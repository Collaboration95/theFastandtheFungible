// Offline: serialized size of the escrow-v1 quote Memo vs XRPL's 1 KiB Memos limit.
// Synthetic terms (no wallet, no network). Sizes use ripple-binary-codec, the encoder xrpl.js signs with.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { assert } from './common.mjs'
const { coreTypes } = createRequire(import.meta.url)('ripple-binary-codec')
const LIMIT = 1024
const hex = s => Buffer.from(s).toString('hex').toUpperCase()
const canon = v => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v)
// rippled sums STArray::add over the Memos; the codec appends one array end marker (0xF1) that rippled does not count.
const memosSize = memos => coreTypes.STArray.from(memos).toBytes().length - 1
const memo = terms => [{ Memo: { MemoType: hex('researchagent/escrow-v1'), MemoData: hex(canon(terms)) } }]

const issuer = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
const base = {
  scheme: 'escrow-v1', network: 'xrpl:1', quoteId: 'q-' + 'a1'.repeat(16), publisherSlug: 'team-builder-notes', articleId: 'xrpl-escrow-fees-and-res-v2626', version: '2026-11-04',
  manifestRoot: 'b3'.repeat(32), amount: '0.90', payer: issuer, payTo: issuer, condition: 'A0258020' + 'C4'.repeat(32) + '810120', cancelAfter: 815000000,
  keyReveal: { ciphertextHash: 'd5'.repeat(32), plaintextHash: 'e6'.repeat(32), iv: 'F7'.repeat(12), tag: '08'.repeat(16) },
}
const iou = { currency: 'SGT', issuer, label: 'TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD' }
const digest = createHash('sha256').update('example intent').digest()
const cases = [
  { name: 'XRP, intent id = SHA-256 as 64 hex chars', terms: { ...base, asset: 'XRP', intentId: digest.toString('hex') } },
  { name: 'IOU, intent id = SHA-256 as 64 hex chars (rejected live, 7 Nov)', terms: { ...base, asset: iou, intentId: digest.toString('hex') } },
  { name: 'IOU, intent id = SHA-256 as 43 base64url chars (our workaround)', terms: { ...base, asset: iou, intentId: digest.toString('base64url') } },
]
const sizes = cases.map(c => ({ ...c, size: memosSize(memo(c.terms)), data: Buffer.byteLength(canon(c.terms)) }))
for (const s of sizes) console.log(`${String(s.size).padStart(5)} bytes serialized Memos (MemoData ${s.data} bytes) ${s.size > LIMIT ? 'REJECTED  ' : 'ok        '} ${s.name}`)
assert.equal(sizes[1].data, 997, 'calibrated to the 997-byte MemoData observed live')
assert.ok(sizes[0].size <= LIMIT && sizes[2].size <= LIMIT && sizes[1].size > LIMIT)
console.log(`Headroom after the workaround: ${LIMIT - sizes[2].size} bytes. Synthetic values calibrated to the 997-byte MemoData of the 7 Nov live rejection (docs/BUILDER-FEEDBACK.md); no wallet, signing or network.`)
