import { read, assert } from './common.mjs'
const evidence=read('docs/evidence/rlusd.md')
assert.ok(evidence.includes('HTTP 401'));assert.ok(evidence.includes('Authentication required'))
console.log('Historical evidence replay: official mint denied unauthenticated request (401). Current access policy unmeasured; no funding request sent.')
