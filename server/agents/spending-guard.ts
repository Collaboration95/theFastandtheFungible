import { topicWords } from '../../shared/relevance.js'

/**
 * Hard gate 2 for planner output (D9, H8-04). A live plan, its requested facts and its clarify questions may describe
 * payments the user asked about ("can my agent pay it with XRP?", "before a buyer can use it"), but they may never
 * instruct a purchase, a payment or a transfer, and never touch spending authority (the budget). Policy code alone
 * buys; this guard only throws the plan away, so a false positive costs a live plan, never money.
 *
 * Until 11 Nov the guard rejected any plan containing buy, pay, price, purchase or budget, which discarded every live
 * plan for a question that used one of those words (6 of 6 in round 8) and blamed an outage. Now it looks for
 * instructions, not topic words, and a phrase made only of the user's own words is their topic, not an instruction.
 */
const DETERMINER = String.raw`(?:the|this|that|these|those|its|their|your|my|our|an?|all|any|every|each|one|two|three|more|another|additional|extra|remaining|rest\s+of\s+the|\d+)`
const DIRECTIVES: RegExp[] = [
  // An imperative purchase or transfer with an object: "buy the NotFT article", "spend the remaining balance".
  new RegExp(String.raw`\b(?:buy|purchase|pay\s+for|spend|unlock|acquire|order|send|transfer|tip)\s+(?:${DETERMINER}\s+)+(?:[\w$-]+\s+){0,3}?(?:articles?|reports?|posts?|sources?|pieces?|items?|stor(?:y|ies)|evidence|content|premium|paywalled|deep[- ]dives?|budget|balance|funds?|money|XRP|RLUSD|drops|tokens?)\b`, 'gi'),
  // Urgency: "buy … now", "pay … immediately", "spend … without approval".
  /\b(?:buy|purchase|pay|spend|send|transfer|unlock)\b[^.;\n]{0,40}?\b(?:now|immediately|right away|asap|at once|without (?:asking|approval|confirmation))\b/gi,
  // Spending authority: "raise the budget", "ignore the spending limit", "use the remaining budget".
  new RegExp(String.raw`\b(?:increase|raise|lift|double|triple|top\s*up|extend|expand|remove|ignore|override|exceed|bypass|skip|disable|waive|use|spend|allocate|reallocate)\s+(?:(?:the|my|your|our|any|all|its|their|this|that|remaining|whole|entire|full|more)\s+)*(?:budget|spending\s+(?:limit|cap|policy|rules?)|per[- ]source\s+cap|approvals?|allowance)\b`, 'gi'),
  // The budget itself and its currency: a planner never brings them up unless the user did.
  /\bbudget\w*/gi,
  /S\$/g,
  /\b(?:send|transfer)\s+(?:now|for|to|\d)/gi,
]
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()
/** The user's own words: the phrase occurs in their text, or every content word of it does. */
function userWords(phrase: string, own: string, ownWords: Set<string>): boolean {
  if (normalize(own).includes(normalize(phrase))) return true
  const words = topicWords(phrase)
  return words.length > 0 && words.every(word => ownWords.has(word))
}
/**
 * The first purchase instruction or spending-authority phrase in `text` that is not made of the user's own words
 * (`own`: the question plus any clarify answers), or undefined. The text is planner output and is never trusted.
 */
export function spendingInstruction(text: string, own = ''): string | undefined {
  const ownWords = new Set(topicWords(own))
  for (const pattern of DIRECTIVES) {
    for (const match of text.matchAll(pattern)) if (!userWords(match[0], own, ownWords)) return match[0]
  }
  return undefined
}
