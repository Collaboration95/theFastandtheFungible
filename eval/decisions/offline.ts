// `npm run eval:decisions` (#203): does buying improve the answer compared with free-only?
// For every bank question it runs the product's own steps in process: search (keyword index), the free
// answer (writeAnswer), up to three decide() rounds under the real spending policy and trust, a simulated
// purchase with the delivery proof check, and the re-answer. It scores the free-only answer (v1) and the
// final answer on requested facts supported, citation validity, purchases per question and wasted spend.
//
// Default: fixture mode, no network. The research writer is always the extractive fixture here.
// `--decision flash|clef|luna --live` (with EVAL_LIVE=1) swaps only the decision judge for the harness
// transport (a separate EVAL_* account); see eval/decisions/README.md for the expected call counts.
//
// `--decision production` (#207, #212) runs the provider the demo runs (DECISION_PROVIDER, built as server/routes.ts
// builds it; see providers/production.ts) on the post-#221 flow: each question's requested facts (`requested[].need`)
// are the frozen requirements, every round judges the next open one as the gap with gap_material fixed at 1, and one
// free follow-up search runs before round 1. Coverage is the bank's scripted needle check (no extra model call; #213
// measured the coverage judge separately). `--flow requested|gap` picks the flow for any arm.
// `--sweep` judges every requested fact once on the initial evidence (question search + that fact's follow-up search),
// buying nothing: the calibration dataset. Every decide() round writes per-candidate rows to `--dataset <file.jsonl>`.
// `--plan` prints the exact call counts (and bounds for the flow) and runs nothing live.
import { fileURLToPath } from 'node:url'
import type { Answer, ContentEnvelope, DecisionRound, PublicCandidate, ReputationRecord } from '../../shared/contracts/index.js'
import { BUDGET } from '../../shared/contracts/index.js'
import { decide, FixtureDecisionProvider, publicSources, type DecisionProvider } from '../../server/agents/decision.js'
import { chunkCandidates, decisionsMaxQuestions } from '../../server/agents/openai-decisions.js'
import { followUpQuery } from '../../server/agents/requirements.js'
import { FOLLOW_UP, sanitizeGaps, writeAnswer } from '../../server/agents/research.js'
import { applyCalibration, applyProof, newRecord, summary } from '../../server/reputation.js'
import { loadBank, type Fact, type Question } from '../questions/bank.js'
import { datasetRows, writeJsonl, type DatasetRow } from './dataset.js'
import { citationValidity, supportedFacts } from './facts.js'
import { decisionMetrics } from './metrics.js'
import { HarnessDecisionProvider } from './providers/decisions.js'
import { countingFetch, productionProvider } from './providers/production.js'
import { assertNoSecrets, enableLive, outDir, rates, save, type Arm } from './transport.js'
import { contentOf, loadWorld, proofPasses, retrieveOffline, WORLD_LABELS, type World } from './world.js'

export type Purchase = { round: number; resourceId: string; priceMinor: number; proof: 'PASS' | 'REFUNDED'; claimed?: number; observed?: number; gainedFacts: string[]; wasted: boolean }
export type Flow = 'gap' | 'requested'
export type QuestionResult = {
  id: string; kind: Question['kind']; hardCase?: string; useCase?: string; requested: number
  free: { supported: string[]; citations: { valid: number; total: number }; gaps: string[] }
  final: { supported: string[]; citations: { valid: number; total: number }; answerVersions: number }
  purchases: Purchase[]; spentMinor: number; refundedMinor: number; wastedMinor: number
  rounds: { round: number; gap: string; factId?: string; selected: string | null; fallback?: string; verdicts: Record<string, string> }[]
  expectedBuy: string | null; firstBuy: string | null; firstBuyPriceMinor: number; error?: string
  followUp?: { factId: string; query: string; freeRead: number; paidFound: number; kept: boolean }
  stop?: string
}
export type RunOptions = {
  budgetMinor?: number; threshold?: number; flow?: Flow
  /** Ask the provider's paid-relevance question after a verified grant. Production does not (its trust check uses embeddings), so the production arm turns it off. */
  paidRelevance?: boolean
  /** Per-candidate rows of every decide() round are appended here (#207). */
  dataset?: DatasetRow[]
}

/** Fixture mode never reaches an LLM, whatever the shell exports. */
export function forceFixtureResearch() {
  for (const name of ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_BASE_URL', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY']) delete process.env[name]
  process.env.LANGFUSE_ENABLED = '0'
}

type State = { world: World; q: Question; provider: DecisionProvider; trust: Map<string, ReputationRecord>; candidates: PublicCandidate[]; contents: ContentEnvelope[]; answers: Answer[]; purchases: Purchase[]; focus?: string; requirements?: string[]; paidRelevance: boolean }
const reputationOf = (trust: Map<string, ReputationRecord>) => Object.fromEntries([...trust.values()].map(r => [r.wallet, summary(r)]))
const write = (s: State, previous?: Answer) => writeAnswer({ question: s.q.question, contents: s.contents, candidates: s.candidates, version: (previous?.version ?? 0) + 1, ...(previous ? { previous: structuredClone(previous) } : {}), ...(s.focus ? { focus: s.focus } : {}), ...(s.requirements ? { requirements: s.requirements } : {}) }).then(r => r.answer)
const readSourcesOf = (candidates: PublicCandidate[], contents: ContentEnvelope[]) => publicSources(candidates.filter(c => contents.some(x => x.resourceId === c.resourceId)))
/** The simulated purchase of the policy's pick: proof check (D4), refund on failure (D5), else grant and re-answer. Returns the price. */
async function buy(s: State, round: number, resourceId: string, gap: string): Promise<number> {
  const candidate = s.candidates.find(c => c.resourceId === resourceId)!
  const article = s.world.articles.get(candidate.resourceId)!
  const price = candidate.price.amountMinor
  const slug = candidate.publisherSlug ?? candidate.profileId
  const record = s.trust.get(candidate.wallet!) ?? newRecord(slug, candidate.wallet!)
  // The proof check on delivery (D4): a failed planted claim is quarantined, challenged and refunded (D5).
  if (!proofPasses(article)) {
    s.trust.set(candidate.wallet!, applyProof(record, 'REFUNDED'))
    s.purchases.push({ round, resourceId: candidate.resourceId, priceMinor: price, proof: 'REFUNDED', gainedFacts: [], wasted: true })
    return price
  }
  // Verified grant: only now may the delivered passages be read (gate 1).
  const delivered = contentOf(s.world, article)
  let next = applyProof(record, 'PASS')
  let observed: number | undefined
  if (s.paidRelevance) try {
    observed = s.provider.judgePaidRelevance ? (await s.provider.judgePaidRelevance({ question: s.q.question, gap, content: structuredClone(delivered) })).observed : undefined
    if (observed !== undefined && candidate.relevance !== undefined) next = applyCalibration(next, candidate.relevance, observed)
  } catch { observed = undefined }
  s.trust.set(candidate.wallet!, next)
  s.contents.push(delivered)
  const answer = s.answers.at(-1)!
  const before = supportedFacts(answer, s.contents, s.q)
  const reanswer = await write(s, answer)
  s.answers.push(reanswer)
  const gained = supportedFacts(reanswer, s.contents, s.q).filter(id => !before.includes(id))
  s.purchases.push({ round, resourceId: candidate.resourceId, priceMinor: price, proof: 'PASS', ...(candidate.relevance === undefined ? {} : { claimed: candidate.relevance }), ...(observed === undefined ? {} : { observed }), gainedFacts: gained, wasted: gained.length === 0 })
  return price
}
/** The free focused search for one requested fact (#210): new hits only, every new free hit read, at most FOLLOW_UP.paidToAdd paid. */
async function followUpFor(world: World, q: Question, fact: Fact, known: PublicCandidate[]) {
  const query = followUpQuery({ text: fact.need }, q.question)
  const found = await retrieveOffline(world, [query])
  const fresh = found.candidates.filter(c => !known.some(k => k.resourceId === c.resourceId))
  const added = [...fresh.filter(c => c.tier === 'FREE'), ...fresh.filter(c => c.tier === 'PAID').slice(0, FOLLOW_UP.paidToAdd)]
  return { query, added, contents: found.contents.filter(c => added.some(a => a.resourceId === c.resourceId)) }
}

export async function runQuestion(world: World, q: Question, provider: DecisionProvider, trust: Map<string, ReputationRecord>, options: RunOptions = {}): Promise<QuestionResult> {
  const budgetMinor = options.budgetMinor ?? BUDGET.initialMinor
  const flow = options.flow ?? 'gap'
  const { candidates, contents: free } = await retrieveOffline(world, [q.question])
  const s: State = { world, q, provider, trust, candidates: [...candidates], contents: [...free], answers: [], purchases: [], paidRelevance: options.paidRelevance ?? true, ...(q.answers ? { focus: Object.values(q.answers).join(', ') } : {}), ...(flow === 'requested' ? { requirements: q.requested.map(f => f.need) } : {}) }
  const first = await write(s)
  s.answers.push(first)
  const rounds: QuestionResult['rounds'] = []
  let spentMinor = 0, error: string | undefined, stop: string | undefined, followUp: QuestionResult['followUp']
  const supported = () => supportedFacts(s.answers.at(-1), s.contents, q)
  const open = () => q.requested.filter(f => !supported().includes(f.id))
  const decideRound = (round: number, gap: string, fact?: Fact) => {
    const readSources = readSourcesOf(s.candidates, s.contents)
    return decide({ question: q.question, conclusion: s.answers.at(-1)!.conclusion, gap, ...(flow === 'requested' ? { requirement: Boolean(fact) } : {}), candidates: s.candidates, readSources, boughtResourceIds: s.purchases.map(p => p.resourceId), budgetMinor, spentMinor, reservedMinor: 0, perSourceCapMinor: BUDGET.capMinor, round, provider, ...(options.threshold === undefined ? {} : { threshold: options.threshold }), reputation: reputationOf(trust) })
      .then(decision => { options.dataset?.push(...datasetRows(world, q, decision, { ...(fact ? { fact } : {}), factOpen: true, readSources, mode: 'flow' })); return decision })
  }
  try {
    if (flow === 'requested') {
      // One free follow-up search before round 1 (#210), for the first open fact; the answer is kept only when coverage improves.
      const target = open()[0]
      if (target) {
        const found = await followUpFor(world, q, target, s.candidates)
        s.candidates.push(...found.added)
        let kept = false
        if (found.contents.length) {
          const before = supported().length
          s.contents.push(...found.contents)
          const reanswer = await write(s, s.answers.at(-1))
          if (supportedFacts(reanswer, s.contents, q).length > before) { s.answers.push(reanswer); kept = true }
        }
        followUp = { factId: target.id, query: found.query, freeRead: found.contents.length, paidFound: found.added.filter(c => c.tier === 'PAID').length, kept }
      }
      // #209: each round judges the next open requested fact not yet judged on this evidence; the round limit is 3.
      const attempts = new Set<string>()
      for (let round = 1; ; round++) {
        const facts = open()
        // Evidence state as loop.ts: accessible sources plus purchase outcomes, so new evidence or a refund re-opens a fact.
        const fingerprint = [...s.contents.map(c => c.resourceId).sort(), '|', ...s.purchases.map(p => `${p.resourceId}:${p.proof}`).sort()].join(',')
        const fact = facts.find(f => !attempts.has(`${f.id}|${fingerprint}`))
        if (round > 1 && !facts.length) { stop = 'complete'; break }
        if (round > 3) { stop = 'round-limit'; break }
        if (budgetMinor > 0 && spentMinor >= budgetMinor) { stop = 'budget-exhausted'; break }
        if (round > 1 && !fact) { stop = 'no-eligible-purchase'; break }
        if (fact) attempts.add(`${fact.id}|${fingerprint}`)
        // The frozen requirement text, sanitised like a gap (loop.ts); round 1 with nothing open has an empty gap and makes no call (UC1).
        const gap = fact ? sanitizeGaps([fact.need], s.candidates)[0]?.text ?? fact.need : ''
        let decision: DecisionRound
        try { decision = await decideRound(round, gap, fact) } catch (e) {
          // A failed decision fails the round and buys nothing (#197); the answer so far stands.
          rounds.push({ round, gap, ...(fact ? { factId: fact.id } : {}), selected: null, fallback: `round failed: ${e instanceof Error ? e.message : String(e)}`, verdicts: {} })
          stop = 'decision-unavailable'
          break
        }
        rounds.push({ round, gap, ...(fact ? { factId: fact.id } : {}), selected: decision.selectedResourceId ?? null, verdicts: Object.fromEntries(decision.rows.map(r => [r.candidate.resourceId, r.verdict])) })
        if (!fact) { stop = 'complete'; break }
        if (decision.selectedResourceId) spentMinor += await buy(s, round, decision.selectedResourceId, gap)
      }
    } else {
      for (let round = 1; round <= 3 && spentMinor < budgetMinor; round++) {
        const gap = s.answers.at(-1)!.openGaps[0]?.text ?? ''
        let decision: DecisionRound
        try { decision = await decideRound(round, gap) } catch (e) {
          rounds.push({ round, gap, selected: null, fallback: `round failed: ${e instanceof Error ? e.message : String(e)}`, verdicts: {} })
          break
        }
        rounds.push({ round, gap, selected: decision.selectedResourceId ?? null, ...(decision.fallbackReason ? { fallback: decision.fallbackReason } : {}), verdicts: Object.fromEntries(decision.rows.map(r => [r.candidate.resourceId, r.verdict])) })
        if (!decision.selectedResourceId) break
        spentMinor += await buy(s, round, decision.selectedResourceId, gap)
      }
    }
  } catch (e) { error = e instanceof Error ? e.message : String(e) }
  const final = s.answers.at(-1)!
  const purchases = s.purchases
  const refundedMinor = purchases.filter(p => p.proof === 'REFUNDED').reduce((sum, p) => sum + p.priceMinor, 0)
  return {
    id: q.id, kind: q.kind, ...(q.hardCase ? { hardCase: q.hardCase } : {}), ...(q.useCase ? { useCase: q.useCase } : {}), requested: q.requested.length,
    free: { supported: supportedFacts(first, free, q), citations: citationValidity(first, free), gaps: first.openGaps.map(g => g.text) },
    final: { supported: supportedFacts(final, s.contents, q), citations: citationValidity(final, s.contents), answerVersions: s.answers.length },
    purchases, spentMinor, refundedMinor, wastedMinor: purchases.filter(p => p.wasted).reduce((sum, p) => sum + p.priceMinor, 0), rounds,
    expectedBuy: q.expect.buy, firstBuy: purchases[0]?.resourceId ?? null, firstBuyPriceMinor: purchases[0]?.priceMinor ?? 0, ...(error ? { error } : {}),
    ...(followUp ? { followUp } : {}), ...(stop ? { stop } : {}),
  }
}

/**
 * The calibration sweep (#207): every requested fact judged once as a frozen requirement (gap_material 1) on the
 * initial evidence, which is the question's search plus that fact's own free follow-up search. Nothing is bought, so
 * every fact sees identical, reproducible evidence and the call count is exact. `factOpen` says whether the fact was
 * still unanswered by the free reads (production would decide it); closed facts still label addresses-gap.
 */
export async function sweepQuestion(world: World, q: Question, provider: DecisionProvider, dataset: DatasetRow[]): Promise<{ id: string; facts: { factId: string; candidates: number; paid: number; open: boolean; selected: string | null; error?: string }[] }> {
  const base = await retrieveOffline(world, [q.question])
  const focus = q.answers ? Object.values(q.answers).join(', ') : undefined
  const facts: { factId: string; candidates: number; paid: number; open: boolean; selected: string | null; error?: string }[] = []
  for (const fact of q.requested) {
    const found = await followUpFor(world, q, fact, base.candidates)
    const candidates = [...base.candidates, ...found.added]
    const contents = [...base.contents, ...found.contents]
    const answer = (await writeAnswer({ question: q.question, contents, candidates, version: 1, requirements: q.requested.map(f => f.need), ...(focus ? { focus } : {}) })).answer
    const factOpen = !supportedFacts(answer, contents, q).includes(fact.id)
    const readSources = readSourcesOf(candidates, contents)
    const gap = sanitizeGaps([fact.need], candidates)[0]?.text ?? fact.need
    const paid = candidates.filter(c => c.tier === 'PAID').length
    try {
      const decision = await decide({ question: q.question, conclusion: answer.conclusion, gap, requirement: true, candidates, readSources, budgetMinor: BUDGET.initialMinor, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: BUDGET.capMinor, round: 1, provider })
      dataset.push(...datasetRows(world, q, decision, { fact, factOpen, readSources, mode: 'sweep' }))
      facts.push({ factId: fact.id, candidates: candidates.length, paid, open: factOpen, selected: decision.selectedResourceId ?? null })
    } catch (e) { facts.push({ factId: fact.id, candidates: candidates.length, paid, open: factOpen, selected: null, error: e instanceof Error ? e.message : String(e) }) }
  }
  return { id: q.id, facts }
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
export async function evaluateBank(options: { provider?: DecisionProvider; ids?: string[]; budgetMinor?: number; world?: World; sharedTrust?: boolean; flow?: Flow; paidRelevance?: boolean; dataset?: DatasetRow[] } = {}) {
  const bank = loadBank()
  const world = options.world ?? await loadWorld()
  const provider: DecisionProvider = options.provider ?? new FixtureDecisionProvider()
  const trust = new Map<string, ReputationRecord>()
  const questions = bank.questions.filter(q => !options.ids || options.ids.includes(q.id))
  const results: QuestionResult[] = []
  for (const q of questions) {
    if (!options.sharedTrust) trust.clear()
    results.push(await runQuestion(world, q, provider, trust, { budgetMinor: options.budgetMinor, flow: options.flow, paidRelevance: options.paidRelevance, dataset: options.dataset }))
  }
  return { bankVersion: bank.version, flow: options.flow ?? 'gap', trust: options.sharedTrust ? 'shared across questions' : 'reset per question', labels: { ...WORLD_LABELS, research: 'fixture · extractive-fixture', decision: `${provider.name} · ${provider.model}${provider.promptVersion ? ` · ${provider.promptVersion}` : ''}`, coverage: options.flow === 'requested' ? 'scripted needle check (eval)' : 'n/a' }, summary: summarize(results), results }
}

/** The calibration sweep over the bank: per-fact outcomes plus the dataset rows. */
export async function sweepBank(options: { provider?: DecisionProvider; ids?: string[]; world?: World } = {}) {
  const bank = loadBank()
  const world = options.world ?? await loadWorld()
  const provider: DecisionProvider = options.provider ?? new FixtureDecisionProvider()
  const dataset: DatasetRow[] = []
  const questions = []
  for (const q of bank.questions.filter(q => !options.ids || options.ids.includes(q.id))) questions.push(await sweepQuestion(world, q, provider, dataset))
  return { bankVersion: bank.version, labels: { ...WORLD_LABELS, decision: `${provider.name} · ${provider.model}${provider.promptVersion ? ` · ${provider.promptVersion}` : ''}` }, questions, dataset }
}

/** Requests one decide() round sends for `paid` paid candidates under a requested fact (no gap_material question). */
export function requestsPerRound(provider: DecisionProvider, paid: number): number {
  if (!paid) return 0
  return provider.judgeBatch ? chunkCandidates(paid, decisionsMaxQuestions(), false).length : paid
}
/**
 * `--plan`: run the arm with a counting stub (no network, no cache), and print what the live run will send.
 * Sweep: exact. Flow: the per-round request count is exact per question (paid candidates are fixed after the
 * follow-up search); the number of rounds depends on what the live model buys, so the plan prints min/max.
 */
export async function planProduction(options: { ids?: string[]; sweep: boolean; world?: World }) {
  const world = options.world ?? await loadWorld()
  const stub = countingFetch()
  const provider = productionProvider({ fetch: stub.fetch })
  const usd = (calls: { bytes: number }[]) => calls.reduce((s, c) => s + (Math.ceil(c.bytes / 3) + 100) * rates[provider.arm] / 1e6, 0)
  if (options.sweep) {
    const sweep = await sweepBank({ provider, ids: options.ids, world })
    return { mode: 'sweep', provider: sweep.labels.decision, arm: provider.arm, maxQuestions: provider.judgeBatch ? decisionsMaxQuestions() : null, exactCalls: stub.calls.length, facts: sweep.questions.reduce((s, q) => s + q.facts.length, 0), factsWithoutPaid: sweep.questions.flatMap(q => q.facts).filter(f => !f.paid).length, datasetRows: sweep.dataset.length, questionsPerCall: stub.calls.map(c => c.questions), estimatedUsd: usd(stub.calls) }
  }
  const report = await evaluateBank({ provider, ids: options.ids, world, flow: 'requested', paidRelevance: false })
  const perQuestion = await Promise.all(report.results.map(async r => {
    const q = loadBank().questions.find(x => x.id === r.id)!
    const base = await retrieveOffline(world, [q.question])
    const paid = base.candidates.filter(c => c.tier === 'PAID').length + (r.followUp?.paidFound ?? 0)
    const perRound = requestsPerRound(provider, paid)
    const openAtStart = r.rounds.some(x => x.factId)
    return { id: r.id, paid, perRound, min: openAtStart ? perRound : 0, max: openAtStart ? 3 * perRound : 0 }
  }))
  const average = stub.calls.length ? usd(stub.calls) / stub.calls.length : 0
  const min = perQuestion.reduce((s, q) => s + q.min, 0), max = perQuestion.reduce((s, q) => s + q.max, 0)
  return { mode: 'flow', provider: report.labels.decision, arm: provider.arm, maxQuestions: provider.judgeBatch ? decisionsMaxQuestions() : null, stubRunCalls: stub.calls.length, minCalls: min, maxCalls: max, estimatedUsd: { min: min * average, max: max * average }, perQuestion }
}

function printTable(report: Awaited<ReturnType<typeof evaluateBank>>) {
  const pct = (x: number | null) => x === null ? '–' : `${(x * 100).toFixed(1)}%`
  const rows = [['overall', report.summary.overall] as const, ...Object.entries(report.summary.byKind)]
  console.log(`Decision eval · bank v${report.bankVersion} · flow ${report.flow} · trust ${report.trust} · ${report.labels.decision} · ${report.labels.research} · ${report.labels.search} · ${report.labels.settlement}`)
  console.log('slice            n  facts free→paid     cites free/paid   buys/q  spent  wasted  refunded  F1 vs bank')
  for (const [name, s] of rows) console.log(`${name.padEnd(15)} ${String(s.questions).padStart(2)}  ${pct(s.freeOnly.factRecall).padStart(6)} → ${pct(s.withPurchase.factRecall).padStart(6)}   ${pct(s.freeOnly.citationValidity).padStart(6)}/${pct(s.withPurchase.citationValidity).padEnd(6)}   ${(s.purchasesPerQuestion ?? 0).toFixed(2).padStart(5)}  S$${(s.spentMinor / 100).toFixed(2)}  S$${(s.wastedMinor / 100).toFixed(2)}  S$${(s.refundedMinor / 100).toFixed(2)}    ${s.firstPurchaseVsBank.f1.toFixed(2)}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
  forceFixtureResearch()
  // Raw scores unless asked: a calibration dataset must never be collected through a calibrator.
  if (arg('--calibration') !== 'on') delete process.env.DECISION_CALIBRATION
  else process.env.DECISION_CALIBRATION = 'on'
  const arm = arg('--decision') as Arm | 'fixture' | 'production' | undefined
  const ids = arg('--ids')?.split(',')
  const sweep = process.argv.includes('--sweep')
  const flow = (arg('--flow') ?? (arm === 'production' ? 'requested' : 'gap')) as Flow
  if (!['gap', 'requested'].includes(flow)) throw new Error('--flow is gap or requested')
  if (process.argv.includes('--plan')) {
    if (arm !== 'production') throw new Error('--plan covers --decision production (run.ts and eval/coverage/run.ts have their own --plan).')
    console.log(JSON.stringify(await planProduction({ ids, sweep }), null, 2))
    process.exit(0)
  }
  let provider: DecisionProvider | undefined
  if (arm && arm !== 'fixture') {
    if (!process.argv.includes('--live')) throw new Error('A live decision arm needs --live (and EVAL_LIVE=1).')
    enableLive()
    provider = arm === 'production' ? productionProvider({ phase: sweep ? 'calibration-sweep' : 'eval-decisions' }) : new HarnessDecisionProvider(arm, 'eval-decisions')
  }
  const name = `${arm ?? 'fixture'}${sweep ? '-sweep' : flow === 'requested' ? '-requested' : ''}`
  const datasetFile = arg('--dataset') ?? `${outDir()}/dataset-${name}.jsonl`
  const files: string[] = []
  if (sweep) {
    const result = await sweepBank({ provider, ids })
    files.push(writeJsonl(datasetFile, result.dataset), save(`offline-${name}.json`, { bankVersion: result.bankVersion, labels: result.labels, questions: result.questions }))
    const facts = result.questions.flatMap(q => q.facts)
    console.log(`Calibration sweep · ${result.labels.decision} · ${facts.length} facts · ${facts.filter(f => f.error).length} failed rounds · ${result.dataset.length} rows`)
  } else {
    const dataset: DatasetRow[] = []
    const report = await evaluateBank({ provider, ids, budgetMinor: arg('--budget') ? Number(arg('--budget')) : undefined, sharedTrust: process.argv.includes('--shared-trust'), flow, paidRelevance: arm !== 'production', dataset })
    printTable(report)
    files.push(save(`offline-${name}.json`, report), writeJsonl(datasetFile, dataset))
  }
  assertNoSecrets(files)
  console.log(`Wrote: ${files.join(', ')}`)
}
