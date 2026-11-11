import { it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { randomBytes } from 'node:crypto'
import { resources } from './helpers/resource-scope'
import { initialJsGzip, checkBundleBudget, INITIAL_JS_BUDGET } from '../scripts/bundle-budget.mjs'

it('counts only static transitive imports once, including a diamond and cycle; excludes optional chunks', () => {
  const dir = resources().tempDir('ra-bundle-')
  mkdirSync(join(dir, '.vite'))
  writeFileSync(join(dir, '.vite/manifest.json'), JSON.stringify({
    'index.html': { file: 'app.js', imports: ['left', 'right'], dynamicImports: ['optional'] },
    left: { file: 'left.js', imports: ['common'] }, right: { file: 'right.js', imports: ['common'] },
    common: { file: 'common.js', imports: ['index.html'] }, optional: { file: 'optional.js' },
  }))
  for (const file of ['app.js', 'left.js', 'right.js', 'common.js']) writeFileSync(join(dir, file), file)
  const chunks = initialJsGzip(dir)
  expect(chunks).toHaveLength(4)
  for (const chunk of chunks) expect(chunk.gzip).toBe(gzipSync(chunk.file).length)
  expect(checkBundleBudget(dir).bytes).toBe(chunks.reduce((sum, chunk) => sum + chunk.gzip, 0))
  // Incompressible bytes reproduce a static budget failure without launching a browser.
  writeFileSync(join(dir, 'app.js'), randomBytes(INITIAL_JS_BUDGET + 1))
  expect(() => checkBundleBudget(dir)).toThrow(/must be below 170000/)
})
