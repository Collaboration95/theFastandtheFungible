import { questionTerms } from './answer-summary.js'
import type { Answer, Gap } from './contracts/index.js'

/** Words that frame a gap ("Identify the…", "Explain whether… needs", "the … amount") but name no fact. A quantity word is
 * answered by the figure the QUANTITY rule requires, not by repeating the word. */
const FRAME = new Set('identify explain describe state name list confirm determine whether specific exact detail details information evidence source sources need needs required requires require must one amount amounts number numbers figure figures value values total level'.split(' '))
/** A gap that asks for a quantity is answered only by a lead sentence that carries a figure. */
const QUANTITY = /\b(?:how (?:much|many|long)|amounts?|numbers?|figures?|fees?|costs?|prices?|reserves?|rates?|percent(?:age)?|drops)\b/i
const stem = (word: string) => word.length > 4 ? word.replace(/(?:ies|es|s|ed|ing)$/, '') : word

/**
 * H9-10: "Still unanswered" never lists what the answer's lead already answers. Open gaps are recomputed against the lead
 * (the exact cited sentences the answer shows first):
 * - a gap that restates the question is closed when a lead answers the question;
 * - a gap whose fact words all occur in the lead is closed.
 * A gap that asks for a quantity stays open unless the lead carries a figure. Everything else stays open: a gap is
 * closed only by text the visitor can read first, never by a guess.
 */
export function openGapsAfterLead(question: string, answer: Pick<Answer, 'lead' | 'openGaps'>): Gap[] {
  const lead = answer.lead ?? []
  if (!lead.length || !answer.openGaps.length) return answer.openGaps
  const leadText = lead.map(item => item.text).join(' ')
  const own = new Set(questionTerms(leadText).map(stem))
  const asked = new Set(questionTerms(question).map(stem))
  return answer.openGaps.filter(gap => {
    if (QUANTITY.test(gap.text) && !/\d/.test(leadText)) return true
    const terms = [...new Set(questionTerms(gap.text).filter(term => !FRAME.has(term)).map(stem))]
    if (!terms.length) return true
    const inQuestion = terms.filter(term => asked.has(term)).length
    const restates = inQuestion / terms.length >= 0.8 && inQuestion / Math.max(1, asked.size) >= 0.6
    return !(restates || terms.every(term => own.has(term)))
  })
}
