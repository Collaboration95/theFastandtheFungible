import { scoreStep } from '../telemetry.js'
import { startActiveObservation } from '@langfuse/tracing'
import { z } from 'zod'
import { CandidateJudgmentSchema, DecisionRoundSchema, PublicCandidateSchema } from '../../shared/contracts/index.js'
import type { CandidateJudgment, ContentEnvelope, CoverageStatus, DecisionProviderName, DecisionRound, PublicCandidate, PublicSourceRef, Requirement, ReputationSummary } from '../../shared/contracts/index.js'
import { fixtureCoverage, type CoverageEvidence } from './requirements.js'
import { NEWCOMER } from '../reputation.js'
import { compareTieBreak } from './tie-break.js'
import { activeCalibrator, calibrate, roundCalibration } from './calibration.js'

/** Every live call takes the round's abort signal (#206): when one call fails the round, its siblings stop. */
type Signal = { signal?: AbortSignal }
export interface DecisionProvider {
  name: DecisionProviderName
  model: string
  /** The question wording and option order this provider sends, recorded on each round (#214). */
  promptVersion?: string
  judgeRound(input: { question: string; conclusion: string; gap: string } & Signal): Promise<{ gapMaterial: number }>
  judgeCandidate(input: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate } & Signal): Promise<CandidateJudgment>
  /**
   * One request for the whole round (#214, "batch-evidence"): the gap question plus three questions per candidate.
   * Judgments come back in `candidates` order. When present, decideRound uses it instead of the per-call path.
   */
  judgeBatch?(input: { question: string; conclusion: string; gap: string; readSources: PublicSourceRef[]; candidates: PublicCandidate[]; skipGapMaterial?: boolean } & Signal): Promise<{ gapMaterial?: number; judgments: CandidateJudgment[] }>
  /** Calibration (#141): does a granted paid body address the gap? Called only after a verified grant (gate 1). */
  judgePaidRelevance?(input: { question: string; gap: string; content: ContentEnvelope } & Signal): Promise<{ observed: number }>
  /**
   * Requested-fact coverage (#208, #213): one multi-question request per evidence state, one choice question per
   * requirement over free or verified-granted passages only (gate 1). A missing or malformed entry is `unknown`.
   */
  judgeCoverage?(input: CoverageInput & Signal): Promise<Record<string, CoverageStatus>>
}
export type CoverageInput = { question: string; requirements: Pick<Requirement, 'id' | 'text'>[]; evidence: CoverageEvidence[] }
const SourceRefSchema = PublicCandidateSchema.pick({ resourceId: true, version: true, title: true, publisher: true, family: true, facets: true })
// W3-LIVE: both matched tables selected the grid report; retain flash for latency.
// Flash grid value reached 0.1743 while the live supplier maximum was 0.0508.
// Use 0.15 for flash; fixture stays 0.20 and larger Clef stays 0.35.
export const CLEF_DECISION_MODEL = '@cf/cloudflare/clef-flash'
export const OPENAI_DECISION_MODEL = 'gpt-6-luna'
/**
 * The model for a live provider. `DECISION_MODEL` applies only when it names that provider's kind of model
 * (`@cf/…` for Cloudflare), so `DECISION_PROVIDER=cloudflare` alone is the one-line revert (#214).
 */
export function decisionModel(provider: 'cloudflare' | 'openai' = 'cloudflare', configured: string | undefined = process.env.DECISION_MODEL): string {
  const cloudflareModel = Boolean(configured?.startsWith('@cf/'))
  if (provider === 'openai') return configured && !cloudflareModel ? configured : OPENAI_DECISION_MODEL
  return configured && cloudflareModel ? configured : CLEF_DECISION_MODEL
}
export const publicCandidate = (input: unknown): PublicCandidate => PublicCandidateSchema.parse(input)
export const publicSources = (input: unknown): PublicSourceRef[] => z.array(SourceRefSchema).parse(input)
// Words that say nothing about which evidence a gap needs.
const STOP = new Set(['accessible', 'evidence', 'source', 'sources', 'about', 'their', 'there', 'which', 'what', 'with', 'from', 'that', 'this', 'whether', 'still', 'missing', 'figures', 'dated', 'data'])
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3 && !STOP.has(word)) ?? [])
/** Share of the gap a candidate's public fields address: two matching content words count as fully addressed. */
export const textOverlap = (gap: string, text: string) => {
  const own = words(text)
  return Math.min(1, [...words(gap)].filter(word => own.has(word)).length / 2)
}
export const gapOverlap = (gap: string, candidate: PublicCandidate) => textOverlap(gap, `${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`)
/**
 * The question's named entities: capitalised words after the first, and acronyms ("Kestrel", "Semiconductor",
 * "Malaysia", "TSMC"). Possessives split off ("Semiconductor's" → "semiconductor").
 */
export const questionEntities = (question: string) => {
  const tokens = question.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? []
  return new Set(tokens.filter((token, index) => (index > 0 && /^[A-Z]/.test(token)) || /^[A-Z0-9]{2,}$/.test(token)).map(token => token.toLowerCase()))
}
/**
 * Share of the question's named entities a candidate's public fields name: two matches (or all, when fewer) count as
 * fully on-entity; a question with no named entity scores 1. A generic post that shares only the gap's words scores 0.
 */
export const entityOverlap = (question: string, candidate: PublicCandidate) => {
  const entities = questionEntities(question)
  if (!entities.size) return 1
  const own = new Set(`${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [])
  return Math.min(1, [...entities].filter(entity => own.has(entity)).length / Math.min(2, entities.size))
}

/**
 * Generic metadata heuristics, with no named-source or hidden corpus knowledge.
 * addressesGap = word/tag overlap with the gap × (0.5 + 0.5 × named-entity overlap with the question) × the hit's
 * claimed relevance (a promise that calibration later checks); originality from family/derivedFrom; credibility
 * from the publisher kind (carried as `authority`). Price never enters.
 */
export class FixtureDecisionProvider implements DecisionProvider {
  readonly name = 'fixture' as const
  readonly model = 'metadata-fixture'
  /** Calibration fixture: word overlap between the gap and the granted body. */
  async judgePaidRelevance({ gap, content }: { question: string; gap: string; content: ContentEnvelope }) {
    return { observed: gap.trim() ? textOverlap(gap, content.spans.map(s => s.text).join(' ')) : 0 }
  }
  async judgeRound({ gap }: { question: string; conclusion: string; gap: string }) {
    return { gapMaterial: gap.trim() ? 0.9 : 0 }
  }
  /** Coverage fixture: the story-bible cue rules, else entity or word overlap with a figure (requirements.ts). */
  async judgeCoverage({ requirements, evidence }: CoverageInput) {
    return fixtureCoverage(requirements, evidence)
  }
  async judgeCandidate({ question, gap, readSources, candidate: raw }: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate }): Promise<CandidateJudgment> {
    const candidate = publicCandidate(raw)
    const sources = publicSources(readSources)
    const rewrite = Boolean(candidate.derivedFrom)
    const repeated = sources.some(source => source.family === candidate.family)
    return {
      // On the gap's words AND the question's entities: UC3 round 2 prefers the Kestrel/Penang deep-dive over a generic lead-times post.
      addressesGap: gap.trim() ? Math.max(0.05, gapOverlap(gap, candidate)) * (0.5 + 0.5 * entityOverlap(question, candidate)) * (candidate.relevance ?? 1) : 0,
      originality: rewrite ? { original: 0.02, rewrite: 0.96, overlap: 0.02 } : repeated ? { original: 0.05, rewrite: 0.05, overlap: 0.9 } : { original: 0.9, rewrite: 0.03, overlap: 0.07 },
      credibility: candidate.authority,
    }
  }
}
export type DecideInput = {
  question: string; conclusion: string; gap: string
  candidates: PublicCandidate[]; readSources: PublicSourceRef[]
  budgetMinor: number; spentMinor: number; reservedMinor: number; perSourceCapMinor: number
  round: number; provider?: DecisionProvider; threshold?: number; boughtResourceIds?: string[]
  /** Trust by publisher wallet (D6, D21). When given, value × T and quarantined/delisted sellers get SKIP_LOW_TRUST; a wallet with no entry is a newcomer. */
  reputation?: Record<string, ReputationSummary>
  /** Abandons the round from outside (e.g. Stop); the round's own controller also aborts siblings on the first failure (#206). */
  signal?: AbortSignal
  /**
   * The gap is a frozen requested fact (#208): derived from the question and clarify answers before any evidence, so
   * it is part of what the question asks by construction. gapMaterial is 1 and the model is not asked (the live
   * gap_material score swung 0.06–0.94 on on-question gaps and dropped right articles under the threshold).
   */
  requirement?: boolean
}
/** Raw-score buy thresholds per model. gpt-6-luna runs raw at 0.20 with no calibrator (#214): never the benchmark's calibrated 0.05. */
export function buyThreshold(model: string, configured: unknown = process.env.BUY_THRESHOLD): number {
  const value = configured === undefined || configured === '' ? (model.endsWith('/clef') ? 0.35 : model.endsWith('/clef-flash') ? 0.15 : 0.20) : Number(configured)
  return z.number().min(0).max(1).parse(value)
}
/**
 * A live decision provider failed (timeout, HTTP error, daily quota, refusal, invalid answer). Decision 2 (8 Oct, #197):
 * the round fails and nothing is bought; the word-overlap fixture is never substituted for a live provider.
 */
export class DecisionUnavailableError extends Error {
  constructor(readonly status: string) { super(`Decision model unavailable (${status})`) }
}
/** A short, secret-free status: the provider's status when it gave one, otherwise the failure class. */
export function decisionFailureStatus(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status === 'string' && /^[\w .-]{1,40}$/.test(status)) return status
  return error instanceof z.ZodError ? 'invalid response' : 'provider error'
}
/** The SKIP_NO_GAP reason when the gap is empty: policy decides without asking any model (#214). */
export const NO_GAP_NOT_CALLED = 'no open gap — decision model not called'
/** Placeholder judgment for rows the model never saw (empty gap): every probability 0, so value is 0. */
const NOT_JUDGED: CandidateJudgment = { addressesGap: 0, originality: { original: 0, rewrite: 0, overlap: 0 }, credibility: 0 }
const GapMaterialSchema = z.object({ gapMaterial: z.number().min(0).max(1) })
/** Traced as a chain: the provider's generations nest inside; the output is the full verdict table. */
export function decide(input: DecideInput): Promise<DecisionRound> {
  return startActiveObservation('decide-purchase', async observation => {
    observation.update({ input: { round: input.round, gap: input.gap, remainingMinor: input.budgetMinor - input.spentMinor - input.reservedMinor, capMinor: input.perSourceCapMinor } })
    const live = Boolean(input.provider && input.provider.name !== 'fixture' && input.gap.trim())
    let round: DecisionRound
    try { round = await decideRound(input) } catch (error) {
      if (error instanceof DecisionUnavailableError) {
        scoreStep('decision-unavailable', true, error.status)
        // The refusal rate (#214): a refusal fails the round like any other failure, and is counted on its own.
        if (live) scoreStep('decision-refusal', error.status === 'refusal')
        observation.update({ level: 'ERROR', statusMessage: error.message })
      }
      throw error
    }
    if (input.provider) scoreStep('decision-unavailable', false)
    if (live) scoreStep('decision-refusal', false)
    scoreStep('gap-material', round.gapMaterial, round.gap)
    observation.update({ output: { provider: round.provider, model: round.model, promptVersion: round.promptVersion ?? null, gapMaterial: round.gapMaterial, threshold: round.threshold, selected: round.selectedResourceId ?? null, calibration: round.calibration ?? null, rows: round.rows.map(r => ({ resourceId: r.candidate.resourceId, priceMinor: r.candidate.price.amountMinor, addressesGap: r.judgment.addressesGap, original: r.judgment.originality.original, ...(r.calibrated ? { calibratedAddressesGap: r.calibrated.addressesGap, calibratedOriginal: r.calibrated.original } : {}), credibility: r.judgment.credibility, value: r.value, verdict: r.verdict })) } })
    return round
  }, { asType: 'chain' })
}
/**
 * The model's view of the round. Batch providers get one request; the rest one round call plus one call per candidate,
 * in parallel. Every answer is validated, and any failure fails the round (#197). One AbortController per round (#206):
 * the first failure, or the caller abandoning the round, aborts every sibling still in flight.
 */
async function judgeAll(provider: DecisionProvider, input: DecideInput, candidates: PublicCandidate[], readSources: PublicSourceRef[]): Promise<{ gapMaterial: number; judgments: CandidateJudgment[] }> {
  const controller = new AbortController()
  const abandon = () => controller.abort()
  if (input.signal?.aborted) abandon()
  input.signal?.addEventListener('abort', abandon, { once: true })
  const { signal } = controller
  const failRound = (error: unknown): never => { controller.abort(); throw error }
  try {
    const fixed = input.requirement ? { gapMaterial: 1 } : undefined
    // Nothing left to ask: a requested fact with no paid candidate makes no model call.
    if (fixed && !candidates.length) return { gapMaterial: 1, judgments: [] }
    if (provider.judgeBatch) {
      const result = await provider.judgeBatch({ question: input.question, conclusion: input.conclusion, gap: input.gap, readSources, candidates, signal, ...(fixed ? { skipGapMaterial: true } : {}) })
      return { gapMaterial: fixed?.gapMaterial ?? GapMaterialSchema.parse(result).gapMaterial, judgments: z.array(CandidateJudgmentSchema).length(candidates.length).parse(result.judgments) }
    }
    const [{ gapMaterial }, judgments] = await Promise.all([
      fixed ? Promise.resolve(fixed) : provider.judgeRound({ question: input.question, conclusion: input.conclusion, gap: input.gap, signal }).then(result => GapMaterialSchema.parse(result)).catch(failRound),
      Promise.all(candidates.map(candidate => provider.judgeCandidate({ question: input.question, gap: input.gap, readSources, candidate, signal }).then(result => CandidateJudgmentSchema.parse(result)).catch(failRound))),
    ])
    return { gapMaterial, judgments }
  } catch (error) {
    controller.abort()
    throw new DecisionUnavailableError(input.signal?.aborted ? 'abandoned' : decisionFailureStatus(error))
  } finally { input.signal?.removeEventListener('abort', abandon) }
}
async function decideRound(input: DecideInput): Promise<DecisionRound> {
  // Zod strips every unknown property, including body, spans, and injected commands.
  const candidates = z.array(PublicCandidateSchema).parse(input.candidates).filter(candidate => candidate.tier === 'PAID')
  const readSources = publicSources(input.readSources)
  const remaining = z.number().int().nonnegative().parse(input.budgetMinor) - z.number().int().nonnegative().parse(input.spentMinor) - z.number().int().nonnegative().parse(input.reservedMinor)
  const cap = z.number().int().nonnegative().parse(input.perSourceCapMinor)
  const provider: DecisionProvider = input.provider ?? new FixtureDecisionProvider()
  // An empty gap makes no model call for any provider (#214): nothing is worth buying, and Luna refused or scored it 0.87.
  const open = input.gap.trim().length > 0
  const { gapMaterial, judgments } = open ? await judgeAll(provider, input, candidates, readSources) : { gapMaterial: 0, judgments: candidates.map(() => NOT_JUDGED) }
  // #207: a versioned calibrator for this exact (provider, model, prompt version), only with DECISION_CALIBRATION=on.
  // Its threshold is on the calibrated scale; an explicit threshold still wins, and BUY_THRESHOLD (raw scale) never applies to it.
  const calibrator = open ? activeCalibrator(provider) : undefined
  const threshold = calibrator && input.threshold === undefined ? calibrator.buyThreshold : buyThreshold(provider.model, input.threshold)
  const acquired = new Set([...readSources.map(source => source.resourceId), ...(input.boughtResourceIds ?? [])])
  const rows = candidates.map((candidate, index) => {
    const judgment = judgments[index]
    // Trust can only lower value (T ∈ [0, 1]); it never touches the budget or the cap.
    const reputation = input.reputation && candidate.wallet ? input.reputation[candidate.wallet] ?? NEWCOMER : undefined
    const trust = reputation ? Math.min(1, Math.max(0, reputation.T)) : 1
    const calibrated = calibrator ? calibrate(calibrator, judgment) : undefined
    const value = gapMaterial * (calibrated?.addressesGap ?? judgment.addressesGap) * (calibrated?.original ?? judgment.originality.original) * (0.5 + 0.25 * judgment.credibility) * trust
    const price = candidate.price.amountMinor
    // A zero-price PAID resource ranks by value, avoiding Infinity in JSON.
    const valuePerDollar = value / (Math.max(price, 1) / 100)
    // With no model call, a rewrite is known from its public metadata only (derivedFrom, set by retrieval for a shared family).
    // Always the RAW originality (#207): a calibrator that lifts P(original) can never let a rewrite through.
    const rewrite = open ? judgment.originality.rewrite >= judgment.originality.original : Boolean(candidate.derivedFrom)
    let verdict: DecisionRound['rows'][number]['verdict'] = 'BUY'
    let reason = 'Clears the value threshold and spending policy.'
    // A rewrite is labelled as one even when no gap is open (story bible UC1).
    if (reputation && reputation.status !== 'active') { verdict = 'SKIP_LOW_TRUST'; reason = `Publisher ${reputation.status}: never bought or cited.` }
    else if (acquired.has(candidate.resourceId) || (candidate.derivedFrom && acquired.has(candidate.derivedFrom)) || rewrite) { verdict = 'SKIP_REWRITE'; reason = 'Already acquired or a rewrite of existing evidence.' }
    else if (!open) { verdict = 'SKIP_NO_GAP'; reason = NO_GAP_NOT_CALLED }
    else if (gapMaterial === 0) { verdict = 'SKIP_NO_GAP'; reason = 'No material open gap.' }
    else if (price > cap) { verdict = 'SKIP_OVER_CAP'; reason = 'Price exceeds the per-source cap.' }
    else if (value < threshold) { verdict = 'SKIP_LOW_VALUE'; reason = 'Value is below the model threshold.' }
    else if (price > remaining || input.budgetMinor === 0) { verdict = 'SKIP_OVER_BUDGET'; reason = input.budgetMinor === 0 ? 'Would buy with a sufficient budget; S$0 authorizes no purchase.' : 'Price exceeds the remaining budget.' }
    return { candidate, judgment, value, valuePerDollar, verdict, reason, wouldBuy: verdict === 'BUY' || (input.budgetMinor === 0 && verdict === 'SKIP_OVER_BUDGET'), ...(reputation ? { reputation } : {}), ...(calibrated ? { calibrated } : {}) }
  })
  // Equal value per dollar: a neutral hash order (#204), never alphabetical and never the claimed relevance.
  const selected = rows.filter(row => row.verdict === 'BUY').sort((a, b) => b.valuePerDollar - a.valuePerDollar || compareTieBreak(input.question, { id: a.candidate.resourceId, version: a.candidate.version }, { id: b.candidate.resourceId, version: b.candidate.version }))[0]
  return DecisionRoundSchema.parse({ round: input.round, gap: input.gap, gapMaterial, ...(open ? { gapMaterialSource: input.requirement ? 'requirement' : 'model' } : {}), provider: provider.name, model: provider.model, ...(provider.promptVersion ? { promptVersion: provider.promptVersion } : {}), ...(calibrator ? { calibration: roundCalibration(calibrator) } : {}), threshold, rows, ...(selected ? { selectedResourceId: selected.candidate.resourceId } : {}) })
}
