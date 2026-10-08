// Answer scoring against the question bank's requested facts (#203). A fact counts as supported only
// when a claim cites a passage of one of the fact's source articles and that cited passage holds every
// needle: a trap passage with the same figures (wrong entity, date or forecast) never counts.
import type { Answer, ContentEnvelope } from '../../shared/contracts/index.js'
import { factHolds, type Question } from '../questions/bank.js'

const span = (contents: ContentEnvelope[], ref: Answer['claims'][number]['citations'][number]) => {
  const content = contents.find(c => c.resourceId === ref.resourceId && c.version === ref.version)
  const s = content?.spans.find(item => item.id === ref.spanId)
  return content && s && content.body.includes(s.text) ? s.text : undefined
}
/** Requested-fact ids the answer supports with a valid citation to a source article. */
export function supportedFacts(answer: Answer | undefined, contents: ContentEnvelope[], question: Question): string[] {
  if (!answer) return []
  return question.requested.filter(fact => fact.needles.length && answer.claims.some(claim => claim.citations.some(ref => fact.sources.includes(ref.resourceId) && factHolds(fact, span(contents, ref) ?? '')))).map(f => f.id)
}
/** Citations that resolve to an exact span of accessible content (gate 4), over all citations. */
export function citationValidity(answer: Answer | undefined, contents: ContentEnvelope[]): { valid: number; total: number } {
  const refs = answer?.claims.flatMap(c => c.citations) ?? []
  return { valid: refs.filter(ref => span(contents, ref) !== undefined).length, total: refs.length }
}
/** Claim-text variant for stored runs, where the export never loads delivered bodies: needles in a claim citing a source. */
export function supportedByClaimText(answer: Answer | undefined, question: Question): string[] {
  if (!answer) return []
  return question.requested.filter(fact => fact.needles.length && answer.claims.some(claim => claim.citations.some(ref => fact.sources.includes(ref.resourceId)) && factHolds(fact, claim.text))).map(f => f.id)
}
/** The bank question a stored run asked: same question text and, when the bank lists them, the same clarify answers. */
export function matchQuestion(questions: Question[], text: string, answers?: Record<string, unknown>): Question | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const same = questions.filter(q => norm(q.question) === norm(text))
  return same.find(q => q.answers && answers && Object.entries(q.answers).every(([k, v]) => answers[k] === v)) ?? same.find(q => !q.answers) ?? (same.length === 1 ? same[0] : undefined)
}
