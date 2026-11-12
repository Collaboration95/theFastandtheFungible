import type { ActiveWork } from '../agents/active-work.js'
import type { Response } from 'express'
import type { ModeLabels } from '../../shared/contracts/run.js'
import type { Store } from '../store.js'
import type { PublisherClient } from '../publisher-client.js'
import type { PurchaseManager } from '../purchases.js'
import type { RunLoop } from '../agents/loop.js'
import type { Reputation } from '../reputation.js'
import type { XrplPayer } from '../xrpl.js'

/** The engine owns these services; surface routers only register existing handlers. */
export type ApiContext = {
  wallets?: ReturnType<typeof import('../delegated-wallet.js').delegatedWallets>;
  work: ActiveWork;
  store: Store; client: PublisherClient; purchases: PurchaseManager; loop: RunLoop
  reputation: Reputation; payer?: XrplPayer; labels: ModeLabels
  mcpPolicy: { maxMinor: number; dailyMinor: number }; publisherUrl: string
  launch: (runId: string, job: () => Promise<void>, release?: () => void) => Promise<void>
  trackWork?: (job: Promise<unknown>) => void
  progress: (runId: string, label: string) => () => void
  sseGzip?: boolean; onStreamOpen?: (runId: string) => void;
  streams: Map<string, Set<Response>>; onStreamEmpty?: (runId: string) => void; reportDir: string
  reportJobs: Map<string, Promise<{ format: 'PDF' | 'HTML'; path: string }>>
}
