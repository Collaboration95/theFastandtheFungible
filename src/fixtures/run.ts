import { exampleRun as foundationRun } from '../../shared/contracts/examples.js'
import { RunSnapshotSchema } from '../../shared/contracts/index.js'
import type { DecisionRound, DecisionRow, PublicCandidate } from '../../shared/contracts/index.js'

export { exampleRun } from '../../shared/contracts/examples.js'

// Offline examples only: no live provider calls, purchase intents or premium bodies.
const preview = (resourceId: string, title: string, amountMinor: number, derivedFrom?: string): PublicCandidate => ({
  profileId: 'synthetic-paid', resourceId, version: 'v1', title,
  publisher: 'Fictional demo publisher', preview: 'Synthetic public preview of grid energisation evidence.',
  price: { amountMinor, currency: 'SGD' }, family: 'grid-record', facets: ['grid-energisation'], authority: 2,
  tier: 'PAID', derivedFrom, license: { kind: 'SYNTHETIC', attribution: 'ResearchAgent fictional demo corpus' },
})
const gapMaterial = 0.85
const row = (candidate: PublicCandidate, addressesGap: number, original: number, rewrite: number, verdict: DecisionRow['verdict'], reason: string, wouldBuy = false): DecisionRow => {
  const credibility = 1.8
  const value = gapMaterial * addressesGap * original * (0.5 + 0.25 * credibility)
  return { candidate, judgment: { addressesGap, originality: { original, rewrite, overlap: 1 - original - rewrite }, credibility },
    value, valuePerDollar: value / (candidate.price.amountMinor / 100), verdict, reason, wouldBuy }
}
const rows = [
  row(preview('example-rewrite', 'Circuit Note · synthetic rewrite', 40, foundationRun.candidates[0].resourceId), 0.65, 0.05, 0.9, 'SKIP_REWRITE', 'Derived from an already-read source.'),
  row(preview('example-over-cap', 'GridScope Asia · synthetic analysis', 140), 0.8, 0.9, 0.05, 'SKIP_OVER_CAP', 'S$1.40 exceeds the S$1.00 per-source cap.'),
  row(preview('example-low-value', 'Northstar Wire · synthetic demand update', 50), 0.1, 0.6, 0.2, 'SKIP_LOW_VALUE', 'The demand facet is already answered; little value for the grid gap.'),
  row(preview('example-grid', 'Grid Operators Report · synthetic primary record', 80), 0.85, 0.9, 0.05, 'SKIP_OVER_BUDGET', 'S$0 authorizes no purchase. This would be selected with sufficient budget.', true),
]
const round: DecisionRound = { round: 1, gap: foundationRun.answers[0].openGaps[0].text, gapMaterial,
  provider: 'fixture', model: 'synthetic-table-example', threshold: 0.2, rows }

export const offlineZeroBudgetRun = RunSnapshotSchema.parse({
  ...foundationRun, runId: 'offline-example-zero-budget', budgetMinor: 0, round: 1, phase: 'DONE',
  candidates: [...foundationRun.candidates, ...rows.map(row => row.candidate)], decisions: [round],
  labels: { ...foundationRun.labels, research: 'fixture · offline extractive example', decision: 'fixture · synthetic table example' },
  events: [{ id: 1, runId: 'offline-example-zero-budget', type: 'DECIDE', at: '2026-10-04T14:00:00.000Z', label: 'Offline synthetic example: would buy; zero purchases authorized.' }],
})

// A separate labelled protocol illustration, not evidence that this offline run paid.
export const offlineWireExampleRun = RunSnapshotSchema.parse({
  ...foundationRun, runId: 'offline-wire-example', phase: 'DONE',
  labels: { ...foundationRun.labels, decision: 'fixture · offline HTTP illustration' },
  events: [
    { id: 1, runId: 'offline-wire-example', type: 'HTTP', at: '2026-10-04T14:00:00.000Z', label: 'Synthetic HTTP illustration: payment required', data: { method: 'GET', path: '/resources/example-grid', status: 402 } },
    { id: 2, runId: 'offline-wire-example', type: 'HTTP', at: '2026-10-04T14:00:01.000Z', label: 'Synthetic quote illustration', data: { method: 'POST', path: '/quote', status: 200, amountMinor: 80, currency: 'SGD' } },
    { id: 3, runId: 'offline-wire-example', type: 'HTTP', at: '2026-10-04T14:00:02.000Z', label: 'Synthetic settlement illustration · no real funds', data: { method: 'POST', path: '/settle', status: 200 } },
    { id: 4, runId: 'offline-wire-example', type: 'HTTP', at: '2026-10-04T14:00:03.000Z', label: 'Synthetic delivery and digest illustration', data: { method: 'GET', path: '/delivery', status: 200, verified: true } },
  ],
})
