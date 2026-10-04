import type { PublicCandidate, PurchaseIntent } from '../shared/contracts/index.js'
import type { Store } from './store.js'
import type { PublisherClient } from './publisher-client.js'
export class PurchaseManager {
  constructor(readonly store: Store, readonly client: PublisherClient) {}
  async purchase(_input: { runId: string; candidate: PublicCandidate; intentId: string }): Promise<PurchaseIntent> { throw new Error('TODO(W1-LEDGER)') }
  async retryDelivery(_intentId: string): Promise<PurchaseIntent> { throw new Error('TODO(W1-LEDGER)') }
  async reconcile(): Promise<void> { throw new Error('TODO(W1-LEDGER)') }
}
