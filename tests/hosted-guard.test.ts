import { describe, it, expect } from 'vitest'
import { createServer, request } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'

// H6 (11 Nov): the packaged guard (docker/hosted/start.mjs) probed HG's /api/demo/status on EVERY request, with the
// visitor's cookie and a 1.5 s timeout. A slow status (readiness refresh over Testnet, a busy event loop) showed real
// visitors and the uptime check the paused page while nothing was paused, and every cookieless probe minted a session.
// The guard now keeps a contract answer per Host. These tests drive a stand-in HG whose behaviour a file switches.
const host = 'ra-front-000000000000.asia-southeast1.run.app'
type Mode = 'ok' | 'paused' | 'slow' | 'hosted-false' | 'error' | 'garbage' | 'hang'
const freePort = () => new Promise<number>(resolve => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address() as { port: number }; s.close(() => resolve(port)) }) })
const get = (port: number, path: string, headers: Record<string, string> = {}) => new Promise<{ status: number; body: string; ms: number }>((resolve, reject) => {
  const at = Date.now()
  const r = request({ hostname: '127.0.0.1', port, path, headers: { host, ...headers } }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', c => { body += c }); res.on('end', () => resolve({ status: res.statusCode ?? 0, body, ms: Date.now() - at })) })
  r.on('error', reject); r.end()
})
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// The stand-in HG: denies other Hosts like server/hosted/session.ts, sets a session cookie when none is sent, and
// records every probe (status requests without the visitor marker) with the cookie it carried.
const FAKE_HG = (h: string) => `import {createServer} from 'node:http'
import {readFileSync} from 'node:fs'
const probes = []
const mode = () => readFileSync(process.env.MODE_FILE, 'utf8').trim()
createServer((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ probes })) }).listen(Number(process.env.STATS_PORT), '127.0.0.1')
createServer((req, res) => {
  const m = mode()
  res.setHeader('Content-Type', 'application/json')
  if (req.headers.host !== ${JSON.stringify(h)}) { res.writeHead(403); res.end(JSON.stringify({ error: 'origin_denied' })); return }
  const visitor = req.headers['x-test-visitor'] === '1'
  if (req.url === '/api/demo/status' && !visitor) probes.push({ cookie: req.headers.cookie || null, xff: req.headers['x-forwarded-for'] || null, mode: m })
  if (m === 'hang') return
  const contract = state => ({ state, capabilities: { ask: state === 'ready' }, remaining: { questions: 5, minor: 1000 }, labels: { models: 'm', rail: 'r' } })
  const answer = () => {
    if (req.url !== '/api/demo/status') { res.end(JSON.stringify({ forwarded: true, path: req.url })); return }
    if (m === 'hosted-false') { res.end(JSON.stringify({ hosted: false })); return }
    if (m === 'error') { res.writeHead(500); res.end(JSON.stringify({ error: 'boom' })); return }
    if (m === 'garbage') { res.end('<html>not json'); return }
    if (!req.headers.cookie) res.setHeader('Set-Cookie', '__Host-ra_session=' + 'a'.repeat(64) + '; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=Lax')
    res.end(JSON.stringify({ ...contract(m === 'paused' ? 'paused' : 'ready'), from: 'hg' }))
  }
  if (m === 'slow') setTimeout(answer, 1500); else answer()
}).listen(Number(process.env.PORT), '127.0.0.1')
`

async function guard(initial: Mode, timing: Record<string, string> = {}) {
  const scope = resources(), dir = scope.tempDir('ra-hosted-guard-')
  const modeFile = join(dir, 'mode'), setMode = (m: Mode) => writeFileSync(modeFile, m)
  setMode(initial)
  writeFileSync(join(dir, 'api.mjs'), FAKE_HG(host))
  const [port, raw, stats] = await Promise.all([freePort(), freePort(), freePort()])
  scope.spawn(process.execPath, ['docker/hosted/start.mjs'], { env: { ...process.env, HOSTED: '1', ROLE: 'api', PORT: String(port), RAW_API_PORT: String(raw), STATS_PORT: String(stats), MODE_FILE: modeFile, HOSTED_LISTEN: '127.0.0.1', HOSTED_BUNDLE: join(dir, 'api.mjs'), K_SERVICE: '', HOSTED_PUBLISHER_UPSTREAM: '', HOSTED_GUARD_RECHECK_MS: '200', HOSTED_GUARD_QUALIFIED_MS: '1000', HOSTED_GUARD_PROBE_MS: '400', ...timing } })
  for (let i = 0; i < 100; i++) { if (await get(port, '/livez').then(r => r.status === 200, () => false)) break; await wait(50) }
  // Both the guard and the stand-in must be listening before a test measures anything.
  for (let i = 0; i < 100; i++) { if (await get(stats, '/').then(r => r.status === 200, () => false)) break; await wait(50) }
  const probes = async () => JSON.parse((await get(stats, '/')).body).probes as { cookie: string | null; xff: string | null; mode: Mode }[]
  return { port, setMode, probes }
}
const visitor = { 'x-test-visitor': '1', cookie: '__Host-ra_session=' + 'b'.repeat(64), 'x-forwarded-for': '203.0.113.9' }
const pausedByGuard = (r: { status: number; body: string }) => r.status === 503 && r.body.includes('paused') && !r.body.startsWith('{')
const fakePausedStatus = (r: { body: string }) => { const b = JSON.parse(r.body); return b.state === 'paused' && Object.keys(b.capabilities).length === 0 && b.from === undefined }

describe('hosted guard qualification (H6)', () => {
  it('probes once per Host with its own session, not once per visitor request', async () => {
    const g = await guard('ok', { HOSTED_GUARD_RECHECK_MS: '1500', HOSTED_GUARD_QUALIFIED_MS: '5000' })
    const first = await get(g.port, '/api/runs', visitor)
    expect(JSON.parse(first.body)).toEqual({ forwarded: true, path: '/api/runs' })
    const burst = await Promise.all(Array.from({ length: 30 }, () => get(g.port, '/api/runs', visitor)))
    expect(burst.every(r => r.status === 200 && JSON.parse(r.body).forwarded)).toBe(true)
    const probes = await g.probes()
    expect(probes.length).toBe(1)
    // Probes never carry a visitor's cookie or address. The first one gets the guard its own HG session.
    expect(probes.every(p => p.cookie !== visitor.cookie && p.xff === null)).toBe(true)
    expect(probes[0].cookie).toBeNull()
    await wait(1600)
    await get(g.port, '/api/runs', visitor) // past RECHECK_MS: a background re-check reuses the guard's own session
    await wait(200)
    const later = await g.probes()
    expect(later.length).toBeGreaterThan(probes.length)
    expect(later.slice(1).every(p => p.cookie === '__Host-ra_session=' + 'a'.repeat(64))).toBe(true)
  }, 30000)

  it('keeps forwarding while a qualified HG is only slow, then fails closed once no good answer is recent', async () => {
    const g = await guard('ok')
    expect((await get(g.port, '/api/demo/status', visitor)).status).toBe(200)
    g.setMode('slow') // every HG answer now takes 1.5 s, longer than the 400 ms probe timeout
    const during: { status: number; body: string }[] = []
    const until = Date.now() + 700 // inside QUALIFIED_MS (1 s) of the last good answer
    while (Date.now() < until) during.push(await get(g.port, '/api/runs', visitor))
    expect(during.length).toBeGreaterThan(0)
    expect(during.some(pausedByGuard)).toBe(false) // slow-but-healthy is never shown as paused
    await wait(1200) // no contract answer for longer than QUALIFIED_MS: back to fail closed
    expect(pausedByGuard(await get(g.port, '/api/runs', visitor))).toBe(true)
    g.setMode('ok')
    let back = false
    for (let i = 0; i < 40 && !back; i++) { back = (await get(g.port, '/api/runs', visitor)).status === 200; if (!back) await wait(100) }
    expect(back).toBe(true)
  }, 30000)

  it('withdraws the qualification at once when HG stops answering with the contract', async () => {
    const g = await guard('ok')
    expect((await get(g.port, '/api/runs', visitor)).status).toBe(200)
    g.setMode('hosted-false') // a non-hosted API answers status: never expose it
    await wait(250)
    await get(g.port, '/api/runs', visitor) // triggers the background re-check (may still forward this one)
    await wait(100)
    const after = await get(g.port, '/api/runs', visitor)
    expect(pausedByGuard(after)).toBe(true)
    expect(fakePausedStatus(await get(g.port, '/api/demo/status', visitor))).toBe(true)
  }, 30000)

  for (const mode of ['hosted-false', 'error', 'garbage', 'hang'] as const) {
    it(`fails closed for a ${mode} API that never qualified`, async () => {
      const g = await guard(mode)
      const runs = await get(g.port, '/api/runs', visitor)
      expect(pausedByGuard(runs)).toBe(true)
      expect(fakePausedStatus(await get(g.port, '/api/demo/status', visitor))).toBe(true)
      expect((await get(g.port, '/readyz')).status).toBe(503)
    }, 30000)
  }

  it('fails closed when nothing listens on the raw port', async () => {
    const scope = resources(), dir = scope.tempDir('ra-hosted-guard-')
    writeFileSync(join(dir, 'api.mjs'), 'setInterval(() => {}, 1000)\n') // a child that never binds
    const [port, raw] = await Promise.all([freePort(), freePort()])
    scope.spawn(process.execPath, ['docker/hosted/start.mjs'], { env: { ...process.env, HOSTED: '1', ROLE: 'api', PORT: String(port), RAW_API_PORT: String(raw), HOSTED_LISTEN: '127.0.0.1', HOSTED_BUNDLE: join(dir, 'api.mjs'), K_SERVICE: '', HOSTED_PUBLISHER_UPSTREAM: '' } })
    for (let i = 0; i < 100; i++) { if (await get(port, '/livez').then(r => r.status === 200, () => false)) break; await wait(50) }
    expect(pausedByGuard(await get(port, '/runs/abc', visitor))).toBe(true)
    expect(fakePausedStatus(await get(port, '/api/demo/status', visitor))).toBe(true)
  }, 30000)

  it("forwards HG's own paused state: the guard never stands in for the pause", async () => {
    const g = await guard('paused')
    const status = JSON.parse((await get(g.port, '/api/demo/status', visitor)).body)
    expect(status).toMatchObject({ state: 'paused', capabilities: { ask: false }, from: 'hg' })
  }, 30000)

  it('never lets a different Host ride on the public Host qualification', async () => {
    const g = await guard('ok')
    expect((await get(g.port, '/api/runs', visitor)).status).toBe(200)
    const other = await get(g.port, '/api/runs', { ...visitor, host: 'evil.example' })
    expect(pausedByGuard(other)).toBe(true)
  }, 30000)
})
