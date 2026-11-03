// Delete premium content, events and run bodies from finished runs older than the window. Keeps receipts, intents and every audit row.
//   npm run data:prune -- [--older-than 30d] [--db data/app.db] [--reports data/reports] [--dry-run] [--no-vacuum]
// Default window: DATA_RETENTION_DAYS or 30 days. Nothing is pruned unless you run this command.
import { parseArgs } from 'node:util'
import { Store } from '../server/store.js'
import { DEFAULT_RETENTION_DAYS, parseWindow, removeReports } from '../server/retention.js'

const { values } = parseArgs({ options: { 'older-than': { type: 'string' }, db: { type: 'string' }, reports: { type: 'string' }, 'dry-run': { type: 'boolean', default: false }, 'no-vacuum': { type: 'boolean', default: false } } })
const path = values.db ?? process.env.APP_DB ?? 'data/app.db'
const days = parseWindow(values['older-than'] ?? (process.env.DATA_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS)))
const store = new Store(path)
try {
  const result = store.prune({ olderThanDays: days, dryRun: values['dry-run'] })
  const reports = !values['dry-run'] ? removeReports(values.reports ?? process.env.REPORT_DIR ?? 'data/reports', result.runIds) : []
  if (!values['dry-run'] && result.runIds.length && !values['no-vacuum']) store.compact()
  const verify = store.auditVerify()
  console.log(`${values['dry-run'] ? 'DRY RUN, nothing deleted. Would prune' : 'Pruned'} ${result.runIds.length} finished run(s) older than ${days}d (before ${result.cutoff})`)
  console.log(`  deleted: ${Object.entries(result.deleted).map(([k, v]) => `${k}=${v}`).join(' ')} reportFiles=${reports.length}`)
  console.log('  kept: intents, receipts, manifests, signed payments, and all audit entries (chain ' + (verify.ok ? `verifies, ${verify.entries} entries)` : 'FAILS: ' + verify.failures.map(f => f.reason).join('; ') + ')'))
  process.exit(verify.ok ? 0 : 1)
} finally { store.close() }
