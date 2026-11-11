import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { once } from 'node:events'
import { request as http, type IncomingHttpHeaders } from 'node:http'
import express, { type ErrorRequestHandler } from 'express'
import { resources } from './helpers/resource-scope.js'
import { Store } from '../server/store.js'
import { loadConfig } from '../server/config.js'
import { HostedLimits, LIMITS } from '../server/hosted/limits.js'
import { HostedQueue } from '../server/hosted/queue.js'
import { HostedReadiness } from '../server/hosted/readiness.js'
import { HostedError } from '../server/hosted/control.js'
import { hostedRouter } from '../server/hosted/routes.js'
import { sessionGuard, accessGuard } from '../server/hosted/session.js'
import type { ApiContext } from '../server/api/context.js'

// H7, through the real hosted middleware: the session flood cap, readiness off the request path, and /readyz on a full queue.
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-11T12:00:00Z')) })
const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.restoreAllMocks() })
type Reply = { status: number; headers: IncomingHttpHeaders; json: <T = Record<string, unknown>>() => T }
const wire = (url: string, headers: Record<string, string> = {}) => new Promise<Reply>((resolve, reject) => {
  const req = http(url, { headers: { Host: 'demo.example', ...headers } }, res => {
    let text = ''
    res.on('data', c => { text += c })
    res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, json: <T>() => JSON.parse(text) as T }))
  })
  req.on('error', reject); req.end()
})
async function stack(ready: () => Promise<boolean> = async () => true) {
  const dir = resources().tempDir('hg-h7-'), control = join(dir, 'control.json')
  const config = loadConfig({ HOSTED: '1', HOSTED_ORIGIN: 'https://demo.example', HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'k'.repeat(40), HOSTED_CONTROL_PATH: control })
  const pause = (paused: boolean) => writeFileSync(control, JSON.stringify({ admissionsPaused: paused, spendingPaused: paused, reasonCode: 'test', expiresAt: '2026-11-19T16:00:00Z' }))
  pause(false)
  const store = new Store(join(dir, 'app.db')), limits = new HostedLimits(store, config), queue = new HostedQueue(config)
  const context = { store, loop: {}, labels: { decision: 'fixture · test' }, payer: undefined } as unknown as ApiContext
  const app = express()
  app.use(sessionGuard(limits)); app.use(express.json()); app.use(accessGuard(limits))
  app.use(hostedRouter(context, config, limits, queue, ready, async () => true))
  app.use(((error, _req, res, _next) => { if (error instanceof HostedError) { res.status(error.status).json({ error: error.code }); return } res.status(500).json({ error: String(error) }) }) as ErrorRequestHandler)
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); queue.close(); store.close() })
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const sessions = () => store.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get()!.n))
  return { url, limits, queue, store, pause, sessions, from: (ip: string, headers: Record<string, string> = {}) => ({ 'X-Forwarded-For': ip, ...headers }) }
}
const cookieOf = (r: Reply) => String(r.headers['set-cookie']?.[0] ?? '').split(';')[0]

it('stops a cookieless flood from one address at the hourly cap and still admits a visitor from anywhere else', async () => {
  const { url, from, sessions } = await stack(), flooder = '203.0.113.50'
  const replies: Reply[] = []
  for (let i = 0; i < LIMITS.sessionMintsPerIpHour + 25; i++) replies.push(await wire(url + '/api/demo/status', from(flooder)))
  const minted = replies.filter(r => r.status === 200), refused = replies.filter(r => r.status === 429)
  expect(minted).toHaveLength(LIMITS.sessionMintsPerIpHour)
  expect(refused).toHaveLength(25)
  expect(refused.every(r => r.json().error === 'session_rate' && !r.headers['set-cookie'])).toBe(true)
  expect(sessions()).toBe(LIMITS.sessionMintsPerIpHour)
  // A reload or a second tab carries the cookie: still served, from the same address, at the cap.
  expect((await wire(url + '/api/demo/status', from(flooder, { Cookie: cookieOf(minted[0]) }))).status).toBe(200)
  // Someone else is not locked out.
  const judge = await wire(url + '/api/demo/status', from('198.51.100.7'))
  expect(judge.status).toBe(200); expect(judge.json<{ csrfToken: string }>().csrfToken).toHaveLength(64)
  expect(sessions()).toBe(LIMITS.sessionMintsPerIpHour + 1)
})

it('mints no session for the uptime check, whatever its rate', async () => {
  const { url, from, sessions } = await stack()
  for (let i = 0; i < LIMITS.sessionMintsPerIpHour + 20; i++) expect((await wire(url + '/readyz', from('35.187.0.1'))).status).toBe(200)
  expect(sessions()).toBe(0)
})

it('serves /api/demo/status and /readyz while a readiness refresh is still in flight, and refuses asks when the last answer was no', async () => {
  let call = 0
  const slow: { resolve?: (v: boolean) => void } = {}
  const readiness = new HostedReadiness(() => ++call === 1 ? Promise.resolve(true) : new Promise<boolean>(r => { slow.resolve = r }), { intervalMs: 10 })
  cleanup.push(() => readiness.close())
  const { url, from } = await stack(() => readiness.ready())
  await vi.waitFor(() => expect(slow.resolve).toBeDefined(), { timeout: 5000 }) // the second refresh is in flight and will not finish
  // Both answer at once from the last result. Before H7 these awaited the refresh itself (up to 1.9 s live).
  const status = await wire(url + '/api/demo/status', from('198.51.100.8'))
  expect(status.status).toBe(200); expect(status.json<{ state: string }>().state).toBe('ready')
  const readyz = await wire(url + '/readyz', from('35.187.0.1'))
  expect([readyz.status, readyz.json().status]).toEqual([200, 'ready'])
  // When the refresh finishes with "not ready", the next request sees it and a new ask is refused.
  slow.resolve!(false)
  await vi.waitFor(async () => expect((await wire(url + '/readyz', from('35.187.0.1'))).status).toBe(503), { timeout: 5000 })
  const jar = await wire(url + '/api/demo/status', from('198.51.100.8'))
  expect(jar.json<{ state: string; capabilities: { ask: boolean } }>()).toMatchObject({ state: 'degraded', capabilities: { ask: false } })
  const ask = await new Promise<Reply>((resolve, reject) => {
    const req = http(url + '/api/scope', { method: 'POST', headers: { Host: 'demo.example', Origin: 'https://demo.example', 'Content-Type': 'application/json', 'Idempotency-Key': 'k1', 'X-CSRF-Token': jar.json<{ csrfToken: string }>().csrfToken, 'Sec-Fetch-Site': 'same-origin', Cookie: cookieOf(jar), ...from('198.51.100.8') } }, res => {
      let text = ''; res.on('data', c => { text += c }); res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, json: <T>() => JSON.parse(text) as T }))
    })
    req.on('error', reject); req.end(JSON.stringify({ question: 'Does it work?' }))
  })
  expect([ask.status, ask.json().error]).toEqual([503, 'demo_unavailable'])
})

it('keeps /readyz at 200 for a full queue (busy, not unhealthy) and 503 for a state that cannot take work', async () => {
  const { url, queue, from, pause } = await stack()
  const never = () => new Promise<void>(() => undefined), expired = vi.fn()
  queue.enqueue('running', never, expired); queue.enqueue('wait-1', never, expired); queue.enqueue('wait-2', never, expired)
  expect(queue.canQueue).toBe(false)
  const ip = from('35.187.0.1')
  const full = await wire(url + '/readyz', ip)
  expect([full.status, full.json()]).toEqual([200, { status: 'busy', queue: 'full' }])
  // The visitor-facing state is unchanged: busy, and a new question is not offered.
  const status = await wire(url + '/api/demo/status', from('198.51.100.9'))
  expect(status.json<{ state: string; capabilities: { ask: boolean } }>()).toMatchObject({ state: 'busy', capabilities: { ask: false } })
  // Genuinely unhealthy still fails the check, queue or not.
  pause(true)
  const paused = await wire(url + '/readyz', ip)
  expect([paused.status, paused.json().status]).toEqual([503, 'paused'])
})

it('answers 503 degraded when the service is not ready, with an open queue', async () => {
  const { url, from } = await stack(async () => false)
  const r = await wire(url + '/readyz', from('35.187.0.1'))
  expect([r.status, r.json()]).toEqual([503, { status: 'degraded' }])
})
