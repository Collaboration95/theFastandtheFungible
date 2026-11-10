import { defineConfig } from 'vite'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
// The replay bundles the same App, so the lazy in-browser receipt verifier needs the same browser shims as the root vite.config.ts.
const shim = (file: string) => fileURLToPath(new URL(`../src/verify/shims/${file}`, import.meta.url))
export default defineConfig({
  root: 'demo', base: '/theFastandtheFungible/demo/', plugins: [react(), {
    name: 'compressed-audited-replays', enforce: 'post',
    transform(_code, id) {
      if (!/[/\\]demo[/\\]traces[/\\]UC[^?]*\.json$/.test(id)) return
      // Keep raw evidence in Git; encode the identical bytes for the static replay.
      const packed = gzipSync(readFileSync(id)).toString('base64')
      return { code: `export default new Response(new Blob([Uint8Array.from(atob(${JSON.stringify(packed)}), c => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(JSON.parse)`, map: null }
    },
  }],
  publicDir: false,
  resolve: { alias: [{ find: /^node:crypto$/, replacement: shim('node-crypto.ts') }, { find: /^ws$/, replacement: shim('ws.ts') }] },
  build: { outDir: '../site/demo', emptyOutDir: true },
})
