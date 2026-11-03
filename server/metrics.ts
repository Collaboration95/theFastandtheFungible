import type { Store } from './store.js'
import type { PurchaseManager } from './purchases.js'
import { XrplPayer } from './xrpl.js'

export const percentile = (values: number[], p: number) => values.length ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] : null
const backlogStatuses = new Set(['SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'])
export function backlog(store: Store) {
  const pending = store.listIntents().filter(i => backlogStatuses.has(i.status))
  const ages = pending.map(i => Date.parse(i.submittingAt ?? i.createdAt ?? '')).filter(Number.isFinite)
  return { count: pending.length, oldestAgeMs: ages.length ? Math.max(0, Date.now() - Math.min(...ages)) : null,
    unknownAgeCount: pending.length - ages.length, exhaustedDeliveries: pending.filter(i => (i.deliveryAttempts ?? 0) >= 3).length }
}
/** Explicit projection: no question, body, token, seed, signed blob or provider error is returned. */
export function metrics(store: Store, purchases: PurchaseManager) {
  const runs = store.listRuns(), intents = store.listIntents()
  const latencies = intents.flatMap(i => i.settledAt && i.submittingAt ? [Date.parse(i.settledAt) - Date.parse(i.submittingAt)] : [])
  return { schema: 'operations-v1', rail: purchases.payer.rail,
    purchasesByStatus: Object.fromEntries([...new Set(intents.map(i => i.status))].map(s => [s, intents.filter(i => i.status === s).length])),
    settleLatencyMs: { samples: latencies.length, p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    payerLockWaitMs: { samples: purchases.payer instanceof XrplPayer ? purchases.payer.lockWaitMs.length : 0, p95: purchases.payer instanceof XrplPayer ? percentile(purchases.payer.lockWaitMs, 0.95) : null, scope: 'last 1024 successful lock acquisitions in this process' },
    reconcileBacklog: backlog(store), spendTodayBySurface: store.spendBySurface(),
    fallbacks: { llm: runs.reduce((n, r) => n + r.events.filter(e => e.type === 'MODEL_FALLBACK').length, 0),
      decision: runs.reduce((n, r) => n + r.decisions.filter(d => !!d.fallbackReason).length, 0), decisionUnavailable: runs.reduce((n, r) => n + r.events.filter(e => e.type === 'DECISION_UNAVAILABLE').length, 0) },
    modelUsageByRun: runs.map(r => {
      const usage = r.events.filter(e => e.type === 'MODEL_USAGE').map(e => e.data ?? {})
      return { runId: r.runId, reportedCalls: usage.length, inputTokens: usage.length ? usage.reduce((n, u) => n + Number(u.inputTokens ?? 0), 0) : null,
        outputTokens: usage.length ? usage.reduce((n, u) => n + Number(u.outputTokens ?? 0), 0) : null,
        estimatedUsd: usage.length && usage.every(u => typeof u.estimatedUsd === 'number') ? usage.reduce((n, u) => n + Number(u.estimatedUsd), 0) : null }
    }) }
}
