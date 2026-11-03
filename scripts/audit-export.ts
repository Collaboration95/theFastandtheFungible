// Export receipts (one row per charge) or the audit chain itself. Read-only; the label of every row says Testnet or SIMULATED.
//   npm run audit:export -- [--db data/app.db] [--format csv|jsonl] [--from 2026-11-01] [--to 2026-11-30] [--out file] [--log]
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { DatabaseSync } from 'node:sqlite'
import { auditEntries, receiptRows, toCsv, toJsonl } from '../server/audit.js'

const { values } = parseArgs({ options: { principal: { type: 'string' }, db: { type: 'string' }, format: { type: 'string', default: 'csv' }, from: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' }, log: { type: 'boolean', default: false } } })
if (!['csv', 'jsonl'].includes(values.format!)) { console.error('--format must be csv or jsonl'); process.exit(2) }
const path = values.db ?? process.env.APP_DB ?? 'data/app.db'
let db: DatabaseSync
try { db = new DatabaseSync(path, { readOnly: true }) } catch { console.error(`Cannot open ${path} (read-only). Pass --db <path>.`); process.exit(2) }
try {
  const range = { from: values.from, to: values.to, principal: values.principal }
  const body = values.log ? toJsonl(auditEntries(db, range).filter(row => !values.principal || row.principal === values.principal)) : values.format === 'jsonl' ? toJsonl(receiptRows(db, range)) : toCsv(receiptRows(db, range))
  if (values.out) { writeFileSync(values.out, body); console.error(`Wrote ${values.out} (${values.log ? 'audit chain, JSONL' : values.format}). Rows are labelled XRPL TESTNET or SIMULATED; nothing here is a regulated record.`) }
  else process.stdout.write(body)
} catch (error) { console.error(error instanceof Error ? error.message : 'Export failed'); process.exit(2) }
finally { db.close() }
