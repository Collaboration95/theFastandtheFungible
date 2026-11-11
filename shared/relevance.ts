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
  ['key reveal', 'keyreveal', 'key delivery', 'reveal key', 'ciphertext', 'encryption key', 'decryption key', 'never reveals', 'key not delivered', 'non-delivery of the key'],
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
// R9-C: "whether" is a question word like "what" or "which" (live planners open requested facts with it), and "then" only
// orders clauses ("reading the article and then refusing to pay"); neither names a subject.
const STOP = new Set('a an the of at in on to for and or with its it is are was were be did does do what how why when which whether who can will should from about this that their have has had by as into before after then today must need needs lets let get does every just than more much many each actually use used using i my me an agent please tell work know server no independent accessible evidence missing dated figures still unanswered happen happens'.split(' '))
/** The same light inflection rule for query words, phrases and answer ranking. */
export const topicStem = (w: string) => w.replace(/(?:ing|ed)$/, m => w.length > 5 ? '' : m).replace(/(?<!s)s$/, m => w.length > 3 ? '' : m)
export const topicWords = (text: string): string[] => [...new Set((text.normalize('NFKC').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => w.length > 1 && !STOP.has(w)).map(topicStem))]
// Normalize the fixed vocabulary once rather than for each query word and hit.
const groupWords = new Map(PROTOCOL_GLOSSARY.map(group => [group, new Set(group.flatMap(topicWords))]))
const phraseWords = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').map(topicStem).join(' ')
const phraseText = (text: string) => ` ${phraseWords(text)} `
const aliasKeys = new Map<string, string>(PROTOCOL_GLOSSARY.flat().map(p => [p, phraseText(p)]))
export type TopicDocument = { words: ReadonlySet<string>; phrases: string }
/** Publisher indexes prepare immutable document vocabulary once for all queries. */
export const topicDocument = (text: string): TopicDocument => ({ words: new Set(topicWords(text)), phrases: phraseText(text) })
const phraseIn = (normalized: string, phrase: string) => normalized.includes(aliasKeys.get(phrase) ?? phraseText(phrase))
/**
 * Callers test one question, gap or clause against every candidate, passage and sentence, so the same short text
 * was scanned against the whole glossary thousands of times per run (about a third of a fixture ask's event-loop
 * time). The results depend only on the text; keep the most recent ones, frozen so no caller can alter a shared result.
 */
export const memoByText = <T>(compute: (text: string) => T, { entries = 512, maxLength = 4096 } = {}): ((text: string) => T) => {
  const cache = new Map<string, T>()
  return text => {
    if (text.length > maxLength) return compute(text)
    if (cache.has(text)) return cache.get(text)!
    const value = compute(text)
    if (cache.size >= entries) cache.delete(cache.keys().next().value!)
    cache.set(text, value)
    return value
  }
}
const matchingGroups = memoByText((query: string) => {
  // Safety vocabulary with an intervening source adjective still names prompt injection. This changes vocabulary,
  // not the original words or their overlap denominator ("malicious document instructions", for example).
  const safety = /\b(?:malicious|untrusted)\s+(?:\w+\s+){0,2}(?:instructions|content)\b/i.test(query)
  const normalized = phraseText(`${query}${safety ? ' prompt injection' : ''}`)
  return Object.freeze(PROTOCOL_GLOSSARY.filter(group => (group[0] !== 'did' || /\bDID(?:Set|Delete)?\b/.test(query) || /decentralized identifier/i.test(query)) && group.some(p => phraseIn(normalized, p))))
})
/** topicWords of a query-side text, shared and frozen; topicWords itself still returns a fresh array. */
const queryWords = memoByText((query: string) => Object.freeze(topicWords(query)))
/** The same passages and candidate texts are tested against many queries and clauses within one answer. */
const documentWords = memoByText((document: string): ReadonlySet<string> => new Set(topicWords(document)), { entries: 64, maxLength: 16384 })
const documentPhrases = memoByText(phraseText, { entries: 64, maxLength: 16384 })
export const isProtocolQuery = memoByText((query: string) => /\b(?:XRPL|XRP|x402|RLUSD|escrow\w*|credentials?|trustset|AMM\w*|FATF|VASPs|MAS|prompt.inject\w*)\b/i.test(query) || /\bDID(?:Set|Delete)?\b/.test(query) || matchingGroups(query).length > 0 && /\b(?:payment|purchase|http|transaction|ledger|token|account|wallet)\b/i.test(query))
/** The glossary phrases a query's families add that the query does not already say. */
export function protocolAliases(query: string): string[] {
  const normalized = phraseText(query)
  return [...new Set(matchingGroups(query).flat().filter(p => !phraseIn(normalized, p)))]
}
export function expandProtocolQuery(query: string): string {
  return [query, ...protocolAliases(query)].join(' ')
}
const literalText = (text: string) => ` ${text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
/** Plural folding only (escrows → escrow, tokens → token), the same rule phraseText applies, without its -ing/-ed. */
const singularText = (text: string) => literalText(text).replace(/\S+/g, w => w.replace(/(?<!s)s$/, m => w.length > 3 ? '' : m))
/**
 * The publisher's keyword search term (R8-A3): expandProtocolQuery plus the glossary's singular spelling of a phrase
 * the query says only in the plural ("escrows" → escrow, "issued tokens" → issued token). Keyword search does not fold
 * plurals, and the glossary match does, so the expansion used to add only the family's sibling names (EscrowCreate,
 * TrustSet) and never its own word. Those references then outranked the article using that word: the TokenEscrow
 * (XLS-85) article ranked 8th in its writer's hits for "Which XRPL amendment lets escrows hold issued tokens, not just
 * XRP?" (v5 H05). It adds no new family and no plural, so the topic checks and every other caller of
 * expandProtocolQuery are unchanged.
 */
export function searchQuery(query: string): string {
  const literal = literalText(query), singular = singularText(query)
  const plural = matchingGroups(query).flat().filter(p => singularText(p) === literalText(p) && singular.includes(literalText(p)) && !literal.includes(literalText(p)))
  return [query, ...new Set(plural), ...protocolAliases(query)].join(' ')
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
/**
 * Forms of one word that the light stemmer cannot fold, for the subject floors below (R9-C): "How does the writer get
 * paid?" is about writer payment, and "worth buying" about what was bought. Folding is local to those floors, so search,
 * title matching and the protocol families keep their exact words.
 */
// QUAL: "spend money" is buying here ("Can the language model in ResearchAgent spend money on its own?" is answered by
// "How does ResearchAgent decide which article is worth buying?"), so spend and spent are forms of buy.
const SAME_WORD = new Map<string, readonly string[]>([['pay', ['pay', 'paid', 'payment']], ['buy', ['buy', 'bought', 'spend', 'spent']]])
const BASE_OF = new Map([...SAME_WORD].flatMap(([base, forms]) => forms.map(form => [form, base] as const)))
/**
 * The share of a query's topic words a document names, directly or through a glossary group both name, and how many.
 * `fold` treats the forms of one word as one (paid, payment → pay); `skip` leaves words out of the count.
 */
function wordOverlap(query: string, document: string, prepared?: TopicDocument, options: { fold?: boolean; skip?: ReadonlySet<string> } = {}): { share: number; matched: number } {
  const words = options.skip ? queryWords(query).filter(w => !options.skip!.has(w)) : queryWords(query)
  const need = options.fold ? [...new Set(words.map(w => BASE_OF.get(w) ?? w))] : words
  const own = prepared?.words ?? documentWords(document)
  const normalized = prepared?.phrases ?? documentPhrases(document)
  const aliases = matchingGroups(query).filter(group => group.some(p => phraseIn(normalized, p)))
  const forms = (w: string) => options.fold ? SAME_WORD.get(w) ?? [w] : [w]
  const matched = need.filter(w => forms(w).some(form => own.has(form) || aliases.some(g => groupWords.get(g)!.has(form)))).length
  return { share: need.length ? matched / need.length : 0, matched }
}
/** Match each original term directly or through a glossary group it belongs to. */
export function topicOverlap(query: string, document: string, prepared?: TopicDocument): number {
  return wordOverlap(query, document, prepared).share
}
/** Network qualifiers ("on XRPL", "on Testnet") say where a question applies, not what it asks about. */
const QUALIFIERS = new Set(['xrpl', 'testnet'])
/** Broad families that many protocol articles mention in passing; a specific family the question names ranks first. */
const BROAD = new Set(['x402', 'finality', 'transaction cost', 'digital payment token'])
/**
 * The broad families that usually name what a question asks about its subject (is it final, what does it cost, is it
 * regulated) rather than the subject itself (R9-C). x402 is broad too, but a question naming x402 is about x402.
 */
const PREDICATES = new Set(['finality', 'transaction cost', 'digital payment token'])
/** The subject families a query names, never the network qualifiers (H8-01). */
export const subjectFamilies = memoByText((query: string) => Object.freeze(matchingGroups(query).filter(g => g[0] !== 'xrpl' && !QUALIFIERS.has(g[0]))))
/**
 * The families a technical query must match. Of the specific families, the first one the query names leads (K4); a
 * broad family it names (fees, finality, x402, digital payment tokens) also counts. A qualifier is the subject only
 * when the query names nothing else (H8-01). Empty when the query names no family.
 */
const requiredFamilies = memoByText((query: string) => {
  const subjects = subjectFamilies(query)
  const groups = subjects.length ? subjects : matchingGroups(query).filter(g => g[0] !== 'xrpl')
  const queryText = phraseText(query)
  const position = (group: typeof groups[number]) => Math.min(...group.filter(p => phraseIn(queryText, p)).map(p => queryText.indexOf(aliasKeys.get(p)!)))
  const lead = groups.filter(g => !BROAD.has(g[0])).sort((a, b) => position(a) - position(b)).slice(0, 1)
  return Object.freeze([...lead, ...groups.filter(g => BROAD.has(g[0]))])
})
/**
 * How directly a document matches the subject a query names: 2 for a specific family, 1 for a broad family only
 * (x402, finality, fees, digital payment tokens), 0 for none. Ranks eligible protocol articles; it admits nothing.
 */
export function subjectRank(query: string, document: string): number {
  const documentText = documentPhrases(document)
  const hits = subjectFamilies(query).filter(group => group.some(p => phraseIn(documentText, p)))
  return hits.some(group => !BROAD.has(group[0])) ? 2 : hits.length ? 1 : 0
}
export function metadataTopicMatches(query: string, document: string, prepared?: TopicDocument): boolean {
  // An explicitly technical request cannot be routed to a finance story sharing a date/place.
  if (/\b(?:XRPL|XRP|x402|RLUSD)\b/i.test(query) && !/\b(?:XRPL|XRP|x402|RLUSD|ledger|escrow|trustset)\b/i.test(document)) return false
  const words = queryWords(query).filter(w => !/^\d+$/.test(w))
  if (!words.length) return true
  // H8-01: a qualifier never outranks the question's subject. "What does an x402 402 response contain … on Testnet?"
  // is about x402, and a Testnet server list does not answer it. A qualifier is the subject only when the question
  // names nothing else ("Which Testnet server should I use?").
  const families = requiredFamilies(query)
  const technical = isProtocolQuery(query)
  if (technical) {
    // Match the subject family, not a percentage of the question's explanatory prose. Of the specific families, the
    // first one the question names leads (K4); a broad family it names (fees, finality, x402, digital payment tokens)
    // also counts, so "How much does one key-reveal purchase cost in XRPL network fees?" admits a fee article, which
    // the old rule skipped (H8-01). subjectRank then ranks a specific family first. Finality still needs finality
    // metadata, so wallet/budget tags cannot satisfy a finality question.
    if (families.length) {
      const documentText = prepared?.phrases ?? documentPhrases(document)
      if (families.some(group => group.some(p => phraseIn(documentText, p)))) return true
      return families.every(group => PREDICATES.has(group[0])) && namesPredicateSubject(query, families, document, prepared)
    }
    const need = words.filter(w => !GENERIC.has(w))
    const own = prepared?.words ?? documentWords(document)
    return need.length ? need.some(w => own.has(w)) : true
  }
  return wordOverlap(query.replace(/\b\d+\b/g, ' '), document, prepared, { fold: true }).share >= 0.5
}
/** Words that name no particular protocol subject. */
const GENERIC = new Set(['xrpl','xrp','ledger','payment','transaction','account','token','asset'])
/** The network qualifiers' own words (xrpl, ledger, testnet, …): where a question applies, never what it asks. */
const QUALIFIER_WORDS = new Set(PROTOCOL_GLOSSARY.filter(group => QUALIFIERS.has(group[0])).flatMap(group => [...groupWords.get(group)!]))
/**
 * R9-C: a query whose only families are predicates (finality, fees, regulation) often names one as what it asks about its
 * subject, not as the subject: "Whether a payment made by an agent for an article is final or reversible when the writer
 * never reveals the key" asks about an article whose writer never reveals the key, and "final" is the question. Requiring
 * finality vocabulary rejected the writer no-show explainer that answers it, so the answer lost its lead (R9-A's D4
 * repro). A document naming none of those families still matches when it names at least half, and at least two, of the
 * query's other subject words: not generic words, network qualifiers or the families' own words. A query naming a
 * specific family ("escrow", "trust line") or x402 keeps that family as its gate.
 */
function namesPredicateSubject(query: string, families: readonly (typeof PROTOCOL_GLOSSARY)[number][], document: string, prepared?: TopicDocument): boolean {
  const skip = new Set([...GENERIC, ...QUALIFIER_WORDS, ...families.flatMap(group => [...groupWords.get(group)!])])
  const { share, matched } = wordOverlap(query.replace(/\b\d+\b/g, ' '), document, prepared, { fold: true, skip })
  return matched >= 2 && share >= 0.5
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
