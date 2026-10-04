import type { Store } from '../store.js'
import type { PublisherClient } from '../publisher-client.js'
import type { PurchaseManager } from '../purchases.js'
import type { TraceEvent } from '../../shared/contracts/index.js'
export class RunLoop {
  constructor(readonly store: Store, readonly client: PublisherClient, readonly purchases: PurchaseManager, readonly onEvent?: (event: TraceEvent) => void) {}
  async start(_runId: string): Promise<void> { throw new Error('TODO(W1-DECIDE)') }
  stop(_runId: string): void { throw new Error('TODO(W1-DECIDE)') }
  async retryDelivery(_runId: string, _intentId: string): Promise<void> { throw new Error('TODO(W1-DECIDE)') }
}
