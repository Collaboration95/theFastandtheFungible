import { questionTerms } from './answer-summary.js'
import type { Answer, Gap } from './contracts/index.js'

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
