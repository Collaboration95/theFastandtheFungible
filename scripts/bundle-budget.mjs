import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// The deploy's browser-perf test and every local production build use this exact calculation.
export const INITIAL_JS_BUDGET = 170_000
export function initialJsGzip(dist = 'dist') {
  const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'))
  const files = new Set()
  const visit = key => {
    const chunk = manifest[key]
    if (files.has(chunk.file)) return
    files.add(chunk.file)
    chunk.imports?.forEach(visit)
  }
  visit('index.html')
  return [...files].map(file => ({ file, gzip: gzipSync(readFileSync(resolve(dist, file))).length }))
}
export function checkBundleBudget(dist = 'dist') {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw Error(`Bundle budget requires Node 22, matching deploy (current ${process.version})`)
  const chunks = initialJsGzip(dist), bytes = chunks.reduce((total, chunk) => total + chunk.gzip, 0)
  if (bytes >= INITIAL_JS_BUDGET) throw Error(`Initial JS gzip ${bytes} bytes must be below ${INITIAL_JS_BUDGET}; lazy-load optional UI before shipping`)
  return { bytes, budget: INITIAL_JS_BUDGET, chunks }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(checkBundleBudget(), null, 2))
}
