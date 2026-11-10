/** Small protocol glossary for search and topic checks. It adds vocabulary, never evidence.
 * Groups cover protocol names, wire terminology, safety and transaction families;
 * original query terms keep their denominator so an alias cannot erase unknown scope. */
export const PROTOCOL_GLOSSARY = [
  ['xrpl', 'xrp ledger', 'xrp'],
  ['x402', '402 response', 'http 402', 'payment required', 'payment-required', 'challenge headers'],
  ['prompt injection', 'prompt injected', 'spending controls', 'authorization', 'wallet draining'],
  ['finality', 'final', 'settled', 'validated ledger', 'validation', 'settlement'],
  ['trust line', 'trust lines', 'trustline', 'TrustSet', 'owner reserve', 'account reserves'],
  ['escrow', 'EscrowCreate', 'EscrowFinish', 'EscrowCancel'],
  ['did', 'decentralized identifier', 'DIDSet', 'DIDDelete'],
  ['amm', 'automated market maker', 'AMMCreate', 'AMMDeposit', 'AMMWithdraw', 'AMMBid', 'AMMVote', 'AMMDelete'],
  ['dex', 'decentralized exchange', 'OfferCreate', 'OfferCancel'],
  ['credential', 'credentials', 'CredentialCreate', 'CredentialAccept', 'CredentialDelete'],
  ['transaction cost', 'transaction fee', 'fees', 'drops', 'base fee'],
  ['destination tag', 'destination tags', 'destinationtag', 'source tag', 'tag'],
  ['websocket', 'public endpoint', 'endpoint', 'server url'],
  ['trust line', 'trustline', 'trustset', 'issued token', 'issued tokens'],
  ['digital payment token', 'dpt', 'payment services act', 'psa', 'statute', 'regulation', 'licensing'],
  ['regular key', 'SetRegularKey', 'key rotation'],
  ['multi sign', 'multisign', 'multisigning', 'multiple approvers', 'more than one approver', 'SignerListSet'],
  ['checks', 'CheckCreate', 'CheckCash', 'capped payment', 'cashes'],
  ['payment channel', 'payment channels', 'micropayments', 'PaymentChannelCreate', 'PaymentChannelFund', 'PaymentChannelClaim'],
  ['travel rule', 'fatf', 'vasps', 'originator and beneficiary information'],
  ['key reveal', 'keyreveal', 'key delivery', 'reveal key', 'ciphertext', 'encryption key'],
] as const
const STOP = new Set('a an the of at in on to for and or with its it is are was were be did does do what how why when which who can will should from about this that their have has had by as into before after today must need needs lets let get does every just than more much many each actually use used using i my me an agent please tell work know server no independent accessible evidence missing dated figures still unanswered happen happens'.split(' '))
export const topicWords = (text: string): string[] => [...new Set((text.normalize('NFKC').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.replace(/(?:ing|ed)$/, m => w.length > 5 ? '' : m).replace(/(?<!s)s$/, m => w.length > 3 ? '' : m)))]
const phraseWords = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').map(w => w.replace(/(?:ing|ed)$/, m => w.length > 5 ? '' : m).replace(/(?<!s)s$/, m => w.length > 3 ? '' : m)).join(' ')
const phraseText = (text: string) => ` ${phraseWords(text)} `
const aliasKeys = new Map<string, string>(PROTOCOL_GLOSSARY.flat().map(p => [p, phraseText(p)]))
const phraseIn = (normalized: string, phrase: string) => normalized.includes(aliasKeys.get(phrase) ?? phraseText(phrase))
const matchingGroups = (query: string) => {
  const normalized = phraseText(query)
  return PROTOCOL_GLOSSARY.filter(group => (group[0] !== 'did' || /\bDID(?:Set|Delete)?\b/.test(query) || /decentralized identifier/i.test(query)) && group.some(p => phraseIn(normalized, p)))
}
export const isProtocolQuery = (query: string) => /\b(?:XRPL|XRP|x402|RLUSD|escrow\w*|credentials?|trustset|AMM\w*|FATF|VASPs|MAS|prompt.inject\w*)\b/i.test(query) || /\bDID(?:Set|Delete)?\b/.test(query) || matchingGroups(query).length > 0 && /\b(?:payment|http|transaction|ledger|token|account|wallet)\b/i.test(query)
export function expandProtocolQuery(query: string): string {
  const normalized = phraseText(query)
  return [query, ...new Set(matchingGroups(query).flat().filter(p => !phraseIn(normalized, p)))].join(' ')
}
/** Match each original term directly or through a glossary group it belongs to. */
export function topicOverlap(query: string, document: string): number {
  const need = topicWords(query), own = new Set(topicWords(document))
  const normalized = phraseText(document)
  const aliases = matchingGroups(query).filter(group => group.some(p => phraseIn(normalized, p)))
  return need.length ? need.filter(w => own.has(w) || aliases.some(g => g.some(p => topicWords(p).includes(w)))).length / need.length : 0
}
export function metadataTopicMatches(query: string, document: string): boolean {
  // An explicitly technical request cannot be routed to a finance story sharing a date/place.
  if (/\b(?:XRPL|XRP|x402|RLUSD)\b/i.test(query) && !/\b(?:XRPL|XRP|x402|RLUSD|ledger|escrow|trustset)\b/i.test(document)) return false
  const words = topicWords(query).filter(w => !/^\d+$/.test(w))
  if (!words.length) return true
  const groups = matchingGroups(query).filter(g => g[0] !== 'xrpl')
  const technical = isProtocolQuery(query)
  if (technical) {
    // Match the subject family, not a percentage of the question's explanatory prose.
    // Finality therefore needs finality metadata; wallet/budget tags cannot satisfy it.
    const specific = groups.filter(g => !['x402','finality','transaction cost','digital payment token'].includes(g[0]))
    if (groups.length) {
      const queryText = phraseText(query), documentText = phraseText(document)
      const position = (group: typeof groups[number]) => Math.min(...group.filter(p => phraseIn(queryText,p)).map(p => queryText.indexOf(aliasKeys.get(p)!)))
      const ordered = [...(specific.length ? specific : groups)].sort((a,b) => position(a) - position(b))
      return ordered[0].some(p => phraseIn(documentText, p))
    }
    const generic = new Set(['xrpl','xrp','ledger','payment','transaction','account','token','asset'])
    const need = words.filter(w => !generic.has(w))
    const own = new Set(topicWords(document))
    return need.length ? need.some(w => own.has(w)) : true
  }
  return topicOverlap(query.replace(/\b\d+\b/g, ' '), document) >= 0.5
}
export function topicMatches(query: string, document: string): boolean {
  return metadataTopicMatches(query, document)
}
