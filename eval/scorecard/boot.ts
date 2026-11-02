// Dedicated child: all fixture boot configuration precedes imports; no .env loading.
import { once } from 'node:events'
import { join } from 'node:path'
import { createPublisherApp } from '../../publisher/routes.js'
import { createApiApp } from '../../server/routes.js'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import { FixtureDecisionProvider } from '../../server/agents/decision.js'
import { productionProvider } from '../decisions/providers/production.js'
import { enableLive } from '../decisions/transport.js'

const dir = process.argv[2], live = process.argv.includes('--live')
if (live) enableLive()
const publisher = createPublisherApp({ writers: await loadWriterCorpus(undefined, { allowMini: false }), journal: join(dir, 'publisher.db'), secret: 'scorecard-local-fixture', rail: 'simulated', env: {} })
await publisher.locals.ready
const ps = publisher.listen(0, '127.0.0.1')
await once(ps, 'listening')
const publisherUrl = `http://127.0.0.1:${(ps.address() as { port: number }).port}`
const api = await createApiApp({ dbPath: join(dir, 'api.db'), publisherUrl, secret: 'scorecard-local-fixture', reportDir: join(dir, 'reports'), provider: live ? productionProvider({ phase: 'latency' }) : new FixtureDecisionProvider() })
const server = api.app.listen(0, '127.0.0.1')
await once(server, 'listening')
console.log(JSON.stringify({ base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, publisher: publisherUrl }))
process.on('SIGTERM', () => { server.closeAllConnections(); ps.closeAllConnections(); server.close(() => { api.close(); ps.close(() => { publisher.locals.journal.close(); process.exit(0) }) }) })
