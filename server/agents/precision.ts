import { sameSource } from '../../shared/source-identity.js'
import { questionTerms } from '../../shared/answer-summary.js'
import type { ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'

/** Rare title/facet matches distinguish a named entity from a shared topic. */
export function entityPrecision(question: string, candidate: PublicCandidate, pool: PublicCandidate[]): number {
  const names = (question.match(/\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z]{2,}[A-Z0-9]*|[a-z]+_[a-z_]+|[a-z]+\d+[a-z]*|[A-Z][a-z]+)\b/g) ?? []).filter(t => questionTerms(question).includes(t.toLowerCase()))
  // Multi-entity narrative comparisons keep value ordering; a title mentioning
  // more locations does not make it a better answer to a trend question.
  const narrative = names.filter(t => /^[A-Z][a-z]+$/.test(t))
  if (narrative.length > 0 && names.length > 1 && !/\b(?:transaction|field|flag|type|header)\b/i.test(question)) return 0
  const own = new Set(questionTerms(`${candidate.title} ${candidate.facets.join(' ')}`))
  return names.map(t => t.toLowerCase()).filter(t => own.has(t)).reduce((sum, t) => {
    const frequency = pool.filter(c => questionTerms(`${c.title} ${c.facets.join(' ')}`).includes(t)).length
    return sum + (frequency <= pool.length / 2 ? 1 / Math.max(1, frequency) : 0)
  }, 0)
}

/** Probe eligibility uses public facets, never an abstract alone or model instructions. */
export function probeMetadata(question: string, candidate: PublicCandidate, top?: PublicCandidate): boolean {
  const need = questionTerms(question)
  const facets = new Set(questionTerms(candidate.facets.join(' ')))
  const entities = question.match(/\b(?:[A-Z]{2,}[A-Z0-9]*|[A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z][a-z]+s?|[a-z]+\d+[a-z]*|[a-z]+_[a-z_]+)\b/g)?.map(t => t.toLowerCase()).filter(t => need.includes(t)) ?? []
  return !!top && sameSource(candidate, top) && candidate.profileId === top.profileId && !!candidate.wallet && (candidate.relevance ?? 0) >= 0.40 && candidate.price.amountMinor <= 30
    && entities.some(t => facets.has(t))
}

/** Conservative duplicate guard: all substantive gap terms must occur in a single
 * delivered sentence, which must state a fact (number or technical identifier).
 * This only prevents additional spending; it never declares an answer correct. */
export function alreadyCovered(gap: string, evidence: ContentEnvelope[]): boolean {
  const need = questionTerms(gap).filter(t => !['no', 'accessible', 'evidence', 'missing', 'about', 'still', 'unanswered'].includes(t))
  return need.length > 0 && evidence.some(c => c.spans.some(s => c.body.includes(s.text) && s.text.split(/(?<=[.!?])\s+/).some(sentence => {
    const own = new Set(questionTerms(sentence))
    return need.every(t => own.has(t)) && /\d|[a-z][A-Z]/.test(sentence)
      && !/\b(?:unknown|not confirmed|does not|no evidence|unconfirmed)\b/i.test(sentence)
  })))
}
