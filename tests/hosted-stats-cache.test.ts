import { expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createServer, request } from 'node:http'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { resources } from './helpers/resource-scope.js'

const configs = ['front/default.conf.template', 'nginx.conf']
it.each(configs)('%s scopes its single public stats policy to the exact aggregate route', file => {
  const config = readFileSync(`docker/hosted/${file}`, 'utf8')
  const blocks = [...config.matchAll(/location = \/api\/demo\/stats \{([\s\S]*?)^\s*\}/gm)]
  expect(blocks).toHaveLength(1)
  const block = blocks[0][1]
  expect(block).toContain('proxy_hide_header Cache-Control;')
  expect(block.match(/add_header Cache-Control[^;]+;/g)).toEqual(['add_header Cache-Control "public, max-age=60" always;'])
  expect(block).toMatch(/proxy_pass (?:\$api|http:\/\/\$\{VM_UPSTREAM\});/)
  const serverHeaders = config.split(/location\s/)[0].match(/add_header[^;]+;/g) ?? []
  expect(serverHeaders).toContain('add_header Cache-Control no-store always;')
  // Location add_header disables inheritance. Preserve any present/future security headers.
  for (const header of serverHeaders.filter(h => !h.startsWith('add_header Cache-Control '))) expect(block).toContain(header)
})

const freePort = async () => {
  const server = createServer().listen(0, '127.0.0.1'); await once(server, 'listening')
  const port = (server.address() as { port: number }).port
  await new Promise<void>(done => server.close(() => done()))
  return port
}
const get = (port: number, path: string, method = 'GET') => new Promise<{ status: number; policies: string[]; security: string | undefined }>((resolve, reject) => {
  const req = request({ hostname: '127.0.0.1', port, path, method }, res => {
    const policies = res.rawHeaders.flatMap((h, i) => i % 2 === 0 && h.toLowerCase() === 'cache-control' ? [res.rawHeaders[i + 1]] : [])
    res.resume(); res.on('end', () => resolve({ status: res.statusCode!, policies, security: res.headers['x-content-type-options'] as string | undefined }))
  })
  req.on('error', reject); req.end()
})

it.skipIf(spawnSync('nginx', ['-v']).status !== 0)('both real nginx layers replace upstream cache headers only for stats', async () => {
  const scope = resources(), dir = scope.tempDir('stats-cache-')
  const upstream = createServer((_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end('{}')
  }).listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  scope.defer(() => new Promise<void>(done => { upstream.closeAllConnections(); upstream.close(() => done()) }))
  let upstreamPort = (upstream.address() as { port: number }).port
  // VM first, then Cloud Run front: exercise each layer and their combined response.
  for (const [index, file] of [...configs].reverse().entries()) {
    const port = await freePort(), root = join(dir, String(index))
    mkdirSync(join(root, 'logs'), { recursive: true })
    let config = readFileSync(`docker/hosted/${file}`, 'utf8')
      .replace('listen 8080;', `listen 127.0.0.1:${port};`)
      .replace('include /etc/nginx/mime.types;', 'types { text/html html; }')
      .replaceAll('/etc/nginx/proxy-headers.conf', resolve('docker/hosted/proxy-headers.conf'))
      .replaceAll('http://api:8788', `http://127.0.0.1:${upstreamPort}`)
      .replaceAll('${VM_UPSTREAM}', `127.0.0.1:${upstreamPort}`).replaceAll('${HOSTED_VIDEO_URL}', '')
    for (const name of ['nginx.pid', 'client', 'proxy', 'fastcgi', 'uwsgi', 'scgi']) config = config.replaceAll(`/tmp/${name}`, join(root, name))
    if (file.startsWith('front/')) config = `pid ${join(root, 'nginx.pid')}; events {} http { ${config} }`
    const path = join(root, 'nginx.conf'); writeFileSync(path, config)
    const check = spawnSync('nginx', ['-t', '-p', root, '-c', path], { encoding: 'utf8' })
    expect(check.status, check.stderr).toBe(0)
    scope.spawn('nginx', ['-p', root, '-c', path, '-g', 'daemon off;'])
    let ready = false
    for (let n = 0; n < 60; n++) {
      try { await get(port, '/api/demo/stats'); ready = true; break } catch { await new Promise(r => setTimeout(r, 25)) }
    }
    expect(ready).toBe(true)
    for (const method of ['GET', 'HEAD']) expect(await get(port, '/api/demo/stats', method)).toEqual({ status: 200, policies: ['public, max-age=60'], security: 'nosniff' })
    for (const route of ['/api/demo/status', '/api/demo/stats/']) {
      const response = await get(port, route)
      expect(response.status).toBe(200)
      expect(response.policies).toEqual(Array(index + 2).fill('no-store'))
    }
    upstreamPort = port
  }
})
