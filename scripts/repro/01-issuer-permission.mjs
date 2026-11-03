import { read, assert } from './common.mjs'
const evidence=read('docs/evidence/rlusd.md')
assert.ok(evidence.includes('2174353408'))
assert.equal((2174353408 & 0x40000000) >>> 0,0)
console.log('Recorded issuer flags lack AllowTrustLineLocking; tecNO_PERMISSION is document-derived, never submitted.')
