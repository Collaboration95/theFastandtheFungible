// The raw API is loopback-only. Missing HG contracts must never expose owner mode.
import { spawn } from 'node:child_process'
import { createServer, request } from 'node:http'
import { createServer as createRelay, connect } from 'node:net'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
process.umask(0o077)
if (process.env.K_SERVICE) throw new Error('Stateful hosted roles require the persistent-disk VM')
if (process.env.HOSTED !== '1') throw new Error('HOSTED=1 is required')
const role = process.env.ROLE || 'api'
const port = Number(process.env.PORT || 8788)
const raw = Number(process.env.RAW_API_PORT || 18788)
// The API only accepts a pinned numeric-loopback publisher origin (server/publisher-client.ts).
// In compose the publisher is its own container, so the API supervisor relays the loopback
// PUBLISHER_URL port to HOSTED_PUBLISHER_UPSTREAM (host:port on the private compose network).
let relay
const upstream = role === 'api' ? process.env.HOSTED_PUBLISHER_UPSTREAM : undefined
if (upstream) {
  const target = /^([a-z0-9.-]+):(\d{1,5})$/.exec(upstream)
  const local = new URL(process.env.PUBLISHER_URL || 'http://127.0.0.1:8790')
  if (!target || local.hostname !== '127.0.0.1') throw new Error('HOSTED_PUBLISHER_UPSTREAM needs host:port and a 127.0.0.1 PUBLISHER_URL')
  relay = createRelay(socket => {
    const out = connect(Number(target[2]), target[1])
    socket.on('error', () => out.destroy()); out.on('error', () => socket.destroy())
    socket.pipe(out).pipe(socket)
  }).listen(Number(local.port || 80), '127.0.0.1')
}
const child = spawn(process.execPath, [process.env.HOSTED_BUNDLE || `/app/dist/${role}.mjs`], {
  env: { ...process.env, ...(role === 'api' ? { HOST: '127.0.0.1', PORT: String(raw) } : {}) },
  // Dependency diagnostics can contain URLs/configuration. Report exits only.
  stdio: 'ignore',
})
let stopping = false
let server
function stop(code) {
  if (stopping) return
  stopping = true
  server?.close()
  relay?.close()
  child.kill('SIGTERM')
  const timer = setTimeout(() => { child.kill('SIGKILL'); process.exit(code) }, 115000)
  timer.unref()
  child.once('exit', () => process.exit(code))
}
child.once('error', () => { console.error('Hosted child could not start'); stop(1) })
child.once('exit', code => { if (!stopping) { console.error(`Hosted ${role} exited (${code})`); server?.close(); process.exitCode = 1 } })
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => stop(0))
// Ask HG whether it serves the hosted contract for a public Host. Uses node:http because
// fetch() silently drops a Host header, and HG denies any Host but the public origin.
//
// Whether the child is HG is fixed for its lifetime (this process exits with it), so the answer
// belongs to the child and the Host, not to each visitor request. On 11 Nov the guard probed on
// every request with the visitor's cookie and a 1.5 s timeout: HG minted a session for each
// cookieless probe and made it wait for its readiness refresh (Testnet round trips), so a slow
// refresh or a busy event loop showed visitors and the uptime check the paused page while
// nothing was paused (H6). Now a contract answer is kept per Host and re-checked in the
// background, one probe per Host at a time. An answer that is not the contract, or a refused
// connection, withdraws it at once. A re-check that is only slow keeps it until QUALIFIED_MS
// after the last good answer; after that the guard fails closed again. Probes carry the guard's
// own HG session, so they never mint visitor sessions.
const states = ['ready','paused','busy','degraded','ended']
// Tests shorten these; an override can never lengthen how long a silent child stays qualified.
const ms = (name, fallback) => Math.min(fallback, Math.max(50, Number(process.env[name]) || fallback))
const RECHECK_MS = ms('HOSTED_GUARD_RECHECK_MS', 10000), QUALIFIED_MS = ms('HOSTED_GUARD_QUALIFIED_MS', 60000), PROBE_MS = ms('HOSTED_GUARD_PROBE_MS', 5000)
const qualified = new Map() // Host -> time of the last contract answer
const probing = new Map() // Host -> the probe in flight
let probeCookie = '' // the guard's own HG session ('name=value'), refreshed whenever HG sets a new one
const sessionCookie = /^__Host-ra_session=[a-f0-9]{64}$/
function probe(host) {
  return new Promise(resolve => {
    const headers = { host, 'x-forwarded-proto': 'https', ...(probeCookie ? { cookie: probeCookie } : {}) }
    const status = request({ hostname: '127.0.0.1', port: raw, path: '/api/demo/status', method: 'GET', headers, timeout: PROBE_MS }, response => {
      const minted = [response.headers['set-cookie'] ?? []].flat().map(c => c.split(';')[0]).find(c => sessionCookie.test(c))
      if (minted) probeCookie = minted
      let text = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { if (text.length < 65536) text += chunk })
      response.on('error', () => resolve('no'))
      response.on('end', () => {
        try { const body = JSON.parse(text); resolve(response.statusCode === 200 && states.includes(body.state) && !!body.capabilities && !!body.remaining && !!body.labels ? 'yes' : 'no') }
        catch { resolve('no') } // fail closed
      })
    })
    status.on('timeout', () => { resolve('slow'); status.destroy() })
    status.on('error', () => resolve('no'))
    status.end()
  })
}
const fresh = host => Date.now() - (qualified.get(host) ?? -Infinity) < QUALIFIED_MS
function qualify(host) {
  let pending = probing.get(host)
  if (!pending) {
    pending = probe(host).then(answer => {
      if (answer === 'yes') qualified.set(host, Date.now())
      else if (answer === 'no') qualified.delete(host)
      return fresh(host)
    }).finally(() => probing.delete(host))
    probing.set(host, pending)
  }
  return pending
}
function admitted(req) {
  const host = req.headers.host || ''
  if (!fresh(host)) return qualify(host)
  if (Date.now() - qualified.get(host) >= RECHECK_MS) void qualify(host)
  return true
}
if (role === 'api') {
  const paused = readFileSync(fileURLToPath(new URL('./paused.html', import.meta.url)))
  server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const path = new URL(req.url, 'http://localhost').pathname
    if (path === '/livez') { res.writeHead(child.exitCode === null ? 200 : 503); res.end(); return }
    if (!(await admitted(req))) {
      if (path === '/api/demo/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ state: 'paused', capabilities: {}, remaining: { questions: 0, minor: 0 }, labels: { models: process.env.LLM_PROVIDER || 'fixture', rail: process.env.SETTLEMENT_RAIL || 'simulated' }, links: { replay: 'https://collaboration95.github.io/theFastandtheFungible/demo/' } })); return }
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(paused); return
    }
    const upstream = request({ hostname: '127.0.0.1', port: raw, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end() })
    req.on('aborted', () => upstream.destroy())
    res.on('close', () => upstream.destroy())
    req.pipe(upstream)
  }).listen(port, process.env.HOSTED_LISTEN || '0.0.0.0')
}
