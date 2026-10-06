import { afterEach } from 'vitest'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import type { WriterCorpus } from '../shared/contracts/writers.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })
export async function serve(writers: WriterCorpus) {
  const app = createPublisherApp({ secret: 's', journal: ':memory:', rail: 'simulated', writers, env: {} })
  await app.locals.ready; await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`
}
