import { percentile } from '../decisions/metrics.js'
import { purchaseMetrics } from '../decisions/fit-calibration.js'
import type { DatasetRow } from '../decisions/dataset.js'
import type { QuestionResult } from '../decisions/offline.js'

export type Quality = { wastedSpendPct: number | null; netWastedSpendPct: number | null; usedSpendPct: number | null; selectionF1Flow: number; selectionF1Sweep: number; supportedFactUpliftPts: number | null; falseCompleteRate: number | null }
export function qualityMetrics(results: QuestionResult[], sweep: DatasetRow[], falseCompleteRate: number | null): Quality {
  const spent = results.reduce((s, r) => s + r.spentMinor, 0)
  const netSpent = spent - results.reduce((s, r) => s + r.refundedMinor, 0)
  const refundedWaste = results.reduce((s, r) => s + r.purchases.filter(p => p.wasted && p.proof === 'REFUNDED').reduce((sum, p) => sum + p.priceMinor, 0), 0)
  // A delivered fact must survive in the final answer, not merely appear in v2.
  const used = results.reduce((s, r) => s + r.purchases.filter(p => p.proof === 'PASS' && p.gainedFacts.some(f => r.final.supported.includes(f))).reduce((sum, p) => sum + p.priceMinor, 0), 0)
  const facts = results.reduce((s, r) => s + r.requested, 0)
  const tp = results.filter(r => r.firstBuy !== null && r.firstBuy === r.expectedBuy).length
  const buys = results.filter(r => r.firstBuy !== null).length, expected = results.filter(r => r.expectedBuy !== null).length
  const grouped = new Map<string, DatasetRow[]>()
  for (const r of sweep.filter(r => r.factOpen)) { const key = `${r.questionId}|${r.factId}|${r.round}`; grouped.set(key, [...grouped.get(key) ?? [], r]) }
  const thresholds = new Set(sweep.map(r => r.threshold))
  if (thresholds.size > 1) throw new Error('Sweep thresholds differ; cannot compare this scorecard')
  const metrics = purchaseMetrics([...grouped.values()].map(rows => ({ rows })), new Map(sweep.map(r => [r, r.value])), sweep[0]?.threshold ?? 0.2)
  return { wastedSpendPct: spent ? 100 * results.reduce((s, r) => s + r.wastedMinor, 0) / spent : null,
    netWastedSpendPct: netSpent ? 100 * (results.reduce((s, r) => s + r.wastedMinor, 0) - refundedWaste) / netSpent : null,
    usedSpendPct: spent ? 100 * used / spent : null,
    selectionF1Flow: buys + expected ? 2 * tp / (buys + expected) : 0, selectionF1Sweep: sweep.some(r => r.selected !== undefined) ? (() => {
      let tp = 0, fp = 0, fn = 0
      for (const rows of grouped.values()) {
        const pick = rows.find(r => r.selected)
        if (pick?.labels.buy === null) continue
        if (pick?.labels.buy === 1) tp++
        else { if (pick) fp++; if (rows.some(r => r.labels.buy === 1)) fn++ }
      }
      return 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0
    })() : metrics.f1,
    supportedFactUpliftPts: facts ? 100 * results.reduce((s, r) => s + r.final.supported.length - r.free.supported.length, 0) / facts : null, falseCompleteRate }
}
export const timings = (samples: { firstMs: number; finalMs: number }[]) => ({ samples: samples.length, p50FirstAnswerMs: percentile(samples.map(s => s.firstMs), 0.5), p95FirstAnswerMs: percentile(samples.map(s => s.firstMs), 0.95), p95FinalAnswerMs: percentile(samples.map(s => s.finalMs), 0.95) })
const higher = new Set(['selectionF1Flow', 'selectionF1Sweep', 'supportedFactUpliftPts', 'usedSpendPct'])
/** Hardware-dependent timings are observations, not deterministic fixture regression gates. */
export function deltas(current: Quality, previous: Quality) {
  return Object.entries(current).map(([metric, value]) => {
    const before = previous[metric as keyof Quality]
    const delta = value === null || before == null ? null : value - before
    const worse = delta === null ? false : higher.has(metric) ? -delta : delta
    return { metric, before, after: value, delta, regression: worse !== false && worse > Math.abs(before ?? 0) * 0.1 + 1e-12 }
  })
}

/** Numeric axes only; raw samples and IDs are evidence, not comparable aggregate metrics. */
export function reportDeltas(current: Record<string, unknown>, previous: Record<string, unknown>) {
  const numeric = (report: Record<string, unknown>) => {
    const result: Record<string, number> = {}
    const collect = (prefix: string, value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) result[prefix] = value
      else if (value && typeof value === 'object' && !Array.isArray(value)) for (const [k, v] of Object.entries(value)) collect(`${prefix}.${k}`, v)
    }
    for (const k of ['quality', 'timing', 'cost', 'audit']) collect(k, report[k])
    return result
  }
  const before = numeric(previous), after = numeric(current)
  return Object.entries(after).map(([metric, value]) => ({ metric, before: before[metric] ?? null, after: value, delta: before[metric] === undefined ? null : value - before[metric] }))
}
