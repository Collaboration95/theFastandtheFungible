import 'dotenv/config'
import { resolve } from 'node:path'
import { once } from 'node:events'
import { pathToFileURL } from 'node:url'
import { createPublisherApp } from './routes.js'
export { createPublisherApp } from './routes.js'

export async function startPublisher() {
  const port = Number(process.env.PUBLISHER_PORT ?? process.env.PORT ?? 8790)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid publisher port')
  const app = createPublisherApp()
  try { await app.locals.ready } catch (error) { app.locals.journal.close(); throw error }
  const server = app.listen(port, '0.0.0.0')
  try { await once(server, 'listening') } catch (error) { app.locals.journal.close(); throw error }
  const address = server.address()
  console.log(`Publisher listening on port ${typeof address === 'object' ? address?.port : port} · SIMULATED SGD · no real funds`)
  server.once('close', () => { app.locals.journal.close(); void (app.locals.ledger as { close?: () => Promise<void> } | undefined)?.close?.() })
  const shutdown = () => server.close()
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  return server
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void startPublisher().catch(() => { console.error('Publisher startup failed'); process.exitCode = 1 })
}
