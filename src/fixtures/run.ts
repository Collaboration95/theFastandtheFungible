import { exampleRun as foundationRun } from '../../shared/contracts/examples.js'
import { RunSnapshotSchema } from '../../shared/contracts/index.js'
import type { DecisionRound, DecisionRow, PublicCandidate, ReputationRecord } from '../../shared/contracts/index.js'
import { DEMO_QUESTIONS } from '../../shared/contracts/examples.js'
import { ScopeSchema } from '../../shared/contracts/index.js'

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

/* UC3 (story bible): round 1 buys AlphaLeak, its dated-figure proof fails, it is challenged,
   refunded and quarantined (H 0.80 → 0.40); round 2 skips it (SKIP_LOW_TRUST) and buys The Fab Floor.
   SIMULATED rail, synthetic corpus. AlphaLeak's delivered text is kept for audit only: not in contents, never cited. */
const uc3Id = 'offline-uc3'
const uc3At = (id: number) => `2026-10-07T09:00:${String(id).padStart(2, '0')}.000Z`
const uc3Event = (id: number, type: string, label: string, data?: Record<string, unknown>) => ({ id, runId: uc3Id, type, label, at: uc3At(id), ...(data ? { data } : {}) })
const synthetic = { kind: 'SYNTHETIC', attribution: 'ResearchAgent synthetic writers corpus' }
const article = (publisherSlug: string, writerSlug: string, resourceId: string, publisher: string, title: string, tier: 'FREE' | 'PAID', amountMinor: number, family: string, relevance: number, extra: Partial<PublicCandidate> = {}): PublicCandidate => ({
  profileId: publisherSlug, publisherSlug, writerSlug, resourceId, version: 'v1', title, publisher, preview: `Synthetic abstract: ${title}.`,
  price: { amountMinor, currency: 'SGD' }, family, facets: [], authority: 1, tier, license: synthetic, url: `/w/${publisherSlug}/articles/${resourceId}`, relevance, ...extra,
})
const openRecords = article('open-records', 'open-records', 'or-penang-packaging-output-2026-q3', 'Open Records', 'Malaysia advanced-packaging output and capacity, Q3 2026', 'FREE', 0, 'penang-packaging', 0.7)
const loadFactor = article('load-factor', 'load-factor', 'lf-penang-grid-connection', 'Load Factor', 'Powering a packaging plant in Penang', 'FREE', 0, 'penang-power', 0.2)
const alphaLeak = article('alphaleak', 'alphaleak', 'alphaleak-kestrel-penang-lead-times', 'AlphaLeak', "LEAKED: Kestrel's Penang lead times are collapsing", 'PAID', 30, 'alphaleak-penang', 0.96)
const fabFloor = article('the-fab-floor', 'the-fab-floor', 'fab-floor-kestrel-penang-lead-times', 'The Fab Floor', "Kestrel's Penang lead times: 26 weeks to 18 in three and a half months", 'PAID', 25, 'fab-floor-penang', 0.78)
const notft = article('notfinancialtimes', 'priya-nair', 'notft-malaysia-packaging-capex-2026', 'NotFinancialTimes', "Malaysia's packaging boom costs US$420 million", 'PAID', 90, 'notft-packaging-capex', 0.55)
const digest = article('marketpulse-digest', 'marketpulse-digest', 'mp-malaysia-packaging-digest', 'MarketPulse Digest', 'Malaysia packaging: US$420 million and counting', 'PAID', 20, 'notft-packaging-capex', 0.5, { derivedFrom: notft.resourceId })
const orText = "Kestrel's Penang Phase 2 plant was commissioned on 15 August 2026, raising capacity from 11,000 to 16,000 advanced-packaging units a month."
const ffText = 'Quoted lead times fell from 26 weeks (1 June) to 22 weeks (1 August) and 18 weeks (15 September 2026).'
const quarantined = { H: 0.4, C: 1, T: 0.4, status: 'quarantined' as const }
const judged = (candidate: PublicCandidate, gap: number, verdict: DecisionRow['verdict'], reason: string, reputation?: DecisionRow['reputation']): DecisionRow => {
  const value = 0.9 * gap * 0.85 * (0.5 + 0.25 * 1.2)
  return { candidate, judgment: { addressesGap: gap, originality: { original: 0.85, rewrite: 0.1, overlap: 0.05 }, credibility: 1.2 }, value, valuePerDollar: value / (candidate.price.amountMinor / 100), verdict, reason, wouldBuy: verdict === 'BUY', ...(reputation ? { reputation } : {}) }
}
const leakIntent = `${uc3Id}:1:${alphaLeak.resourceId}:v1`, fabIntent = `${uc3Id}:2:${fabFloor.resourceId}:v1`
const paidTx = 'A1'.repeat(32), refundTx = 'B2'.repeat(32), fabTx = 'C3'.repeat(32)
const SIM = 'SIMULATED SGD · no real funds' as const
export const uc3Run = RunSnapshotSchema.parse({
  runId: uc3Id, question: DEMO_QUESTIONS[2].text, budgetMinor: 200, spentMinor: 55, refundedMinor: 30, reservedMinor: 0, perSourceCapMinor: 100,
  phase: 'DONE', stopped: false, round: 2,
  candidates: [openRecords, loadFactor, alphaLeak, fabFloor, notft, digest],
  contents: [
    { profileId: openRecords.profileId, resourceId: openRecords.resourceId, version: 'v1', title: openRecords.title, publisher: openRecords.publisher, body: orText, spans: [{ id: 'capacity', text: orText }] },
    { profileId: fabFloor.profileId, resourceId: fabFloor.resourceId, version: 'v1', title: fabFloor.title, publisher: fabFloor.publisher, body: ffText, spans: [{ id: 'lead-times', text: ffText }] },
  ],
  answers: [
    { conclusion: 'Capacity rose after Phase 2, but no free source states a lead time.', claims: [{ id: 'cap', text: orText, stance: 'SUPPORTS', citations: [{ resourceId: openRecords.resourceId, version: 'v1', spanId: 'capacity' }] }], openGaps: [{ text: 'Actual lead times in weeks, and their trend.', tags: ['lead times'] }], version: 1, provider: 'fixture', model: 'extractive-fixture' },
    { conclusion: `Yes. ${ffText}`, claims: [{ id: 'lead', text: ffText, stance: 'SUPPORTS', citations: [{ resourceId: fabFloor.resourceId, version: 'v1', spanId: 'lead-times' }] }, { id: 'cap', text: orText, stance: 'SUPPORTS', citations: [{ resourceId: openRecords.resourceId, version: 'v1', spanId: 'capacity' }] }], openGaps: [], version: 2, provider: 'fixture', model: 'extractive-fixture' },
  ],
  impact: { classification: 'STRENGTHENS', explanation: 'A dated lead-time series strengthens the answer.', claimChanges: [{ toClaimId: 'lead', change: 'ADDED' }, { fromClaimId: 'cap', toClaimId: 'cap', change: 'UNCHANGED' }] },
  decisions: [
    { round: 1, gap: 'Actual lead times in weeks, and their trend.', gapMaterial: 0.9, provider: 'fixture', model: 'metadata-fixture', threshold: 0.2, selectedResourceId: alphaLeak.resourceId, rows: [
      judged(alphaLeak, 0.96, 'BUY', 'Best value per S$ above the bar.'), judged(fabFloor, 0.78, 'SKIP_LOW_VALUE', 'Lower value per S$ than the pick this round.'),
      judged(digest, 0.4, 'SKIP_REWRITE', 'A rewrite of NotFinancialTimes.'), judged(notft, 0.2, 'SKIP_LOW_VALUE', 'About capex, not lead times.')] },
    { round: 2, gap: 'Actual lead times in weeks, and their trend.', gapMaterial: 0.9, provider: 'fixture', model: 'metadata-fixture', threshold: 0.2, selectedResourceId: fabFloor.resourceId, rows: [
      judged(alphaLeak, 0.96, 'SKIP_LOW_TRUST', 'Honesty H 0.40 is under 0.50: quarantined.', quarantined), judged(fabFloor, 0.78, 'BUY', 'Best value per S$ above the bar.'),
      judged(digest, 0.4, 'SKIP_REWRITE', 'A rewrite of NotFinancialTimes.'), judged(notft, 0.2, 'SKIP_LOW_VALUE', 'About capex, not lead times.')] },
  ],
  intents: [
    { intentId: leakIntent, runId: uc3Id, profileId: 'alphaleak', resourceId: alphaLeak.resourceId, version: 'v1', amountMinor: 30, status: 'REFUNDED', receiptId: 'uc3-r1', txHash: paidTx, failedClaimIds: ['lead-times-dated'], refund: { txHash: refundTx, amountMinor: 30 } },
    { intentId: fabIntent, runId: uc3Id, profileId: 'the-fab-floor', resourceId: fabFloor.resourceId, version: 'v1', amountMinor: 25, status: 'VERIFIED', receiptId: 'uc3-r2', txHash: fabTx },
  ],
  receipts: [
    { receiptId: 'uc3-r1', intentId: leakIntent, runId: uc3Id, resourceId: alphaLeak.resourceId, version: 'v1', amountMinor: 30, currency: 'SGD', settledAt: uc3At(10), label: SIM },
    { receiptId: 'uc3-r2', intentId: fabIntent, runId: uc3Id, resourceId: fabFloor.resourceId, version: 'v1', amountMinor: 25, currency: 'SGD', settledAt: uc3At(22), label: SIM },
  ],
  // The server keeps AlphaLeak's grant for audit; its failed proof keeps it out of contents and citations.
  grants: [
    { runId: uc3Id, resourceId: alphaLeak.resourceId, version: 'v1', intentId: leakIntent, contentDigest: 'a'.repeat(64), grantedAt: uc3At(10) },
    { runId: uc3Id, resourceId: fabFloor.resourceId, version: 'v1', intentId: fabIntent, contentDigest: 'f'.repeat(64), grantedAt: uc3At(22) },
  ],
  events: [
    uc3Event(1, 'PLAN', 'Search plan (fixture · scope-fixture): Kestrel Penang packaging lead times · Malaysia advanced-packaging capacity', { plan: { restatement: 'Penang packaging lead times', subqueries: ['Kestrel Penang packaging lead times', 'Malaysia advanced-packaging capacity'] }, planner: 'fixture · scope-fixture' }),
    uc3Event(2, 'SEARCH', 'Searching 8 writers (hybrid).'), uc3Event(3, 'READ_FREE', 'Reading free sources only.'), uc3Event(4, 'ANSWER', 'Writing the free answer.'),
    uc3Event(5, 'DECIDE', 'Scoring public abstracts and applying spending policy.'), uc3Event(6, 'BUY', 'Policy selected one purchase within budget.'),
    uc3Event(7, 'WIRE', `GET ${alphaLeak.url} → 402`, { method: 'GET', path: alphaLeak.url, status: 402 }),
    uc3Event(8, 'PURCHASE', 'RESERVED', { intentId: leakIntent, status: 'RESERVED' }),
    uc3Event(9, 'XRPL', 'Signed payment sent to the publisher\'s facilitator · SIMULATED', { intentId: leakIntent }),
    uc3Event(10, 'WIRE', `GET ${alphaLeak.url} → 200`, { method: 'GET', path: alphaLeak.url, status: 200 }),
    uc3Event(11, 'PROOF', 'Proof failed · lead-times-dated · source quarantined, never cited', { intentId: leakIntent, claims: 1, ok: false, rootOk: true, wordCountOk: true, failedClaimIds: ['lead-times-dated'] }),
    uc3Event(12, 'CHALLENGE', 'POST /w/alphaleak/challenge · claim lead-times-dated', { intentId: leakIntent, claimId: 'lead-times-dated', txHash: paidTx, label: SIM }),
    uc3Event(13, 'WIRE', 'POST /w/alphaleak/challenge → 200', { method: 'POST', path: '/w/alphaleak/challenge', status: 200 }),
    uc3Event(14, 'CHALLENGE', 'REFUNDED', { intentId: leakIntent, status: 'REFUNDED', label: SIM }),
    uc3Event(15, 'REFUND', `Refunded S$0.30 · InvoiceID = original tx · ${SIM}`, { intentId: leakIntent, txHash: refundTx, amountMinor: 30, originalTxHash: paidTx, label: SIM }),
    uc3Event(16, 'REPUTATION', 'alphaleak: proof refunded · H 0.80→0.40 · C 1.00→1.00 · quarantined', { publisherSlug: 'alphaleak', before: { H: 0.8, C: 1, T: 0.8, status: 'active' }, after: quarantined }),
    uc3Event(17, 'DECIDE', 'Scoring public abstracts and applying spending policy.'), uc3Event(18, 'BUY', 'Policy selected one purchase within budget.'),
    uc3Event(19, 'WIRE', `GET ${fabFloor.url} → 402`, { method: 'GET', path: fabFloor.url, status: 402 }),
    uc3Event(20, 'PURCHASE', 'RESERVED', { intentId: fabIntent, status: 'RESERVED' }),
    uc3Event(21, 'XRPL', 'Signed payment sent to the publisher\'s facilitator · SIMULATED', { intentId: fabIntent }),
    uc3Event(22, 'WIRE', `GET ${fabFloor.url} → 200`, { method: 'GET', path: fabFloor.url, status: 200 }),
    uc3Event(23, 'PROOF', 'Proof verified · 1 claim recomputed', { intentId: fabIntent, claims: 1, ok: true }),
    uc3Event(24, 'GRANT', 'manifest root verified', { intentId: fabIntent, resourceId: fabFloor.resourceId, version: 'v1' }),
    uc3Event(25, 'REPUTATION', 'the-fab-floor: proof pass · H 0.80→0.83 · C 1.00→1.00 · active', { publisherSlug: 'the-fab-floor', before: { H: 0.8, C: 1, T: 0.8, status: 'active' }, after: { H: 0.83, C: 1, T: 0.83, status: 'active' } }),
    uc3Event(26, 'READ_PAID', 'Verified grant permits paid evidence.'), uc3Event(27, 'ANSWER', 'Re-answering with verified evidence.'),
    uc3Event(28, 'DONE', 'Answer ready.'),
  ],
  labels: { research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', publisher: 'local', settlement: SIM, search: 'hybrid', plan: 'fixture · scope-fixture' },
  checkpoint: {}, reportStatus: 'NONE',
})
const record = (publisherSlug: string, r: number, s: number, counts: Pick<ReputationRecord, 'passes' | 'fails' | 'refunds' | 'refusals'>): ReputationRecord => {
  const H = (r + 4) / (r + s + 5)
  return { publisherSlug, wallet: `r${publisherSlug}`, r, s, ...counts, brierSum: 0, n: 0, H, C: 1, T: H, status: H < 0.5 ? 'quarantined' : 'active', updatedAt: uc3At(25) }
}
/** GET /api/reputation after the UC3 fixture run. */
export const uc3Reputation: ReputationRecord[] = [
  record('alphaleak', 0, 5, { passes: 0, fails: 1, refunds: 1, refusals: 0 }),
  record('the-fab-floor', 1, 0, { passes: 1, fails: 0, refunds: 0, refusals: 0 }),
]
/** POST /api/scope for UC2 (one angle question, story bible). */
export const uc2Scope = ScopeSchema.parse({
  questions: [{ id: 'angle', text: 'Which angle matters most to you?', options: ['capacity allocation', 'pricing & margins', 'delivery timeline'] }],
  plan: { restatement: "Analyst outlook on Kestrel's TSMC deal", subqueries: ['Kestrel TSMC deal analyst outlook', 'Kestrel gross margin consensus FY27'] },
})
