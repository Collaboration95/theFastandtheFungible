import type { Answer, ContentEnvelope, PublicCandidate, RunSnapshot } from './index.js'
import { XRPL_LABEL } from './publisher.js'
/** Demo use cases (D16). Wording locked by the corpus story bible (data/corpus/v2/story-bible.json). */
export const DEMO_QUESTIONS = [
  { id: 'UC1', text: 'What did the Bank of Japan change at its last meeting, and how did 10-year JGB yields react?' },
  { id: 'UC2', text: "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC?" },
  { id: 'UC3', text: "Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia getting shorter?" },
  { id: 'UC4', text: "When was Kestrel Semiconductor's Penang Phase 2 packaging plant commissioned, how large a grid connection does it need, and how much of its electricity comes from renewable sources?" },
] as const
/**
 * Home examples for a Testnet app. The fictional-corpus questions above get no answer from the labelled team-authored XRPL writers,
 * so a judge's first click would be a decline. These three are bought and cited from those writers on Testnet.
 */
// R9-A (r9 §6.1): the x402 402 question leads. It was the most reliable question in round 9 (2/2 hosted, one purchase,
// the PAYMENT-REQUIRED / PAYMENT-SIGNATURE answer) and the likeliest Ripple DevRel question; it replaces the overlapping
// "x402 headers" preset under the same id. RLUSD escrow follows now that it buys one article and leads with the flag.
export const TESTNET_QUESTIONS = [
  { id: 'XRPL2', label: 'x402 payment', text: 'What does an x402 402 response contain, and can my agent pay it with XRP on Testnet?' },
  { id: 'XRPL1', label: 'RLUSD escrow', text: 'Can an XRPL escrow hold RLUSD today, and what must the issuer enable before a buyer can lock it?' },
  { id: 'XRPL3', label: 'How writers get paid', text: 'How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?' },
] as const
const FIXTURE_LABELS: Record<string, string> = { UC1: 'Bank of Japan decision', UC2: 'Kestrel–TSMC outlook', UC3: 'Malaysia packaging lead times', UC4: 'Penang plant power' }
/** The three example questions for a rail: Testnet shows XRPL questions; simulated and recorded demos keep the fixture stories. */
export function exampleQuestions(settlement?: string): { id: string; label: string; text: string }[] {
  if (settlement === XRPL_LABEL) return TESTNET_QUESTIONS.map(q => ({ ...q }))
  return DEMO_QUESTIONS.slice(0, 3).map(q => ({ id: q.id, label: FIXTURE_LABELS[q.id] ?? q.id, text: q.text }))
}
/** A neutral synthetic question for unit-test fixtures (not a demo use case). */
const EXAMPLE_QUESTION = "Can a fictional operator's announced 600 MW expansion actually be operating by 2028?"
export const exampleCandidate: PublicCandidate = { profileId: 'public-records', resourceId: 'example-free', version: 'v1', title: 'Synthetic demand record', publisher: 'Fictional Public Records', preview: 'A synthetic primary record of contracted demand.', price: { amountMinor: 0, currency: 'SGD' }, family: 'demand-record', facets: ['demand'], authority: 2, tier: 'FREE', license: { kind: 'SYNTHETIC', attribution: 'ResearchAgent fictional demo corpus' } }
export const exampleContent: ContentEnvelope = { profileId: exampleCandidate.profileId, resourceId: exampleCandidate.resourceId, version: 'v1', title: exampleCandidate.title, publisher: exampleCandidate.publisher, body: 'A fictional operator announces a 600 MW expansion supported by contracted demand.', spans: [{ id: 'demand-1', text: 'A fictional operator announces a 600 MW expansion supported by contracted demand.' }] }
export const exampleAnswer: Answer = { conclusion: 'Demand supports the plan; grid energisation remains unverified.', claims: [{ id: 'claim-1', text: exampleContent.body, stance: 'SUPPORTS', citations: [{ resourceId: exampleContent.resourceId, version: 'v1', spanId: 'demand-1' }] }], openGaps: [{ text: 'No independent evidence on grid energisation dates.', tags: ['grid-energisation'] }], version: 1, provider: 'fixture', model: 'extractive-fixture' }
export const exampleRun: RunSnapshot = { runId: 'example-run', question: EXAMPLE_QUESTION, budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, phase: 'DECIDE', stopped: false, round: 0, candidates: [exampleCandidate], contents: [exampleContent], answers: [exampleAnswer], decisions: [], intents: [], receipts: [], grants: [], events: [], labels: { research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', publisher: 'local', settlement: 'SIMULATED SGD · no real funds' }, checkpoint: {}, reportStatus: 'NONE' }
