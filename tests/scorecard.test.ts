import { expect, it } from 'vitest'
import { deltas, qualityMetrics, reportDeltas, timings, type Quality } from '../eval/scorecard/metrics.js'
import type { QuestionResult } from '../eval/decisions/offline.js'

it('uses gross spend including refunded failures and requested-fact denominators', () => {
  const base = { id: 'test', kind: 'paid-needed' as const, purchases: [], refundedMinor: 0, rounds: [], firstBuyPriceMinor: 0 }
  const rows: QuestionResult[] = [{ ...base, spentMinor: 50, wastedMinor: 20, requested: 2, firstBuy: 'a', expectedBuy: 'a', free: { supported: [], citations: { valid: 0, total: 0 }, gaps: [] }, final: { supported: ['f'], citations: { valid: 0, total: 0 }, answerVersions: 2 } }, { ...base, spentMinor: 50, wastedMinor: 50, requested: 1, firstBuy: 'b', expectedBuy: null, free: { supported: [], citations: { valid: 0, total: 0 }, gaps: [] }, final: { supported: [], citations: { valid: 0, total: 0 }, answerVersions: 1 } }]
  expect(qualityMetrics(rows, [], 0.1)).toMatchObject({ wastedSpendPct: 70, selectionF1Flow: 2 / 3, supportedFactUpliftPts: 100 / 3, falseCompleteRate: 0.1 })
  expect(qualityMetrics([], [], null)).toMatchObject({ wastedSpendPct: null, supportedFactUpliftPts: null, falseCompleteRate: null })
})
it('interpolates wall-clock percentiles and preserves missing observations', () => {
  expect(timings([{ firstMs: 10, finalMs: 20 }, { firstMs: 30, finalMs: 100 }])).toMatchObject({ p50FirstAnswerMs: 20, p95FirstAnswerMs: 29, p95FinalAnswerMs: 96 })
  expect(timings([]).p95FirstAnswerMs).toBeNull()
})
it('gates only quality worsening strictly over 10%, including a zero baseline', () => {
  const baseline: Quality = { wastedSpendPct: 10, netWastedSpendPct: 10, usedSpendPct: 50, selectionF1Flow: 0.5, selectionF1Sweep: 0.5, supportedFactUpliftPts: 10, falseCompleteRate: 0 }
  expect(deltas({ ...baseline, wastedSpendPct: 11, selectionF1Flow: 0.45 }, baseline).every(d => !d.regression)).toBe(true)
  expect(deltas({ ...baseline, wastedSpendPct: 11.01, selectionF1Sweep: 0.44, falseCompleteRate: 0.001 }, baseline).filter(d => d.regression).map(d => d.metric)).toEqual(['wastedSpendPct', 'selectionF1Sweep', 'falseCompleteRate'])
  expect(deltas({ ...baseline, wastedSpendPct: 1, selectionF1Flow: 1 }, baseline).every(d => !d.regression)).toBe(true)
})

it('compares timing and cost aggregates while skipping raw sample identifiers', () => {
  const d = reportDeltas({ timing: { p95FirstAnswerMs: 200, observations: [{ firstMs: 10 }] }, cost: { modelUsd: 0.2 } }, { timing: { p95FirstAnswerMs: 100 }, cost: { modelUsd: 0.1 } })
  expect(d).toEqual([{ metric: 'timing.p95FirstAnswerMs', before: 100, after: 200, delta: 100 }, { metric: 'cost.modelUsd', before: 0.1, after: 0.2, delta: 0.1 }])
})

it('scores the actual policy pick without resurrecting a high-scoring vetoed candidate', () => {
  const row = { questionId: 'Q1', factId: 'f', round: 1, factOpen: true, threshold: 0.2, value: 0.9, priceMinor: 50, originality: { original: 1, rewrite: 0, overlap: 0 }, labels: { buy: 1 }, verdict: 'SKIP_LOW_VALUE', selected: false } as import('../eval/decisions/dataset.js').DatasetRow
  expect(qualityMetrics([], [row], null).selectionF1Sweep).toBe(0)
  expect(qualityMetrics([], [{ ...row, verdict: 'BUY', selected: true }], null).selectionF1Sweep).toBe(1)
})
