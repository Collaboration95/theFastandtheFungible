import { Router } from 'express'
import type { ApiContext } from './context.js'
import { toCsv, toJsonl } from '../audit.js'
import { XRPL_LABEL } from '../../shared/contracts/index.js'

/** Token-guarded by admissionGuard (everything under /api/audit/). Rows come from the money tables; the chain is verified by /api/audit/verify. */
export function auditRouter({ store }: ApiContext) {
  const router = Router()
  const text = (value: unknown) => typeof value === 'string' ? value : undefined
  router.get(['/api/audit/receipts.csv', '/api/audit/receipts.jsonl'], (req, res) => {
    let rows
    try { rows = store.receiptRows({ from: text(req.query.from), to: text(req.query.to), principal: text(req.query.principal) }) }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid range.' }); return }
    const csv = req.path.endsWith('.csv')
    // Every row also carries its own rail label; the header repeats it for tools that only read headers.
    // ASCII only: HTTP header values are Latin-1 on the wire.
    const testnet = rows.some(r => r.label === XRPL_LABEL)
    res.set('X-Export-Label', testnet ? 'XRPL TESTNET - no real value - not a regulated record' : 'SIMULATED - no real funds')
    res.set('Content-Disposition', `attachment; filename="receipts-${testnet ? 'testnet' : 'simulated'}.${csv ? 'csv' : 'jsonl'}"`)
    res.type(csv ? 'text/csv; charset=utf-8' : 'application/x-ndjson; charset=utf-8').send(csv ? toCsv(rows) : toJsonl(rows))
  })
  router.get('/api/audit/verify', (_req, res) => res.json(store.auditVerify()))
  return router
}
