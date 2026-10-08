// `npm run eval:decisions` (#203): does buying improve the answer compared with free-only?
// For every bank question it runs the product's own steps in process: search (keyword index), the free
// answer (writeAnswer), up to three decide() rounds under the real spending policy and trust, a simulated
// purchase with the delivery proof check, and the re-answer. It scores the free-only answer (v1) and the
// final answer on requested facts supported, citation validity, purchases per question and wasted spend.
//
// Default: fixture mode, no network. The research writer is always the extractive fixture here.
// `--decision flash|clef|luna --live` (with EVAL_LIVE=1) swaps only the decision judge for the harness
// transport (a separate EVAL_* account); see eval/decisions/README.md for the expected call counts.
import { fileURLToPath } from 'node:url'
import type { Answer, ContentEnvelope, DecisionRound, PublicCandidate, ReputationRecord } from '../../shared/contracts/index.js'
import { BUDGET } from '../../shared/contracts/index.js'
import { decide, FixtureDecisionProvider, publicSources, type DecisionProvider } from '../../server/agents/decision.js'
import { writeAnswer } from '../../server/agents/research.js'
import { applyCalibration, applyProof, newRecord, summary } from '../../server/reputation.js'
import { loadBank, type Question } from '../questions/bank.js'
import { citationValidity, supportedFacts } from './facts.js'
import { decisionMetrics } from './metrics.js'
import { HarnessDecisionProvider } from './providers/decisions.js'
import { enableLive, save, type Arm } from './transport.js'
import { contentOf, loadWorld, proofPasses, retrieveOffline, WORLD_LABELS, type World } from './world.js'

export type Purchase = { round: number; resourceId: string; priceMinor: number; proof: 'PASS' | 'REFUNDED'; claimed?: number; observed?: number; gainedFacts: string[]; wasted: boolean }
export type QuestionResult = {
  id: string; kind: Question['kind']; hardCase?: string; useCase?: string; requested: number
  free: { supported: string[]; citations: { valid: number; total: number }; gaps: string[] }
  final: { supported: string[]; citations: { valid: number; total: number }; answerVersions: number }
  purchases: Purchase[]; spentMinor: number; refundedMinor: number; wastedMinor: number
  rounds: { round: number; gap: string; selected: string | null; fallback?: string; verdicts: Record<string, string> }[]
  expectedBuy: string | null; firstBuy: string | null; firstBuyPriceMinor: number; error?: string
}

/** Fixture mode never reaches an LLM, whatever the shell exports. */
export function forceFixtureResearch() {
  for (const name of ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_BASE_URL', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY']) delete process.env[name]
  process.env.LANGFUSE_ENABLED = '0'
}

export async function runQuestion(world: World, q: Question, provider: DecisionProvider, trust: Map<string, ReputationRecord>, options: { budgetMinor?: number; threshold?: number } = {}): Promise<QuestionResult> {
  const budgetMinor = options.budgetMinor ?? BUDGET.initialMinor
  const { candidates, contents: free } = await retrieveOffline(world, [q.question])
  const contents: ContentEnvelope[] = [...free]
  const focus = q.answers ? Object.values(q.answers).join(', ') : undefined
  const first = (await writeAnswer({ question: q.question, contents, candidates, version: 1, ...(focus ? { focus } : {}) })).answer
  const answers: Answer[] = [first]
  const purchases: Purchase[] = []
  const rounds: QuestionResult['rounds'] = []
  let spentMinor = 0, error: string | undefined
  try {
    for (let round = 1; round <= 3 && spentMinor < budgetMinor; round++) {
      const answer = answers.at(-1)!
      const gap = answer.openGaps[0]?.text ?? ''
      const readSources = publicSources(candidates.filter(c => contents.some(x => x.resourceId === c.resourceId)))
      const reputation = Object.fromEntries([...trust.values()].map(r => [r.wallet, summary(r)]))
      const decision: DecisionRound = await decide({ question: q.question, conclusion: answer.conclusion, gap, candidates, readSources, boughtResourceIds: purchases.map(p => p.resourceId), budgetMinor, spentMinor, reservedMinor: 0, perSourceCapMinor: BUDGET.capMinor, round, provider, ...(options.threshold === undefined ? {} : { threshold: options.threshold }), reputation })
      rounds.push({ round, gap, selected: decision.selectedResourceId ?? null, ...(decision.fallbackReason ? { fallback: decision.fallbackReason } : {}), verdicts: Object.fromEntries(decision.rows.map(r => [r.candidate.resourceId, r.verdict])) })
      if (!decision.selectedResourceId) break
      const candidate = candidates.find(c => c.resourceId === decision.selectedResourceId)! as PublicCandidate
      const article = world.articles.get(candidate.resourceId)!
      const price = candidate.price.amountMinor
      spentMinor += price
      const slug = candidate.publisherSlug ?? candidate.profileId
      const record = trust.get(candidate.wallet!) ?? newRecord(slug, candidate.wallet!)
      // The proof check on delivery (D4): a failed planted claim is quarantined, challenged and refunded (D5).
      if (!proofPasses(article)) {
        trust.set(candidate.wallet!, applyProof(record, 'REFUNDED'))
        purchases.push({ round, resourceId: candidate.resourceId, priceMinor: price, proof: 'REFUNDED', gainedFacts: [], wasted: true })
        continue
      }
      // Verified grant: only now may the delivered passages be read (gate 1).
      const delivered = contentOf(world, article)
      let next = applyProof(record, 'PASS')
      let observed: number | undefined
      try {
        observed = provider.judgePaidRelevance ? (await provider.judgePaidRelevance({ question: q.question, gap, content: structuredClone(delivered) })).observed : undefined
        if (observed !== undefined && candidate.relevance !== undefined) next = applyCalibration(next, candidate.relevance, observed)
      } catch { observed = undefined }
      trust.set(candidate.wallet!, next)
      contents.push(delivered)
      const before = supportedFacts(answer, contents, q)
      const reanswer = (await writeAnswer({ question: q.question, contents, candidates, version: answer.version + 1, previous: structuredClone(answer), ...(focus ? { focus } : {}) })).answer
      answers.push(reanswer)
      const gained = supportedFacts(reanswer, contents, q).filter(id => !before.includes(id))
      purchases.push({ round, resourceId: candidate.resourceId, priceMinor: price, proof: 'PASS', ...(candidate.relevance === undefined ? {} : { claimed: candidate.relevance }), ...(observed === undefined ? {} : { observed }), gainedFacts: gained, wasted: gained.length === 0 })
    }
  } catch (e) { error = e instanceof Error ? e.message : String(e) }
  const final = answers.at(-1)!
  const refundedMinor = purchases.filter(p => p.proof === 'REFUNDED').reduce((s, p) => s + p.priceMinor, 0)
  return {
    id: q.id, kind: q.kind, ...(q.hardCase ? { hardCase: q.hardCase } : {}), ...(q.useCase ? { useCase: q.useCase } : {}), requested: q.requested.length,
    free: { supported: supportedFacts(first, free, q), citations: citationValidity(first, free), gaps: first.openGaps.map(g => g.text) },
    final: { supported: supportedFacts(final, contents, q), citations: citationValidity(final, contents), answerVersions: answers.length },
    purchases, spentMinor, refundedMinor, wastedMinor: purchases.filter(p => p.wasted).reduce((s, p) => s + p.priceMinor, 0), rounds,
    expectedBuy: q.expect.buy, firstBuy: purchases[0]?.resourceId ?? null, firstBuyPriceMinor: purchases[0]?.priceMinor ?? 0, ...(error ? { error } : {}),
  }
}

const ratio = (n: number, d: number) => d ? n / d : null
/** Free-only vs with-purchase, overall and by question kind. */
export function summarize(results: QuestionResult[]) {
  const block = (rs: QuestionResult[]) => {
    const requested = rs.reduce((s, r) => s + r.requested, 0)
    const cites = (k: 'free' | 'final') => rs.reduce((acc, r) => ({ valid: acc.valid + r[k].citations.valid, total: acc.total + r[k].citations.total }), { valid: 0, total: 0 })
    const freeCites = cites('free'), finalCites = cites('final')
    const purchases = rs.flatMap(r => r.purchases)
    return {
      questions: rs.length, requestedFacts: requested,
      freeOnly: { factsSupported: rs.reduce((s, r) => s + r.free.supported.length, 0), factRecall: ratio(rs.reduce((s, r) => s + r.free.supported.length, 0), requested), citationValidity: ratio(freeCites.valid, freeCites.total) },
      withPurchase: { factsSupported: rs.reduce((s, r) => s + r.final.supported.length, 0), factRecall: ratio(rs.reduce((s, r) => s + r.final.supported.length, 0), requested), citationValidity: ratio(finalCites.valid, finalCites.total) },
      purchasesPerQuestion: ratio(purchases.length, rs.length), spentMinor: rs.reduce((s, r) => s + r.spentMinor, 0), refundedMinor: rs.reduce((s, r) => s + r.refundedMinor, 0),
      wastedMinor: rs.reduce((s, r) => s + r.wastedMinor, 0), wastedPurchases: purchases.filter(p => p.wasted).length, failedProofs: purchases.filter(p => p.proof === 'REFUNDED').length,
      firstPurchaseVsBank: decisionMetrics(rs.map(r => ({ expected: r.expectedBuy, selected: r.firstBuy, priceMinor: r.firstBuyPriceMinor }))),
      errors: rs.filter(r => r.error).map(r => ({ id: r.id, error: r.error })),
    }
  }
  const kinds = [...new Set(results.map(r => r.kind))].sort()
  return { overall: block(results), byKind: Object.fromEntries(kinds.map(k => [k, block(results.filter(r => r.kind === k))])) }
}

/**
 * Questions run in bank order. Trust is reset per question by default, as before every live use-case run
 * (prompt.md §4); `sharedTrust` keeps one table across questions, as one long-lived server would, so an
 * earlier purchase's calibration or refund changes later decisions (order-dependent by design).
 */
export async function evaluateBank(options: { provider?: DecisionProvider; ids?: string[]; budgetMinor?: number; world?: World; sharedTrust?: boolean } = {}) {
  const bank = loadBank()
  const world = options.world ?? await loadWorld()
  const provider = options.provider ?? new FixtureDecisionProvider()
  const trust = new Map<string, ReputationRecord>()
  const questions = bank.questions.filter(q => !options.ids || options.ids.includes(q.id))
  const results: QuestionResult[] = []
  for (const q of questions) {
    if (!options.sharedTrust) trust.clear()
    results.push(await runQuestion(world, q, provider, trust, { budgetMinor: options.budgetMinor }))
  }
  return { bankVersion: bank.version, trust: options.sharedTrust ? 'shared across questions' : 'reset per question', labels: { ...WORLD_LABELS, research: 'fixture · extractive-fixture', decision: `${provider.name} · ${provider.model}` }, summary: summarize(results), results }
}

function printTable(report: Awaited<ReturnType<typeof evaluateBank>>) {
  const pct = (x: number | null) => x === null ? '–' : `${(x * 100).toFixed(1)}%`
  const rows = [['overall', report.summary.overall] as const, ...Object.entries(report.summary.byKind)]
  console.log(`Decision eval · bank v${report.bankVersion} · trust ${report.trust} · ${report.labels.decision} · ${report.labels.research} · ${report.labels.search} · ${report.labels.settlement}`)
  console.log('slice            n  facts free→paid     cites free/paid   buys/q  spent  wasted  refunded  F1 vs bank')
  for (const [name, s] of rows) console.log(`${name.padEnd(15)} ${String(s.questions).padStart(2)}  ${pct(s.freeOnly.factRecall).padStart(6)} → ${pct(s.withPurchase.factRecall).padStart(6)}   ${pct(s.freeOnly.citationValidity).padStart(6)}/${pct(s.withPurchase.citationValidity).padEnd(6)}   ${(s.purchasesPerQuestion ?? 0).toFixed(2).padStart(5)}  S$${(s.spentMinor / 100).toFixed(2)}  S$${(s.wastedMinor / 100).toFixed(2)}  S$${(s.refundedMinor / 100).toFixed(2)}    ${s.firstPurchaseVsBank.f1.toFixed(2)}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
  forceFixtureResearch()
  const arm = arg('--decision') as Arm | 'fixture' | undefined
  let provider: DecisionProvider | undefined
  if (arm && arm !== 'fixture') {
    if (!process.argv.includes('--live')) throw new Error('A live decision arm needs --live (and EVAL_LIVE=1).')
    enableLive()
    provider = new HarnessDecisionProvider(arm, 'eval-decisions')
  }
  const report = await evaluateBank({ provider, ids: arg('--ids')?.split(','), budgetMinor: arg('--budget') ? Number(arg('--budget')) : undefined, sharedTrust: process.argv.includes('--shared-trust') })
  printTable(report)
  const file = save(`offline-${arm ?? 'fixture'}.json`, report)
  console.log(`Full report: ${file}`)
}
