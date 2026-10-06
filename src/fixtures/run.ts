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

// A complete offline S$2 story for stage-pacing tests: free answer, one purchase, verified grant, v2.
const storyId = 'offline-paid-story'
const gridCandidate: PublicCandidate = { ...preview('example-grid', 'Synthetic grid record', 80), profileId: 'synthetic-paid' }
const gridBody = 'Only 240 of the announced 600 MW has a confirmed energisation slot before 2028.'
const freeCitation = foundationRun.answers[0].claims[0].citations[0]
const gridCitation = { resourceId: gridCandidate.resourceId, version: 'v1', spanId: 'grid-1' }
const intentId = `${storyId}:1:example-grid:v1`
const story = (id: number, type: string, label: string, data?: Record<string, unknown>) => ({ id, runId: storyId, type, label, at: `2026-10-04T14:00:00.${String(id * 5).padStart(3, '0')}Z`, ...(data ? { data } : {}) })
const gridRow = row(gridCandidate, 0.85, 0.9, 0.05, 'BUY', 'Clears the value threshold and spending policy.')
export const paidStoryRun = RunSnapshotSchema.parse({
  ...foundationRun, runId: storyId, phase: 'DONE', round: 2,
  candidates: [...foundationRun.candidates, gridCandidate],
  contents: [...foundationRun.contents, { profileId: gridCandidate.profileId, resourceId: gridCandidate.resourceId, version: 'v1', title: gridCandidate.title, publisher: gridCandidate.publisher, body: gridBody, spans: [{ id: 'grid-1', text: gridBody }] }],
  answers: [
    { ...foundationRun.answers[0], version: 1 },
    { conclusion: `${gridBody} Demand is real.`, claims: [{ id: 'grid-claim', text: gridBody, stance: 'CHALLENGES', citations: [gridCitation] }, { ...foundationRun.answers[0].claims[0], citations: [freeCitation] }], openGaps: [], version: 2, provider: 'fixture', model: 'extractive-fixture' },
  ],
  impact: { classification: 'QUALIFIES', explanation: 'New cited evidence qualifies the previous answer.', claimChanges: [{ toClaimId: 'grid-claim', change: 'ADDED' }, { fromClaimId: 'claim-1', toClaimId: 'claim-1', change: 'UNCHANGED' }] },
  decisions: [
    { round: 1, gap: 'No accessible evidence on grid energisation.', gapMaterial, provider: 'fixture', model: 'synthetic-table-example', threshold: 0.2, rows: [gridRow], selectedResourceId: 'example-grid' },
    { round: 2, gap: '', gapMaterial: 0, provider: 'fixture', model: 'synthetic-table-example', threshold: 0.2, rows: [{ ...gridRow, value: 0, valuePerDollar: 0, verdict: 'SKIP_NO_GAP', reason: 'No material open gap.' }] },
  ],
  spentMinor: 80,
  intents: [{ intentId, runId: storyId, profileId: gridCandidate.profileId, resourceId: 'example-grid', version: 'v1', amountMinor: 80, status: 'VERIFIED', receiptId: 'receipt-1' }],
  receipts: [{ receiptId: 'receipt-1', intentId, runId: storyId, resourceId: 'example-grid', version: 'v1', amountMinor: 80, currency: 'SGD', settledAt: '2026-10-04T14:00:00.045Z', label: 'SIMULATED SGD · no real funds' }],
  grants: [{ runId: storyId, resourceId: 'example-grid', version: 'v1', intentId, contentDigest: 'c'.repeat(64), grantedAt: '2026-10-04T14:00:00.055Z' }],
  events: [
    story(1, 'SEARCH', 'Searching publisher public metadata.'), story(2, 'READ_FREE', 'Reading free sources only.'), story(3, 'ANSWER', 'Writing the free answer.'),
    story(4, 'DECIDE', 'Scoring public previews and applying spending policy.'), story(5, 'BUY', 'Policy selected one purchase within budget.'),
    story(6, 'WIRE', 'GET content → 402', { method: 'GET', path: '/v1/profiles/synthetic-paid/resources/example-grid/versions/v1/content', status: 402 }),
    story(7, 'WIRE', 'POST /v1/quotes → 200', { method: 'POST', path: '/v1/quotes', status: 200 }),
    story(8, 'PURCHASE', 'RESERVED', { intentId, status: 'RESERVED' }),
    story(9, 'WIRE', 'POST /v1/settlements → 200', { method: 'POST', path: '/v1/settlements', status: 200 }),
    story(10, 'WIRE', 'GET content → 200', { method: 'GET', path: '/v1/profiles/synthetic-paid/resources/example-grid/versions/v1/content', status: 200 }),
    story(11, 'GRANT', 'sha-256 verified', { intentId, resourceId: 'example-grid', version: 'v1' }),
    story(12, 'READ_PAID', 'Verified grant permits paid evidence.'), story(13, 'ANSWER', 'Re-answering with verified evidence.'),
    story(14, 'DECIDE', 'Scoring public previews and applying spending policy.'), story(15, 'DONE', 'Stopped: no eligible purchase.'),
  ],
})
