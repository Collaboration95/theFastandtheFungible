import { DROPS_PER_MINOR, SIMULATED_LABEL, XRPL_EXPLORER, XRPL_LABEL, type PublicCandidate, type PurchaseIntent, type Settlement } from '../shared/contracts/index.js'
import type { Store } from './store.js'
import { PublisherHttpError, type PublisherClient, type WireObserver } from './publisher-client.js'
import { XrplPayer, type Submission } from './xrpl.js'

const xrp = (drops: string) => (Number(drops) / 1_000_000).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
const explorer = (txHash: string) => `${XRPL_EXPLORER}/${txHash}`

/** Trusted policy-only service: never expose purchase as a browser/LLM command. */
export class PurchaseManager {
  private readonly active = new Map<string, Promise<PurchaseIntent>>()
  private readonly identities = new Map<string, string>()
  constructor(readonly store: Store, readonly client: PublisherClient, readonly payer?: XrplPayer) {}
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
  async purchase(input: { runId: string; candidate: PublicCandidate; intentId: string }): Promise<PurchaseIntent> {
    const identity = JSON.stringify([input.runId, input.candidate.profileId, input.candidate.resourceId, input.candidate.version, input.candidate.price.amountMinor])
    const activeIdentity = this.identities.get(input.intentId)
    if (activeIdentity && activeIdentity !== identity) throw new Error('Intent identity mismatch')
    const existing = this.store.getIntent(input.intentId)
    if (existing && (existing.runId !== input.runId || existing.profileId !== input.candidate.profileId || existing.resourceId !== input.candidate.resourceId || existing.version !== input.candidate.version || existing.amountMinor !== input.candidate.price.amountMinor)) throw new Error('Intent identity mismatch')
    this.identities.set(input.intentId, identity)
    try { return await this.once(input.intentId, () => this.buy(input)) }
    finally { this.identities.delete(input.intentId) }
  }
  private async buy({ runId, candidate, intentId }: { runId: string; candidate: PublicCandidate; intentId: string }): Promise<PurchaseIntent> {
    let intent = this.store.getIntent(intentId)
    if (!intent) {
      if (candidate.tier !== 'PAID') throw new Error('Purchase requires paid public candidate')
      // The initial unpaid GET is visible as 402, without ever exposing a body.
      try { await this.client.read(candidate, undefined, this.wire(runId)); throw new Error('Paid content did not require payment') }
      catch (error) { if (!(error instanceof PublisherHttpError) || error.status !== 402) throw error }
      const quote = await this.client.quote({ runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version }, this.wire(runId))
      intent = this.store.reserveIntent({ runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version, amountMinor: candidate.price.amountMinor, quote, status: 'QUOTED' })
      this.store.appendEvent(runId, { type: 'PURCHASE', label: intent.status, data: { intentId, status: intent.status } })
    }
    const terms = intent.quote?.payment
    if (intent.status === 'RESERVED' && terms) {
      // Policy-approved price must equal the ledger amount before anything is signed.
      const refusal = !this.payer?.address ? 'XRPL payer is not configured; nothing was charged' : XrplPayer.checkTerms(terms, intent.amountMinor, DROPS_PER_MINOR, intent.quote!.quoteHash)
      if (refusal) {
        intent = this.store.updateIntent(intentId, { status: 'FAILED_NOT_SETTLED', error: refusal })
        this.store.appendEvent(runId, { type: 'PURCHASE', label: `FAILED_NOT_SETTLED · ${refusal}`, data: { intentId } })
        return intent
      }
    }
    if (intent.status === 'RESERVED' && this.store.claimSubmitting(intentId)) {
      try {
        const settlement = terms ? await this.payOnLedger(intent) : await this.client.settle(intent.quote!, this.wire(runId))
        if (settlement) this.record(intent, settlement)
      } catch {
        // Every exception after submission is ambiguous, including HTTP errors
        // and malformed responses. A possible charge is never refunded locally.
        intent = this.store.updateIntent(intentId, { error: 'Settlement outcome unknown; reconciliation required' })
        this.store.appendEvent(runId, { type: 'PURCHASE', label: 'SUBMITTING · reconciliation required', data: { intentId } })
        return intent
      }
    }
    intent = this.store.getIntent(intentId)!
    if (['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(intent.status)) return this.deliver(intent)
    return intent
  }
  /** Sign once per intent (hash persisted before submit), wait for ledger close, then ask the publisher to verify. */
  private async payOnLedger(intent: PurchaseIntent): Promise<Settlement | undefined> {
    const terms = intent.quote!.payment!
    let submission = this.store.getSubmission(intent.intentId)
    if (!submission) {
      const paid = await this.payer!.pay(terms, signed => this.store.recordSubmission(intent.intentId, signed))
      submission = paid.submission
      this.ledgerEvent(intent.runId, `Signed ${xrp(terms.amountDrops)} XRP → ${terms.payTo} · InvoiceID = quote hash · submitted (${paid.engineResult}), waiting for ledger close`, { intentId: intent.intentId, txHash: submission.txHash, amountDrops: terms.amountDrops, payTo: terms.payTo, explorerUrl: explorer(submission.txHash) })
    }
    return this.confirm(intent, submission, true)
  }
  private async confirm(intent: PurchaseIntent, submission: Submission, wait: boolean): Promise<Settlement | undefined> {
    const outcome = wait ? await this.payer!.waitFor(submission) : await this.payer!.status(submission)
    if (outcome.state === 'failed' || outcome.state === 'expired') {
      // The ledger proves this payment can never apply, so the reservation is released.
      const reason = outcome.state === 'failed' ? `XRPL payment failed on ledger (${outcome.result}); amount not delivered` : 'XRPL payment expired before validation; nothing was charged'
      this.store.failSubmission(intent.intentId, reason)
      this.ledgerEvent(intent.runId, reason, { intentId: intent.intentId, txHash: submission.txHash })
      return undefined
    }
    if (outcome.state === 'pending') throw new Error('XRPL payment not validated yet')
    this.ledgerEvent(intent.runId, `Validated in ledger ${outcome.ledgerIndex} · tesSUCCESS`, { intentId: intent.intentId, txHash: submission.txHash, ledgerIndex: outcome.ledgerIndex, explorerUrl: explorer(submission.txHash) })
    for (let attempt = 0; attempt < 10; attempt++) {
      const settlement = await this.client.settle(intent.quote!, this.wire(intent.runId), submission.txHash)
      if (settlement.status === 'SETTLED') {
        if (settlement.ledger?.txHash !== submission.txHash) throw new Error('Publisher receipt names a different payment')
        this.ledgerEvent(intent.runId, 'Publisher verified the payment on the ledger and issued a receipt', { intentId: intent.intentId, txHash: submission.txHash })
        return settlement
      }
      await new Promise(resolve => setTimeout(resolve, 1000)) // Publisher's node may lag by a ledger.
    }
    throw new Error('Publisher has not verified the payment yet')
  }
  private record(intent: PurchaseIntent, settlement: Settlement): void {
    if (settlement.status !== 'SETTLED' || !settlement.receiptId || !settlement.deliveryToken) throw new Error('Incomplete settlement response')
    if (intent.quote?.payment && !settlement.ledger) throw new Error('XRPL settlement requires a ledger proof')
    const ledger = settlement.ledger
    this.store.recordSettlement(intent.intentId, { receiptId: settlement.receiptId, intentId: intent.intentId, runId: intent.runId, resourceId: intent.resourceId, version: intent.version, amountMinor: intent.amountMinor, currency: 'SGD', settledAt: new Date().toISOString(), label: ledger ? XRPL_LABEL : SIMULATED_LABEL, ...(ledger ? { xrpl: { ...ledger, explorerUrl: explorer(ledger.txHash) } } : {}) }, settlement.deliveryToken)
  }
  private async deliver(intent: PurchaseIntent): Promise<PurchaseIntent> {
    try {
      if (this.store.getIntent(intent.intentId)?.status === 'VERIFIED') return this.store.getIntent(intent.intentId)!
      this.store.updateIntent(intent.intentId, { status: 'DELIVERY_PENDING', error: undefined })
      const token = this.store.getDeliveryToken(intent.intentId)
      if (!token) throw new Error('Missing private delivery token')
      // read only needs the candidate's identity; preserve the public client API.
      const candidate = { profileId: intent.profileId, resourceId: intent.resourceId, version: intent.version } as PublicCandidate
      const response = await this.client.read(candidate, token, this.wire(intent.runId))
      this.store.addGrant({ runId: intent.runId, resourceId: intent.resourceId, version: intent.version, intentId: intent.intentId, contentDigest: intent.quote!.contentDigest, grantedAt: new Date().toISOString() }, response.content, { bytes: response.rawBytes ?? response.bytes, digest: response.digest })
      this.store.appendEvent(intent.runId, { type: 'GRANT', label: 'sha-256 verified', data: { intentId: intent.intentId, resourceId: intent.resourceId, version: intent.version } })
    } catch {
      // Delivery errors preserve the charge, receipt and token for a pure GET retry.
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
  async reconcile(): Promise<void> {
    for (const intent of this.store.listIntents('SUBMITTING')) {
      await this.once(intent.intentId, async () => {
        if (intent.quote?.payment) return this.reconcileLedger(intent)
        try {
          const settlement = await this.client.settlement(intent.intentId, this.wire(intent.runId))
          if (settlement.status === 'SETTLED') { this.record(intent, settlement); return this.deliver(this.store.getIntent(intent.intentId)!) }
          // NOT_FOUND can race an in-flight POST. Keep the reservation, and never
          // issue another settlement until the publisher resolves that intent.
          this.store.updateIntent(intent.intentId, { error: 'Settlement not yet found; reconciliation required' })
        } catch { this.store.updateIntent(intent.intentId, { error: 'Settlement status unavailable; reconciliation required' }) }
        return this.store.getIntent(intent.intentId)!
      })
    }
  }
  /** Restart: the stored hash, never a new signature, decides an interrupted XRPL purchase. */
  private async reconcileLedger(intent: PurchaseIntent): Promise<PurchaseIntent> {
    const submission = this.store.getSubmission(intent.intentId)
    try {
      // Nothing persisted means nothing was ever submitted (the hash is stored before submit).
      if (!submission) return this.store.failSubmission(intent.intentId, 'No XRPL payment was submitted before the restart; nothing was charged')
      if (!this.payer) return this.store.updateIntent(intent.intentId, { error: 'XRPL ledger unavailable; reconciliation required' })
      await this.payer.submit(submission.txBlob) // Same blob, same hash: safe if it never reached the network.
      const settlement = await this.confirm(intent, submission, false)
      if (settlement) { this.record(intent, settlement); return this.deliver(this.store.getIntent(intent.intentId)!) }
    } catch { this.store.updateIntent(intent.intentId, { error: 'XRPL payment awaiting ledger or publisher; reconciliation required' }) }
    return this.store.getIntent(intent.intentId)!
  }
}
