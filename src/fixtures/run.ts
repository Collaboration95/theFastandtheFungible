import { exampleRun as foundationRun } from '../../shared/contracts/examples.js'
import { RunSnapshotSchema } from '../../shared/contracts/index.js'
import { z } from 'zod'
import type { DecisionRound, DecisionRow, PublicCandidate } from '../../shared/contracts/index.js'
import { ReputationRecordSchema, ScopeSchema } from '../../shared/contracts/index.js'
import uc1 from './uc/uc1.json'
import uc2 from './uc/uc2.json'
import uc3 from './uc/uc3.json'
import uc4 from './uc/uc4.json'
import reputation from './uc/reputation.json'
import scopeUc2 from './uc/scope-uc2.json'

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
    { id: 1, runId: 'offline-wire-example', type: 'WIRE', at: '2026-10-04T14:00:00.000Z', label: 'Synthetic x402 v2 illustration: 402 + PAYMENT-REQUIRED', data: { method: 'GET', path: '/w/synthetic-paid/articles/example-grid', status: 402, amountMinor: 80, currency: 'SGD' } },
    { id: 2, runId: 'offline-wire-example', type: 'WIRE', at: '2026-10-04T14:00:01.000Z', label: 'Synthetic paid GET with PAYMENT-SIGNATURE · no real funds', data: { method: 'GET', path: '/w/synthetic-paid/articles/example-grid', status: 200, verified: true } },
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
    story(6, 'WIRE', 'GET /w/synthetic-paid/articles/example-grid → 402', { method: 'GET', path: '/w/synthetic-paid/articles/example-grid', status: 402 }),
    story(7, 'PURCHASE', 'RESERVED', { intentId, status: 'RESERVED' }),
    story(8, 'XRPL', 'Signed payment sent to the publisher\'s facilitator · SIMULATED', { intentId }),
    story(9, 'WIRE', 'GET /w/synthetic-paid/articles/example-grid → 200', { method: 'GET', path: '/w/synthetic-paid/articles/example-grid', status: 200 }),
    story(10, 'PROOF', 'Proof verified · 1 claim recomputed', { intentId, claims: 1, ok: true }),
    story(11, 'GRANT', 'manifest root verified', { intentId, resourceId: 'example-grid', version: 'v1' }),
    story(12, 'READ_PAID', 'Verified grant permits paid evidence.'), story(13, 'ANSWER', 'Re-answering with verified evidence.'),
    story(14, 'DECIDE', 'Scoring public previews and applying spending policy.'), story(15, 'DONE', 'Stopped: no eligible purchase.'),
  ],
})

/* UC1–UC3 (story bible, D16) as the #157 scenario harness recorded them: fixture providers, the
   SIMULATED rail, the v2 corpus. Regenerate with `node --import tsx src/fixtures/generate-uc.ts`.
   UC3: AlphaLeak's proof fails, it is challenged, refunded and quarantined (H 0.80 → 0.40); round 2
   skips it (SKIP_LOW_TRUST) and buys The Fab Floor. UC4 (#211): one focused free search finds the third fact. */
export const ucRuns = { UC1: RunSnapshotSchema.parse(uc1), UC2: RunSnapshotSchema.parse(uc2), UC3: RunSnapshotSchema.parse(uc3), UC4: RunSnapshotSchema.parse(uc4) }
export const uc3Run = ucRuns.UC3
/** GET /api/reputation after UC1–UC3. */
export const uc3Reputation = z.array(ReputationRecordSchema).parse(reputation)
/** POST /api/scope for UC2 (one angle question). */
export const uc2Scope = ScopeSchema.parse(scopeUc2)
