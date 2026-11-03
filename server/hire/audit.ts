import type { RunSnapshot } from '../../shared/contracts/run.js'
import { DROPS_PER_MINOR } from '../../shared/contracts/index.js'
import { royaltyPlan, SERVICE_FEE_MINOR } from './policy.js'
export type HireAuditRecord = { runId: string; budgetMinor: number; result?: {
  moneyChain: { inbound: { txHash: string; amountDrops: string }; payments: { id: string; kind: string; payTo: string; amountDrops: string; txHash: string }[];
    writerAddresses: Record<string, string>; retainedDrops: string; purchaseDrops: string; royaltyDrops: string; changeDrops: string }
} }
/** Read-only deterministic checks; ledger authenticity is verified at settlement, not inferred here. */
export function auditHireRecords(runs: RunSnapshot[], records: HireAuditRecord[]) {
  const violations: { rule: string; runId: string; evidence: string }[] = []
  const hashes = new Set<string>()
  for (const record of records) {
    if (!record.result) continue // pending obligations remain reserved; not a completed chain
    const { moneyChain: chain } = record.result
    const run = runs.find(r => r.runId === record.runId)
    const fail = (rule: string) => violations.push({ rule, runId: record.runId, evidence: 'hire chain does not match deterministic policy' })
    if (!run) { fail('money_chain_reconciliation'); continue }
    try {
      const expected = royaltyPlan(run, chain.writerAddresses)
      const actual = chain.payments.filter(p => p.kind === 'royalty').map(({ id, kind, payTo, amountDrops }) => ({ id, kind, payTo, amountDrops })).sort((a,b) => a.id.localeCompare(b.id))
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('royalty_policy')
      const royalty = actual.reduce((s,p) => s + BigInt(p.amountDrops), 0n)
      const change = chain.payments.filter(p => p.kind === 'change').reduce((s,p) => s + BigInt(p.amountDrops), 0n)
      const spend = BigInt(run.spentMinor * DROPS_PER_MINOR)
      if (chain.payments.some(p => !['royalty', 'change'].includes(p.kind))
        || chain.purchaseDrops !== String(spend) || chain.royaltyDrops !== String(royalty) || chain.changeDrops !== String(change)
        || spend + change !== BigInt(record.budgetMinor * DROPS_PER_MINOR)
        || royalty + BigInt(chain.retainedDrops) !== BigInt(SERVICE_FEE_MINOR * DROPS_PER_MINOR)
        || BigInt(chain.inbound.amountDrops) !== spend + royalty + change + BigInt(chain.retainedDrops)) fail('money_chain_reconciliation')
      for (const hash of [chain.inbound.txHash, ...chain.payments.map(p => p.txHash)]) {
        if (hashes.has(hash)) fail('duplicate_settlement')
        hashes.add(hash)
      }
    } catch { fail('royalty_policy') }
  }
  return violations
}
