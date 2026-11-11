import { questionTerms } from './answer-summary.js'
import type { Answer, Gap } from './contracts/index.js'
import { actionGroups, identifierFamily, identifiersIn, memberOf, subjectFamilies } from './relevance.js'
import { answerBoilerplate, sentences } from './lead-finding.js'
import { answerNames, askedKind } from './answer-entity.js'

/** Words that frame a gap ("Identify the…", "Explain whether… needs", "the … amount") but name no fact. A quantity word is
 * answered by the figure the QUANTITY rule requires, not by repeating the word. */
const FRAME = new Set('identify explain describe state name list confirm determine whether specific exact detail details information evidence source sources need needs required requires require must one amount amounts number numbers figure figures value values total level'.split(' '))
/** QUAL: live planners also frame facts as "the difference between…", "what mechanism or control…", "the role of…",
 * "including…", "each one". Not in strict mode. */
const PLANNER_FRAME = new Set([...FRAME, ...'difference differences differ between compare comparison versus mechanism mechanisms control controls role roles including include includes criteria process way ways each any many'.split(' ')])
/** A gap that asks for a quantity is answered only by a lead sentence that carries a figure. */
const QUANTITY = /\b(?:how (?:much|many|long)|amounts?|numbers?|figures?|fees?|costs?|prices?|reserves?|rates?|percent(?:age)?|drops)\b/i
/** "Which transaction(s) / field / flag / type" is answered by the identifier the lead names, not by the word. */
const KIND = new Set(['transaction', 'transactions', 'type', 'types', 'field', 'fields', 'flag', 'flags'])
const IDENTIFIER = /\b[A-Za-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/
const stem = (word: string) => word.length > 4 ? word.replace(/(?:ies|es|s|ed|ing)$/, '') : word
/** Forms of one word the light stem cannot fold (paid, payment → pay; bought, spend → buy), as shared/relevance.ts folds them. */
const FOLD = new Map([...['pay', 'pays', 'paid', 'paying', 'payment', 'payments'].map(w => [w, 'pay'] as const), ...['buy', 'buys', 'bought', 'buying', 'spend', 'spends', 'spent', 'spending'].map(w => [w, 'buy'] as const)])
const folded = (word: string) => FOLD.get(word) ?? stem(word)
/** "XRP Ledger" is XRPL; with `split`, CamelCase names count whole and by their words (EscrowFinish → escrowfinish, escrow, finish). */
const termsOf = (text: string, split: boolean) => questionTerms(`${text} ${split ? text.replace(/([a-z0-9])([A-Z])/g, '$1 $2') : ''}`.replace(/\bXRP Ledger\b/gi, split ? 'XRPL' : '$&'))

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const CALENDAR_DATE = new RegExp(`\\b(20\\d{2})-(\\d{2})-(\\d{2})\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\s+(20\\d{2})\\b|\\b(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'gi')
/** Compare explicit calendar dates across ISO, day-month and month-day wording, without treating the year alone as a date. */
const explicitDates = (text: string) => [...text.matchAll(CALENDAR_DATE)].map(m =>
  m[1] ? `${m[1]}-${Number(m[2])}-${Number(m[3])}` : m[4] ? `${m[6]}-${MONTHS.indexOf(m[5].slice(0, 3).toLowerCase()) + 1}-${Number(m[4])}` : `${m[9]}-${MONTHS.indexOf(m[7].slice(0, 3).toLowerCase()) + 1}-${Number(m[8])}`)

/** Necessary semantic checks before word overlap can establish a requested fact. These only reject unsupported facts. */
const supportChecks = new Map<string, boolean>()
export function factSupportBoundary(fact: string, passage: string): boolean {
  const key = JSON.stringify([fact, passage])
  if (supportChecks.has(key)) return supportChecks.get(key)!
  const check = () => {
    // A source's unrelated figure or access date cannot establish a requested date.
    if ((fact.match(/\b20\d{2}\b/g) ?? []).some(year => !passage.includes(year))) return false
    const dates = explicitDates(fact)
    if (dates.length) {
      const observed = new Set(explicitDates(passage))
      if (dates.some(date => !observed.has(date))) return false
    }
    // A request for how a fee is set, or who votes on it, asks for a mechanism or actor, not its numeric amount.
    const explanatory = (/^(?:how\b(?!\s+(?:much|many|long))|who\b)/i.test(fact) || /\b(?:mechanism|method|policy)\b/i.test(fact)) && !/\b(?:amounts?|numbers?|figures?)\b/i.test(fact)
    if (QUANTITY.test(fact) && !explanatory && !/\b\d[\d,.]*\s*(?:%|(?:XRP|drops?|days?|hours?|minutes?|seconds?|weeks?|months?|years?|SGD|USD|bp|tickets?|objects?)\b)/i.test(passage)) return false
    const kind = askedKind(fact)
    const groups = kind === 'transaction' ? actionGroups(fact) : []
    if (groups.length) {
      const families = subjectFamilies(fact)
      const names = sentences(passage).filter(text => !answerBoilerplate(text)).flatMap(identifiersIn)
        .filter(id => !families.length || families.some(family => identifierFamily(id) === family[0]))
      const members = new Set(names.map(memberOf))
      if (!groups.every(group => group.some(member => members.has(member)))) return false
    }
    if (/\b(?:who|submitters?|eligible accounts?|which accounts?)\b/i.test(fact) && /\bsubmit\w*\b/i.test(fact)) {
      const eligibility = sentences(passage).filter(text => /\b(?:anyone|any account|(?:the )?(?:owner|sender|buyer|writer|destination|subject|issuer))\b[^.!?]{0,90}\b(?:may|can|must|allowed to)\s+submit\b|\bsubmitted by\s+(?:any|the|an?)\b/i.test(text))
      if (!eligibility.length || answerNames('transaction', fact, '').some(name => !eligibility.some(text => new RegExp(`\\b${name}\\b`).test(text)))) return false
    }
    if (/\bsubmit\w*\b/i.test(fact) && answerNames('transaction', fact, '').some(name => !new RegExp(`\\b${name}\\b`).test(passage))) return false
    if (/\bvot(?:e|es|ing)\b/i.test(fact) && !sentences(passage).some(text => !answerBoilerplate(text) && /\bvot(?:e|es|ing)\b/i.test(text) && !/\b(?:neither|no|not|without)\b[^.!?]{0,80}\bvot/i.test(text))) return false
    if (/\bcredentials?\b/i.test(fact) && /\bcontains?\b/i.test(fact)
      && ![/\bissuer\b/i, /\bsubject\b/i, /\b(?:type|CredentialType)\b/i].every(pattern => pattern.test(passage))) return false
    // A status observation made on a date is not an activation date.
    if (/\b(?:activation date|when\b[^.!?]{0,60}\b(?:activated|enabled|launched))\b/i.test(fact)
      && !sentences(passage).some(text => /\b(?:activated|activation|enabled|launched)\b[^.!?]{0,45}\b(?:on|since)\b[^.!?]{0,30}\b20\d{2}\b/i.test(text) && !/\b(?:not|never)\b/i.test(text) && !answerBoilerplate(text))) return false
    if (/\bcredentials?\b/i.test(fact) && /\b(?:prove\w*|attest\w*|means?|meaning)\b/i.test(fact)
      && !sentences(passage).some(text => /\bcredentials?\b[^.!?]{0,70}\b(?:attests?|records?|represents?)\b|\bissuer'?s?\s+(?:attestation|assertion)\b/i.test(text)
        && !/\b(?:not|never|no|without)\b[^.!?]{0,70}\b(?:attest\w*|records?|represents?|assertion)\b/i.test(text))) return false
    if (kind && ['flag', 'header', 'standard', 'code', 'field'].includes(kind) && !answerNames(kind, passage, '').length) return false
    return true
  }
  const result = check()
  if (key.length <= 16_384) { if (supportChecks.size >= 256) supportChecks.delete(supportChecks.keys().next().value!); supportChecks.set(key, result) }
  return result
}

/** Word-form reconciliation for a single fact, after its semantic checks. No title or other requirement supplies evidence. */
export function leadSupportsFact(question: string, factText: string, leadText: string): boolean {
  if (!factSupportBoundary(factText, leadText)) return false
  const own = new Set(termsOf(leadText, true).map(folded))
  const asked = new Set(questionTerms(question).map(folded))
  const named = IDENTIFIER.test(leadText)
  const fact = [...new Set(questionTerms(factText.replace(/\bXRP Ledger\b/gi, 'XRPL')).filter(word => !PLANNER_FRAME.has(word) && !(named && KIND.has(word))).map(folded))]
  if (!fact.length) return false
  const matched = fact.filter(word => own.has(word)).length
  const inQuestion = fact.filter(word => asked.has(word)).length
  const restates = inQuestion / fact.length >= 0.8 && inQuestion / Math.max(1, asked.size) >= 0.6
  return restates || matched === fact.length || fact.length >= 5 && matched >= 3 && matched / fact.length >= 0.5
}

/**
 * H9-10: "Still unanswered" never lists what the answer's lead already answers. Open gaps are recomputed against the lead
 * (the exact cited sentences the answer shows first):
 * - a gap that restates the question is closed when a lead answers the question;
 * - a gap whose fact words all occur in the lead is closed;
 * - QUAL: a long requested fact (five or more fact words, as live planners write them: "What mechanism or control stops
 *   the agent from reading the article and then refusing to pay") is closed when the lead names at least half of its
 *   fact words, and at least three. Word forms fold (paid, payment → pay), CamelCase names count by their words
 *   (CredentialCreate names "create"), and "which transaction" is answered by the identifier the lead names.
 * `strict` keeps the R9-B rules exactly (the first two only, no folding): an answer without requested facts buys for its
 * first open gap (the legacy path), so the answer writer uses strict there, and only the display and a planned run's
 * requested facts use the rest.
 * A gap that asks for a quantity stays open unless the lead carries a figure. Everything else stays open: a gap is
 * closed only by text the visitor can read first, never by a guess.
 */
export function openGapsAfterLead(question: string, answer: Pick<Answer, 'lead' | 'openGaps'>, options: { strict?: boolean } = {}): Gap[] {
  const lead = answer.lead ?? []
  if (!lead.length || !answer.openGaps.length) return answer.openGaps
  const loose = !options.strict
  const term = loose ? folded : stem
  const frame = loose ? PLANNER_FRAME : FRAME
  const leadText = lead.map(item => item.text).join(' ')
  const own = new Set(termsOf(leadText, loose).map(term))
  const asked = new Set(questionTerms(question).map(term))
  const named = loose && IDENTIFIER.test(leadText)
  return answer.openGaps.filter(gap => {
    if (loose && !factSupportBoundary(gap.text, leadText)) return true
    if (QUANTITY.test(gap.text) && !/\d/.test(leadText)) return true
    const fact = [...new Set(questionTerms(loose ? gap.text.replace(/\bXRP Ledger\b/gi, 'XRPL') : gap.text).filter(word => !frame.has(word) && !(named && KIND.has(word))).map(term))]
    if (!fact.length) return true
    const inQuestion = fact.filter(word => asked.has(word)).length
    const restates = inQuestion / fact.length >= 0.8 && inQuestion / Math.max(1, asked.size) >= 0.6
    const matched = fact.filter(word => own.has(word)).length
    const long = loose && fact.length >= 5 && matched >= 3 && matched / fact.length >= 0.5
    return !(restates || matched === fact.length || long)
  })
}
