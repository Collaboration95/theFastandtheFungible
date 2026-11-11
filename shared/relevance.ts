/** Small protocol glossary for search and topic checks. It adds vocabulary, never evidence.
 * Groups cover protocol names, wire terminology, safety and transaction families;
 * original query terms keep their denominator so an alias cannot erase unknown scope. */
export const PROTOCOL_GLOSSARY = [
  ['xrpl', 'xrp ledger', 'xrp'],
  ['x402', '402 response', 'http 402', 'payment required', 'payment is required', 'payment-required', 'challenge headers'],
  ['prompt injection', 'prompt injected', 'spending controls', 'authorization', 'wallet draining', 'purchase budget', 'budget policy', 'policy code', 'deterministic policy'],
  ['receipt verification', 'offline verification', 'cited answer', 'signed receipt', 'verify receipt', 'ledger verification', 'independently verify'],
  ['finality', 'final', 'settled', 'validated ledger', 'validation', 'settlement'],
  ['trust line', 'trust lines', 'trustline', 'TrustSet', 'owner reserve', 'account reserves'],
  ['escrow', 'EscrowCreate', 'EscrowFinish', 'EscrowCancel'],
  ['did', 'decentralized identifier', 'DID document', 'DIDDocument', 'DIDSet', 'DIDDelete'],
  ['amm', 'automated market maker', 'LP token', 'LP tokens', 'AMMCreate', 'AMMDeposit', 'AMMWithdraw', 'AMMBid', 'AMMVote', 'AMMDelete'],
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
  // C5 (11 Nov): vocabulary for the sourced explainers added in the same change. Names only; it never adds evidence.
  ['crypto-condition', 'crypto condition', 'conditional escrow', 'PREIMAGE-SHA-256', 'preimage', 'fulfillment', 'hash lock', 'hash locked'],
  ['TicketCreate', 'TicketSequence', 'ticket limit', 'xrpl tickets'],
  ['validation quorum', 'trusted validators', 'unique node list', 'UNL', 'negative UNL', 'validation threshold'],
  ['fill or kill', 'immediate or cancel', 'order flags', 'tfFillOrKill', 'tfImmediateOrCancel', 'tfPassive', 'tfSell'],
  ['tfPartialPayment', 'DeliverMax', 'DeliverMin', 'SendMax', 'delivered amount'],
  ['hex currency code', 'nonstandard currency', 'issued currency'],
  ['stablecoin framework', 'payment stablecoin', 'GENIUS Act', 'single currency stablecoin', 'redemption at par', 'stablecoin issuer'],
  ['agent payments protocol', 'AP2', 'payment mandate', 'checkout mandate', 'verifiable digital credentials'],
  ['facilitator', 'verify and settle', 'settlement response', 'payment payload'],
  ['deposit authorization', 'DepositAuth', 'DepositPreauth', 'preauthorized deposits'],
  ['testnet', 'altnet', 'test network'],
] as const
const STOP = new Set('a an the of at in on to for and or with its it is are was were be did does do what how why when which who can will should from about this that their have has had by as into before after today must need needs lets let get does every just than more much many each actually use used using i my me an agent please tell work know server no independent accessible evidence missing dated figures still unanswered happen happens'.split(' '))
export const topicWords = (text: string): string[] => [...new Set((text.normalize('NFKC').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.replace(/(?:ing|ed)$/, m => w.length > 5 ? '' : m).replace(/(?<!s)s$/, m => w.length > 3 ? '' : m)))]
// Normalize the fixed vocabulary once rather than for each query word and hit.
const groupWords = new Map(PROTOCOL_GLOSSARY.map(group => [group, new Set(group.flatMap(topicWords))]))
const phraseWords = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').map(w => w.replace(/(?:ing|ed)$/, m => w.length > 5 ? '' : m).replace(/(?<!s)s$/, m => w.length > 3 ? '' : m)).join(' ')
const phraseText = (text: string) => ` ${phraseWords(text)} `
const aliasKeys = new Map<string, string>(PROTOCOL_GLOSSARY.flat().map(p => [p, phraseText(p)]))
export type TopicDocument = { words: ReadonlySet<string>; phrases: string }
/** Publisher indexes prepare immutable document vocabulary once for all queries. */
export const topicDocument = (text: string): TopicDocument => ({ words: new Set(topicWords(text)), phrases: phraseText(text) })
const phraseIn = (normalized: string, phrase: string) => normalized.includes(aliasKeys.get(phrase) ?? phraseText(phrase))
const matchingGroups = (query: string) => {
  const normalized = phraseText(query)
  return PROTOCOL_GLOSSARY.filter(group => (group[0] !== 'did' || /\bDID(?:Set|Delete)?\b/.test(query) || /decentralized identifier/i.test(query)) && group.some(p => phraseIn(normalized, p)))
}
export const isProtocolQuery = (query: string) => /\b(?:XRPL|XRP|x402|RLUSD|escrow\w*|credentials?|trustset|AMM\w*|FATF|VASPs|MAS|prompt.inject\w*)\b/i.test(query) || /\bDID(?:Set|Delete)?\b/.test(query) || matchingGroups(query).length > 0 && /\b(?:payment|purchase|http|transaction|ledger|token|account|wallet)\b/i.test(query)
/** The glossary phrases a query's families add that the query does not already say. */
export function protocolAliases(query: string): string[] {
  const normalized = phraseText(query)
  return [...new Set(matchingGroups(query).flat().filter(p => !phraseIn(normalized, p)))]
}
export function expandProtocolQuery(query: string): string {
  return [query, ...protocolAliases(query)].join(' ')
}
/**
 * A protocol identifier: a CamelCase transaction, field or flag name (EscrowCreate, DIDSet, AllowTrustLineLocking)
 * or a hyphenated capitalised standard name (XLS-85, PREIMAGE-SHA-256).
 */
export const IDENTIFIER = /\b[A-Za-z][A-Za-z0-9]*(?:[a-z][A-Z]|[A-Z]{2}[a-z])[A-Za-z0-9]*\b|\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b/g
/** A CamelCase protocol name (EscrowCreate, DIDSet, tfFillOrKill): one member of a family, not a synonym for it. */
export const isCamelCaseName = (phrase: string) => /^[A-Za-z][A-Za-z0-9]*(?:[a-z][A-Z]|[A-Z]{2}[a-z])[A-Za-z0-9]*$/.test(phrase)
/** The protocol identifiers a public text names, as written. */
export const identifiersIn = (text: string) => [...new Set(text.match(IDENTIFIER) ?? [])]
/** The glossary family an identifier belongs to (its first phrase), if any: escrow for EscrowCreate. */
export const identifierFamily = (identifier: string) => PROTOCOL_GLOSSARY.find(group => group.some(p => p.toLowerCase() === identifier.toLowerCase()))?.[0]
/** An identifier's words, splitting a leading acronym too: DIDSet → did, set (topicWords alone keeps "didset"). */
export const identifierWords = (identifier: string) => topicWords(identifier.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'))
/**
 * The words that tell a family's members apart: create, accept and delete for the credential family (CredentialCreate,
 * CredentialAccept, CredentialDelete), never the family's own words (credential).
 */
export function familyMemberWords(family: string): Set<string> {
  const groups = PROTOCOL_GLOSSARY.filter(group => group[0] === family)
  const own = new Set(groups.flatMap(group => group.filter(p => !isCamelCaseName(p)).flatMap(topicWords)))
  return new Set(groups.flatMap(group => group.filter(isCamelCaseName).flatMap(identifierWords)).filter(word => !own.has(word)))
}
/** Match each original term directly or through a glossary group it belongs to. */
export function topicOverlap(query: string, document: string, prepared?: TopicDocument): number {
  const need = topicWords(query), own = prepared?.words ?? new Set(topicWords(document))
  const normalized = prepared?.phrases ?? phraseText(document)
  const aliases = matchingGroups(query).filter(group => group.some(p => phraseIn(normalized, p)))
  return need.length ? need.filter(w => own.has(w) || aliases.some(g => groupWords.get(g)!.has(w))).length / need.length : 0
}
/** Network qualifiers ("on XRPL", "on Testnet") say where a question applies, not what it asks about. */
const QUALIFIERS = new Set(['xrpl', 'testnet'])
/** Broad families that many protocol articles mention in passing; a specific family the question names ranks first. */
const BROAD = new Set(['x402', 'finality', 'transaction cost', 'digital payment token'])
/** The subject families a query names, never the network qualifiers (H8-01). */
export const subjectFamilies = (query: string) => matchingGroups(query).filter(g => g[0] !== 'xrpl' && !QUALIFIERS.has(g[0]))
/**
 * How directly a document matches the subject a query names: 2 for a specific family, 1 for a broad family only
 * (x402, finality, fees, digital payment tokens), 0 for none. Ranks eligible protocol articles; it admits nothing.
 */
export function subjectRank(query: string, document: string): number {
  const documentText = phraseText(document)
  const hits = subjectFamilies(query).filter(group => group.some(p => phraseIn(documentText, p)))
  return hits.some(group => !BROAD.has(group[0])) ? 2 : hits.length ? 1 : 0
}
export function metadataTopicMatches(query: string, document: string, prepared?: TopicDocument): boolean {
  // An explicitly technical request cannot be routed to a finance story sharing a date/place.
  if (/\b(?:XRPL|XRP|x402|RLUSD)\b/i.test(query) && !/\b(?:XRPL|XRP|x402|RLUSD|ledger|escrow|trustset)\b/i.test(document)) return false
  const words = topicWords(query).filter(w => !/^\d+$/.test(w))
  if (!words.length) return true
  // H8-01: a qualifier never outranks the question's subject. "What does an x402 402 response contain … on Testnet?"
  // is about x402, and a Testnet server list does not answer it. A qualifier is the subject only when the question
  // names nothing else ("Which Testnet server should I use?").
  const subjects = subjectFamilies(query)
  const groups = subjects.length ? subjects : matchingGroups(query).filter(g => g[0] !== 'xrpl')
  const technical = isProtocolQuery(query)
  if (technical) {
    // Match the subject family, not a percentage of the question's explanatory prose. Of the specific families, the
    // first one the question names leads (K4); a broad family it names (fees, finality, x402, digital payment tokens)
    // also counts, so "How much does one key-reveal purchase cost in XRPL network fees?" admits a fee article, which
    // the old rule skipped (H8-01). subjectRank then ranks a specific family first. Finality still needs finality
    // metadata, so wallet/budget tags cannot satisfy a finality question.
    if (groups.length) {
      const queryText = phraseText(query), documentText = prepared?.phrases ?? phraseText(document)
      const position = (group: typeof groups[number]) => Math.min(...group.filter(p => phraseIn(queryText, p)).map(p => queryText.indexOf(aliasKeys.get(p)!)))
      const lead = groups.filter(g => !BROAD.has(g[0])).sort((a, b) => position(a) - position(b)).slice(0, 1)
      return [...lead, ...groups.filter(g => BROAD.has(g[0]))].some(group => group.some(p => phraseIn(documentText, p)))
    }
    const generic = new Set(['xrpl','xrp','ledger','payment','transaction','account','token','asset'])
    const need = words.filter(w => !generic.has(w))
    const own = prepared?.words ?? new Set(topicWords(document))
    return need.length ? need.some(w => own.has(w)) : true
  }
  return topicOverlap(query.replace(/\b\d+\b/g, ' '), document, prepared) >= 0.5
}
export function topicMatches(query: string, document: string, prepared?: TopicDocument): boolean {
  return metadataTopicMatches(query, document, prepared)
}
/**
 * A bought article's title states a requested fact: at least 80% of its (four or more) topic words occur in the fact,
 * directly or through a shared glossary family. Looser than titleMatches; it only ever withholds further spending.
 */
export function titleCovers(fact: string, title: string): boolean {
  return topicWords(title).filter(w => !/^\d+$/.test(w)).length >= 4 && topicOverlap(title, fact) >= 0.8
}
/**
 * An article titled with (part of) the question: at least 80% of the title's topic words occur in the question
 * directly or through a shared glossary family, at least 60% occur literally (so one shared family name such as
 * "x402" cannot carry a whole title), and the title has at least four of them, so a generic reference title
 * ("What does EscrowCreate do on XRPL?") never qualifies. It reads only the public title, never paid text.
 */
export function titleMatches(question: string, title: string): boolean {
  const words = topicWords(title).filter(w => !/^\d+$/.test(w))
  if (words.length < 4) return false
  const own = new Set(topicWords(question))
  return words.filter(w => own.has(w)).length / words.length >= 0.6 && topicOverlap(title, question) >= 0.8
}
