import { describe, it, expect } from 'vitest'
import { createServer, request } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'

// The packaged API guard (docker/hosted/start.mjs) forwards public traffic only after HG
// answers /api/demo/status for the visitor's exact Host. Cloud deploy on 11 Nov showed the
// probe used fetch(), which drops Host, so HG denied every probe and the demo stayed paused.
const host = 'ra-front-000000000000.asia-southeast1.run.app'
const freePort = () => new Promise<number>(resolve => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address() as { port: number }; s.close(() => resolve(port)) }) })
const get = (port: number, path: string, headers: Record<string, string>) => new Promise<{ status: number; body: string }>((resolve, reject) => {
  const r = request({ hostname: '127.0.0.1', port, path, headers }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', c => { body += c }); res.on('end', () => resolve({ status: res.statusCode ?? 0, body })) })
  r.on('error', reject); r.end()
})

describe('hosted API supervisor', () => {
  it('probes HG with the exact public Host and forwards only when the contract answers', async () => {
    const scope = resources(), dir = scope.tempDir('ra-hosted-supervisor-')
    // Fake HG: like server/hosted/session.ts, it denies any Host other than the public origin.
    writeFileSync(join(dir, 'api.mjs'), `import {createServer} from 'node:http'
createServer((req,res)=>{
  res.setHeader('Content-Type','application/json')
  if (req.headers.host !== ${JSON.stringify(host)}) { res.writeHead(403); res.end(JSON.stringify({error:'origin_denied'})); return }
  if (req.url === '/api/demo/status') { res.end(JSON.stringify({state:'paused',capabilities:{ask:false},remaining:{questions:0,minor:0},labels:{models:'m',rail:'r'},xff:req.headers['x-forwarded-for']||null})); return }
  if (req.url === '/registry') { fetch(process.env.PUBLISHER_URL + '/registry').then(r => r.json()).then(body => res.end(JSON.stringify(body)), () => { res.writeHead(502); res.end('{}') }); return }
  res.end(JSON.stringify({forwarded:true,path:req.url}))
}).listen(Number(process.env.PORT),'127.0.0.1')
`)
    // Fake publisher on its own port, standing in for the separate compose container.
    const publisher = createServer((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ publishers: ['via-relay'] })) })
    scope.defer(() => new Promise<void>(r => { publisher.closeAllConnections(); publisher.close(() => r()) }))
    await new Promise<void>(r => publisher.listen(0, '127.0.0.1', () => r()))
    const upstream = (publisher.address() as { port: number }).port
    const port = await freePort(), raw = await freePort(), loopback = await freePort()
    const child = scope.spawn(process.execPath, ['docker/hosted/start.mjs'], { env: { ...process.env, HOSTED: '1', ROLE: 'api', PORT: String(port), RAW_API_PORT: String(raw), HOSTED_LISTEN: '127.0.0.1', HOSTED_BUNDLE: join(dir, 'api.mjs'), K_SERVICE: '', PUBLISHER_URL: `http://127.0.0.1:${loopback}`, HOSTED_PUBLISHER_UPSTREAM: `127.0.0.1:${upstream}` } })
    expect(child.pid).toBeTruthy()
    let live = 0
    for (let i = 0; i < 100 && live !== 200; i++) { live = await get(port, '/livez', { host }).then(r => r.status, () => 0); if (live !== 200) await new Promise(r => setTimeout(r, 100)) }
    expect(live).toBe(200)
    // Allow the fake HG to bind as well.
    let status = { status: 0, body: '' }
    for (let i = 0; i < 50; i++) { status = await get(port, '/api/demo/status', { host, 'x-forwarded-for': '203.0.113.7' }); if (JSON.parse(status.body).capabilities?.ask === false) break; await new Promise(r => setTimeout(r, 100)) }
    expect(JSON.parse(status.body)).toMatchObject({ state: 'paused', capabilities: { ask: false }, xff: '203.0.113.7' })
    expect(JSON.parse((await get(port, '/api/runs', { host })).body)).toEqual({ forwarded: true, path: '/api/runs' })
    // The API's pinned loopback publisher origin reaches the separate publisher through the relay.
    expect(JSON.parse((await get(port, '/registry', { host })).body)).toEqual({ publishers: ['via-relay'] })
    // A different Host is denied by HG, so the guard fails closed: paused status, 503 elsewhere.
    expect(JSON.parse((await get(port, '/api/demo/status', { host: 'evil.example' })).body).capabilities).toEqual({})
    expect((await get(port, '/api/runs', { host: 'evil.example' })).status).toBe(503)
    child.kill('SIGTERM')
  }, 30000)
})
