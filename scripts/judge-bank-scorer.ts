import { citationIdentity } from '../shared/source-identity.js'
import type { Citation, DecisionRound } from '../shared/contracts/index.js'

export interface LeadSentence { text: string; citations: readonly Citation[] }
const normalise = (text: string) => text.toLowerCase().replace(/\s+/gu, ' ').trim()
/** Pure scoring of the displayed lead, never the conclusion or unrelated claims.
 * accessibleCitations must identify delivered free or verified-granted spans. */
export function answersFromAccessible(gold: string | undefined, lead: readonly LeadSentence[], accessibleCitations: readonly Citation[]): 0 | 1 {
  if (!gold || !normalise(gold)) return 0
  const first = lead.flatMap(item => Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(item.text.replace(/\s+/gu, ' ').trim()), part => ({ text: part.segment, citations: item.citations }))).slice(0, 2)
  const purchased = (a: Citation, b: Citation) => citationIdentity(a) === citationIdentity(b)
  return normalise(first.map(s => s.text).join(' ')).includes(normalise(gold)) && first.some(s => s.citations.some(c => accessibleCitations.some(p => purchased(c, p)))) ? 1 : 0
}

/** The original paid-only scorer keeps its verified-purchase contract. */
export function answersIt(gold: string | undefined, lead: readonly LeadSentence[], purchasedCitations: readonly Citation[]): 0 | 1 {
  return answersFromAccessible(gold, lead, purchasedCitations)
}

export function decisionValues(questionId: string, negative: boolean, decisions: readonly DecisionRound[]) {
  return decisions.flatMap(round => round.rows.map((row, index) => ({
    questionId, group: negative ? 'negative' : 'relevant', round: round.round, candidateIndex: index,
    writer: row.candidate.writerSlug ?? row.candidate.publisher, article: row.candidate.resourceId,
    source: row.candidate.source, version: row.candidate.version, relevance: row.candidate.relevance ?? null,
    provider: round.provider, model: round.model, threshold: round.threshold, gapMaterial: round.gapMaterial,
    judgment: row.judgment, trust: row.reputation?.T ?? 1, calibrated: row.calibrated ?? null,
    marginalValue: row.marginalValue ?? null, value: row.value, valuePerDollar: row.valuePerDollar,
    verdict: row.verdict, reason: row.reason,
  })))
}
export type ValueRow = ReturnType<typeof decisionValues>[number]
/** Question-bank groups, not post-hoc relevance labels; all rounds, including repeats. */
export function valueHistograms(rows: readonly ValueRow[]) {
  const edges = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1]
  return Object.fromEntries(['relevant', 'negative'].map(group => {
    const values = rows.filter(row => row.group === group).map(row => row.value)
    return [group, { count: values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
      bins: edges.slice(0, -1).map((lower, i) => ({ lower, upper: edges[i + 1], upperInclusive: i === edges.length - 2,
        count: values.filter(v => v >= lower && (i === edges.length - 2 ? v <= edges[i + 1] : v < edges[i + 1])).length })) }]
  }))
}
