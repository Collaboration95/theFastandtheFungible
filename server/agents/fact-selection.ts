// Extractive answer ranking only. This never declares coverage, grants access or spends.
import { contentWords, noNewEvidence } from './requirements.js'
// Process/node identifiers and other mixed letter/digit keys carry more scope
// than generic words such as "wafer". Keep them even when shorter than 4 chars.
const words = (text: string) => new Set([...contentWords(text), ...(text.toLowerCase().match(/\b[a-z0-9]+\b/g) ?? []).filter(w => /[a-z]/.test(w) && /\d/.test(w) || ['boj', 'hbm', 'qfn', 'bga', 'fed', 'jgb'].includes(w))])
/** Rare overlapping words disambiguate e.g. a board vote from market pricing.
 * Tokenize each accessible passage once; no bank labels or premium metadata.
 */
export function requestedPassageScores(requirement: string, passages: string[]): number[] {
  const need = words(requirement), own = passages.map(words)
  const weights = new Map([...need].map(w => [w, Math.log(1 + passages.length / (1 + own.filter(p => p.has(w)).length))]))
  return passages.map((p, i) => !/\b\d+(?:[.,]\d+)?\b/.test(p) || noNewEvidence.test(p) ? 0
    : [...need].filter(w => own[i].has(w)).reduce((score, w) => score + weights.get(w)!, 0))
}
