import { scoreStep } from '../telemetry.js'
import { startActiveObservation } from '@langfuse/tracing'
import { z } from 'zod'
import { CandidateJudgmentSchema, DecisionRoundSchema, PublicCandidateSchema, FacetSchema } from '../../shared/contracts/index.js'
import type { CandidateJudgment, DecisionRound, PublicCandidate, PublicSourceRef } from '../../shared/contracts/index.js'

export interface DecisionProvider {
  name: 'cloudflare' | 'fixture'
  model: string
  judgeRound(input: { question: string; conclusion: string; gap: string }): Promise<{ gapMaterial: number }>
  judgeCandidate(input: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate }): Promise<CandidateJudgment>
}
const SourceRefSchema = PublicCandidateSchema.pick({ resourceId: true, version: true, title: true, publisher: true, family: true, facets: true })
// W3-LIVE: both matched tables selected the grid report; retain flash for latency.
// Flash grid value reached 0.1743 while the live supplier maximum was 0.0508.
// Use 0.15 for flash; fixture stays 0.20 and larger Clef stays 0.35.
export const decisionModel = () => process.env.DECISION_MODEL || '@cf/cloudflare/clef-flash'
export const publicCandidate = (input: unknown): PublicCandidate => PublicCandidateSchema.parse(input)
export const publicSources = (input: unknown): PublicSourceRef[] => z.array(SourceRefSchema).parse(input)
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3) ?? [])
const overlap = (a: string, b: string) => [...words(a)].filter(word => words(b).has(word)).length
const facetFor = (gap: string) => FacetSchema.options.find(facet => overlap(gap, facet.replaceAll('-', ' ')) > 0)

/** Generic metadata heuristics, with no named-source or hidden corpus knowledge. */
export class FixtureDecisionProvider implements DecisionProvider {
  readonly name = 'fixture' as const
  readonly model = 'metadata-fixture'
  constructor(private readonly gapFacet?: string) {}
  async judgeRound({ gap }: { question: string; conclusion: string; gap: string }) {
    return { gapMaterial: gap.trim() ? 0.9 : 0 }
  }
  async judgeCandidate({ gap, readSources, candidate: raw }: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate }): Promise<CandidateJudgment> {
    const candidate = publicCandidate(raw)
    const sources = publicSources(readSources)
    const rewrite = Boolean(candidate.derivedFrom) || /\b(rewrite|summari[sz]es?|syndicat\w*)\b/i.test(candidate.preview)
    const repeated = sources.some(source => source.family === candidate.family)
    const facet = FacetSchema.safeParse(this.gapFacet).data ?? facetFor(gap)
    const relevant = facet ? candidate.facets.includes(facet) : overlap(gap, candidate.preview) >= 2
    return {
      addressesGap: gap.trim() ? (relevant ? 0.9 : 0.08) : 0,
      originality: rewrite ? { original: 0.02, rewrite: 0.96, overlap: 0.02 } : repeated ? { original: 0.05, rewrite: 0.05, overlap: 0.9 } : { original: 0.9, rewrite: 0.03, overlap: 0.07 },
      credibility: candidate.authority,
    }
  }
}
export type DecideInput = {
  question: string; conclusion: string; gap: string; gapFacet?: string
  candidates: PublicCandidate[]; readSources: PublicSourceRef[]
  budgetMinor: number; spentMinor: number; reservedMinor: number; perSourceCapMinor: number
  round: number; provider?: DecisionProvider; threshold?: number; boughtResourceIds?: string[]
}
export function buyThreshold(model: string, configured: unknown = process.env.BUY_THRESHOLD): number {
  const value = configured === undefined || configured === '' ? (model.endsWith('/clef') ? 0.35 : model.endsWith('/clef-flash') ? 0.15 : 0.20) : Number(configured)
  return z.number().min(0).max(1).parse(value)
}
/** Traced as a chain: Clef generations nest inside; the output is the full verdict table. */
export function decide(input: DecideInput): Promise<DecisionRound> {
  return startActiveObservation('decide-purchase', async observation => {
    observation.update({ input: { round: input.round, gap: input.gap, remainingMinor: input.budgetMinor - input.spentMinor - input.reservedMinor, capMinor: input.perSourceCapMinor } })
    const round = await decideRound(input)
    if (input.provider) scoreStep('decision-fallback', Boolean(round.fallbackReason), round.fallbackReason)
    scoreStep('gap-material', round.gapMaterial, round.gap)
    observation.update({ output: { provider: round.provider, model: round.model, gapMaterial: round.gapMaterial, threshold: round.threshold, selected: round.selectedResourceId ?? null, rows: round.rows.map(r => ({ resourceId: r.candidate.resourceId, priceMinor: r.candidate.price.amountMinor, addressesGap: r.judgment.addressesGap, original: r.judgment.originality.original, credibility: r.judgment.credibility, value: r.value, verdict: r.verdict })) }, ...(round.fallbackReason ? { level: 'WARNING' as const, statusMessage: round.fallbackReason } : {}) })
    return round
  }, { asType: 'chain' })
}
async function decideRound(input: DecideInput): Promise<DecisionRound> {
  // Zod strips every unknown property, including body, spans, and injected commands.
  const candidates = z.array(PublicCandidateSchema).parse(input.candidates).filter(candidate => candidate.tier === 'PAID')
  const readSources = publicSources(input.readSources)
  const remaining = z.number().int().nonnegative().parse(input.budgetMinor) - z.number().int().nonnegative().parse(input.spentMinor) - z.number().int().nonnegative().parse(input.reservedMinor)
  const cap = z.number().int().nonnegative().parse(input.perSourceCapMinor)
  let provider = input.provider ?? new FixtureDecisionProvider(input.gapFacet)
  let fallbackReason: string | undefined
  const evaluate = (provider: DecisionProvider) => Promise.all([
    provider.judgeRound({ question: input.question, conclusion: input.conclusion, gap: input.gap }).then(result => z.object({ gapMaterial: z.number().min(0).max(1) }).parse(result)),
    Promise.all(candidates.map(candidate => provider.judgeCandidate({ question: input.question, gap: input.gap, readSources, candidate }).then(result => CandidateJudgmentSchema.parse(result)))),
  ])
  let results: Awaited<ReturnType<typeof evaluate>>
  try { results = await evaluate(provider) } catch {
    provider = new FixtureDecisionProvider(input.gapFacet)
    fallbackReason = 'Decision provider unavailable or invalid; fixture metadata substituted.'
    results = await evaluate(provider)
  }
  const [{ gapMaterial }, judgments] = results
  const threshold = buyThreshold(provider.model, input.threshold)
  const acquired = new Set([...readSources.map(source => source.resourceId), ...(input.boughtResourceIds ?? [])])
  const rows = candidates.map((candidate, index) => {
    const judgment = judgments[index]
    const value = gapMaterial * judgment.addressesGap * judgment.originality.original * (0.5 + 0.25 * judgment.credibility)
    const price = candidate.price.amountMinor
    // A zero-price PAID resource ranks by value, avoiding Infinity in JSON.
    const valuePerDollar = value / (Math.max(price, 1) / 100)
    let verdict: DecisionRound['rows'][number]['verdict'] = 'BUY'
    let reason = 'Clears the value threshold and spending policy.'
    if (!input.gap.trim() || gapMaterial === 0) { verdict = 'SKIP_NO_GAP'; reason = 'No material open gap.' }
    else if (acquired.has(candidate.resourceId) || (candidate.derivedFrom && acquired.has(candidate.derivedFrom)) || judgment.originality.rewrite >= judgment.originality.original) { verdict = 'SKIP_REWRITE'; reason = 'Already acquired or a rewrite of existing evidence.' }
    else if (price > cap) { verdict = 'SKIP_OVER_CAP'; reason = 'Price exceeds the per-source cap.' }
    else if (value < threshold) { verdict = 'SKIP_LOW_VALUE'; reason = 'Value is below the model threshold.' }
    else if (price > remaining || input.budgetMinor === 0) { verdict = 'SKIP_OVER_BUDGET'; reason = input.budgetMinor === 0 ? 'Would buy with a sufficient budget; S$0 authorizes no purchase.' : 'Price exceeds the remaining budget.' }
    return { candidate, judgment, value, valuePerDollar, verdict, reason, wouldBuy: verdict === 'BUY' || (input.budgetMinor === 0 && verdict === 'SKIP_OVER_BUDGET') }
  })
  const selected = rows.filter(row => row.verdict === 'BUY').sort((a, b) => b.valuePerDollar - a.valuePerDollar || a.candidate.resourceId.localeCompare(b.candidate.resourceId))[0]
  return DecisionRoundSchema.parse({ round: input.round, gap: input.gap, gapMaterial, provider: provider.name, model: provider.model, threshold, rows, ...(selected ? { selectedResourceId: selected.candidate.resourceId } : {}), ...(fallbackReason ? { fallbackReason } : {}) })
}
