// Extractive answer ranking only. This never declares coverage, grants access or spends.
import { searchText } from '../../publisher/search-text.js'
import { contentWords, noNewEvidence } from './requirements.js'
// Process/node identifiers and other mixed letter/digit keys carry more scope
// than generic words such as "wafer". Keep them even when shorter than 4 chars.
const words = (text: string) => new Set([...contentWords(text), ...(text.match(/\b(?:[A-Z]{2,}|[A-Z][a-z]*[A-Z][A-Za-z]*|[a-zA-Z]*\d+[a-zA-Z][a-zA-Z0-9]*|[a-zA-Z]+\d+[a-zA-Z0-9]*)\b/g) ?? []).map(w => w.toLowerCase())])
/** Rare overlapping words disambiguate e.g. a board vote from market pricing.
 * Tokenize each accessible passage once; no bank labels or premium metadata.
 */
export function requestedPassageScores(requirement: string, passages: string[]): number[] {
  const need = words(requirement), own = passages.map(words)
  const scopes = [...need].filter(w => /[a-z].*\d|\d.*[a-z]/i.test(w))
  const terms = [...contentWords(requirement)]
  const phrases = terms.slice(1).map((w, i) => `${terms[i]} ${w}`)
  const weights = new Map([...need].map(w => [w, Math.log(1 + passages.length / (1 + own.filter(p => p.has(w)).length))]))
  const namedType = /\b(?:transaction|field|flag|header|scheme|protocol|setting|permission|type|identifier|credential)s?\b/i.test(requirement)
  return passages.map((p, i) => !namedType && !/\b\d+(?:[.,]\d+)?\b/.test(p) || /\bundisclosed\b/i.test(p) || noNewEvidence.test(p) || scopes.some(w => !own[i].has(w)) ? 0
    : [...need].filter(w => own[i].has(w)).reduce((score, w) => score + weights.get(w)!, 0)
      + 0.25 * phrases.filter(phrase => searchText(p).toLowerCase().includes(phrase)).length)
}
