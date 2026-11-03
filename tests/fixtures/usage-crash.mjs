import { Store } from '../../server/store.ts'
import { legacyUsage } from './legacy-usage.ts'
const [path, oracle] = process.argv.slice(2)
const s = new Store(path)
if (oracle === 'true') s.usage = legacyUsage
const run = s.createMcpRun('synthetic crash', 200, 'crash', { maxMinor: 200, dailyMinor: 300 }).run
const identity = { runId: run.runId, intentId: 'crash-payment', profileId: 'writer', resourceId: 'article', version: 'v1', amountMinor: 90 }
s.reserveIntent({ ...identity, status: 'QUOTED', quote: { ...identity, quoteId: 'quote', quoteHash: 'hash', currency: 'SGD', expiresAt: '2099-01-01T00:00:00Z', contentDigest: 'digest' } })
s.claimSubmitting(identity.intentId)
// Abrupt process death: no Store.close, engine shutdown or settlement.
process.kill(process.pid, 'SIGKILL')
