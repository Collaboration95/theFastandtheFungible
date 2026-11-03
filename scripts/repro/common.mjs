import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
export { assert }
export const read = p => readFileSync(new URL('../../'+p,import.meta.url),'utf8')
export const json = p => JSON.parse(read(p))
assert.equal(json('node_modules/x402-xrpl/package.json').version,'0.3.4','Run npm ci: repros pin x402-xrpl 0.3.4')
