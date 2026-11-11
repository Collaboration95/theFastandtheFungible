import { read, assert } from './common.mjs'
const evidence=read('docs/evidence/rlusd.md')
assert.ok(evidence.includes('2174353408'))
assert.equal((2174353408 & 0x40000000) >>> 0,0)
if (process.argv.includes('--live')) await import('../ledger-dry-run.mjs')
else console.log('Recorded issuer flags lack AllowTrustLineLocking; historical refusal was document-derived. Use --live for unsigned rippled simulate on both networks.')
