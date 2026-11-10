/** Small protocol glossary for search and topic checks. It adds vocabulary, never evidence.
 * Groups cover protocol names, wire terminology, safety and transaction families;
 * original query terms keep their denominator so an alias cannot erase unknown scope. */
export const PROTOCOL_GLOSSARY = [
  ['xrpl', 'xrp ledger', 'xrp'],
  ['x402', '402 response', 'http 402', 'payment required', 'payment-required', 'challenge headers'],
  ['prompt injection', 'prompt injected', 'spending controls', 'authorization', 'wallet draining'],
  ['finality', 'final', 'settled', 'validated ledger', 'validation', 'settlement'],
  ['trust line', 'trustline', 'trustset'],
  ['escrow', 'escrowcreate', 'escrowfinish', 'escrowcancel'],
  ['did', 'decentralized identifier', 'didset', 'diddelete'],
  ['amm', 'automated market maker', 'ammcreate', 'ammdeposit', 'ammwithdraw', 'ammbid', 'ammvote', 'ammdelete'],
  ['dex', 'decentralized exchange', 'offercreate', 'offercancel'],
  ['credential', 'credentials', 'credentialcreate', 'credentialaccept', 'credentialdelete'],
] as const
const STOP = new Set('a an the of at in on to for and or with its it is are was were be did does do what how why when which who can will should from about this that their have has had by as into before after today must need needs lets let get does every just than more much many each actually use used using i my me an agent please tell work know server no independent accessible evidence missing dated figures still unanswered'.split(' '))
export const topicWords = (text: string): string[] => [...new Set((text.normalize('NFKC').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.replace(/(?:ing|ed|s)$/, m => w.length > 5 ? '' : m)))]
const phraseIn = (text: string, phrase: string) => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `.includes(` ${phrase.replace(/[^a-z0-9]+/g, ' ')} `)
const matchingGroups = (query: string) => PROTOCOL_GLOSSARY.filter(group => (group[0] !== 'did' || /\bDID(?:Set|Delete)?\b/.test(query) || /decentralized identifier/i.test(query)) && group.some(p => phraseIn(query, p)))
export function expandProtocolQuery(query: string): string {
  return [query, ...matchingGroups(query).flat()].join(' ')
}
/** Match each original term directly or through a glossary group it belongs to. */
export function topicOverlap(query: string, document: string): number {
  const need = topicWords(query), own = new Set(topicWords(document))
  const aliases = matchingGroups(query).filter(group => group.some(p => phraseIn(document, p)))
  return need.length ? need.filter(w => own.has(w) || aliases.some(g => g.some(p => topicWords(p).includes(w)))).length / need.length : 0
}
export function topicMatches(query: string, document: string): boolean {
  // An explicitly technical request cannot be routed to a finance story sharing a date/place.
  if (/\b(?:XRPL|XRP|x402|RLUSD)\b/i.test(query) && !/\b(?:XRPL|XRP|x402|RLUSD|ledger|escrow|trustset)\b/i.test(document)) return false
  const words = topicWords(query).filter(w => !/^\d+$/.test(w))
  if (!words.length) return true
  return topicOverlap(query.replace(/\b\d+\b/g, ' '), document) >= 0.5
}
