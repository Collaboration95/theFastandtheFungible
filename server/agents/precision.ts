import { sameSource } from '../../shared/source-identity.js'
import { questionTerms } from '../../shared/answer-summary.js'
import { expandProtocolQuery, isCamelCaseName, protocolAliases, topicWords } from '../../shared/relevance.js'
import type { ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'

/** Rare title/facet matches distinguish a named entity from a shared topic. */
export function entityPrecision(question: string, candidate: PublicCandidate, pool: PublicCandidate[]): number {
  const names = (question.match(/\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z]{2,}[A-Z0-9]*|[a-z]+_[a-z_]+|[a-z]+\d+[a-z]*|[A-Z][a-z]+)\b/g) ?? []).filter(t => questionTerms(question).includes(t.toLowerCase()))
  // Multi-entity narrative comparisons keep value ordering; a title mentioning
  // more locations does not make it a better answer to a trend question.
  const narrative = names.filter(t => /^[A-Z][a-z]+$/.test(t))
  if (narrative.length > 0 && names.length > 1 && !/\b(?:transaction|field|flag|type|header)s?\b/i.test(question)) return 0
  const own = new Set(questionTerms(`${candidate.title} ${candidate.facets.join(' ')}`))
  const answerType = question.match(/\b(transaction|field|flag|header|scheme|permission|setting|reserve)s?\b/i)?.[1]
  const titleType = answerType && new RegExp(`\\b${answerType}s?\\b`, 'i').test(candidate.title) ? 2 : 0
  // R8-A3: "which transactions …" asks for named transactions as much as "which transaction …" does; the singular-only
  // pattern gave the generic escrow explainer the lead over the EscrowFinish reference for a plural question.
  const namedTransaction = /\b(?:which|what).*\btransactions?\b/i.test(question) && candidate.facets.some(f => /\btransactions?\b/i.test(f)) && /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/.test(candidate.title) ? 3 : 0
  const generic = new Set(['xrpl','xrp','ledger','payment','transaction','account','token','asset','field','type'])
  // R8-A2: the question's own words and the glossary's vocabulary for them count; a word that only a sibling
  // transaction name adds (create, finish, cancel from EscrowCreate/EscrowFinish/EscrowCancel for an escrow question;
  // delete from CredentialDelete) does not. Otherwise the generic reference whose topics list every sibling outranks
  // the article naming what was asked: the escrow explainer beat the TokenEscrow amendment article for "Which XRPL
  // amendment and issuer flag does token escrow need?", and CredentialDelete beat CredentialAccept for "Which
  // transaction must the subject of a Credential submit to accept it?".
  const asked = new Set([...topicWords(question), ...protocolAliases(question).filter(p => !isCamelCaseName(p)).flatMap(topicWords)])
  const subjects = topicWords(expandProtocolQuery(question)).filter(t => !generic.has(t) && asked.has(t))
  const metadata = (c: PublicCandidate) => new Set(topicWords(`${c.title} ${c.facets.join(' ')}`))
  const ownTopics = metadata(candidate)
  const subjectPrecision = /\b(?:XRPL|XRP|x402|RLUSD|escrow\w*|credentials?|trustset|DID|AMM|FATF)\b/i.test(question) ? subjects.filter(t => ownTopics.has(t)).reduce((sum,t) => sum + 1 / Math.max(1, pool.filter(c => metadata(c).has(t)).length), 0) : 0
  return namedTransaction + subjectPrecision + titleType + names.map(t => t.toLowerCase()).filter(t => own.has(t)).reduce((sum, t) => {
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
