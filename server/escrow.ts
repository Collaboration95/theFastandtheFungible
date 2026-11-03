// Trusted policy purchase path. Bytes are quarantined until proof AND validated finish.
import { decode } from 'xrpl'
import { z } from 'zod'
import { EscrowQuoteSchema } from '../shared/contracts/escrow.js'
import { DROPS_PER_MINOR, type PublicCandidate, type PurchaseIntent } from '../shared/contracts/index.js'
import { verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'
import { escrowInvoice, escrowMemo, fulfillmentFor, ledgerTime, matchesCreate, newHashlock, verifyEscrowQuote } from '../shared/escrow.js'
import { encodeHeader, ledgerInvoiceId } from '../shared/x402.js'
import { lookupTx } from '../shared/xrpl.js'
import { Reputation } from './reputation.js'
import { payeeRefusal } from './payee-screening.js'
import type { Store } from './store.js'
import { PublisherClient } from './publisher-client.js'
import { XrplPayer, FEE_CAP_DROPS } from './xrpl.js'
import type { EscrowOperation } from './escrow-state.js'

export function escrowSelected(store: Store, runId: string, c: PublicCandidate, optIn?: boolean): boolean {
  const opted = optIn ?? (store.getRun(runId).checkpoint.escrow as boolean | undefined ?? (process.env.ESCROW_WRITERS ?? '').split(',').includes(c.profileId))
  const rep = c.wallet ? store.getReputation(c.wallet) : undefined
  return opted && (!rep || rep.passes === 0 || rep.T < 0.8)
}
export class EscrowPurchases {
  constructor(private store: Store, private client: PublisherClient, private payer: XrplPayer) {}
  async purchase(runId: string, candidate: PublicCandidate, intentId: string): Promise<PurchaseIntent> {
    if (!this.store.getIntent(intentId)) {
      const manifest = candidate.manifest, rep = candidate.wallet ? this.store.getReputation(candidate.wallet) : undefined
      if (candidate.tier !== 'PAID' || !manifest || !verifyManifestSignature(manifest) || manifest.articleId !== candidate.resourceId || manifest.version !== candidate.version || manifest.publisherSlug !== candidate.profileId || manifest.priceMinor !== candidate.price.amountMinor || manifest.wallet !== candidate.wallet || payeeRefusal(candidate.wallet ?? '')) throw new Error('Escrow candidate is ineligible')
      if (rep && rep.status !== 'active') return this.store.skipEscrow({ source: candidate.source, runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version, amountMinor: candidate.price.amountMinor, status: 'SKIPPED' }, 'Writer quarantined or delisted')
      const hashlock = newHashlock(), cancelAfter = await ledgerTime(this.payer.ledger) + 120
      const paidPath = PublisherClient.paidPath(candidate)
      let quote
      try { quote = EscrowQuoteSchema.parse(await this.client.forSource(candidate.source).escrowQuote(paidPath, { payer: this.payer.address!, intentId, condition: hashlock.condition, cancelAfter })) }
      catch { return this.store.skipEscrow({ source: candidate.source, runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version, amountMinor: candidate.price.amountMinor, status: 'SKIPPED' }, 'Writer escrow unavailable; no paid fallback') }
      const t = quote.terms
      if (!verifyEscrowQuote(quote) || t.network !== 'xrpl:1' || t.asset !== 'XRP' || t.payer !== this.payer.address || t.payTo !== candidate.wallet || t.intentId !== intentId || t.condition !== hashlock.condition || t.cancelAfter !== cancelAfter || t.articleId !== candidate.resourceId || t.version !== candidate.version || t.publisherSlug !== candidate.profileId || t.manifestRoot !== manifest.root || t.amount !== String(candidate.price.amountMinor * DROPS_PER_MINOR)) throw new Error('Escrow quote binding rejected')
      const invoice = escrowInvoice(t)
      const intent = this.store.reserveIntent({ source: candidate.source, runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version, amountMinor: candidate.price.amountMinor, status: 'QUOTED', paidPath,
        quote: { source: candidate.source, runId, intentId, profileId: candidate.profileId, resourceId: candidate.resourceId, version: candidate.version, quoteId: invoice, quoteHash: ledgerInvoiceId(invoice), amountMinor: candidate.price.amountMinor, currency: 'SGD', contentDigest: manifest.root, expiresAt: new Date(Date.now() + 60000).toISOString(), payment: { rail: 'xrpl-testnet', network: 'xrpl:1', asset: 'XRP', amountDrops: t.amount, payTo: t.payTo, invoiceId: ledgerInvoiceId(invoice) } } })
      if (intent.status !== 'RESERVED') return intent
      this.store.recordManifest(intentId, manifest)
      if (!this.store.claimSubmitting(intentId)) return this.store.getIntent(intentId)!
      this.store.prepareEscrow({ intentId, secret: hashlock.secret, quote, publicStatus: { scheme: 'escrow-v1', policy: 'escrow-policy-v1', state: 'PREPARED', owner: t.payer, cancelAfter } })
    }
    return this.advance(intentId)
  }
  private recordFailedProof(intent: PurchaseIntent) {
    if (intent.escrow?.proofOk !== false || !this.store.getRun(intent.runId).events.some(e => e.type === 'PROOF' && e.data?.intentId === intent.intentId && e.data?.ok === false)) return
    const run = this.store.getRun(intent.runId)
    const recorded = Array.isArray(run.checkpoint.trustRecorded) ? run.checkpoint.trustRecorded as string[] : []
    if (recorded.includes(intent.intentId)) return
    const manifest = this.store.getManifest(intent.intentId)!
    new Reputation(this.store).recordProof({ publisherSlug: intent.profileId, wallet: manifest.wallet, outcome: 'REJECTED', runId: intent.runId, claimed: manifest.relevance })
    this.store.updateRun(intent.runId, { checkpoint: { ...this.store.getRun(intent.runId).checkpoint, trustRecorded: [...recorded, intent.intentId] } })
  }
  private terminalFeeHolds(intentId: string) {
    return this.store.listIntents('SUBMITTING').filter(i => i.intentId !== intentId && i.escrow).length * FEE_CAP_DROPS
  }
  private event(intent: PurchaseIntent, op: EscrowOperation, hash: string, ledgerIndex: number) {
    const e = this.store.getEscrow(intent.intentId)!
    this.store.appendEvent(intent.runId, { type: `ESCROW_${op.toUpperCase()}`, label: `Escrow ${op} validated`, data: { intentId: intent.intentId, txHash: hash, ledgerIndex, owner: e.publicStatus.owner, createSequence: e.publicStatus.createSequence, result: 'tesSUCCESS', scheme: 'escrow-v1' } })
  }
  /** A revealed fulfillment can be relayed by another account. Object absence alone proves no winner. */
  private async reconcileObject(intent: PurchaseIntent): Promise<boolean> {
    const e = this.store.getEscrow(intent.intentId)!, t = e.quote.terms
    let object
    try {
      object = (await this.payer.ledger.request({ command: 'ledger_entry', escrow: { owner: t.payer, seq: e.publicStatus.createSequence }, ledger_index: 'validated' })).result.node
    } catch (error) {
      if (!['entryNotFound', 'objectNotFound'].includes((error as { data?: { error?: string } }).data?.error ?? '')) throw error
    }
    if (object) {
      if (object.Account !== t.payer || object.Destination !== t.payTo || object.Amount !== t.amount || object.Condition !== t.condition || object.CancelAfter !== t.cancelAfter) throw new Error('Escrow object differs from quote')
      return false
    }
    const create = await lookupTx(this.payer.ledger, e.publicStatus.createHash!)
    if (create.state !== 'validated') throw new Error('Escrow history unavailable')
    let marker: unknown
    // Bounded recovery scan. Incomplete history is pending, never a presumed refund.
    for (let page = 0; page < 4; page++) {
      const { result } = await this.payer.ledger.request({ command: 'account_tx', api_version: 2, account: t.payer, ledger_index_min: create.ledgerIndex, ledger_index_max: -1, binary: false, forward: false, limit: 100, ...(marker ? { marker } : {}) })
      for (const entry of result.transactions ?? []) {
        const hash = entry.hash ?? entry.tx_json?.hash ?? entry.tx?.hash
        const tx = entry.tx_json ?? entry.tx
        if (!hash || tx?.Owner !== t.payer || Number(tx?.OfferSequence) !== e.publicStatus.createSequence || !['EscrowFinish', 'EscrowCancel'].includes(tx?.TransactionType)) continue
        const found = await lookupTx(this.payer.ledger, hash)
        if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS' || found.tx.Owner !== t.payer || Number(found.tx.OfferSequence) !== e.publicStatus.createSequence) continue
        const op = found.tx.TransactionType === 'EscrowFinish' ? 'finish' : found.tx.TransactionType === 'EscrowCancel' ? 'cancel' : undefined
        if (!op || op === 'finish' && (found.tx.Condition !== t.condition || found.tx.Fulfillment !== fulfillmentFor(e.secret))) continue
        this.store.completeEscrow(intent.intentId, op, found.ledgerIndex, hash)
        this.event(intent, op, hash, found.ledgerIndex)
        if (op === 'finish') this.store.appendEvent(intent.runId, { type: 'GRANT', label: 'Proof verified and relayed escrow release validated', data: { intentId: intent.intentId, resourceId: intent.resourceId, version: intent.version } })
        return true
      }
      marker = result.marker
      if (!marker) break
    }
    throw new Error('Escrow object absent; validated terminal history required')
  }
  /** Re-submit only the persisted blob. Expired terminal signatures can be replaced for the SAME object. */
  private async terminal(intent: PurchaseIntent, op: 'finish' | 'cancel') {
    const e = this.store.getEscrow(intent.intentId)!
    if (await this.reconcileObject(intent)) return
    let tx = this.store.escrowOutbox(intent.intentId).find(t => t.operation === op)
    if (tx) {
      const status = await this.payer.status(tx)
      if (status.state === 'failed' || status.state === 'expired') {
        this.store.retireEscrowTerminal(intent.intentId, op)
        tx = undefined
        if (op === 'finish') { this.store.escrowTransition(intent.intentId, { state: 'CANCEL_DUE' }); return }
      }
    }
    if (!tx) {
      const now = await ledgerTime(this.payer.ledger)
      if (op === 'finish' && (e.publicStatus.state !== 'VERIFIED_FOR_RELEASE' || now >= e.publicStatus.cancelAfter - 15)) { this.store.escrowTransition(intent.intentId, { state: 'CANCEL_DUE' }); return }
      if (op === 'cancel' && now <= e.publicStatus.cancelAfter) return
      const common = { Owner: e.publicStatus.owner, OfferSequence: e.publicStatus.createSequence! }
      const sent = await this.payer.escrow(op === 'finish' ? { TransactionType: 'EscrowFinish', ...common, Condition: e.quote.terms.condition, Fulfillment: fulfillmentFor(e.secret) } : { TransactionType: 'EscrowCancel', ...common }, 0,
        s => this.store.recordEscrowSubmission(intent.intentId, op, s), async s => { try { await this.payer.ledger.request({ command: 'submit', tx_blob: s.txBlob }) } catch { /* reconcile hash */ } }, async () => { if (op === 'finish' && await ledgerTime(this.payer.ledger) >= e.publicStatus.cancelAfter - 15) throw new Error('Finish window closed') }, () => this.terminalFeeHolds(intent.intentId))
      await sent.sent
      tx = { ...sent.submission, intentId: intent.intentId, operation: op }
    } else {
      try { await this.payer.ledger.request({ command: 'submit', tx_blob: tx.txBlob }) } catch { /* hash decides */ }
    }
    const result = await this.payer.waitFor(tx)
    if (result.state === 'success') {
      // The signed outbox fixes operation, owner and object; successful validation proves its terminal branch.
      this.store.completeEscrow(intent.intentId, op, result.ledgerIndex)
      this.event(intent, op, tx.txHash, result.ledgerIndex)
      if (op === 'finish') this.store.appendEvent(intent.runId, { type: 'GRANT', label: 'Proof verified and escrow released', data: { intentId: intent.intentId, resourceId: intent.resourceId, version: intent.version } })
    }
  }
  async advance(intentId: string): Promise<PurchaseIntent> {
    const intent = this.store.getIntent(intentId)!
    let e = this.store.getEscrow(intentId)
    if (e) this.recordFailedProof(intent)
    if (!e || intent.status !== 'SUBMITTING' || ['RELEASED', 'CANCELLED'].includes(e.publicStatus.state)) return intent
    try {
      let create = this.store.escrowOutbox(intentId).find(t => t.operation === 'create')
      if (!create) {
        if (this.store.isPaused() || this.store.getRun(intent.runId).stopped || await ledgerTime(this.payer.ledger) >= e.quote.terms.cancelAfter - 15) return this.store.failSubmission(intentId, 'Escrow not signed before stop or expiry')
        const t = e.quote.terms
        const sent = await this.payer.escrow({ TransactionType: 'EscrowCreate', Destination: t.payTo, Amount: t.amount, Condition: t.condition, CancelAfter: t.cancelAfter, Memos: escrowMemo(t) }, Number(t.amount),
          s => this.store.recordEscrowSubmission(intentId, 'create', s), async s => { try { await this.payer.ledger.request({ command: 'submit', tx_blob: s.txBlob }) } catch { /* hash decides */ } }, undefined, () => this.terminalFeeHolds(intentId))
        await sent.sent
        create = { ...sent.submission, intentId, operation: 'create' }
      }
      if (e.publicStatus.state === 'PREPARED') {
        let status = await this.payer.status(create)
        if (status.state === 'pending') {
          try { await this.payer.ledger.request({ command: 'submit', tx_blob: create.txBlob }) } catch { /* hash decides */ }
          status = await this.payer.waitFor(create)
        }
        if (status.state === 'failed' || status.state === 'expired') return this.store.failSubmission(intentId, 'Escrow create ledger-proven not applied; no principal paid')
        if (status.state !== 'success') return this.store.getIntent(intentId)!
        const found = await lookupTx(this.payer.ledger, create.txHash)
        if (found.state !== 'validated' || !matchesCreate(found.tx, e.quote.terms)) throw new Error('Create mismatch')
        e = this.store.escrowTransition(intentId, { state: 'LOCKED', createHash: create.txHash, createSequence: Number(decode(create.txBlob).Sequence) }, status.ledgerIndex)
        this.event(intent, 'create', create.txHash, status.ledgerIndex)
      }
      // Reconcile an escaped finish before considering Stop/expiry/cancellation.
      if (this.store.escrowOutbox(intentId).some(t => t.operation === 'finish')) { await this.terminal(intent, 'finish'); return this.store.getIntent(intentId)! }
      const now = await ledgerTime(this.payer.ledger)
      if (this.store.getRun(intent.runId).stopped || this.store.isPaused() || now >= e.publicStatus.cancelAfter - 15) e = this.store.escrowTransition(intentId, { state: 'CANCEL_DUE' })
      if (e.publicStatus.state === 'LOCKED') {
        try {
          const result = await this.client.forSource(intent.source, true).paidGet(intent.paidPath!, encodeHeader('PAYMENT-SIGNATURE', { x402Version: 2, accepted: { scheme: 'escrow-v1', network: 'xrpl:1', asset: 'XRP', amount: e.quote.terms.amount, payTo: e.quote.terms.payTo, maxTimeoutSeconds: 120, extra: { invoiceId: escrowInvoice(e.quote.terms), areFeesSponsored: false } }, payload: { signedTxBlob: create.txBlob } }))
          if (result.status !== 200 || result.response?.escrowState !== 'LOCKED' || result.response.transaction !== create.txHash || result.response.success) throw new Error('Conditional grant missing')
          const d = Delivery.parse(result.delivery)
          if (d.grant.state !== 'LOCKED' || d.grant.createHash !== create.txHash || d.grant.manifestRoot !== e.quote.terms.manifestRoot || d.grant.articleId !== intent.resourceId || d.grant.version !== intent.version || d.articleId !== intent.resourceId || d.version !== intent.version) throw new Error('Grant identity mismatch')
          const content = { source: intent.source, profileId: intent.profileId, resourceId: intent.resourceId, version: intent.version, title: d.title, publisher: d.publisher, body: d.body, spans: d.passages }
          this.store.addGrant({ source: intent.source, intentId, runId: intent.runId, resourceId: intent.resourceId, version: intent.version, contentDigest: e.quote.terms.manifestRoot, grantedAt: new Date().toISOString() }, content, { bytes: JSON.stringify(content), salts: d.salts })
          const m = this.store.getManifest(intentId)!
          const proof = verifyManifestSignature(m) && m.root === e.quote.terms.manifestRoot && verifyDelivery(d.body, d.passages, d.salts, m).ok
          e = this.store.escrowTransition(intentId, { state: proof ? 'VERIFIED_FOR_RELEASE' : 'CANCEL_DUE', proofOk: proof })
          this.store.appendEvent(intent.runId, { type: 'PROOF', label: proof ? 'Escrow proof passed; awaiting release' : 'Escrow proof failed; cancellation due', data: { intentId, ok: proof, scheme: 'escrow-v1' } })
          this.recordFailedProof(this.store.getIntent(intentId)!)
        } catch { e = this.store.escrowTransition(intentId, { state: 'CANCEL_DUE', proofOk: false }) }
      }
      if (e.publicStatus.state === 'VERIFIED_FOR_RELEASE') await this.terminal(intent, 'finish')
      else if (e.publicStatus.state === 'CANCEL_DUE') await this.terminal(intent, 'cancel')
    } catch {
      // Missing create blob is definitive: no network submission was possible. Otherwise retain authority.
      if (!this.store.escrowOutbox(intentId).length) return this.store.failSubmission(intentId, 'Escrow could not be signed; nothing was charged')
      if (this.store.getIntent(intentId)?.status === 'SUBMITTING') this.store.updateIntent(intentId, { error: 'Escrow awaiting reconciliation; same intent retained' })
    }
    return this.store.getIntent(intentId)!
  }
}
const Delivery = z.object({ articleId: z.string(), version: z.string(), title: z.string(), publisher: z.string(), body: z.string(), passages: z.array(z.object({ id: z.string(), text: z.string() })), salts: z.array(z.string()), grant: z.object({ state: z.literal('LOCKED'), createHash: z.string(), manifestRoot: z.string(), articleId: z.string(), version: z.string() }) })
