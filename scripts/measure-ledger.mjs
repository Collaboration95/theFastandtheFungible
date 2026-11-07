// Read-only: no wallets, signing, account queries, or submission.
import { readFileSync, writeFileSync } from 'node:fs'
import { refresh } from '../site/ledger/ledger.js'
const rows = JSON.parse(readFileSync('site/ledger/transactions.json', 'utf8')).rows
const started = performance.now()
let verified = 0, firstMs = null
await refresh(rows, WebSocket, (_hash, status) => {
  if (status.startsWith('validated')) { verified++; firstMs ??= performance.now() - started }
})
const result = { at: new Date().toISOString(), mode: 'live read-only XRPL Testnet; no spending', verified, total: rows.length, firstMs, elapsedMs: performance.now() - started }
writeFileSync('docs/evidence/round4-l4/live-ledger.json', JSON.stringify(result, null, 2) + '\n')
console.log(result)
