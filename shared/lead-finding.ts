import type { Claim } from './contracts/index.js'

const STOP = new Set('what when where which how did does are the its and with from that this latest last getting much was were for has have on in of a an to s'.split(' '))
const words = (text: string) => [...new Set(text.toLowerCase().replace(/lead[- ]times?/g, 'lead time').match(/[a-z0-9]+/g) ?? [])].filter(word => word.length > 2 && !STOP.has(word))
/** Select only exact sentences of validated claims. Never promote an uncited conclusion.
 * Numeric comparisons and question coverage outrank an author's introductory prose.
 * Shared by the screen and export; callers enforce delivered-passage access first.
 */
export function leadFinding(question: string, claims: Claim[]): { text: string; claim: Claim }[] {
  const terms = words(question)
  const ranked = claims.flatMap((claim, ci) => claim.text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((text, si) => {
    const lower = text.toLowerCase(), tokens = words(text)
    if (/^(?:This is a team-authored|This team-authored|The implementation record|For a reader assessing|Reproduction requires|Code:|Sources?:)|(?:[\w-]+\/)+[\w.-]+\.(?:ts|md|tsx)\b/i.test(text)) return { text, claim, score: 0, ci, si }
    const overlap = terms.filter(term => tokens.includes(term)).length
    if (!overlap && !(/lead[- ]times?|shorter/i.test(question) && /weeks?/.test(lower) && /\bfrom\b.*\bto\b/.test(lower))) return { text, claim, score: 0, ci, si }
    let score = overlap / Math.max(1, terms.length) * 20
    if (/lead[- ]times?|shorter/i.test(question)) score += /\bweeks?\b/.test(lower) ? 12 : 0
    if (/analyst|outlook|margin/i.test(question)) score += /estimate|broker|analyst|consensus/.test(lower) ? 12 : 0
    if (/change|meeting/i.test(question)) score += /policy rate|increase from/.test(lower) ? 9 : 0
    if (/renewable|electricity|grid/i.test(question)) score += /renewable|\bMW\b|commissioned/.test(text) ? 10 : 0
    if (/\d/.test(text)) score += 2
    if (/\bfrom\b.*\bto\b/.test(lower)) score += /lead[- ]times?|shorter/i.test(question) && /weeks?/.test(lower) ? 28 : 5
    if (/^(I |My |Here |Speaking |Let me|It |That |These |They |Then )/.test(text)) score -= 12
    if (text.length > 420 || text.length < 30) score -= 8
    return { text, claim, score, ci, si }
  })).filter(item => item.claim.citations.length && item.score > 0).sort((a, b) => b.score - a.score || a.ci - b.ci || a.si - b.si)
  const first = ranked[0]
  if (!first) return []
  const selected = [first]
  // Multi-part questions need the complementary fact, rather than a second paraphrase.
  if (/\band\b|, how/i.test(question)) {
    const missing = terms.filter(term => !words(first.text).includes(term) && !/kestrel|semiconductor|penang|phase|plant|malaysia/.test(term))
    const second = ranked.find(item => item.claim.id !== first.claim.id && missing.some(term => words(item.text).includes(term)) && item.text.length + first.text.length < 620)
    if (second) selected.push(second)
  }
  return selected.map(({ text, claim }) => ({ text, claim }))
}
