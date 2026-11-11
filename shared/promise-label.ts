// What a writer's signed promise says, in words a reader can follow. Browser-safe: no node imports.
import type { FactCover } from './contracts/manifest.js'
import { displayPeriod } from './fact-menu.js'

/** Plain words for the kind of fact a claim names (never its value). Legacy v1 manifests carry only this. */
const KIND_WORDS: Record<string, string> = {
  'dated-figure': 'Gives a dated figure', 'named-source': 'Names its source', 'numeric-series': 'Gives a series of numbers',
}

/**
 * The row label for one promised claim. A signed fact menu is a pair of catalogue words ("client" + "requirements"), and what the
 * check really does is look for those words in the delivered passage, so that is what the label says: "Mentions client and
 * requirements". The bare pair ("client requirements") is never shown on its own: it reads like a tag, not a promise.
 */
export function promiseLabel(claim: { id: string; kind?: string; covers?: FactCover }): string {
  const covers = claim.covers
  if (!covers) return (claim.kind && KIND_WORDS[claim.kind]) || 'Keeps a promised detail'
  const words = [...new Set([covers.entity, covers.measure, covers.comparison].filter((word): word is string => Boolean(word)))]
  const list = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]
  return `Mentions ${list}${covers.period ? ` in ${displayPeriod(covers.period)}` : ''}`
}
