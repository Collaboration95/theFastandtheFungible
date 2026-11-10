import { sameSource } from './source-identity.js'
import { expandProtocolQuery, topicMatches } from './relevance.js'
import type { Claim, ContentEnvelope, PublicCandidate } from './contracts/index.js'

const STOP = new Set('what when where which how did does are the its and with from that this latest last getting much was were for has have on in of a an to s'.split(' '))
const words = (text: string) => [...new Set(text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/lead[- ]times?/g, 'lead time').match(/[a-z0-9]+/g) ?? [])].filter(word => word.length > 1 && !STOP.has(word))
/** Use Unicode sentence segmentation rather than an uppercase-only boundary rule.
 * Keep source bytes (including identifier punctuation) intact for quotation. */
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
export const answerBoilerplate = (text: string) => /\breference (?:defines the operation-specific fields|describes .* as part of a larger)\b|^(?:Author interpretation|I run|I have|I spent|Here is|Speaking|Verify|Confirm|Inspect|Retain|Keep|Read|Treat|Report|Include|Test|Distinguish|Explain|Consider|Avoid|Compare|Query|Estimate|Where an amendment|Do not|Creating a pool is not evidence|The public XRPL reference describes|For an agent builder)\b|^(?:Applications?|Integrations?|Clients?|Developers?)\b[^.!?]{0,60}\bshould\b|\b(?:I recommend|we recommend|my recommendation|integration recommendation|a reminder that|was no exception)\b/i.test(text)
export function sentences(text: string): string[] {
  return Array.from(segmenter.segment(text), part => part.segment.trim()).filter(Boolean)
}
/** A long sentence may lose a trailing explanatory clause, never a conditional
 * premise or a qualification/negation. The extract remains an exact substring. */
function answerExtracts(text: string): string[] {
  return sentences(text).flatMap(raw => {
    const sentence = raw.replace(/^According to [^,]{1,120},\s+/, '')
    if (sentence.split(/\s+/).length <= 40) return [sentence]
    if (/^(?:if|unless|when|although|because|before|after|while|only)\b/i.test(sentence)) return []
    const cuts = [...sentence.matchAll(/,\s+(?:after|before|while|because|which|with)\b|;\s+|\s+—\s+/g)].map(m => m.index!)
    const cut = cuts.reverse().find(i => sentence.slice(0, i).split(/\s+/).length <= 40 && !/\b(?:not|no|never|unless|except|only|without|cannot|rather)\b|n't\b/i.test(sentence.slice(i)))
    return cut === undefined ? [] : [sentence.slice(0, cut)]
  })
}

/** Select only exact sentences of validated claims. Never promote an uncited conclusion.
 * Numeric comparisons and question coverage outrank an author's introductory prose.
 * Shared by the screen and export; callers enforce delivered-passage access first.
 */
export function leadFinding(question: string, claims: Claim[], delivered?: ContentEnvelope[], firstRequirement?: string, candidates: PublicCandidate[] = []): { text: string; claim: Claim }[] {
  if (delivered) claims = claims.flatMap(claim => claim.citations.flatMap(ref => {
    const content = delivered.find(c => sameSource(c, ref))
    const span = content?.spans.find(s => s.id === ref.spanId && content.body.includes(s.text))
    return span ? [{ ...claim, text: span.text, citations: [ref] }] : []
  }))
  const terms = words(question)
  const expanded = words(expandProtocolQuery(question))
  // A generated entity-basics row is coverage bookkeeping, not a requested fact.
  const requested = firstRequirement && !/^Basic facts on\b/i.test(firstRequirement) ? firstRequirement : undefined
  const firstFact = (requested ?? question.split(/[,;?]\s*(?:and\s+)?(?=what|which|how|when|why)/i)[0]).replace(/^.*?[.!]\s+(?=(?:what|which|how|when|why|is|can)\b)/i, '')
  const primary = words(firstFact)
  const eventTerms = /^when\b/i.test(firstFact) ? primary.filter(term => /(?:ed|held|born|began|begun|took)$/.test(term)) : []
  const causal = /^why\b/i.test(firstFact)
  const quantity = /^(?:how (?:many|much)|what.*(?:amount|cost|fee|reserve|maximum|minimum))\b/i.test(firstFact)
  const capability = /^(?:is|are|can|does|do|will|has|have)\b/i.test(firstFact)
  const naming = /^(?:which|what)\b/i.test(firstFact)
  const fieldValue = naming && /\b(?:field|flag|header|setting|permission)s?\b/i.test(firstFact)
  const latest = /\b(?:last|latest|recent|recently|today|current(?:ly)?)\b/i.test(firstFact) && (/^when\b/i.test(firstFact) || /\b(?:meeting|announcement|statement|release|update)\b/i.test(firstFact))
  // Compare dates within the delivered evidence, so the same input has the
  // same ranking regardless of the machine's clock.
  const latestYear = latest ? Math.max(0, ...claims.flatMap(c => answerExtracts(c.text).filter(text => !/\b(?:next|scheduled|forecast|projected|expected|planned)\b/i.test(text)).flatMap(text => (text.match(/\b20\d{2}\b/g) ?? []).map(Number)))) : 0
  const transactionName = (name: string) => /(?:Create|Finish|Cancel|Set|Delete|Deposit|Withdraw|Bid|Vote|Accept|Fund|Claim|Cash)$|^Set[A-Z]/.test(name)
  const opening = firstFact.match(/^[A-Za-z]+\b/)?.[0]
  const entities = (firstFact.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g) ?? []).filter(name => !STOP.has(name.toLowerCase()) && name.length > 1 && (name !== opening || /[a-z][A-Z]/.test(name)))
  const entityPatterns = entities.map(name => new RegExp(`\\b${name}\\b`, 'i'))
  const named = firstRequirement?.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? []
  const ranked = claims.flatMap((claim, ci) => {
    const metadata = candidates.find(c => claim.citations.some(ref => sameSource(c, ref)))
    const content = delivered?.find(c => claim.citations.some(ref => sameSource(c, ref)))
    const title = metadata?.title ?? content?.title ?? ''
    const titleTerms = words(`${title} ${metadata?.facets.join(' ') ?? ''}`)
    // An entity can be established earlier in the verified article. Require
    // topical overlap in this cited passage, then rank its answer sentence.
    const subject = `${title} ${metadata?.facets.join(' ') ?? ''} ${claim.text}`
    const entityContext = `${subject} ${content?.body ?? ''}`
    if (!topicMatches(firstFact, subject) || !entityPatterns.every(pattern => pattern.test(entityContext))) return []
    const context = words(claim.text)
    const contextOverlap = terms.filter(term => context.includes(term)).length
    return answerExtracts(claim.text).map((text, si) => {
    const lower = text.toLowerCase(), tokens = words(text)
    if (answerBoilerplate(text)) return { text, claim, score: 0, ci, si }
    if (/^(?:This (?:article|note|guide|source)\b|This is a team-authored|This team-authored|The implementation record|For a reader assessing|For an? .*integration|I recommend|Test missing|This is an integration recommendation|Reproduction requires|The four .*entries|Some .*examples use different headers|See\b|Code:|Sources?:)|(?:[\w-]+\/)+[\w.-]+\.(?:ts|md|tsx)\b/i.test(text)) return { text, claim, score: 0, ci, si }
    const overlap = terms.filter(term => tokens.includes(term)).length
    const semanticOverlap = expanded.filter(term => tokens.includes(term)).length
    const identifier = /\b(?:[A-Z][a-z]+){2,}\b|\b[a-z]+[A-Z][A-Za-z]+\b|\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/.test(text)
    const identifiers = text.match(/\b(?:[A-Z][a-z]+){2,}\b|\b[a-z]+[A-Z][A-Za-z]+\b|\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g) ?? []
    const novelIdentifier = identifiers.some(name => !question.includes(name) && (!fieldValue || !transactionName(name)))
    const numericComparison = /\bto\s+[\d.,]+%?\s+from\s+[\d.,]+/i.test(text)
    const changeAnswer = /\b(?:change\w*|meeting)\b/i.test(firstFact) && /\b(?:voted|rais(?:e|ed)|reduced|increased|cut)\b/i.test(text) && /\d/.test(text)
    if (/\b(?:I recommend|we recommend|integration recommendation)\b/i.test(text)) return { text, claim, score: 0, ci, si }
    if (/^(?:make |npm |npx |node |python |curl |[A-Z_]+=)/.test(text) && !/\bcommand|CLI|install|invoke\b/i.test(question)) return { text, claim, score: 0, ci, si }
    if (!overlap && !semanticOverlap && !(contextOverlap && (identifier || numericComparison || changeAnswer)) && !(/lead[- ]times?|shorter/i.test(question) && /weeks?/.test(lower) && /\bfrom\b.*\bto\b/.test(lower))) return { text, claim, score: 0, ci, si }
    let score = overlap / Math.max(1, terms.length) * 20 + contextOverlap / Math.max(1, terms.length) * 4
    score += semanticOverlap / Math.max(1, expanded.length) * 8
    score += primary.filter(term => tokens.includes(term)).length / Math.max(1, primary.length) * 12
    if (latest) {
      const year = Math.max(0, ...((text.match(/\b20\d{2}\b/g) ?? claim.text.match(/\b20\d{2}\b/g)) ?? []).map(Number))
      if (year) score += Math.max(0, 20 - (latestYear - year) * 12)
      if (/\b(?:next|scheduled|forecast|projected|expected|planned)\b/i.test(text)) score -= 20
    }
    if (/\bmeeting\b/i.test(firstFact) && /\b(?:vote|voted|members?|meeting)\b/i.test(text)) score += 12
    score += tokens.filter(t => titleTerms.includes(t) && primary.includes(t)).length * 2
    if (causal) {
      if (/\b(?:because|requires?|increases?|adds?|counts?|reserves?|locks?|locked|set aside|held|increment|so that)\b/i.test(text)) score += 20
      if (/\b(?:separate|unrelated|caveat|not.*(?:fee|cost))\b/i.test(text)) score -= 18
    }
    if (/\b(?:cannot be inferred|not evidence of|does not establish)\b/i.test(text)) score -= 20
    if (capability && identifier && /\b(?:until|unless|before|requires?|enables?|permission)\b/i.test(text)) score += 20
    if (capability && /\b(?:can|cannot|must|requires?|enables?|enabled|supports?|allows?|does not|is not)\b/i.test(text)) score += 12
    if (quantity && /\d+(?:[.,]\d+)?\s*(?:XRP|drops?|%|percent|days?|SGD|USD|weeks?)\b/i.test(text)) score += 16
    if (/^when\b/i.test(firstFact) && /\b(?:20\d{2}|before|after|validated|final)\b/i.test(text)) score += 12
    if (eventTerms.some(term => tokens.includes(term))) score += 28
    if (naming && /\b(?:is|means|sets|creates|enables|allows|requires|needs|uses|called|named)\b/i.test(text)) score += 8
    if (!causal && !(fieldValue && transactionName(identifiers[0] ?? '')) && /^(?:[A-Z][a-z]+){2,}\b.{0,40}\b(?:defines|creates|updates|sets|assigns|records|places|redeems|releases|locks)\b/.test(text)) score += 12
    if (named.some(name => text.includes(name))) score += 20
    // Technical questions ask for a named field/type as well as topical prose.
    // Reward identifiers generically, never a bank-specific answer vocabulary.
    if (!causal && /\b(?:field|flag|setting|type|header|transaction|permission|scheme|protocol)s?\b|\b(?:must|need).*\b(?:enable|set)\b/i.test(question) && novelIdentifier) score += 24
    const kind = /^(?:which|what)\b|\b(?:name|called|named)\b/i.test(firstFact) ? firstFact.match(/\b(transaction|scheme|protocol|field|flag|setting|type|header|permission)s?\b/i)?.[1] : undefined
    if (kind && new RegExp(`\\b${kind}s?\\b`, 'i').test(text)) score += 16
    if (/\bwhich transaction\b/i.test(question) && /^(?:The |An? )?[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/.test(text)) score += 16
    if (/\bstatute|law|regulation\b/i.test(question) && /\bAct|statute|law|regulat/i.test(text)) score += 8
    if (/lead[- ]times?|shorter/i.test(question)) score += /\bweeks?\b/.test(lower) ? 12 : 0
    if (/analyst|outlook|margin/i.test(question)) score += /estimate|broker|analyst|consensus/.test(lower) ? 12 : 0
    if (/change|meeting/i.test(firstFact)) score += /policy rate|increase from|\brais(?:e|ed)\b|\bvoted\b/.test(lower) ? 28 : 0
    if (/renewable|electricity|grid/i.test(question)) score += /renewable|\bMW\b|commissioned/.test(text) ? 10 : 0
    if (/\d/.test(text)) score += 2
    if (numericComparison) score += /analyst|outlook|margin/i.test(firstFact) ? 24 : 10
    if (/\bfrom\b.*\bto\b/.test(lower)) score += /lead[- ]times?|shorter/i.test(question) && /weeks?/.test(lower) ? /shorter|shorten|trend|change|improv/i.test(firstFact) ? 50 : 28 : 5
    if (/^(I |My |Here |Speaking |Let me|It |That |These |They |Then )/.test(text)) score -= 12
    if (text.length > 420 || text.length < 30) score -= 8
    return { text, claim, score, ci, si }
  })}).filter(item => item.claim.citations.length && item.score > 0 && item.text.length <= 620 && item.text.split(/\s+/).length <= 40).sort((a, b) => b.score - a.score || a.ci - b.ci || a.si - b.si)
  const first = ranked[0]
  if (!first) return []
  const selected = [first]
  // Include a complementary question term or the adjacent explanation.
  // A complete numeric comparison already states both ends of the change.
  if (!(/lead[- ]times?|shorter/i.test(question) && /\bfrom\b.*\bto\b/i.test(first.text) && /weeks?/i.test(first.text)) || /\band\b|, how/i.test(question)) {
    const missing = terms.filter(term => !words(first.text).includes(term) && ranked.filter(item => words(item.text).includes(term)).length <= Math.max(1, ranked.length / 3))
    const second = ranked.find(item => item.text !== first.text && (missing.some(term => words(item.text).includes(term)) || (/\bfield|flag|setting|type|header|transaction\b/i.test(question) && /[a-z][A-Z]/.test(item.text))) && item.text.length + first.text.length < 620)
    if (second) selected.push(second)
  }
  let remaining = 40
  return selected.flatMap(({ text, claim }) => {
    const count = text.split(/\s+/).length
    if (count > remaining) return []
    remaining -= count
    return [{ text, claim }]
  })
}

/** Omit a repeated claim row only when its displayed sentence is already in the lead.
 * Callers must show the lead claim's stance alongside that sentence.
 */
export function remainingClaims(question: string, claims: Claim[], lead: ReturnType<typeof leadFinding>, delivered?: ContentEnvelope[], candidates: PublicCandidate[] = []): Claim[] {
  return claims.filter(claim => !lead.some(item => item.claim.id === claim.id && item.text === (leadFinding(question, [claim], delivered, undefined, candidates)[0]?.text ?? claim.text)))
}
