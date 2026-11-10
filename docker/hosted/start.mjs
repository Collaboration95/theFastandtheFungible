// The raw API is loopback-only. Missing HG contracts must never expose owner mode.
import { spawn } from 'node:child_process'
import { createServer, request } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
process.umask(0o077)
if (process.env.K_SERVICE) throw new Error('Stateful hosted roles require the persistent-disk VM')
if (process.env.HOSTED !== '1') throw new Error('HOSTED=1 is required')
const role = process.env.ROLE || 'api'
const port = Number(process.env.PORT || 8788)
const raw = Number(process.env.RAW_API_PORT || 18788)
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
  child.kill('SIGTERM')
  const timer = setTimeout(() => { child.kill('SIGKILL'); process.exit(code) }, 115000)
  timer.unref()
  child.once('exit', () => process.exit(code))
}
child.once('error', () => { console.error('Hosted child could not start'); stop(1) })
child.once('exit', code => { if (!stopping) { console.error(`Hosted ${role} exited (${code})`); server?.close(); process.exitCode = 1 } })
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => stop(0))
// Ask HG whether it serves the hosted contract for this visitor's exact Host. Uses node:http
// because fetch() silently drops a Host header, and HG denies any Host but the public origin.
const states = ['ready','paused','busy','degraded','ended']
function probe(req) {
  return new Promise(resolve => {
    const headers = { host: req.headers.host || '', cookie: req.headers.cookie || '', 'x-forwarded-proto': 'https' }
    if (typeof req.headers['x-forwarded-for'] === 'string') headers['x-forwarded-for'] = req.headers['x-forwarded-for']
    const status = request({ hostname: '127.0.0.1', port: raw, path: '/api/demo/status', method: 'GET', headers, timeout: 1500 }, response => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { if (text.length < 65536) text += chunk })
      response.on('error', () => resolve(false))
      response.on('end', () => {
        try { const body = JSON.parse(text); resolve(response.statusCode === 200 && states.includes(body.state) && !!body.capabilities && !!body.remaining && !!body.labels) }
        catch { resolve(false) } // fail closed
      })
    })
    status.on('timeout', () => status.destroy())
    status.on('error', () => resolve(false))
    status.end()
  })
}
if (role === 'api') {
  const paused = readFileSync(fileURLToPath(new URL('./paused.html', import.meta.url)))
  server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const path = new URL(req.url, 'http://localhost').pathname
    if (path === '/livez') { res.writeHead(child.exitCode === null ? 200 : 503); res.end(); return }
    const qualified = await probe(req)
    if (!qualified) {
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
