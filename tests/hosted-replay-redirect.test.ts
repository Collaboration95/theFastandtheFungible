import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
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
