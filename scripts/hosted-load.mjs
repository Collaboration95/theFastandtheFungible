#!/usr/bin/env node
// Local load test for the packaged hosted guard (docker/hosted/start.mjs) in front of the real HG gateway: HOSTED=1,
// fixture models, the simulated rail, the fixture writer server, ephemeral ports. Never a deployment, never Testnet.
//
//   node --import tsx scripts/hosted-load.mjs [--guard-ref <git ref>] [--visitors 6] [--seconds 120] [--uptime-ms 10000]
//        [--readiness 380,1900,...] [--inline-readiness] [--flood 5200] [--paused-check] [--out docs/evidence/h7/<name>.json]
//
// --inline-readiness: the readiness stand-in H6 used, which behaves as production did before H7 (5 s cache, and the request
//   that finds it expired waits for the refresh). Without it the API runs its real background readiness (server/hosted/readiness.ts)
//   and only the probe is a stand-in, so the before/after comparison runs the same harness on the code under test.
// --flood N: after the visitors, N cookieless requests from one address (a scripted client that never keeps a cookie), then a
//   new visitor from another address, to show how many sessions the flood minted and whether the next real visitor gets in.
//
// Each visitor behaves like the browser: status at boot, history and writers, then ask (scope, submit), follow the run
// over SSE, poll the run every 5 s and status every 3 s, then ask again. One more client polls /readyz with no cookie,
// like the uptime check (every 10 s by default, the live cadence). The guard's own paused answers (paused.html 503, or a status with empty
// capabilities) are counted apart from HG's genuine answers (its paused state, 429 queue/allowance refusals).
//
// Readiness is the one stand-in: without a funded Testnet payer the real probe is never ready. The stand-in keeps the
// production shape (5 s cache, one refresh at a time) and takes each refresh's latency from --readiness, cycled. The
// default comes from the live demo on 11 Nov (04:18-04:21 UTC, /ready minus the warm-cache baseline), with its one
// >1.5 s refresh kept and the tail made more frequent (1 in 10 rather than about 1 in 25) to reproduce in minutes.
import { execFileSync } from 'node:child_process'
import { createServer, request } from 'node:http'
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
const { ResourceScope } = await import('../shared/resource-scope.ts')

const args = process.argv.slice(2)
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback }
const VISITORS = Number(flag('visitors', 6)), SECONDS = Number(flag('seconds', 120))
const READINESS = flag('readiness', '380,400,1310,520,370,570,1900,380,650,450')
const guardRef = flag('guard-ref', ''), out = flag('out', ''), pausedCheck = args.includes('--paused-check')
const INLINE_READINESS = args.includes('--inline-readiness'), FLOOD = Number(flag('flood', 0))
// The live check runs every 60 s from 6 locations: about one /ready every 10 s.
const UPTIME_MS = Number(flag('uptime-ms', 10000))
const HOST = 'ra-load.invalid', ORIGIN = `https://${HOST}`
const root = resolve('.')
const scope = new ResourceScope()
const dir = scope.tempDir('ra-hosted-load-')
const freePort = () => new Promise(r => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => r(port)) }) })
const wait = ms => new Promise(r => setTimeout(r, ms))
const [pub, guardPort, raw] = await Promise.all([freePort(), freePort(), freePort()])
for (const p of [pub, guardPort, raw]) if ([5100, 8788, 8790].includes(p)) throw new Error('reserved demo port allocated')

// The guard under test: this checkout's file, or the one at a git ref (with its paused page next to it).
let guard = join(root, 'docker/hosted/start.mjs')
if (guardRef) {
  mkdirSync(join(dir, 'guard'))
  writeFileSync(join(dir, 'guard/start.mjs'), execFileSync('git', ['show', `${guardRef}:docker/hosted/start.mjs`]))
  copyFileSync(join(root, 'docker/hosted/paused.html'), join(dir, 'guard/paused.html'))
  guard = join(dir, 'guard/start.mjs')
}

const env = { ...process.env }
for (const key of Object.keys(env)) if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(key)) delete env[key]
Object.assign(env, {
  HOSTED: '1', HOSTED_ORIGIN: ORIGIN, HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'hosted-load-test-only-'.padEnd(40, 'x'), HOSTED_CONTROL_PATH: join(dir, 'control.json'),
  SETTLEMENT_RAIL: 'simulated', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', DOTENV_CONFIG_PATH: join(dir, 'no-env'),
  PUBLISHER_URL: `http://127.0.0.1:${pub}`, PUBLISHER_PORT: String(pub), PUBLISHER_DB: join(dir, 'publisher.db'), APP_DB: join(dir, 'app.db'), REPORT_DIR: join(dir, 'reports'),
  K_SERVICE: '', HOSTED_PUBLISHER_UPSTREAM: '',
})
const control = paused => writeFileSync(env.HOSTED_CONTROL_PATH, JSON.stringify({ admissionsPaused: paused, spendingPaused: paused, reasonCode: paused ? 'load_paused' : 'load_test', expiresAt: '2026-11-19T16:00:00Z' }))
control(false)

// The raw API child: production createApiApp with the readiness stand-in, plus an event-loop delay monitor.
const lagFile = join(dir, 'lag.json')
writeFileSync(join(dir, 'api.mjs'), `import { monitorEventLoopDelay } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
const { createApiApp } = await import(${JSON.stringify(pathToFileURL(join(root, 'server/routes.ts')).href)})
const schedule = ${JSON.stringify(READINESS)}.split(',').map(Number)
let n = 0
const refreshes = []
// The one stand-in: what a readiness check costs. Without a funded Testnet payer the real probe is never ready.
const probe = async () => { const ms = schedule[n++ % schedule.length]; await new Promise(r => setTimeout(r, ms)); refreshes.push(ms); return true }
// Inline (pre-H7 production shape): a 5 s cache, and the request that finds it expired waits for one refresh at a time.
let checkedAt = 0, healthy = false, pending
const inline = () => {
  if (Date.now() - checkedAt < 5000) return Promise.resolve(healthy)
  return pending ??= probe().then(v => { checkedAt = Date.now(); healthy = v; return v }).finally(() => { pending = undefined })
}
const api = await createApiApp({ publisherUrl: process.env.PUBLISHER_URL, ...(${JSON.stringify(INLINE_READINESS)} ? { hostedReadiness: inline } : { hostedProbe: probe }) })
const lag = monitorEventLoopDelay({ resolution: 10 }); lag.enable()
const server = api.app.listen(Number(process.env.PORT), process.env.HOST)
const dump = () => writeFileSync(${JSON.stringify(lagFile)}, JSON.stringify({ p50: lag.percentile(50) / 1e6, p99: lag.percentile(99) / 1e6, max: lag.max / 1e6, refreshes }))
setInterval(dump, 1000).unref()
process.on('SIGTERM', () => { dump(); server.closeAllConnections(); server.close(); api.close().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref() })
`)
const start = (args, extra = {}) => { const child = scope.spawn(process.execPath, args, { cwd: root, env: { ...env, ...extra } }); child.stdout.resume(); child.stderr.resume(); return child }

// One request through the guard, classified.
const records = []
function call(method, path, { cookie, ip, body, csrf, key, sse } = {}) {
  return new Promise(resolveCall => {
    const at = Date.now()
    const headers = { host: HOST, accept: sse ? 'text/event-stream' : 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}), ...(cookie ? { cookie } : {}) }
    if (method !== 'GET') Object.assign(headers, { origin: ORIGIN, 'content-type': 'application/json', 'x-csrf-token': csrf ?? '', 'sec-fetch-site': 'same-origin', ...(key ? { 'idempotency-key': key } : {}) })
    const req = request({ hostname: '127.0.0.1', port: guardPort, method, path, headers }, res => {
      const set = [res.headers['set-cookie'] ?? []].flat().map(c => c.split(';')[0]).find(c => c.startsWith('__Host-ra_session='))
      if (sse && res.statusCode === 200) { resolveCall(record(method, path, at, res.statusCode, res.headers['content-type'], '', set, res)); return }
      let text = ''
      res.setEncoding('utf8'); res.on('data', c => { if (text.length < 1 << 20) text += c })
      res.on('end', () => resolveCall(record(method, path, at, res.statusCode, res.headers['content-type'], text, set)))
      res.on('error', () => resolveCall(record(method, path, at, 0, '', '', set)))
    })
    req.on('error', () => resolveCall(record(method, path, at, 0, '', '')))
    if (!sse) req.setTimeout(15000, () => req.destroy(new Error('load request timed out')))
    req.end(body ? JSON.stringify(body) : undefined)
  })
}
function record(method, path, at, status, type = '', text, set, stream) {
  let json
  try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
  const route = path.replace(/\/runs\/[a-zA-Z0-9-]+/, '/runs/:id')
  let kind = status >= 200 && status < 300 ? 'ok' : status === 429 ? 'refused-429' : 'other'
  if (status === 503 && String(type).startsWith('text/html')) kind = 'guard-paused'
  else if (route === '/api/demo/status' && json?.state === 'paused' && json.capabilities && !Object.keys(json.capabilities).length) kind = 'guard-paused'
  else if (json?.state === 'paused' || ['paused', 'spending_paused'].includes(json?.error) || json?.status === 'paused') kind = 'hg-paused'
  const r = { t: Date.now() - t0, method, route, status, ms: Date.now() - at, kind, ...(json?.error ? { error: json.error } : {}), ...(json?.state ? { state: json.state } : {}), ...(json?.status ? { readiness: json.status } : {}) }
  records.push(r)
  return { ...r, json, set, stream }
}

const questions = [
  'What does XLS-34 change for escrow cancellation on the XRP Ledger?',
  'How do payment channels settle on the XRP Ledger, and what does it cost?',
  'Which XRPL amendment introduced token escrow and what are its limits?',
  'What is the reserve requirement for an XRPL account in 2026?',
  'How do x402 payments confirm on the XRPL Testnet?',
  'What changed for AMM fees in the latest XRPL amendments?',
]
let t0 = Date.now(), stopAt = 0
const stats = { asked: 0, admitted: 0, finished: 0 }
async function visitor(i) {
  const ip = `198.51.100.${10 + i}`
  let cookie = '', csrf = ''
  const status = async () => { const r = await call('GET', '/api/demo/status', { cookie, ip }); if (r.set) cookie = r.set; if (r.json?.csrfToken) csrf = r.json.csrfToken; return r }
  await status(); await call('GET', '/api/runs', { cookie, ip }); await call('GET', '/api/writers/status', { cookie, ip })
  let q = i
  while (Date.now() < stopAt) {
    const question = questions[q++ % questions.length], key = randomUUID()
    stats.asked++
    const scope = await call('POST', '/api/scope', { cookie, ip, csrf, key, body: { question, clarify: 'never' } })
    const run = await call('POST', '/runs', { cookie, ip, csrf, key, body: { question, budgetMinor: 200 } })
    if (run.status === 429 && run.error === 'allowance_exhausted') { cookie = ''; csrf = ''; await status(); continue } // a new judge
    if (!run.json?.runId) { await wait(3000); await status(); continue }
    stats.admitted++
    const id = run.json.runId
    let done = false, stream
    // Like the browser's EventSource: open while the run is live, closed once the run is terminal.
    const sse = call('GET', `/runs/${id}/events`, { cookie, ip, sse: true }).then(r => new Promise(end => {
      if (!r.stream) return end()
      stream = r.stream
      if (done) r.stream.destroy()
      const close = setTimeout(() => { r.stream.destroy(); end() }, 90000)
      r.stream.on('close', () => { clearTimeout(close); end() })
      r.stream.setEncoding('utf8')
      r.stream.on('data', chunk => { if (/"phase":"(?:DONE|FAILED|STOPPED)"/.test(chunk)) done = true })
      r.stream.on('end', () => { clearTimeout(close); end() }); r.stream.on('error', () => { clearTimeout(close); end() })
    }))
    const deadline = Date.now() + 120000
    let lastRun = 0, lastStatus = 0
    while (!done && Date.now() < deadline) {
      if (Date.now() - lastStatus >= 3000) { lastStatus = Date.now(); await status() }
      if (Date.now() - lastRun >= 5000) { lastRun = Date.now(); const r = await call('GET', `/runs/${id}`, { cookie, ip }); if (['DONE', 'FAILED', 'STOPPED'].includes(r.json?.phase)) done = true }
      await wait(250)
    }
    if (done) stats.finished++
    stream?.destroy()
    await sse.catch(() => undefined)
    void scope
    await wait(2000) // reading the answer
  }
}
async function uptime() {
  while (Date.now() < stopAt) { await call('GET', '/readyz', { ip: '35.187.0.1' }); await wait(UPTIME_MS) }
}

const summary = { kind: 'local-hosted-load', at: new Date().toISOString(), source: flag('source', ''), readinessMode: INLINE_READINESS ? 'inline (pre-H7)' : 'background (H7)', guard: guardRef ? `docker/hosted/start.mjs at ${guardRef}` : 'docker/hosted/start.mjs (this checkout)', visitors: VISITORS, seconds: SECONDS, uptimeEveryMs: UPTIME_MS, readinessRefreshMs: READINESS, mode: 'HOSTED=1 · fixture models · simulated rail · ephemeral ports', cloud: false }
summary.sourceFiles = Object.fromEntries(['scripts/hosted-load.mjs', 'server/routes.ts', 'server/hosted/routes.ts', 'server/hosted/limits.ts', 'server/hosted/queue.ts', 'server/hosted/readiness.ts'].map(file => [file, existsSync(join(root, file)) ? createHash('sha256').update(readFileSync(join(root, file))).digest('hex') : null]))
try {
  start(['--import', 'tsx', 'publisher/server.ts'])
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${pub}/health`)).ok) break } catch { /* starting */ } await wait(200) }
  start([guard], { ROLE: 'api', PORT: String(guardPort), RAW_API_PORT: String(raw), HOSTED_LISTEN: '127.0.0.1', HOSTED_BUNDLE: join(dir, 'api.mjs'), NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import tsx`.trim() })
  let ready = false
  for (let i = 0; i < 300 && !ready; i++) { const r = await call('GET', '/api/demo/status', {}); ready = r.json?.state === 'ready' && Object.keys(r.json.capabilities ?? {}).length > 0; if (!ready) await wait(200) }
  if (!ready) throw new Error('HG never became ready behind the guard')
  records.length = 0
  const sessions = () => { const db = new DatabaseSync(env.APP_DB, { readOnly: true }); try { return Number(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get().n) } finally { db.close() } }
  const sessionsBefore = sessions()
  t0 = Date.now(); stopAt = t0 + SECONDS * 1000
  await Promise.all([...Array.from({ length: VISITORS }, (_, i) => visitor(i)), uptime()])
  const lag = existsSync(lagFile) ? JSON.parse(readFileSync(lagFile, 'utf8')) : undefined
  const sessionsAfter = sessions()
  const count = (rs, k) => rs.filter(r => r.kind === k).length
  const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] : null }
  const routes = {}
  for (const r of records) (routes[`${r.method} ${r.route}`] ??= []).push(r)
  Object.assign(summary, {
    requests: records.length,
    guardPaused: count(records, 'guard-paused'),
    guardPausedVisitor: records.filter(r => r.kind === 'guard-paused' && r.route !== '/readyz').length,
    readyz: { checks: routes['GET /readyz']?.length ?? 0, ok: count(routes['GET /readyz'] ?? [], 'ok'), guardPaused: count(routes['GET /readyz'] ?? [], 'guard-paused'), hgNotReady: (routes['GET /readyz'] ?? []).filter(r => r.kind === 'other').map(r => r.readiness ?? r.status).reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}) },
    hgPaused: count(records, 'hg-paused'), refused429: records.filter(r => r.kind === 'refused-429').reduce((m, r) => ({ ...m, [r.error ?? '429']: (m[r.error ?? '429'] ?? 0) + 1 }), {}),
    other: records.filter(r => r.kind === 'other' && r.route !== '/readyz').map(r => `${r.method} ${r.route} ${r.status} ${r.error ?? ''}`.trim()).reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}),
    runs: stats,
    sessionsMinted: sessionsAfter - sessionsBefore,
    eventLoopDelayMs: lag && { p50: +lag.p50.toFixed(1), p99: +lag.p99.toFixed(1), max: +lag.max.toFixed(1) },
    readinessRefreshes: lag?.refreshes.length,
    routes: Object.fromEntries(Object.entries(routes).map(([k, rs]) => [k, { n: rs.length, p50: pct(rs.map(r => r.ms), 50), p95: pct(rs.map(r => r.ms), 95), max: Math.max(...rs.map(r => r.ms)), guardPaused: count(rs, 'guard-paused') }])),
    guardPausedSamples: records.filter(r => r.kind === 'guard-paused').slice(0, 20).map(r => ({ t: r.t, route: `${r.method} ${r.route}`, ms: r.ms })),
  })
  if (FLOOD > 0) {
    // A scripted client that never keeps a cookie: every request is a new visitor to the gateway. One address, 12 in flight.
    records.length = 0
    const scripted = '203.0.113.77', beforeFlood = sessions(), tally = { requests: FLOOD, sessionsMinted: 0, refused: {} }
    let sent = 0
    const started = Date.now()
    await Promise.all(Array.from({ length: 12 }, async () => {
      while (sent < FLOOD) {
        sent++
        const r = await call('GET', '/api/demo/status', { ip: scripted })
        if (r.status === 200 && r.set) tally.sessionsMinted++
        else tally.refused[`${r.status} ${r.error ?? ''}`.trim()] = (tally.refused[`${r.status} ${r.error ?? ''}`.trim()] ?? 0) + 1
      }
    }))
    // The next real visitor, from another address, with no cookie.
    const afterFlood = sessions()
    const visitor = await call('GET', '/api/demo/status', { ip: '198.51.100.200' })
    summary.flood = { fromOneAddress: scripted, ...tally, seconds: +((Date.now() - started) / 1000).toFixed(1), sessionTableAfter: sessions(), sessionsAddedByFlood: afterFlood - beforeFlood,
      nextRealVisitor: { http: visitor.status, state: visitor.json?.state, ask: visitor.json?.capabilities?.ask, error: visitor.error, gotSession: Boolean(visitor.set) } }
  }
  if (pausedCheck) {
    // The operator pause must still reach visitors: HG's own paused state and refusals, through the guard.
    control(true)
    records.length = 0
    let cookie = '', csrf = ''
    const s = await call('GET', '/api/demo/status', { ip: '198.51.100.99' }); cookie = s.set ?? ''; csrf = s.json?.csrfToken ?? ''
    const ask = await call('POST', '/runs', { cookie, ip: '198.51.100.99', csrf, key: randomUUID(), body: { question: questions[0], budgetMinor: 200 } })
    const scope = await call('POST', '/api/scope', { cookie, ip: '198.51.100.99', csrf, key: randomUUID(), body: { question: questions[1], clarify: 'never' } })
    const readyz = await call('GET', '/readyz', { ip: '35.187.0.1' })
    summary.pausedControl = { status: { http: s.status, state: s.json?.state, ask: s.json?.capabilities?.ask }, submit: { http: ask.status, error: ask.error }, scope: { http: scope.status, error: scope.error }, readyz: { http: readyz.status, status: readyz.json?.status } }
  }
  const text = JSON.stringify(summary, null, 2)
  if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, text + '\n') }
  console.log(text)
} finally {
  await scope.close()
}
