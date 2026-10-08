// Decisions bench v2 harness (#212), ported from bench/decisions/run.ts on bench/decisions-vs-clef and
// pointed at the REAL corpus: scenarios come from the question bank (#203) and the in-process search,
// not from the synthetic generator. Every arm is judged by the production policy (decide()), so budget,
// cap, rewrite and trust rules bind whatever the model says.
//
// Offline: `npx tsx eval/decisions/run.ts --arms fixture` and `--plan` (call counts, no calls).
// Live (coordinator only, separate EVAL_* account): add `--live` with EVAL_LIVE=1. Not run in this PR.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CandidateJudgment, PublicCandidate, PublicSourceRef, ReputationSummary } from '../../shared/contracts/index.js'
import { BUDGET } from '../../shared/contracts/index.js'
import { decide, FixtureDecisionProvider, publicCandidate, publicSources, type DecisionProvider } from '../../server/agents/decision.js'
import { clefCandidate } from '../../server/agents/clef.js'
import { writeAnswer } from '../../server/agents/research.js'
import { factHolds, loadBank, type Bank, type Question } from '../questions/bank.js'
import { supportedFacts } from './facts.js'
import { forceFixtureResearch } from './offline.js'
import { call, judgment, prob, type Questions } from './providers/decisions.js'
import { enableLive, forecast, hash, models, outDir, save, type Arm } from './transport.js'
import { variants } from './variants.js'
import { contentOf, loadWorld, retrieveOffline, type World } from './world.js'

export type Scenario = {
  id: string; group: string; split: 'dev' | 'test'; slice: string; question: string; conclusion: string
  /** answer-gap: the free answer's first open gap (production today). requested: the first requested fact the free answer lacks, as frozen need text (#194). */
  gaps: { 'answer-gap': string; requested: string }
  readSources: PublicSourceRef[]; candidates: PublicCandidate[]; budgetMinor: number; perSourceCapMinor: number
  expectedResourceId: string | null
  /** Per candidate: 1 when its body holds a requested fact the free answer lacks (an in-domain addresses-gap label), else 0. */
  labels: Record<string, number>
  reputation?: Record<string, ReputationSummary>
}
export type Arms = Arm | 'fixture'
export const defaults: Record<Arms, number> = { flash: 0.15, clef: 0.35, luna: 0.20, fixture: 0.20 }
export const CONFIGS = ['baseline', 'evidence', 'historical', 'batch', 'batch-evidence'] as const
export type Config = (typeof CONFIGS)[number]
/** Odd ids are dev, even ids are test: every lane and kind lands on both sides. */
export const splitOf = (q: Question): 'dev' | 'test' => Number(q.id.slice(1)) % 2 ? 'dev' : 'test'

export async function buildScenarios(world: World, bank: Bank = loadBank()): Promise<Scenario[]> {
  forceFixtureResearch()
  const out: Scenario[] = []
  for (const q of bank.questions) {
    const { candidates, contents } = await retrieveOffline(world, [q.question])
    const focus = q.answers ? Object.values(q.answers).join(', ') : undefined
    const first = (await writeAnswer({ question: q.question, contents, candidates, version: 1, ...(focus ? { focus } : {}) })).answer
    const have = supportedFacts(first, contents, q)
    const missing = q.requested.filter(f => !have.includes(f.id))
    const paid = candidates.filter(c => c.tier === 'PAID')
    const labels = Object.fromEntries(paid.map(c => {
      const article = world.articles.get(c.resourceId)!
      return [c.resourceId, Number(missing.some(f => f.sources.includes(c.resourceId) && article.passages.some(p => factHolds(f, p.text))))]
    }))
    out.push({
      id: q.id, group: q.lane, split: splitOf(q), slice: q.kind, question: q.question, conclusion: first.conclusion,
      gaps: { 'answer-gap': first.openGaps[0]?.text ?? '', requested: missing[0]?.need ?? '' },
      readSources: publicSources(candidates.filter(c => contents.some(x => x.resourceId === c.resourceId))), candidates: paid,
      budgetMinor: BUDGET.initialMinor, perSourceCapMinor: BUDGET.capMinor, expectedResourceId: missing.length ? q.expect.buy : null, labels,
    })
  }
  return out
}

/** The candidate request state: explicit public fields only. Bodies, prices and wallets never enter. */
export function candidateState(s: Scenario, gap: string, c: PublicCandidate) {
  return { question: s.question, gap, readSources: publicSources(s.readSources), candidate: clefCandidate(publicCandidate(c)) }
}
/** The production policy on injected judgments; a failed round is recorded, never silently bought on. */
export async function select(s: Scenario, arm: Arms, gap: string, gapMaterial: number, judgments: CandidateJudgment[], threshold: number, failed = false) {
  const provider: DecisionProvider = { name: arm === 'fixture' ? 'fixture' : 'cloudflare', model: arm === 'fixture' ? 'metadata-fixture' : models[arm],
    judgeRound: async () => { if (failed) throw new Error('Measured timeout or error'); return { gapMaterial } },
    judgeCandidate: async ({ candidate }) => judgments[s.candidates.findIndex(c => c.resourceId === candidate.resourceId)] }
  try {
    const r = await decide({ question: s.question, conclusion: s.conclusion, gap, candidates: s.candidates, readSources: s.readSources, budgetMinor: s.budgetMinor, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: s.perSourceCapMinor, round: 1, provider, threshold, ...(s.reputation ? { reputation: s.reputation } : {}) })
    return { selected: r.selectedResourceId ?? null, rows: r.rows.map(row => ({ id: row.candidate.resourceId, value: row.value, verdict: row.verdict })), fallback: Boolean(r.fallbackReason), priceMinor: r.rows.find(row => row.candidate.resourceId === r.selectedResourceId)?.candidate.price.amountMinor ?? 0 }
  } catch {
    // After #197 a failed decision fails the round: nothing is bought.
    return { selected: null, rows: [], fallback: true, priceMinor: 0 }
  }
}

export type RunRow = Awaited<ReturnType<typeof evaluate>>
export async function evaluate(world: World, s: Scenario, arm: Arms, config: Config = 'baseline', gapSource: keyof Scenario['gaps'] = 'answer-gap', repeat = 0, phase = 'baseline', withPaid = true) {
  const started = performance.now()
  const gap = s.gaps[gapSource]
  const records: Awaited<ReturnType<typeof call>>['record'][] = []
  let gapMaterial = 0, js: CandidateJudgment[], paid: { resourceId: string; label: number; p: number | null }[] = []
  const labelled = paidProbes(s)
  const content = (c: PublicCandidate) => contentOf(world, world.articles.get(c.resourceId)!)
  if (arm === 'fixture') {
    const p = new FixtureDecisionProvider()
    gapMaterial = (await p.judgeRound({ question: s.question, conclusion: s.conclusion, gap })).gapMaterial
    js = await Promise.all(s.candidates.map(c => p.judgeCandidate({ question: s.question, gap, readSources: s.readSources, candidate: c })))
    if (withPaid) paid = await Promise.all(labelled.map(async c => ({ resourceId: c.resourceId, label: s.labels[c.resourceId], p: (await p.judgePaidRelevance({ question: s.question, gap, content: content(c) })).observed })))
    const selection = await select(s, arm, gap, gapMaterial, js, defaults[arm])
    return { id: s.id, group: s.group, split: s.split, slice: s.slice, arm, config, gapSource, repeat, gap, gapMaterial, judgments: js, paid, calls: [] as string[], decisionElapsedMs: performance.now() - started, networkLowerBoundMs: 0, failed: false, ...selection, expected: s.expectedResourceId, labels: s.labels }
  }
  const questions = (config === 'evidence' || config === 'batch-evidence' ? variants.evidence : config === 'historical' ? variants.historical : variants.baseline) as unknown as { round: Questions; candidate: Questions; paid: Questions }
  const meta = { phase, repeat }
  if (config.startsWith('batch')) {
    const state = { question: s.question, conclusion: s.conclusion, gap, readSources: s.readSources, candidates: s.candidates.map(c => clefCandidate(publicCandidate(c))) }
    const qs: Questions = { ...questions.round }
    // Option order is pinned to the scenario's candidate order (NEXT-STEPS §3: answers shift with order).
    s.candidates.forEach((c, i) => { for (const [k, q] of Object.entries(questions.candidate)) qs[`c${i}_${k}`] = { ...q, instructions: `Evaluate only candidates[${i}] (resourceId ${c.resourceId}). ${q.instructions}` } })
    const r = await call(arm, state, qs, { ...meta, kind: 'batch' })
    records.push(r.record)
    try { gapMaterial = prob(r.answers.gap_material); js = s.candidates.map((_, i) => judgment(r.answers, `c${i}_`)) } catch { js = [] }
  } else {
    const results = await Promise.all([
      call(arm, { question: s.question, conclusion: s.conclusion, gap }, questions.round, { ...meta, kind: 'round' }),
      ...s.candidates.map(c => call(arm, candidateState(s, gap, c), questions.candidate, { ...meta, kind: 'candidate' })),
    ])
    records.push(...results.map(r => r.record))
    try { gapMaterial = prob(results[0].answers.gap_material); js = results.slice(1).map(r => judgment(r.answers)) } catch { js = [] }
  }
  const decisionElapsedMs = performance.now() - started
  // Paid relevance reads the delivered passages: in production only after a verified grant (gate 1); here the corpus is local.
  if (withPaid) paid = await Promise.all(labelled.map(async c => {
    const r = await call(arm, { question: s.question, gap, passages: content(c).spans.map(x => x.text) }, questions.paid, { ...meta, kind: 'paid' })
    records.push(r.record)
    let p: number | null = null
    try { p = prob(r.answers.addresses_gap) } catch { /* A missing prediction stays null. */ }
    return { resourceId: c.resourceId, label: s.labels[c.resourceId], p }
  }))
  const decisionRecords = records.filter(r => r.kind !== 'paid')
  const failed = js.length !== s.candidates.length || decisionRecords.some(r => r.error || r.timeout3s)
  const selection = await select(s, arm, gap, gapMaterial, js, defaults[arm], failed)
  return { id: s.id, group: s.group, split: s.split, slice: s.slice, arm, config, gapSource, repeat, gap, gapMaterial, judgments: js, paid, calls: records.map(r => r.key), decisionElapsedMs, networkLowerBoundMs: Math.max(0, ...decisionRecords.map(r => r.latencyMs)), failed, ...selection, expected: s.expectedResourceId, labels: s.labels }
}

/** Paid-relevance probes: every positive candidate plus the first negative one, so the calibration data has both classes. */
export const paidProbes = (s: Scenario) => { const neg = s.candidates.find(c => !s.labels[c.resourceId]); return s.candidates.filter(c => s.labels[c.resourceId] === 1 || c === neg) }
/** Calls one evaluate() makes for an arm: per-candidate 1 + N (+ paid probes), batch 1 (+ paid probes). */
export const plannedCalls = (s: Scenario, config: Config, withPaid = true) => (config.startsWith('batch') ? 1 : 1 + s.candidates.length) + (withPaid ? paidProbes(s).length : 0)

export const testLock = (scenarios: Scenario[]) => hash(scenarios.filter(s => s.split === 'test').map(s => ({ id: s.id, question: s.question, gaps: s.gaps, candidates: s.candidates.map(c => c.resourceId), expected: s.expectedResourceId })))
export async function runBatch(world: World, phase: string, config: Config, gapSource: keyof Scenario['gaps'], scenarios: Scenario[], repeat: number, arm: Arms, withPaid = true) {
  const file = path.join(outDir(), 'runs', `${phase}-${config}-${gapSource}-${arm}-${repeat}.jsonl`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const done = new Set(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => (JSON.parse(l) as { id: string }).id) : [])
  for (const s of scenarios) {
    if (done.has(s.id)) continue
    fs.appendFileSync(file, JSON.stringify(await evaluate(world, s, arm, config, gapSource, repeat, phase, withPaid)) + '\n')
  }
  return file
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1] }
  const arms = arg('--arms', 'fixture').split(',') as Arms[]
  const configs = arg('--configs', 'baseline').split(',') as Config[]
  const gapSource = arg('--gap', 'answer-gap') as keyof Scenario['gaps']
  const split = arg('--split', 'dev') as 'dev' | 'test' | 'all'
  const repeats = Number(arg('--repeats', '1'))
  const phase = arg('--phase', split === 'test' ? 'final' : 'baseline')
  const world = await loadWorld()
  const scenarios = (await buildScenarios(world)).filter(s => split === 'all' || s.split === split)
  // The test split is locked before any tuning; a changed bank or corpus changes the lock.
  const lockFile = path.join(outDir(), 'test-lock.txt'), lock = testLock(await buildScenarios(world))
  if (process.argv.includes('--lock')) { fs.mkdirSync(outDir(), { recursive: true }); fs.writeFileSync(lockFile, lock + '\n') }
  else if (split !== 'dev' && fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8').trim() !== lock) throw new Error('Test lock mismatch: the bank or corpus changed since the lock')
  const live = arms.filter(a => a !== 'fixture') as Arm[]
  const calls = Object.fromEntries(live.map(a => [a, configs.reduce((n, c) => n + repeats * scenarios.reduce((m, s) => m + plannedCalls(s, c), 0), 0)]))
  forecast(`${phase}-${split}`, calls)
  save(`scenarios-${split}.json`, scenarios.map(s => ({ ...s, candidates: s.candidates.map(c => c.resourceId) })))
  if (process.argv.includes('--plan')) process.exit(0)
  if (live.length) { if (!process.argv.includes('--live')) throw new Error('Live arms need --live (and EVAL_LIVE=1); use --plan to count calls.'); enableLive() }
  for (let repeat = 0; repeat < repeats; repeat++) for (const config of configs) for (const arm of arms) console.log(await runBatch(world, phase, config, gapSource, scenarios, repeat, arm))
}
