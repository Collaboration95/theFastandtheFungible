import { Router } from 'express'
import type { ApiContext } from './context.js'
import { backlog, metrics } from '../metrics.js'
import { FEE_CAP_DROPS } from '../xrpl.js'
import { DROPS_PER_MINOR } from '../../shared/contracts/index.js'

import { bounded } from '../dependencies.js'

export function operationsRouter({ store, client, payer, purchases, labels }: ApiContext) {
  const router = Router()
  router.get('/api/writers/status', async (_req, res) => { try { res.json({ publishers: (await client.registry()).map(p => ({ name:p.name, address:p.wallet, credential:p.verification, followed:false })) }) } catch { res.status(503).json({ error:'Writer status unavailable' }) } })
  router.get('/api/metrics', (_req, res) => res.json(metrics(store, purchases)))
  let probe: Promise<unknown> | undefined
  const deep = async () => {
    const reasons: string[] = []
    let db = 'ok', publisher = 'ok'
    try { store.checkWritable() } catch { db = 'down'; reasons.push('Database is not writable') }
    try { await bounded(client.registry()) } catch { publisher = 'down'; reasons.push('Publisher registry unreachable') }
    let ledger: unknown = { status: 'simulated', label: 'SIMULATED · no ledger dependency' }
    if (payer) {
      try {
        const balance = await bounded(payer.balance())
        const admittedDrops = store.walletStatus().reservedMinor * DROPS_PER_MINOR
        const headroomDrops = balance.availableDrops - admittedDrops - FEE_CAP_DROPS
        if (balance.ledgerAgeSeconds > 30) reasons.push('Validated ledger is stale (>30 s)')
        if (headroomDrops < 0) reasons.push('Payer balance below reserve plus admitted budgets and fee cap')
        ledger = { status: balance.ledgerAgeSeconds > 30 || headroomDrops < 0 ? 'degraded' : 'ok', ...balance, admittedDrops, headroomDrops }
      } catch { ledger = { status: 'down' }; reasons.push('Ledger or payer balance unavailable') }
    }
    const queue = db === 'ok' ? backlog(store) : { count: null, oldestAgeMs: null, unknownAgeCount: null, exhaustedDeliveries: null }
    if (queue.count) reasons.push('Payment reconciliation backlog')
    return { status: db === 'down' ? 'down' : reasons.length ? 'degraded' : 'ok', reasons, database: db, publisher, ledger, reconcileBacklog: queue,
      providers: { research: labels.research.split(' · ')[0], decision: labels.decision.split(' · ')[0] } }
  }
  router.get('/api/health', async (req, res, next) => {
    if (req.query.deep !== '1') { next(); return }
    probe ??= deep().finally(() => { probe = undefined })
    const result = await probe as { status: string }
    res.status(result.status === 'down' ? 503 : 200).json(result)
  })
  return router
}
