import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { once } from 'node:events'
import { request as http, type IncomingHttpHeaders } from 'node:http'
import express, { type ErrorRequestHandler } from 'express'
import { resources } from './helpers/resource-scope.js'
import { Store } from '../server/store.js'
import { loadConfig } from '../server/config.js'
import { HostedLimits, LIMITS } from '../server/hosted/limits.js'
import { HostedQueue } from '../server/hosted/queue.js'
import { HostedReadiness, PayerWatch, PAYER_LOW_DROPS, type PayerFunds } from '../server/hosted/readiness.js'
import { HostedError } from '../server/hosted/control.js'
import { hostedRouter } from '../server/hosted/routes.js'
import { sessionGuard, accessGuard } from '../server/hosted/session.js'
import { ActiveWork } from '../server/agents/active-work.js'
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
const post = (url: string, path: string, headers: Record<string, string>, body: unknown) => new Promise<Reply>((resolve, reject) => {
  const req = http(url + path, { method: 'POST', headers: { Host: 'demo.example', Origin: 'https://demo.example', 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', ...headers } }, res => {
    let text = ''; res.on('data', c => { text += c }); res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, json: <T>() => JSON.parse(text) as T }))
  })
  req.on('error', reject); req.end(JSON.stringify(body))
})
async function stack(ready: () => Promise<boolean> = async () => true, env: Record<string, string> = {}, payerFunds?: () => PayerFunds) {
  const dir = resources().tempDir('hg-h7-'), control = join(dir, 'control.json')
  const config = loadConfig({ HOSTED: '1', HOSTED_ORIGIN: 'https://demo.example', HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'k'.repeat(40), HOSTED_CONTROL_PATH: control, ...env })
  const pause = (paused: boolean) => writeFileSync(control, JSON.stringify({ admissionsPaused: paused, spendingPaused: paused, reasonCode: 'test', expiresAt: '2026-11-19T16:00:00Z' }))
  pause(false)
  const store = new Store(join(dir, 'app.db')), limits = new HostedLimits(store, config), queue = new HostedQueue(config)
  const context = { store, loop: {}, labels: { decision: 'fixture · test' }, payer: undefined, work: new ActiveWork(1) } as unknown as ApiContext
  const app = express()
  app.use(sessionGuard(limits)); app.use(express.json()); app.use(accessGuard(limits))
  app.use(hostedRouter(context, config, limits, queue, ready, async () => true, payerFunds))
  app.use(((error, _req, res, _next) => { if (error instanceof HostedError) { res.status(error.status).json({ error: error.code }); return } res.status(500).json({ error: String(error) }) }) as ErrorRequestHandler)
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); queue.close(); store.close() })
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const sessions = () => store.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get()!.n))
  return { url, dir, control, limits, queue, store, pause, sessions, from: (ip: string, headers: Record<string, string> = {}) => ({ 'X-Forwarded-For': ip, ...headers }) }
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
  const ask = await post(url, '/api/scope', { 'Idempotency-Key': 'k1', 'X-CSRF-Token': jar.json<{ csrfToken: string }>().csrfToken, Cookie: cookieOf(jar), ...from('198.51.100.8') }, { question: 'Does it work?' })
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

const visitor = async (url: string, ip: string) => {
  const jar = await wire(url + '/api/demo/status', { 'X-Forwarded-For': ip })
  return { 'X-Forwarded-For': ip, Cookie: cookieOf(jar), 'X-CSRF-Token': jar.json<{ csrfToken: string }>().csrfToken }
}
it('plans while another visitor’s question holds the demo (it used to answer 429 busy), and only the start waits', async () => {
  const { url, queue } = await stack()
  const never = () => new Promise<void>(() => undefined)
  queue.enqueue('someone-elses-run', never, vi.fn())
  expect(queue.busy).toBe(true)
  const a = await visitor(url, '198.51.100.21')
  const question = 'What does XLS-34 change for escrow cancellation on the XRP Ledger?'
  const planned = await post(url, '/api/scope', { ...a, 'Idempotency-Key': 'plan-1' }, { question, clarify: 'never' })
  expect(planned.status).toBe(200)
  expect(planned.json<{ plan?: { subqueries: string[] } }>().plan?.subqueries.length).toBeGreaterThan(0)
  // The same plan again is served from the hold, still without waiting.
  expect((await post(url, '/api/scope', { ...a, 'Idempotency-Key': 'plan-1' }, { question, clarify: 'never' })).status).toBe(200)
  // A second visitor plans at the same time as well.
  const b = await visitor(url, '198.51.100.22')
  expect((await post(url, '/api/scope', { ...b, 'Idempotency-Key': 'plan-2' }, { question, clarify: 'never' })).status).toBe(200)
})
it('shows how long a queued question should wait once runs have finished here, and nothing before', async () => {
  const { url, queue, from } = await stack()
  const a = await wire(url + '/api/demo/status', from('198.51.100.23'))
  expect(a.json<{ wait: Record<string, unknown> }>().wait).toEqual({ ahead: 0, own: false })
  let finish!: () => void
  queue.enqueue('first', () => new Promise<void>(resolve => { finish = resolve }), vi.fn())
  const noHistory = await wire(url + '/api/demo/status', from('198.51.100.23'))
  expect(noHistory.json<{ wait: Record<string, unknown> }>().wait).toEqual({ ahead: 1, own: false }) // nothing has finished yet: no number is invented
  finish(); await vi.waitFor(() => expect(queue.busy).toBe(false))
  queue.enqueue('second', () => new Promise<void>(() => undefined), vi.fn())
  const withHistory = await wire(url + '/api/demo/status', from('198.51.100.23'))
  expect(withHistory.json<{ wait: { ahead: number; estimateSeconds: number } }>().wait).toMatchObject({ ahead: 1, estimateSeconds: expect.any(Number) })
})

const control = (control: string, args: string[]) => spawnSync(process.execPath, ['scripts/hosted-control.mjs', ...args], { encoding: 'utf8', env: { ...process.env, HOSTED_CONTROL_PATH: control } })
it('re-reads the video and proof links from the state disk on every status call, without a restart (J3)', async () => {
  const { url, dir, control: controlPath, from } = await stack(async () => true, { HOSTED_VIDEO_URL: 'https://video.example/from-env' })
  const links = async () => (await wire(url + '/api/demo/status', from('198.51.100.30'))).json<{ links: Record<string, string> }>().links
  // Nothing on disk: the environment's value stands and `proof` is absent.
  expect(await links()).toMatchObject({ video: 'https://video.example/from-env' }); expect(await links()).not.toHaveProperty('proof')
  // The operator command writes the file beside the control file; the very next status call shows it.
  const set = control(controlPath, ['links', '--video', 'https://youtu.be/abc123', '--proof', 'https://collaboration95.github.io/p/1'])
  expect(set.status, set.stderr).toBe(0)
  expect(JSON.parse(readFileSync(join(dir, 'links.json'), 'utf8'))).toEqual({ video: 'https://youtu.be/abc123', proof: 'https://collaboration95.github.io/p/1' })
  expect(await links()).toMatchObject({ video: 'https://youtu.be/abc123', proof: 'https://collaboration95.github.io/p/1' })
  // Clearing one falls back to the environment (video) or to absent (proof); a second set keeps the other.
  expect(control(controlPath, ['links', '--clear', 'proof']).status).toBe(0)
  const cleared = await links(); expect(cleared.video).toBe('https://youtu.be/abc123'); expect(cleared).not.toHaveProperty('proof')
  expect(control(controlPath, ['links', '--clear', 'all']).status).toBe(0)
  expect(await links()).toMatchObject({ video: 'https://video.example/from-env' })
  // A file written by hand with anything but a plain https URL is ignored, never served.
  writeFileSync(join(dir, 'links.json'), JSON.stringify({ video: 'javascript:alert(1)', proof: 'http://insecure.example/x', extra: 'https://ok.example/' }))
  expect(await links()).toMatchObject({ video: 'https://video.example/from-env' }); expect(await links()).not.toHaveProperty('proof')
  writeFileSync(join(dir, 'links.json'), '{not json')
  expect(await links()).toMatchObject({ video: 'https://video.example/from-env' })
})
it('refuses a links command that is not a plain https URL, and keeps the links options out of the other actions', () => {
  const { stdout, status } = control('/nonexistent/control.json', ['links', '--project', 'ra-hg-test', '--video', 'https://youtu.be/abc123', '--proof', 'https://example.org/proof', '--dry-run'])
  expect(status).toBe(0)
  expect(stdout).toContain('links all --local --execute --path /state/control.json --video https://youtu.be/abc123 --proof https://example.org/proof')
  for (const bad of ['http://example.org/x', 'https://exa mple.org', "https://example.org/'; rm -rf /", 'https://user:pw@example.org/', 'https://localhost/x', `https://example.org/${'a'.repeat(300)}`, 'javascript:alert(1)'])
    expect(control('/nonexistent/control.json', ['links', '--video', bad, '--dry-run']).status, bad).not.toBe(0)
  // The exact form the remote command runs inside the container.
  const dir = resources().tempDir('ra-links-'), file = join(dir, 'control.json')
  const inside = control('/nonexistent/control.json', ['links', 'all', '--local', '--execute', '--path', file, '--video', 'https://youtu.be/abc123'])
  expect(inside.status, inside.stderr).toBe(0)
  expect(JSON.parse(readFileSync(join(dir, 'links.json'), 'utf8'))).toEqual({ video: 'https://youtu.be/abc123' })
  expect(control('/nonexistent/control.json', ['links', '--clear', 'deck', '--dry-run']).status).not.toBe(0)
  expect(control('/nonexistent/control.json', ['pause', '--video', 'https://youtu.be/abc123', '--dry-run']).status).not.toBe(0)
})

it('reports the shared payer against 30 XRP for the owner’s alert, without changing anything a visitor sees (J7)', async () => {
  let funds: PayerFunds = 'ok'
  const { url, from, sessions } = await stack(async () => true, {}, () => funds)
  const check = async () => { const r = await wire(url + '/readyz/funds', from('35.187.0.1')); return [r.status, r.json()] }
  expect(await check()).toEqual([200, { funds: 'ok' }])
  funds = 'unknown'; expect(await check()).toEqual([200, { funds: 'unknown' }]) // no reading is not an alert; readiness covers an outage
  funds = 'low'; expect(await check()).toEqual([503, { funds: 'low' }])
  // Low funds alone: visitors still see ready, the readiness check still passes, and the funds check mints no session.
  expect((await wire(url + '/readyz', from('35.187.0.1'))).status).toBe(200)
  const status = await wire(url + '/api/demo/status', from('198.51.100.40'))
  expect(status.json<{ state: string; capabilities: { ask: boolean } }>()).toMatchObject({ state: 'ready', capabilities: { ask: true } })
  expect(sessions()).toBe(1) // only the visitor's
  const { url: bare, from: fromBare } = await stack()
  expect((await wire(bare + '/readyz/funds', fromBare('35.187.0.1'))).json()).toEqual({ funds: 'unknown' }) // a service with no payer reading
})
it('turns the payer’s balance into ok, low or unknown, and ignores a reading it cannot use', () => {
  let now = 1_000_000
  const watch = new PayerWatch(() => now)
  expect(watch.state()).toBe('unknown')
  watch.record(PAYER_LOW_DROPS); expect(watch.state()).toBe('ok')
  watch.record(PAYER_LOW_DROPS - 1); expect(watch.state()).toBe('low')
  watch.record(Number.NaN); watch.record(-5); expect(watch.state()).toBe('low')
  now += 120_001; expect(watch.state()).toBe('unknown') // the probe stopped reading: no stale "low" or "ok"
  watch.record(94_000_000); expect(watch.state()).toBe('ok')
})
