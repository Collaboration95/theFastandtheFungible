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
  store: Store; client: PublisherClient; purchases: PurchaseManager; loop: RunLoop
  reputation: Reputation; payer?: XrplPayer; labels: ModeLabels
  mcpPolicy: { maxMinor: number; dailyMinor: number }; publisherUrl: string
  launch: (runId: string, job: () => Promise<void>) => Promise<void>
  progress: (runId: string, label: string) => () => void
  streams: Map<string, Set<Response>>; reportDir: string
  reportJobs: Map<string, Promise<{ format: 'PDF' | 'HTML'; path: string }>>
}
