// Frozen pre-Lane-M accounting oracle. Keep arithmetic and traversal unchanged.
import type { Store } from '../../server/store.js'
import type { PurchaseIntent, Receipt } from '../../shared/contracts/index.js'
import { DROPS_PER_MINOR } from '../../shared/contracts/index.js'
import type { Surface } from '../../server/spend-policy.js'
const reservedStatuses = new Set(['RESERVED', 'SUBMITTING'])
const chargedStatuses = new Set(['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
// Test-only access to the original private seams, never exposed by production.
type OracleStore = { db: import('node:sqlite').DatabaseSync; rawRun: (id: string) => import('../../shared/contracts/index.js').RunSnapshot; rows: <T>(sql: string, ...args: string[]) => T[]; policyPayments: Store['policyPayments'] }
export function legacyUsage(this: Store, day: string, surface?: Surface, excludeRun?: string, principal?: string) {
  const store = this as unknown as OracleStore
    let spentMinor = 0, reservedMinor = 0
    const admissions = new Map(store.db.prepare('SELECT run_id, surface, principal FROM admissions').all().map(row => [row.run_id as string, row]))
    for (const row of store.db.prepare('SELECT id FROM runs').all()) {
      const id = row.id as string
      if (surface && admissions.get(id)?.surface !== surface) continue
      if (principal && admissions.get(id)?.principal !== principal) continue
      const run = store.rawRun(id)
      const intents = store.rows<PurchaseIntent>('SELECT json FROM intents WHERE run_id=?', id)
      const receipts = store.rows<Receipt>('SELECT r.json FROM receipts r JOIN intents i ON i.id=r.intent_id WHERE i.run_id=?', id)
      const charged = intents.filter(i => chargedStatuses.has(i.status))
      const policy = store.policyPayments(id)
      const policySpent = policy.filter(p => p.confirmedAt).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
      const policyReserved = policy.filter(p => !p.confirmedAt && !p.cancelledAt).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
      spentMinor += policy.filter(p => p.confirmedAt?.slice(0, 10) === day).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
      const hold = store.db.prepare('SELECT minor, closed FROM hire_reserves WHERE run_id=?').get(id)
      spentMinor += intents.filter(i => i.escrow?.state === 'CANCELLED' && i.createdAt?.slice(0, 10) === day).reduce((sum, i) => sum + i.amountMinor, 0)
      const gross = charged.reduce((sum, i) => sum + i.amountMinor, 0) + policySpent
      spentMinor += charged.reduce((sum, i) => {
        const receipt = receipts.find(r => r.intentId === i.intentId)
        return sum + (!receipt || receipt.settledAt.slice(0, 10) === day ? i.amountMinor : 0)
      }, 0)
      if (id !== excludeRun && (hold && !hold.closed || !['DONE', 'STOPPED', 'FAILED'].includes(run.phase) || intents.some(i => reservedStatuses.has(i.status)))) {
        reservedMinor += Math.max(policyReserved, run.budgetMinor + Number(hold?.minor ?? 0) - gross)
      } else if (id !== excludeRun) reservedMinor += policyReserved
    }
    return { spentMinor, reservedMinor }
}
