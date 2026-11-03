// Re-check the audit chain and, with --testnet, every receipt against the public XRPL Testnet. Read-only: no key is loaded, nothing is spent.
//   npm run audit:verify -- [--db data/app.db] [--testnet] [--expect-head <hash>] [--json]
// Exit 0: all checks passed. 1: tampering or a mismatch. 2: could not run (missing database, bad flags).
import { parseArgs } from 'node:util'
import { DatabaseSync } from 'node:sqlite'
import { auditEntries, verifyEscrowEvents, receiptRows, verifyChain, verifyOnTestnet, type TestnetCheck } from '../server/audit.js'
import { testnetLedger, testnetUrl } from '../shared/xrpl.js'

const { values } = parseArgs({ options: { db: { type: 'string' }, testnet: { type: 'boolean', default: false }, 'expect-head': { type: 'string' }, json: { type: 'boolean', default: false } } })
const path = values.db ?? process.env.APP_DB ?? 'data/app.db'
let db: DatabaseSync
try { db = new DatabaseSync(path, { readOnly: true }) } catch { console.error(`Cannot open ${path} (read-only). Pass --db <path>.`); process.exit(2) }
const chain = verifyChain(db, { expectHead: values['expect-head'] })
const rows = receiptRows(db)
let checks: TestnetCheck[] = []
if (values.testnet) {
  const ledger = testnetLedger(testnetUrl())
  try { checks = [...await verifyOnTestnet(rows, ledger), ...await verifyEscrowEvents(auditEntries(db), ledger)] } finally { await ledger.close() }
}
db.close()
const bad = checks.filter(c => c.status !== 'ok' && c.status !== 'skipped')
const ok = chain.ok && !bad.length
if (values.json) console.log(JSON.stringify({ ok, chain, testnet: values.testnet ? checks : 'not checked' }, null, 2))
else {
  console.log(`AUDIT CHAIN   ${chain.ok ? 'OK  ' : 'FAIL'} ${chain.entries} entries${chain.head ? `, head #${chain.head.seq} ${chain.head.hash}` : ''}`)
  console.log(`COVERAGE      ${chain.coverage.receipts} receipts, ${chain.coverage.signed} signed payments, ${chain.coverage.refunds} refunds${chain.coverage.payouts || chain.coverage.inbound ? `, ${chain.coverage.inbound} inbound and ${chain.coverage.payouts} royalty/change payments` : ''} matched to their audit entries`)
  for (const f of chain.failures) console.log(`  FAIL ${f.seq ? `at seq ${f.seq}: ` : ''}${f.reason}`)
  if (!values.testnet) console.log(`TESTNET       not checked (${rows.length} receipt${rows.length === 1 ? '' : 's'}); add --testnet to look each transaction up on the public Testnet`)
  else {
    console.log(`TESTNET       ${bad.length ? 'FAIL' : 'OK  '} ${checks.filter(c => c.status === 'ok').length} of ${checks.length} lookups confirmed (read-only; XRPL Testnet only, no real value)`)
    for (const c of checks) console.log(`  ${c.status.toUpperCase().padEnd(8)} ${c.kind.padEnd(7)} ${c.txHash.slice(0, 16)}…  intent ${c.intentId.slice(0, 24)}  ${c.detail}`)
  }
  console.log(ok ? 'RESULT        PASS' : 'RESULT        FAIL')
}
process.exit(ok ? 0 : 1)
