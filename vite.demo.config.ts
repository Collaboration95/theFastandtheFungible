import { defineConfig } from 'vite'
import { gzipSync } from 'node:zlib'
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: 'demo', base: '/theFastandtheFungible/demo/', plugins: [react(), {
    name: 'compressed-audited-replays', enforce: 'post',
    closeBundle() { mkdirSync('site/evidence', { recursive: true }); copyFileSync('docs/evidence/real-writers.json', 'site/evidence/real-writers.json') },
    transform(_code, id) {
      if (!/[/\\]demo[/\\]traces[/\\]UC[^?]*\.json$/.test(id)) return
      // Keep raw evidence in Git; encode the identical bytes for the static replay.
      const packed = gzipSync(readFileSync(id)).toString('base64')
      return { code: `export default new Response(new Blob([Uint8Array.from(atob(${JSON.stringify(packed)}), c => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(JSON.parse)`, map: null }
    },
  }],
  publicDir: false,
  build: { outDir: '../site/demo', emptyOutDir: true },
})
