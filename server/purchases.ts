import type { PublicCandidate, PurchaseIntent, Settlement } from '../shared/contracts/index.js'
import type { Store } from './store.js'
import { PublisherHttpError, type PublisherClient, type WireObserver } from './publisher-client.js'

/** Trusted policy-only service: never expose purchase as a browser/LLM command. */
export class PurchaseManager {
  private readonly active = new Map<string, Promise<PurchaseIntent>>()
  private readonly identities = new Map<string, string>()
  constructor(readonly store: Store, readonly client: PublisherClient) {}
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
    if (intent.status === 'RESERVED' && this.store.claimSubmitting(intentId)) {
      try {
        const settlement = await this.client.settle(intent.quote!, this.wire(runId))
        this.record(intent, settlement)
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
  private record(intent: PurchaseIntent, settlement: Settlement): void {
    if (settlement.status !== 'SETTLED' || !settlement.receiptId || !settlement.deliveryToken) throw new Error('Incomplete settlement response')
    this.store.recordSettlement(intent.intentId, { receiptId: settlement.receiptId, intentId: intent.intentId, runId: intent.runId, resourceId: intent.resourceId, version: intent.version, amountMinor: intent.amountMinor, currency: 'SGD', settledAt: new Date().toISOString(), label: 'SIMULATED SGD · no real funds' }, settlement.deliveryToken)
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
}
