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
  { need: /\bcapex\b|capital (?:expenditure|spending)/i, offer: /\bcapex\b|investment|\bcost(?:s|ing)?\b|capital (?:expenditure|spending)/i },
  { need: /\bcapacity\b/i, offer: /\bcapacity\b/i },
  { need: /\blead[- ]times?\b/i, offer: /\blead[- ]times?\b|\ballocation\b/i },
  { need: /\bissuance\b/i, offer: /\bissuance\b|\bbonds?\b/i },
]
// Proper names/acronyms come from the request, never a corpus entity list.
// Mixed-case and uppercase technical names outrank ordinary company/place names.
const questionWords = new Set(['The', 'What', 'Which', 'How', 'When', 'Where', 'Give', 'State', 'Report', 'In', 'For', 'Compare', 'Analysts', 'No', 'Basic', 'Corporate', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])
function namedSubjects(text: string): string[] {
  const names = (text.match(/\b[A-Z][A-Za-z]+\b/g) ?? []).filter(w => !questionWords.has(w) && !countries.flat().includes(w))
  const mixedCase = names.filter(w => /[a-z][A-Z]/.test(w))
  const technical = mixedCase.length ? mixedCase : names.filter(w => /^[A-Z]{2,}$/.test(w))
  return technical.length ? technical : names
}
const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const numberWords = (n: number) => n < 20 ? small[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + small[n % 10] : '')
function periodMatches(period: string, year: string): boolean {
  const n = Number(year)
  const words = numberWords(Math.floor(n / 100)) + ' ' + (n % 100 ? numberWords(n % 100) : 'hundred')
  return mentionsMenuPhrase(period, year) || mentionsMenuPhrase(period, words)
}
export function factMenuMismatch(requirement: string, candidate: PublicCandidate): boolean {
  if (!verifiedMenuManifest(candidate)) return false
  const menu = signedFactMenu(candidate)
  const key = factKeys.find(k => k.need.test(requirement))
  const priced = /\bprices?\b|\bpricing\b|\bcosts?\b|\bquote\b/i.test(requirement)
  if (!key && !priced) return false
  const requested = namedSubjects(requirement)
  // Coarse price menus may promise a different metric for the same entity.
  // Reject only explicit entity mismatch; no wafer/domain synonyms or writer IDs.
  if (!key) return requested.length > 0 && menu.length > 0
    && !requested.some(s => mentionsMenuPhrase(`${candidate.title} ${menu.map(f => f.entity).join(' ')}`, s))
  const year = requirement.match(/\b(?:19|20|21)\d{2}\b/)?.[0]
  const dated = Boolean(year || /\bwith (?:its|the|a) date\b|\bdated\b/i.test(requirement))
  return !menu.some(f => key.offer.test(`${f.entity} ${f.measure} ${candidate.title}`)
    && (!requested.length || requested.some(s => mentionsMenuPhrase(`${candidate.title} ${f.entity}`, s)))
    && (!dated || Boolean(f.period && (!year || periodMatches(f.period, year)))))
}
