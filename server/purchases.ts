import { scoreStep } from './telemetry.js'
import { startActiveObservation } from '@langfuse/tracing'
import { z } from 'zod'
import { DROPS_PER_MINOR, SIMULATED_LABEL, XRPL_EXPLORER, XRPL_LABEL, type ContentEnvelope, type PublicCandidate, type PurchaseIntent, type Quote } from '../shared/contracts/index.js'
import type { Manifest } from '../shared/contracts/manifest.js'
import { verifyManifestSignature } from '../shared/manifest.js'
import { encodeHeader, invoiceIdFor, ledgerInvoiceId } from '../shared/x402.js'
import type { Store } from './store.js'
import { PublisherClient, PublisherHttpError, type WireObserver } from './publisher-client.js'
import { SimulatedPayer, XrplPayer, type Payer, type Submission } from './xrpl.js'

const xrp = (drops: string) => (Number(drops) / 1_000_000).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
const explorer = (txHash: string) => `${XRPL_EXPLORER}/${txHash}`

/** `manifest` is the candidate's signed manifest from search, when it has one: the invoice must bind its root. */
type Purchase = { runId: string; candidate: PublicCandidate; intentId: string; manifest?: Manifest }

/** Trusted policy-only service: never expose purchase as a browser/LLM command. */
export class PurchaseManager {
  private readonly active = new Map<string, Promise<PurchaseIntent>>()
  private readonly identities = new Map<string, string>()
  /** A delivery that arrived with the settlement, consumed once by deliver(). Bytes never leave the process. */
  private readonly delivered = new Map<string, unknown>()
  readonly payer: Payer
  /** No payer = the SIMULATED rail (deterministic test-only signer, labelled). */
  constructor(readonly store: Store, readonly client: PublisherClient, payer?: Payer) { this.payer = payer ?? new SimulatedPayer() }
  private ledgerEvent(runId: string, label: string, data: Record<string, unknown>): void {
    this.store.appendEvent(runId, { type: 'XRPL', label, data })
  }
  private wire(runId: string): WireObserver {
    return wire => { this.store.appendEvent(runId, { type: 'WIRE', label: `${wire.method} ${wire.path} → ${wire.status}`, data: { method: wire.method, path: wire.path, status: wire.status } }) }
  }
  private once(intentId: string, fn: () => Promise<PurchaseIntent>): Promise<PurchaseIntent> {
    const existing = this.active.get(intentId)
    if (existing) return existing
    const pending = fn().finally(() => { this.active.delete(intentId) })
    this.active.set(intentId, pending)
    return pending
  }
  async purchase(input: Purchase): Promise<PurchaseIntent> {
    const identity = JSON.stringify([input.runId, input.candidate.profileId, input.candidate.resourceId, input.candidate.version, input.candidate.price.amountMinor])
    const activeIdentity = this.identities.get(input.intentId)
    if (activeIdentity && activeIdentity !== identity) throw new Error('Intent identity mismatch')
    const existing = this.store.getIntent(input.intentId)
    if (existing && (existing.runId !== input.runId || existing.profileId !== input.candidate.profileId || existing.resourceId !== input.candidate.resourceId || existing.version !== input.candidate.version || existing.amountMinor !== input.candidate.price.amountMinor)) throw new Error('Intent identity mismatch')
    this.identities.set(input.intentId, identity)
    // Traced as a tool: the 402 / quote / XRPL / verify / grant events nest under it.
    try {
      return await startActiveObservation('buy-source', async observation => {
        observation.update({ input: { resourceId: input.candidate.resourceId, publisher: input.candidate.profileId, priceMinor: input.candidate.price.amountMinor, intentId: input.intentId } })
        const intent = await this.once(input.intentId, () => this.buy(input))
        scoreStep('purchase-outcome', intent.status, intent.error)
        observation.update({ output: { status: intent.status, txHash: intent.txHash, receiptId: intent.receiptId, error: intent.error }, ...(intent.status === 'VERIFIED' ? {} : { level: 'WARNING' as const, statusMessage: intent.error ?? intent.status }) })
        return intent
      }, { asType: 'tool' })
    } finally { this.identities.delete(input.intentId) }
  }
  private async buy({ runId, candidate, intentId, manifest }: Purchase): Promise<PurchaseIntent> {
    let intent = this.store.getIntent(intentId)
    if (!intent) {
      if (candidate.tier !== 'PAID') throw new Error('Purchase requires paid public candidate')
      // The unpaid GET is visible as 402 and carries the x402 v2 terms in PAYMENT-REQUIRED, never a body.
      const paidPath = PublisherClient.paidPath(candidate)
      const first = await this.client.paidGet(paidPath, undefined, this.wire(runId))
      if (first.status === 200) throw new Error('Paid content did not require payment')
      if (first.status !== 402 || !first.required) throw new PublisherHttpError(first.status)
      const accepted = first.required.accepts[0]
      const invoiceId = accepted.extra.invoiceId
      const quoteHash = ledgerInvoiceId(invoiceId)
      const quote: Quote = {
        runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version,
        quoteId: invoiceId, quoteHash, amountMinor: Math.floor(Number(accepted.amount) / DROPS_PER_MINOR), currency: 'SGD',
        expiresAt: new Date(Date.now() + accepted.maxTimeoutSeconds * 1000).toISOString(), contentDigest: invoiceFields(invoiceId)?.manifestRoot ?? '',
        payment: { rail: first.required.resource.description === XRPL_LABEL ? 'xrpl-testnet' : 'simulated', network: accepted.network, asset: accepted.asset, payTo: accepted.payTo, amountDrops: accepted.amount, invoiceId: quoteHash },
      }
      intent = this.store.reserveIntent({ runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version, amountMinor: candidate.price.amountMinor, quote, paidPath, status: 'QUOTED' })
      this.store.appendEvent(runId, { type: 'PURCHASE', label: intent.status, data: { intentId, status: intent.status } })
    }
    if (intent.status === 'RESERVED') {
      // Before anything is signed: the rail, the payee, the amount and the invoice binding must all check out.
      const refusal = this.refusal(intent, candidate, manifest)
      if (refusal) {
        intent = this.store.updateIntent(intentId, { status: 'FAILED_NOT_SETTLED', error: refusal })
        this.store.appendEvent(runId, { type: 'PURCHASE', label: `FAILED_NOT_SETTLED · ${refusal}`, data: { intentId } })
        return intent
      }
    }
    if (intent.status === 'RESERVED' && this.store.claimSubmitting(intentId)) {
      try { await this.payAndSettle(this.store.getIntent(intentId)!) } catch {
        // Every exception after signing is ambiguous, including HTTP errors and
        // malformed responses. A possible charge is never refunded locally.
        intent = this.store.updateIntent(intentId, { error: 'Settlement outcome unknown; reconciliation required' })
        this.store.appendEvent(runId, { type: 'PURCHASE', label: 'SUBMITTING · reconciliation required', data: { intentId } })
        return intent
      }
    }
    intent = this.store.getIntent(intentId)!
    if (['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(intent.status)) return this.deliver(intent)
    return intent
  }
  private refusal(intent: PurchaseIntent, candidate: PublicCandidate, manifest?: Manifest): string | undefined {
    const quote = intent.quote!, terms = quote.payment!
    const bound = invoiceFields(quote.quoteId)
    if (terms.rail !== this.payer.rail) return this.payer.rail === 'xrpl-testnet' ? 'Publisher is not on the XRPL Testnet rail; nothing was charged' : 'Publisher is on the XRPL Testnet but this run is SIMULATED; nothing was charged'
    if (!this.payer.address) return 'XRPL payer is not configured; nothing was charged'
    // The payee must be the publisher wallet in the public metadata the policy evaluated (and in its signed manifest).
    if (!candidate.wallet || terms.payTo !== candidate.wallet || (manifest && manifest.wallet !== terms.payTo)) return 'XRPL payee differs from the publisher wallet; nothing was charged'
    const terms_ = XrplPayer.checkTerms(terms, intent.amountMinor, DROPS_PER_MINOR, quote.quoteHash)
    if (terms_) return terms_
    // Recompute invoiceId instead of trusting the publisher: it must bind this article version, amount, payee and root.
    if (!bound || invoiceIdFor(bound) !== quote.quoteId || bound.articleId !== intent.resourceId || bound.version !== intent.version || bound.amount !== terms.amountDrops || bound.payTo !== terms.payTo) return 'x402 invoiceId does not bind this purchase; nothing was charged'
    if (manifest && (!verifyManifestSignature(manifest) || manifest.root !== bound.manifestRoot || manifest.articleId !== intent.resourceId || manifest.version !== intent.version)) return 'x402 invoiceId does not bind the signed manifest; nothing was charged'
    return undefined
  }
  private signatureHeader(intent: PurchaseIntent, submission: Submission): string {
    const quote = intent.quote!, terms = quote.payment!
    return encodeHeader('PAYMENT-SIGNATURE', {
      x402Version: 2, payload: { signedTxBlob: submission.txBlob },
      accepted: { scheme: 'exact', network: terms.network, amount: terms.amountDrops, asset: terms.asset, payTo: terms.payTo, maxTimeoutSeconds: 60, extra: { invoiceId: quote.quoteId, areFeesSponsored: false } },
    })
  }
  private send(intent: PurchaseIntent, submission: Submission): Promise<PaidResult> {
    return this.client.paidGet(intent.paidPath!, this.signatureHeader(intent, submission), this.wire(intent.runId))
  }
  /** Sign once per intent (blob persisted write-once before it leaves), then the facilitator submits it. */
  private async payAndSettle(intent: PurchaseIntent): Promise<void> {
    const terms = intent.quote!.payment!
    const started = Date.now()
    let submission = this.store.getSubmission(intent.intentId)
    let result: PaidResult
    if (!submission) {
      const paid = await this.payer.pay(terms, signed => this.store.recordSubmission(intent.intentId, signed), signed => this.send(intent, signed))
      submission = paid.submission
      this.ledgerEvent(intent.runId, `Signed ${xrp(terms.amountDrops)} XRP → ${terms.payTo} · InvoiceID = sha256(invoiceId) · sent to the publisher's facilitator${terms.rail === 'simulated' ? ' · SIMULATED' : ''}`, { intentId: intent.intentId, txHash: submission.txHash, amountDrops: terms.amountDrops, payTo: terms.payTo, ...(terms.rail === 'xrpl-testnet' ? { explorerUrl: explorer(submission.txHash) } : {}) })
      result = await paid.sent
    } else result = await this.send(intent, submission)
    await this.settleFrom(intent, submission, result)
    if (terms.rail === 'xrpl-testnet') scoreStep('ledger-confirm-seconds', (Date.now() - started) / 1000, submission.txHash)
  }
  /** Records the settlement from PAYMENT-RESPONSE (confirmed on the ledger for XRPL), or proves no charge, or throws (ambiguous). */
  private async settleFrom(intent: PurchaseIntent, submission: Submission, result: PaidResult): Promise<void> {
    const terms = intent.quote!.payment!
    if (result.response?.success && result.response.transaction === submission.txHash) {
      let ledgerIndex: number | undefined
      if (terms.rail === 'xrpl-testnet') {
        // Never trust the publisher's word: the buyer looks the payment up on the ledger itself.
        const outcome = await this.ledgerPayer().waitFor(submission)
        if (outcome.state !== 'success') throw new Error('Publisher reported a payment the ledger does not show')
        ledgerIndex = outcome.ledgerIndex
        this.ledgerEvent(intent.runId, `Validated in ledger ${ledgerIndex} · tesSUCCESS`, { intentId: intent.intentId, txHash: submission.txHash, ledgerIndex, explorerUrl: explorer(submission.txHash) })
      }
      const xrpl = ledgerIndex === undefined ? undefined : { txHash: submission.txHash, ledgerIndex, payer: this.payer.address!, payTo: terms.payTo, amountDrops: terms.amountDrops, explorerUrl: explorer(submission.txHash) }
      this.store.recordSettlement(intent.intentId, { receiptId: `x402-${submission.txHash}`, intentId: intent.intentId, runId: intent.runId, resourceId: intent.resourceId, version: intent.version, amountMinor: intent.amountMinor, currency: 'SGD', settledAt: new Date().toISOString(), label: xrpl ? XRPL_LABEL : SIMULATED_LABEL, ...(xrpl ? { xrpl } : {}) }, submission.txHash)
      this.ledgerEvent(intent.runId, `Publisher ${xrpl ? 'verified the payment on the ledger' : 'settled the SIMULATED payment'} and issued a receipt`, { intentId: intent.intentId, txHash: submission.txHash })
      // A failed delivery in the paying exchange surfaces as DELIVERY_FAILED; retryDelivery resends the blob.
      this.delivered.set(intent.intentId, result.status === 200 ? result.delivery : DELIVERY_FAILED)
      return
    }
    if (result.status === 402 && result.response?.success === false) {
      if (terms.rail === 'simulated') {
        // On the simulated rail the publisher journal is the ledger: a refusal for this blob means no charge.
        const reason = `Publisher refused the SIMULATED payment (${result.response.errorReason ?? 'no reason'}); nothing was charged`
        this.store.failSubmission(intent.intentId, reason)
        this.ledgerEvent(intent.runId, reason, { intentId: intent.intentId, txHash: submission.txHash })
        return
      }
      if (await this.releaseIfLedgerProvesNoCharge(intent, submission)) return
    }
    throw new Error('Settlement outcome unknown')
  }
  /** XRPL: only the ledger can prove that a signed payment never applied (failed, or expired past LastLedgerSequence). */
  private async releaseIfLedgerProvesNoCharge(intent: PurchaseIntent, submission: Submission): Promise<boolean> {
    const outcome = await this.ledgerPayer().status(submission)
    if (outcome.state !== 'failed' && outcome.state !== 'expired') return false
    const reason = outcome.state === 'failed' ? `XRPL payment failed on ledger (${outcome.result}); amount not delivered` : 'XRPL payment expired before validation; nothing was charged'
    this.store.failSubmission(intent.intentId, reason)
    this.ledgerEvent(intent.runId, reason, { intentId: intent.intentId, txHash: submission.txHash })
    return true
  }
  private ledgerPayer(): XrplPayer {
    if (!(this.payer instanceof XrplPayer)) throw new Error('XRPL ledger unavailable')
    return this.payer
  }
  private async deliver(intent: PurchaseIntent): Promise<PurchaseIntent> {
    try {
      if (this.store.getIntent(intent.intentId)?.status === 'VERIFIED') return this.store.getIntent(intent.intentId)!
      this.store.updateIntent(intent.intentId, { status: 'DELIVERY_PENDING', error: undefined })
      let delivery = this.delivered.get(intent.intentId)
      this.delivered.delete(intent.intentId)
      if (delivery === DELIVERY_FAILED) throw new Error('Delivery failed after settlement')
      if (delivery === undefined) {
        // Retry = resend the same signed blob: the facilitator returns the same delivery, never a new charge.
        const submission = this.store.getSubmission(intent.intentId)
        if (!submission) throw new Error('Missing signed payment')
        const result = await this.send(intent, submission)
        if (result.status !== 200 || result.response?.transaction !== submission.txHash) throw new Error('Delivery failed')
        delivery = result.delivery
      }
      const paid = DeliverySchema.parse(delivery)
      if (paid.articleId !== intent.resourceId || paid.version !== intent.version) throw new Error('Delivery identity mismatch')
      const content: ContentEnvelope = { profileId: intent.profileId, resourceId: intent.resourceId, version: intent.version, title: paid.title, publisher: paid.publisher, body: paid.body, spans: paid.passages }
      this.store.addGrant({ runId: intent.runId, resourceId: intent.resourceId, version: intent.version, intentId: intent.intentId, contentDigest: intent.quote!.contentDigest, grantedAt: new Date().toISOString() }, content, { bytes: JSON.stringify(content), salts: paid.salts })
      this.store.appendEvent(intent.runId, { type: 'GRANT', label: 'manifest root verified', data: { intentId: intent.intentId, resourceId: intent.resourceId, version: intent.version } })
    } catch {
      // Delivery errors preserve the charge and receipt; a retry resends the same blob.
      if (this.store.getIntent(intent.intentId)?.status !== 'VERIFIED') this.store.updateIntent(intent.intentId, { status: 'DELIVERY_FAILED', error: 'Delivery verification failed; retry delivery' })
    }
    return this.store.getIntent(intent.intentId)!
  }
  async retryDelivery(intentId: string): Promise<PurchaseIntent> {
    return this.once(intentId, async () => {
      const intent = this.store.getIntent(intentId)
      if (!intent) throw new Error('Intent not found')
      if (intent.status === 'VERIFIED') return intent
      if (!['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(intent.status)) throw new Error('Intent has no confirmed settlement')
      return this.deliver(intent)
    })
  }
  /** Restart: the stored blob, never a new signature, decides an interrupted purchase. */
  async reconcile(): Promise<void> {
    for (const intent of this.store.listIntents('SUBMITTING')) {
      await this.once(intent.intentId, async () => {
        const submission = this.store.getSubmission(intent.intentId)
        try {
          // Nothing persisted means nothing was ever signed or sent (the blob is stored before it leaves).
          if (!submission) return this.store.failSubmission(intent.intentId, 'No payment was signed before the restart; nothing was charged')
          if (intent.quote?.payment?.rail === 'xrpl-testnet' && await this.releaseIfLedgerProvesNoCharge(intent, submission)) return this.store.getIntent(intent.intentId)!
          await this.settleFrom(intent, submission, await this.send(intent, submission))
          const settled = this.store.getIntent(intent.intentId)!
          return settled.status === 'SETTLED' ? this.deliver(settled) : settled
        } catch { return this.store.updateIntent(intent.intentId, { error: 'Payment awaiting ledger or publisher; reconciliation required' }) }
      })
    }
  }
}

const DELIVERY_FAILED = Symbol('delivery failed')
type PaidResult = Awaited<ReturnType<PublisherClient['paidGet']>>
type InvoiceFields = { quoteId: string; articleId: string; version: string; manifestRoot: string; amount: string; payTo: string }
const DeliverySchema = z.object({ articleId: z.string(), version: z.string(), title: z.string().min(1), publisher: z.string().min(1), body: z.string().min(1), passages: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(1), salts: z.array(z.string()) })
function invoiceFields(invoiceId: string): InvoiceFields | undefined {
  try {
    const value = JSON.parse(invoiceId) as Record<string, unknown>
    const keys = ['quoteId', 'articleId', 'version', 'manifestRoot', 'amount', 'payTo'] as const
    return keys.every(key => typeof value[key] === 'string') ? Object.fromEntries(keys.map(key => [key, value[key]])) as InvoiceFields : undefined
  } catch { return undefined }
}
