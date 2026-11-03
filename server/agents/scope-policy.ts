// A conservative contradiction veto on public scope, independent of model confidence.
// Missing or unsigned menus are unknown. Shared broad subject matter is not a match.
import type { PublicCandidate } from '../../shared/contracts/index.js'
import { signedFactMenu, verifiedMenuManifest } from './clef.js'
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

// Recognised fact keys only. The menu is a publisher promise, not evidence of truth.
// Unknown keys/unsigned menus retain the existing model estimate. A known key
// needs a compatible entry; broad topic proximity cannot stand in for its scope.
const factKeys = [
  // Wafer economics must at least promise semiconductor scope. Coarse menus
  // may select margin/prepayment rather than price; do not call that absence
  // a contradiction when the title or signed entity establishes the domain.
  { need: /\bwafer\b.*\b(?:prices?|pricing|costs?|quote)\b|\b(?:prices?|pricing|costs?|quote)\b.*\bwafer\b/i, offer: /\bwafers?\b|\bfoundr(?:y|ies)\b|\bTSMC\b|\bKestrel\b|\bsemiconductors?\b/i },
  { need: /\bcapex\b|capital (?:expenditure|spending)/i, offer: /\bcapex\b|investment|\bcost(?:s|ing)?\b|capital (?:expenditure|spending)/i },
  { need: /\bcapacity\b/i, offer: /\bcapacity\b/i },
  { need: /\blead[- ]times?\b/i, offer: /\blead[- ]times?\b|\ballocation\b/i },
  { need: /\bissuance\b/i, offer: /\bissuance\b|\bbonds?\b/i },
]
const subjects = ['CoWoS', 'HBM', 'QFN', 'BGA', 'Kestrel', 'TSMC']
export function factMenuMismatch(requirement: string, candidate: PublicCandidate): boolean {
  if (!verifiedMenuManifest(candidate)) return false
  const menu = signedFactMenu(candidate)
  const key = factKeys.find(k => k.need.test(requirement))
  if (!key) return false
  const named = subjects.filter(s => mentionsMenuPhrase(requirement, s))
  const specific = named.filter(s => ['CoWoS', 'HBM', 'QFN', 'BGA'].includes(s))
  const requested = specific.length ? specific : named
  // Alternatives (QFN and BGA; Kestrel and peers) may be represented by one
  // subject in today's coarse menus. A menu entry must share at least one;
  // this is a necessary check, never a claim of complete semantic coverage.
  const year = requirement.match(/\b20(?:2[3-9]|30)\b/)?.[0]
  const dated = Boolean(year || /\bwith (?:its|the|a) date\b|\bdated\b/i.test(requirement))
  const yearWords: Record<string, string> = { '2023': 'twenty twenty three', '2024': 'twenty twenty four', '2025': 'twenty twenty five', '2026': 'twenty twenty six', '2027': 'twenty twenty seven', '2028': 'twenty twenty eight', '2029': 'twenty twenty nine', '2030': 'twenty thirty' }
  return !menu.some(f => {
    const scope = `${candidate.title} ${f.entity}`
    return key.offer.test(`${f.entity} ${f.measure} ${candidate.title}`)
      && (!requested.length || requested.some(s => mentionsMenuPhrase(scope, s)))
      && (!dated || Boolean(f.period && (!year || mentionsMenuPhrase(f.period, yearWords[year]))))
  })
}
