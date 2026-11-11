// Real-node check for "Check the key yourself" (lane KEY). Run: node --import tsx docs/evidence/key-on-ledger/check.mts
// Reads the public XRPL Testnet nodes the browser verifier uses (read-only `tx` lookups, nothing signed or sent) and
// prints one JSON line per escrow pair. No keys, no wallet, no real value.
import { readFileSync } from 'node:fs'
import { verifyKeyOnLedger } from '../../../src/verify/key-on-ledger.ts'

const here = new URL('.', import.meta.url)
const hostedExport = readFileSync(new URL('../hosted-export-nov11/receipts.json', here), 'utf8')
const pairs: Record<string, { create: string; finish: string; source: string }> = {
  // The committed hosted export (docs/evidence/hosted-export-nov11): its first escrow, create B6FDBD22…, finish 4CCB4E56….
  'hosted export, article 1': { create: 'B6FDBD229FEBDFAE041C4A21FE115449E3396AE7E9A422D391C0F7B4100028E5', finish: '4CCB4E56137D738847E853535B068329562AD490DA4D9F5551CEC2EB1AC70638', source: 'docs/evidence/hosted-export-nov11/receipts.json' },
  // The recorded /demo/ replay (demo/traces/UC3-key-reveal.json): the refunded AlphaLeak escrow and the kept Fab Floor escrow.
  'replay, AlphaLeak (refunded)': { create: 'A8DC9B577696F2C4B4A2BE757601F001413509A3E2A88A404178911722F4C8E7', finish: '4D3D0F43F0147DEE086B009AAC5CDFFF1B57E0F0ACDE6EC3BE4C00B6CE8AFE62', source: 'demo/traces/UC3-key-reveal.json' },
  'replay, Fab Floor': { create: '29F1B9F61C11AE0486A9573365CF0C062354AE3A4951F1EACE43BBA6F89CED92', finish: 'D3B8F480B29AAC560916084AACD64624C2BCF9DCF51EBF338A19DC3B8C66CBBD', source: 'demo/traces/UC3-key-reveal.json' },
}
let failed = 0
for (const [name, { create, finish, source }] of Object.entries(pairs)) {
  if (source.includes('hosted-export') && !(hostedExport.includes(create) && hostedExport.includes(finish))) throw new Error(`${name}: hashes are not in the committed export`)
  const started = Date.now(), result = await verifyKeyOnLedger({ create, finish })
  if (result.status !== 'match') failed++
  console.log(JSON.stringify({ name, source, create, finish, ...result, ms: Date.now() - started }))
}
process.exit(failed ? 1 : 0)
