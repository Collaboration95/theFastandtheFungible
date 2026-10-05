// Cloud Run entry: publisher, API and the built web app in one container on one instance.
// Both SQLite ledgers sit on the instance's in-memory disk, so a restart resets them together:
// the buyer can never remember a purchase the publisher forgot (prompt.md §2 gate 3).
// ponytail: demo state is ephemeral; split the publisher into its own service once it has durable storage.
import { spawn } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'
import express from 'express'

const publisherPort = 8790
process.env.PUBLISHER_URL = `http://127.0.0.1:${publisherPort}`
const publisher = spawn(process.execPath, ['--import', 'tsx', 'publisher/server.ts'], { env: { ...process.env, PUBLISHER_PORT: String(publisherPort) }, stdio: 'inherit' })
publisher.once('exit', code => { console.error('Publisher stopped; exiting so Cloud Run restarts the container.'); process.exit(code || 1) })
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(`${process.env.PUBLISHER_URL}/health`)).ok) break } catch { /* still starting */ }
  if (attempt > 150) throw new Error('Publisher did not become ready')
  await new Promise(resolve => setTimeout(resolve, 200))
}

const { createApiApp } = await import('../server/routes.ts')
const api = await createApiApp()
const app = express()
app.disable('x-powered-by')
// DEMO_BASIC_AUTH="user:password" keeps strangers from spending provider quota and Testnet XRP. Unset = public.
if (process.env.DEMO_BASIC_AUTH) {
  const expected = Buffer.from(`Basic ${Buffer.from(process.env.DEMO_BASIC_AUTH).toString('base64')}`)
  app.use((req, res, next) => {
    const actual = Buffer.from(req.get('Authorization') ?? '')
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return next()
    res.set('WWW-Authenticate', 'Basic realm="ResearchAgent"').status(401).end()
  })
}
app.use(express.static('dist'))
app.use(api.app)
const server = app.listen(Number(process.env.PORT ?? 8080), '0.0.0.0', () => console.log(`ResearchAgent on Cloud Run · port ${process.env.PORT ?? 8080}`))
process.once('SIGTERM', () => { server.close(); api.close(); publisher.kill('SIGTERM') })
