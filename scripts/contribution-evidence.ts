/** Offline evidence: reuse signed delivered leaves; never manufactures semantic fact gains. */
import { readFileSync, writeFileSync } from 'node:fs'
import { contributions, assessedSpend } from '../shared/contribution.js'
import { verifyAnswer } from '../sdk/verify.js'
import { sameSource } from '../shared/source-identity.js'
import { qualityMetrics } from '../eval/scorecard/metrics.js'
import type { QuestionResult } from '../eval/decisions/offline.js'
import type { ReceiptBundle } from '../shared/contracts/receipts.js'
const out = 'docs/evidence/round2-g'
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as ReceiptBundle
const save = (p: string, v: unknown) => writeFileSync(`${out}/${p}`, JSON.stringify(v, null, 2) + '\n')
const upgrade = (b: ReceiptBundle): ReceiptBundle => ({ ...b, schemaVersion: 3, identityVersion: b.schemaVersion as 1 | 2, contributions: contributions(b) })
const base = read('docs/evidence/round2-f/receipt-v2.json')
// Curate one extractive claim per distinct delivered span (no duplicate fact inflation).
const claims = base.sources.filter(s => base.intents.some(i => i.status === 'VERIFIED' && sameSource(i,s))).flatMap(s => s.spans.slice(0, 16).map((span, n) => ({ id: `${s.source?.origin}:${n}`, text: span.text, stance: 'SUPPORTS' as const, citations: [{ source: s.source, resourceId: s.resourceId, version: s.version, spanId: span.id }] })))
const useful = upgrade({ ...base, answers: [{ ...base.answers[0], version: 1, claims }] })
const redundant = upgrade({ ...base, answers: [{ ...base.answers[0], version: 1, claims }, { ...base.answers[0], version: 2, claims: [] }] })
const refundBase = read('docs/evidence/verify-278/receipts.json')
const refunded = upgrade({ ...refundBase, answers: [{ ...refundBase.answers[0], version: 1, claims: refundBase.sources.filter(s => refundBase.intents.some(i => i.status === 'VERIFIED' && sameSource(i,s))).flatMap(s => s.spans.map((span,n) => ({ id: `paid-${n}`, text: span.text, stance: 'SUPPORTS' as const, citations: [{ resourceId:s.resourceId, version:s.version, spanId:span.id }] }))) }] })
const scenarios = { useful, redundant, refunded }
for (const [name, b] of Object.entries(scenarios)) {
  save(`${name}.receipts.json`, b)
  const result = await verifyAnswer(b, { expectHead: b.audit.head })
  if (!result.ok) throw new Error(JSON.stringify(result.checks.filter(c => c.status === 'FAIL')))
  save(`${name}.verify.json`, result)
}
const mutations: Record<string, (b: ReceiptBundle) => void> = {
  origin: b => { b.sources[0].source!.origin = 'http://127.0.0.1:1' },
  key: b => { b.sources[0].source!.sellerKey = 'altered' },
  manifest: b => { b.proofs[0].manifest.root = '0'.repeat(64) },
  span: b => { b.contributions!.purchases[0].links[0].spanId = 'absent' },
  claim: b => { b.contributions!.purchases[0].links[0].claim += ' altered' },
  version: b => { b.contributions!.purchases[0].links[0].answerVersion++ },
  grant: b => { b.grants = [] },
  amount: b => { b.contributions!.purchases[0].grossMinor++ },
  retention: b => { b.contributions!.purchases[0].links[0].retained = false },
  citation: b => { b.contributions!.purchases[0].links[0].citation = 'altered' },
}
const tampers = []
for (const [name, mutate] of Object.entries(mutations)) {
  const b = structuredClone(useful); mutate(b)
  const result = await verifyAnswer(b)
  if (result.ok) throw new Error(`Accepted ${name}`)
  tampers.push({ class: name, rejected: true, failures: result.checks.filter(c => c.status === 'FAIL') })
}
save('tamper-results.json', tampers)
const rows = [{ spentMinor: 100, refundedMinor: 30, wastedMinor: 70, requested: 2, firstBuy: null, expectedBuy: null, free: { supported: [] }, final: { supported: ['f'] }, purchases: [
  { priceMinor: 30, proof: 'REFUNDED', gainedFacts: [], wasted: true }, { priceMinor: 40, proof: 'PASS', gainedFacts: ['removed'], wasted: true }, { priceMinor: 30, proof: 'PASS', gainedFacts: ['f', 'f'], wasted: false },
] }] as unknown as QuestionResult[]
const exact = assessedSpend(rows), scorecard = qualityMetrics(rows, [], null)
save('metric-equivalence.json', { mode: 'synthetic arithmetic rows, not runtime effectiveness', metricVersion: 'qualityMetrics unchanged', rows, ...exact, scorecardUsedSpendPct: scorecard.usedSpendPct, differencePercentagePoints: exact.usedSpendPct! - scorecard.usedSpendPct!, noSpend: assessedSpend([]) })
const compatibility = []
for (const name of ['receipt-v1.json', 'receipt-v2.json']) compatibility.push({ name, ...(await verifyAnswer(read(`docs/evidence/round2-f/${name}`))) })
save('contributions.json', { mode: 'synthetic extractive claim/passage use; not independently verified', source: 'Lane F c0450fa6; historical verify-278', rubric: 'exact delivered span extraction v1; no semantic assessment', policy: 'existing; unchanged', provider: 'fixture', corpus: 'F signed synthetic collision writers; verify-278', paidLinks: Object.fromEntries(Object.entries(scenarios).map(([n,b]) => [n, b.contributions!.purchases.flatMap(p => p.links).length])), compatibility, scenarios: Object.fromEntries(Object.entries(scenarios).map(([n,b]) => [n, b.contributions])) })
if (claims.some(c => !base.sources.some(s => sameSource(s, c.citations[0])))) throw new Error('inaccessible')
