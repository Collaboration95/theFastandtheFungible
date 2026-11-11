import { defineConfig } from 'vite'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { packRecording } from './recording-codec'
import recordingIndex from './recording-index.json'
// The replay bundles the same App, so the lazy in-browser receipt verifier needs the same browser shims as the root vite.config.ts.
const shim = (file: string) => fileURLToPath(new URL(`../src/verify/shims/${file}`, import.meta.url))
export default defineConfig({
  root: 'demo', base: '/theFastandtheFungible/demo/', plugins: [react(), {
    name: 'compressed-audited-replays', enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        if (!bundle) return []
        const app = Object.values(bundle ?? {}).find(item => item.type === 'chunk' && item.moduleIds.some(id => id.endsWith('/src/main.tsx')))
        if (!app || app.type !== 'chunk') throw Error('Replay app chunk was not emitted')
        const recordings = recordingIndex.map(({ scenario, runId }) => {
          const chunk = Object.values(bundle).find(item => item.type === 'chunk' && item.moduleIds.some(id => id.endsWith(`/demo/traces/${scenario}.json`)))
          if (!chunk) throw Error(`Replay chunk missing: ${scenario}`)
          return [scenario, runId, chunk.fileName]
        })
        // Download the shared app while the replay entry validates its selected trace.
        // Preloading does not execute it before the transport shim is installed.
        return [
          // Resolve the same scenario/run precedence as the entry, before its schema dependency arrives.
          { tag: 'script', children: `(()=>{const p=new URLSearchParams(location.search),r=${JSON.stringify(recordings)},s=r.find(v=>v[0]===p.get('scenario'))??r.find(v=>v[1]===p.get('run'))??r.find(v=>v[0]==='UC3-key-reveal'),l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href='/theFastandtheFungible/demo/'+s[2];document.head.append(l)})()` },
          { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/theFastandtheFungible/demo/${app.fileName}` } },
          ...[...app.viteMetadata?.importedCss ?? []].map(file => ({ tag: 'link', attrs: { rel: 'stylesheet', href: `/theFastandtheFungible/demo/${file}` } })),
        ]
      },
    },
    transform(_code, id) {
      if (!/[/\\]demo[/\\]traces[/\\]UC[^?]*\.json$/.test(id) && !/[/\\]docs[/\\]evidence[/\\](?:replay-nov11[/\\]key-reveal|round4-j1[/\\]replays[/\\](?:no-show|payment))[/\\]transactions\.json$/.test(id)) return
      // Keep raw evidence in Git; restore exactly the same JSON before schema validation.
      const packed = gzipSync(packRecording(JSON.parse(readFileSync(id, 'utf8'))), { level: 9 }).toString('base64')
      return { code: `import {unpackRecording} from ${JSON.stringify(fileURLToPath(new URL('./recording-codec.ts', import.meta.url)))};export default await new Response(new Blob([Uint8Array.from(atob(${JSON.stringify(packed)}), c => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(unpackRecording)`, map: null }
    },
  }],
  publicDir: false,
  resolve: { alias: [{ find: /^node:crypto$/, replacement: shim('node-crypto.ts') }, { find: /^ws$/, replacement: shim('ws.ts') }] },
  build: { outDir: '../site/demo', emptyOutDir: true },
})
