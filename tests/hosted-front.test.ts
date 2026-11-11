import { expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { createServer, request as http, type Server } from 'node:http'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'

// H7: the Cloud Run front's template, rendered the way the nginx image's entrypoint does (envsubst on the filtered variables)
// and run on a loopback port. The page it shows when the demo server is down, and the two public aliases to the VM.
const has = (bin: string) => spawnSync('which', [bin]).status === 0
const ready = has('nginx') && has('envsubst')
const freePort = () => new Promise<number>(resolve => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address() as { port: number }; s.close(() => resolve(port)) }) })
const get = (port: number, path: string, encoding = '') => new Promise<{ status: number; type: string; body: string; headers: import('node:http').IncomingHttpHeaders; rawHeaders: string[] }>((resolve, reject) => {
  const req = http({ hostname: '127.0.0.1', port, path, headers: { host: 'demo.example', 'Accept-Encoding': encoding } }, res => {
    let body = ''; res.setEncoding('utf8'); res.on('data', c => { body += c }); res.on('end', () => resolve({ status: res.statusCode!, type: String(res.headers['content-type']), body, headers: res.headers, rawHeaders: res.rawHeaders }))
  })
  req.on('error', reject); req.end()
})
async function front(env: Record<string, string>, upstream: 'closed' | 'echo') {
  const scope = resources(), dir = scope.tempDir('ra-front-'), port = await freePort()
  const upstreamPort = await freePort()
  let server: Server | undefined
  const seen: string[] = []
  if (upstream === 'echo') {
    server = createServer((req, res) => { seen.push(req.url ?? ''); res.setHeader('Cache-Control', req.url?.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store'); res.setHeader('Content-Type', 'application/javascript'); res.end('/* fixture */' + 'const x = 1;'.repeat(200)) })
    await new Promise<void>(resolve => server!.listen(upstreamPort, '127.0.0.1', resolve))
    scope.defer(() => new Promise<void>(resolve => { server!.closeAllConnections(); server!.close(() => resolve()) }))
  }
  mkdirSync(join(dir, 'html')); mkdirSync(join(dir, 'tmp'))
  copyFileSync('docker/hosted/paused.html', join(dir, 'html/paused.html'))
  // The entrypoint substitutes only the variables the Dockerfile's filter names; here the same two.
  const filter = readFileSync('docker/hosted/front/Dockerfile', 'utf8').match(/^ENV NGINX_ENVSUBST_FILTER="([^"]+)"/m)![1]
  const names = Object.keys({ VM_UPSTREAM: 1, HOSTED_VIDEO_URL: 1 }).filter(name => new RegExp(filter).test(name))
  const rendered = spawnSync('envsubst', [names.map(n => `\${${n}}`).join(' ')], { input: readFileSync('docker/hosted/front/default.conf.template', 'utf8'), encoding: 'utf8', env: { ...process.env, VM_UPSTREAM: `127.0.0.1:${upstreamPort}`, HOSTED_VIDEO_URL: '', ...env } })
  expect(rendered.status, rendered.stderr).toBe(0)
  expect(rendered.stdout).not.toMatch(/\$\{[A-Z_]+\}/) // nothing left for nginx to misread as a variable
  writeFileSync(join(dir, 'default.conf'), rendered.stdout.replace('listen 8080', `listen 127.0.0.1:${port}`).replace('/usr/share/nginx/html', join(dir, 'html')).replace('error_log /dev/stderr crit', `error_log ${join(dir, 'error.log')} crit`))
  writeFileSync(join(dir, 'nginx.conf'), `pid ${join(dir, 'nginx.pid')};\nerror_log ${join(dir, 'main.log')};\nevents {}\nhttp { client_body_temp_path ${dir}/tmp/c; proxy_temp_path ${dir}/tmp/p; fastcgi_temp_path ${dir}/tmp/f; uwsgi_temp_path ${dir}/tmp/u; scgi_temp_path ${dir}/tmp/s; access_log off; include ${join(dir, 'default.conf')}; }\n`)
  const test = spawnSync('nginx', ['-t', '-c', join(dir, 'nginx.conf')], { encoding: 'utf8' })
  expect(test.status, test.stderr).toBe(0)
  const child = scope.spawn('nginx', ['-c', join(dir, 'nginx.conf'), '-g', 'daemon off;']); child.stdout.resume(); child.stderr.resume()
  for (let i = 0; i < 50; i++) { try { await get(port, '/livez'); break } catch { await new Promise(r => setTimeout(r, 100)) } }
  return { port, seen }
}

it.skipIf(!ready)('shows the branded paused page with a 503 when the demo server is down, and fills in the video link once the front has one', async () => {
  const withVideo = await front({ HOSTED_VIDEO_URL: 'https://youtu.be/abc123' }, 'closed')
  const page = await get(withVideo.port, '/')
  expect(page.status).toBe(503); expect(page.type).toContain('text/html')
  expect(page.body).toContain('id="video" href="https://youtu.be/abc123"')
  for (const text of ['The shared demo is paused', 'XRPL Testnet · no real value', 'Watch the recorded walkthrough', 'Watch the demo video', 'Slide deck', 'Source code'])
    expect(page.body).toContain(text)
  const none = await front({}, 'closed')
  // No video configured: the link stays empty, and the page's own style hides an empty link.
  expect((await get(none.port, '/')).body).toContain('id="video" href=""')
  expect((await get(none.port, '/api/demo/status')).status).toBe(503)
})

it.skipIf(!ready)('maps /ready and /ready/funds to the VM’s /readyz and /readyz/funds, and answers the liveness paths itself', async () => {
  const { port, seen } = await front({}, 'echo')
  expect((await get(port, '/ready')).status).toBe(200)
  expect((await get(port, '/ready/funds')).status).toBe(200)
  expect(seen).toEqual(['/readyz', '/readyz/funds'])
  expect((await get(port, '/livez')).body).toBe('alive')
})

it('the paused page is the product’s light theme, self-contained, and the front declares the video variable', () => {
  const page = readFileSync('docker/hosted/paused.html', 'utf8')
  // The product's tokens (src/tokens.css), light only.
  for (const token of ['#FBF8F2', '#24211E', '#655D55', '#E8E2D8', '#8F8579', '#8A5F17', 'Geist Variable']) expect(page).toContain(token)
  expect(page).toContain('<meta name="color-scheme" content="light">')
  expect(page).not.toMatch(/prefers-color-scheme:\s*dark/)
  // Self-contained: no scripts, no remote styles or fonts. Every outbound reference is a link a visitor clicks.
  expect(page).not.toMatch(/<script|<link|@import|@font-face|url\(/i)
  expect([...page.matchAll(/href="(https?:[^"]+)"/g)].map(m => m[1])).toEqual([
    'https://collaboration95.github.io/theFastandtheFungible/demo/',
    'https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/submission/ResearchAgent-SFF-deck.pdf',
    'https://github.com/Collaboration95/theFastandtheFungible',
  ])
  expect(page).toContain('a[href=""]{display:none}')
  const dockerfile = readFileSync('docker/hosted/front/Dockerfile', 'utf8')
  expect(dockerfile).toMatch(/^ENV HOSTED_VIDEO_URL=$/m)
  expect(dockerfile).toMatch(/^ENV NGINX_ENVSUBST_FILTER="VM_UPSTREAM\|HOSTED_VIDEO_URL"$/m)
})

it.skipIf(!ready)('gives hashed assets exactly one immutable policy, keeps documents/API no-store, and gzips static JS', async () => {
  const { port } = await front({}, 'echo')
  const asset = await get(port, '/assets/app-contenthash.js', 'gzip')
  expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  expect(asset.rawHeaders.filter(h => h.toLowerCase() === 'cache-control')).toHaveLength(1)
  expect(asset.headers['content-encoding']).toBe('gzip')
  for (const path of ['/', '/api/demo/status', '/proof/fixture', '/verify/fixture']) expect((await get(port, path)).headers['cache-control']).toMatch(/no-store/)
})

it('both proxy whitelists forward Accept-Encoding and only the API compresses SSE', () => {
  for (const path of ['docker/hosted/proxy-headers.conf', 'docker/hosted/front/default.conf.template']) expect(readFileSync(path, 'utf8')).toContain('proxy_set_header Accept-Encoding $http_accept_encoding;')
  const front = readFileSync('docker/hosted/front/default.conf.template', 'utf8')
  expect(front).toContain('gzip_comp_level 5;')
  expect(front.match(/gzip_types ([^;]+);/)![1]).not.toContain('text/event-stream')
})
