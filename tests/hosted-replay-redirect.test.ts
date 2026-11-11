import { expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import { hostedLinks } from '../src/hosted.js'
const replay = 'https://collaboration95.github.io/theFastandtheFungible/demo/'
it('both hosted nginx layers redirect /demo and /demo/ before the SPA fallback', () => {
  for (const path of ['docker/hosted/front/default.conf.template','docker/hosted/nginx.conf']) {
    const config = readFileSync(path,'utf8')
    for (const route of ['/demo','/demo/']) expect(config).toContain(`location = ${route} { return 302 ${replay}; }`)
  }
})
it('the hosted walkthrough and scenario links are absolute published replay URLs', () => {
  const links = hostedLinks({status:{links:{repo:'https://github.com/Collaboration95/theFastandtheFungible',replay}}} as never)
  expect(links.replay).toBe(replay)
  expect(links.keyReveal).toBe(replay+'?scenario=UC-key-reveal')
  expect(readFileSync('docker/hosted/paused.html','utf8')).toContain(`href="${replay}"`)
  expect(readFileSync('src/components/Connecting.tsx','utf8')).toContain(`href="${replay}"`)
})

// Native nginx is optional on developer machines; both production configs are also pinned above.
// The local shipping gate runs these request-level probes with nginx installed.
it.skipIf(spawnSync('nginx', ['-v']).status !== 0).each(['front/default.conf.template', 'nginx.conf'])('production %s redirects HEAD requests with the API offline', async file => {
  const scope = resources(), dir = scope.tempDir('hosted-redirect-')
  const socket = createServer().listen(0, '127.0.0.1'); await once(socket, 'listening')
  const port = (socket.address() as {port:number}).port
  await new Promise<void>(done => socket.close(() => done()))
  let config = readFileSync(`docker/hosted/${file}`, 'utf8')
    .replace('listen 8080;', `listen 127.0.0.1:${port};`)
    .replace('include /etc/nginx/mime.types;', 'types { text/html html; }')
    .replace('/etc/nginx/proxy-headers.conf', resolve('docker/hosted/proxy-headers.conf'))
    .replace('/usr/share/nginx/html', dir)
    .replaceAll('${VM_UPSTREAM}', '127.0.0.1:1').replaceAll('${HOSTED_VIDEO_URL}', '')
  for (const name of ['nginx.pid','client','proxy','fastcgi','uwsgi','scgi']) config = config.replaceAll(`/tmp/${name}`, join(dir,name))
  if (file.startsWith('front/')) config = `pid ${join(dir,'nginx.pid')}; events {} http { ${config} }`
  mkdirSync(join(dir,'logs'))
  const path = join(dir,'nginx.conf'); writeFileSync(path,config)
  scope.spawn('nginx', ['-p', dir, '-c', path, '-g', 'daemon off;'])
  const head = (path: string) => fetch(`http://127.0.0.1:${port}${path}`, {method:'HEAD',redirect:'manual'})
  let ready = false
  for (let i=0; i<60; i++) { try { await head('/demo'); ready=true; break } catch { await new Promise(r=>setTimeout(r,25)) } }
  expect(ready).toBe(true)
  for (const path of ['/demo','/demo/']) {
    const response = await head(path)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(replay)
    expect(response.headers.get('cache-control')).toBe('no-store')
  }
})
