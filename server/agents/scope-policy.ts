// A conservative contradiction veto on public scope, independent of model confidence.
// Missing or unsigned menus are unknown. Shared broad subject matter is not a match.
import type { PublicCandidate } from '../../shared/contracts/index.js'
import { signedFactMenu } from './clef.js'
import { mentionsMenuPhrase } from '../../shared/fact-menu.js'
const countries = [
  ['Singapore', 'Singaporean'], ['Vietnam', 'Vietnamese'], ['Thailand', 'Thai'],
  ['Malaysia', 'Malaysian'], ['Japan', 'Japanese'], ['China', 'Chinese'],
  ['India', 'Indian'], ['Taiwan', 'Taiwanese'], ['Indonesia', 'Indonesian'],
]
export function scopeContradiction(requirement: string, candidate: PublicCandidate): boolean {
  const menu = signedFactMenu(candidate)
  if (!menu.length) return false
  const mentioned = (text: string) => countries.flatMap((aliases, i) => aliases.some(a => mentionsMenuPhrase(text, a)) ? [i] : [])
  const requested = mentioned(requirement)
  if (!requested.length) return false
  // Scope is established by the title and signed entities. Abstracts often mention
  // unrelated countries as background; they cannot rescue a contradictory title.
  const publicScope = `${candidate.title} ${menu.map(f => f.entity).join(' ')}`
  const offered = mentioned(publicScope)
  return offered.length > 0 && !requested.some(country => offered.includes(country))
}
