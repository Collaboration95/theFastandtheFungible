/** Split dash compounds consistently; remove quote variants and possessives before tokenisation. */
export const searchText = (text: string) => text.normalize('NFKC').replace(/['’‘“”"]/g, "'").replace(/'s\b/gi, '').replace(/[\u2010-\u2015\u2212-]/g, ' ').replace(/'/g, ' ')

const STOP = new Set('a an the of at in on to for and or with its it is are was were be did does do what how why when which who can will should from about this that their have has had by as into benefit'.split(' '))
// A host such as s.altnet.rippletest.net should count as "altnet" and "rippletest", never as the generic words "net" or "org".
const HOST_SUFFIX = /\b((?:[a-z0-9-]+\.)+)(?:net|org|com|gov|edu|io|ai|sg)\b/gi
export const searchWords = (text: string) => new Set((searchText(text).replace(HOST_SUFFIX, '$1').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => !STOP.has(w)))
/** Majority of the content query must occur in a document. Unknown terms remain in the denominator.
 * Unlike BM25 this is independent of publisher size and query length, including one-word lookups. */
export function keywordCoverage(query: string, document: Set<string>): number {
  const words = searchWords(query)
  // Explicit acronym scope cannot be answered by a different entity/topic.
  const acronyms = searchText(query).match(/\b[A-Z]{2,}[A-Z0-9]*\b/g) ?? []
  if (acronyms.some(w => !document.has(w.toLowerCase()))) return 0
  return words.size ? [...words].filter(w => document.has(w)).length / words.size : 0
}
