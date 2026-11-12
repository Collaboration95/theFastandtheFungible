# Pinned SDK reproduction — 12 November 2026

From the ResearchAgent checkout, Node 22.23.4 and `npm ci`:

```sh
node --input-type=module - <<'JS'
import { Wallet, signMultiBatch } from 'xrpl'
import { readFileSync } from 'node:fs'
const b = JSON.parse(readFileSync('docs/feedback/upstream/r3/evidence/spike-b.json'))
const tx = structuredClone(b.records.find(r => r.label === 'B2 create + writer finish').tx)
delete tx.TxnSignature
delete tx.BatchSigners
// An ephemeral offline key suffices: failure occurs before producing a signature.
// batchAccount selects the existing inner participant; no real wallet seed is read.
try {
  signMultiBatch(Wallet.generate(), tx, { batchAccount: b.writer })
  throw Error('unexpected success')
} catch (error) {
  console.log(error.message)
  if (!error.message.includes('No field `account`')) process.exitCode = 1
}
JS
```

Observed output: ``No field `account` ``. No network call, wallet funding or transaction submission. The spike records the same error and a separately successful manually constructed Batch V1_1 payload.

This does not justify a new fix against current upstream. Current `XRPLF/xrpl.js` main `4226827251436633d7383ac8e358196e51a9af09`, `packages/xrpl/src/Wallet/batchSigner.ts`, constructs `fieldsToSign` with account, sequence/ticket, flags, txIDs and batchAccount. PR #3371 already merged the V1_1 support; the stored tracker response gives its merge commit and date. Keep dependency repair in the product's SDK-owning lane.
