import { actionGroups, actionMembers, familyMemberWords, identifierFamily, identifiersIn, identifierWords, isProtocolQuery, memberOf, memberRank, subjectFamilies, subjectRank, titleMatches, topicMatches, topicOverlap, topicWords } from '../../shared/relevance.js'
import { alreadyCovered, entityPrecision, probeMetadata } from './precision.js'
import { searchText } from '../../publisher/search-text.js'
import { setImmediate as yieldToLoop } from 'node:timers/promises'
import { sourceKey } from '../../shared/source-identity.js'
import { factMenuMatch, factMenuMismatch, publicTopicMetadata, scopeContradiction } from './scope-policy.js'
import { activeValueFit, marginalValue } from './value-policy.js'
import { quotedText } from './untrusted.js'
import { loadConfig } from '../config.js'
import { scoreStep } from '../telemetry.js'
import { startActiveObservation } from '@langfuse/tracing'
import { z } from 'zod'
import { CandidateJudgmentSchema, DecisionRoundSchema, PublicCandidateSchema } from '../../shared/contracts/index.js'
import type { CandidateJudgment, ContentEnvelope, CoverageStatus, DecisionProviderName, DecisionRound, PublicCandidate, PublicSourceRef, Requirement, ReputationSummary } from '../../shared/contracts/index.js'
import { FIXTURE_GAP_RULES, fixtureCoverage, splitClauses, type CoverageEvidence } from './requirements.js'
import { NEWCOMER } from '../reputation.js'
import { askedKind } from '../../shared/answer-entity.js'
import { compareTieBreak } from './tie-break.js'
import { activeCalibrator, calibrate, roundCalibration } from './calibration.js'

/** Every live call takes the round's abort signal (#206): when one call fails the round, its siblings stop. */
type Signal = { signal?: AbortSignal }
export interface DecisionProvider {
  name: DecisionProviderName
  model: string
  /** The question wording and option order this provider sends, recorded on each round (#214). */
  promptVersion?: string
  judgeRound(input: { question: string; conclusion: string; gap: string } & Signal): Promise<{ gapMaterial: number }>
  judgeCandidate(input: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate } & Signal): Promise<CandidateJudgment>
  /**
   * One request for the whole round (#214, "batch-evidence"): the gap question plus three questions per candidate.
   * Judgments come back in `candidates` order. When present, decideRound uses it instead of the per-call path.
   */
  judgeBatch?(input: { question: string; conclusion?: string; gap: string; readSources: PublicSourceRef[]; candidates: PublicCandidate[]; skipGapMaterial?: boolean } & Signal): Promise<{ gapMaterial?: number; judgments: CandidateJudgment[] }>
  /** Calibration (#141): does a granted paid body address the gap? Called only after a verified grant (gate 1). */
  judgePaidRelevance?(input: { question: string; gap: string; content: ContentEnvelope } & Signal): Promise<{ observed: number }>
  /**
   * Requested-fact coverage (#208, #213): one multi-question request per evidence state, one choice question per
   * requirement over free or verified-granted passages only (gate 1). A missing or malformed entry is `unknown`.
   */
  judgeCoverage?(input: CoverageInput & Signal): Promise<Record<string, CoverageStatus>>
}
export type CoverageInput = { question: string; requirements: Pick<Requirement, 'id' | 'text'>[]; evidence: CoverageEvidence[] }
const SourceRefSchema = PublicCandidateSchema.pick({ source: true, resourceId: true, version: true, title: true, publisher: true, family: true, facets: true })
// W3-LIVE: both matched tables selected the grid report; retain flash for latency.
// Flash grid value reached 0.1743 while the live supplier maximum was 0.0508.
// Use 0.15 for flash; fixture stays 0.20 and larger Clef stays 0.35.
export const CLEF_DECISION_MODEL = '@cf/cloudflare/clef-flash'
export const OPENAI_DECISION_MODEL = 'gpt-6-luna'
/**
 * The model for a live provider. `DECISION_MODEL` applies only when it names that provider's kind of model
 * (`@cf/…` for Cloudflare), so `DECISION_PROVIDER=cloudflare` alone is the one-line revert (#214).
 */
export function decisionModel(provider: 'cloudflare' | 'openai' = 'cloudflare', configured: string | undefined = loadConfig().DECISION_MODEL): string {
  const cloudflareModel = Boolean(configured?.startsWith('@cf/'))
  if (provider === 'openai') return configured && !cloudflareModel ? configured : OPENAI_DECISION_MODEL
  return configured && cloudflareModel ? configured : CLEF_DECISION_MODEL
}
export const publicCandidate = (input: unknown): PublicCandidate => {
  const c = PublicCandidateSchema.omit({ manifest: true, wallet: true, url: true, verification: true }).parse(input)
  // Retain structured public signing metadata for local menu verification across
  // policy/provider projections. clefCandidate never sends the manifest or wallet.
  const signing = PublicCandidateSchema.pick({ manifest: true, wallet: true }).safeParse(input)
  return { ...c, ...(signing.success ? signing.data : {}), profileId: quotedText(c.profileId, 160) || '[omitted]',
    resourceId: quotedText(c.resourceId, 160) || '[omitted]', version: quotedText(c.version, 80) || '[omitted]',
    ...(c.derivedFrom ? { derivedFrom: quotedText(c.derivedFrom, 160) } : {}),
    ...(c.publisherSlug ? { publisherSlug: quotedText(c.publisherSlug, 160) } : {}),
    ...(c.writerSlug ? { writerSlug: quotedText(c.writerSlug, 160) } : {}), title: quotedText(c.title, 200) || '[untrusted title omitted]',
    publisher: quotedText(c.publisher, 120) || '[untrusted publisher omitted]',
    preview: quotedText(c.preview, 1200) || '[untrusted abstract omitted]',
    family: quotedText(c.family, 160) || '[untrusted family omitted]',
    facets: c.facets.slice(0, 16).map(t => quotedText(t, 80)).filter(Boolean),
    license: { kind: quotedText(c.license.kind, 80), attribution: quotedText(c.license.attribution, 200) } }
}
export const publicSources = (input: unknown): PublicSourceRef[] => z.array(SourceRefSchema).parse(input).slice(0, 50).map(s => ({
  ...s, resourceId: quotedText(s.resourceId, 160) || '[omitted]', version: quotedText(s.version, 80) || '[omitted]', title: quotedText(s.title, 200) || '[untrusted title omitted]',
  publisher: quotedText(s.publisher, 120) || '[untrusted publisher omitted]',
  family: quotedText(s.family, 160) || '[untrusted family omitted]',
  facets: s.facets.slice(0, 16).map(t => quotedText(t, 80)).filter(Boolean),
}))
// Words that say nothing about which evidence a gap needs.
const STOP = new Set(['accessible', 'evidence', 'source', 'sources', 'about', 'their', 'there', 'which', 'what', 'with', 'from', 'that', 'this', 'whether', 'still', 'missing', 'figures', 'dated', 'data'])
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3 && !STOP.has(word)) ?? [])
/** Share of the gap a candidate's public fields address: two matching content words count as fully addressed. */
export const textOverlap = (gap: string, text: string) => {
  const own = words(text)
  return Math.min(1, [...words(gap)].filter(word => own.has(word)).length / 2)
}
export const gapOverlap = (gap: string, candidate: PublicCandidate) => {
  const text = `${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`
  const semantic = /\b(?:XRPL|XRP|x402|RLUSD|escrow\w*|credentials?|trustset|DID(?:Set|Delete)?|AMM\w*|prompt.inject\w*)\b/i.test(gap)
    ? Math.min(1, topicOverlap(gap, text) * topicWords(gap).length / 2) : 0
  return Math.max(textOverlap(gap, text), semantic)
}
/**
 * The question's named entities: capitalised words after the first, and acronyms ("Kestrel", "Semiconductor",
 * "Malaysia", "TSMC"). Possessives split off ("Semiconductor's" → "semiconductor").
 */
export const questionEntities = (question: string) => {
  const tokens = searchText(question).match(/[A-Za-z][A-Za-z0-9-]*/g) ?? []
  return new Set(tokens.filter((token, index) => (index > 0 && /^[A-Z]/.test(token)) || /^[A-Z0-9]{2,}$/.test(token)).map(token => token.toLowerCase()))
}
/**
 * Share of the question's named entities a candidate's public fields name: two matches (or all, when fewer) count as
 * fully on-entity; a question with no named entity scores 1. A generic post that shares only the gap's words scores 0.
 */
export const entityOverlap = (question: string, candidate: PublicCandidate) => {
  const entities = questionEntities(question)
  if (!entities.size) return 1
  const ownText = `${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`
  const own = new Set(searchText(ownText).toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [])
  const normalized = new Set(topicWords(ownText))
  return Math.min(1, [...entities].filter(entity => own.has(entity) || isProtocolQuery(question) && topicWords(entity).every(t => normalized.has(t)) || entity === 'xrp' && own.has('xrpl') || entity === 'xrpl' && own.has('xrp')).length / Math.min(2, entities.size))
}
/**
 * A protocol question's own explainer: the candidate's public title states (part of) the question (H8-01, H8-05).
 * Finance questions keep value order: their titles share company and place names, which entity precision already
 * weighs, and the story-bible decisions (UC1–UC3) depend on value.
 */
const titledWithQuestion = (question: string, candidate: Pick<PublicCandidate, 'title'>) => isProtocolQuery(question) && titleMatches(question, candidate.title)
/** Words that name no particular subject: a fact naming only these says nothing a title could add. */
const GENERIC = new Set(['xrpl', 'xrp', 'ledger', 'payment', 'transaction', 'account', 'token', 'asset', 'field', 'type', 'testnet'])
/**
 * R9-A (H9-01): the public titles of the articles a run bought name every clause of its question. Each clause with two
 * or more subject words ("Can an XRPL escrow hold RLUSD today" → escrow, hold, rlusd; "what must the issuer enable before
 * a buyer can lock it" → issuer, enable, buyer, lock) has at least half of them in the titles together. A clause with one
 * word ("what happens to my money") asks about no subject a title could name and is skipped; at least one must count.
 * "How do XRPL AMM pools set their trading fee, and who can vote to change it?" is not named by the AMMCreate title
 * alone (no "vote"), so the AMMVote reference can still follow. A question that asks for a named thing ("Which
 * transaction type creates or modifies a permissioned domain?") is left to R8-A2's per-purchase rule: a title naming
 * its subject (PermissionedDomainDelete, the DID explainer) is not yet the member it asks for. Public titles only.
 */
const ASKS_FOR_NAME = /\bwhich\b|\b(?:transaction|field|flag|type|amendment|setting|header|scheme)s?\b/i
export function titlesNameQuestion(question: string, titles: string[]): boolean {
  if (!titles.length || ASKS_FOR_NAME.test(question)) return false
  // A leading acronym is split as identifierWords does (AMMVote → amm, vote); topicWords alone keeps "ammvote".
  const own = new Set(titles.flatMap(title => topicWords(title.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'))))
  // A clause's subject words, or all its words when it names fewer than two beyond the network ("can my agent pay it with XRP
  // on Testnet" → pay, xrp, testnet): the XRP-on-Testnet explainer still follows the 402 response explainer.
  const clauses = splitClauses(question).map(clause => {
    const words = topicWords(clause).filter(word => !/^\d+$/.test(word)), subject = words.filter(word => !GENERIC.has(word))
    return subject.length >= 2 ? subject : words
  }).filter(words => words.length >= 2)
  return clauses.length > 0 && clauses.every(words => words.filter(word => own.has(word)).length / words.length >= 0.5)
}
/** Some clause of the question asks for a transaction ("…, and which transactions create and accept one?"). */
const clausesAskTransaction = (question: string) => splitClauses(question).some(clause => askedKind(clause) === 'transaction')
const metadataWords = (candidate: Pick<PublicCandidate, 'title' | 'facets'>) => new Set(topicWords(`${candidate.title} ${candidate.facets.join(' ')}`))
const MEASURES = /\b(?:fees?|costs?|reserves?|pric(?:e|es|ing)|drops)\b/gi
const UNIT = /\b(?:drops|XRP|SGD|USD|percent)\b|S\$|%/
const measureOf = (word: string) => word.toLowerCase().replace(/^pric(?:e|es|ing)$/, 'price').replace(/s$/, '')
/**
 * H9-06: 2 when a "how much" question's measure (fee, cost, reserve, price, drops) is in the title with a unit, 1 without
 * one, else 0. "Cost" is answered by a fee or a price ("How much does EscrowFinish with a fulfillment cost?").
 */
export function measureRank(question: string, title: string): number {
  if (!/\bhow (?:much|many)\b/i.test(question)) return 0
  const asked = new Set((question.match(MEASURES) ?? []).map(measureOf).flatMap(measure => measure === 'cost' ? ['cost', 'fee', 'price'] : [measure]))
  if (!asked.size || !(title.match(MEASURES) ?? []).some(word => asked.has(measureOf(word)))) return 0
  return UNIT.test(title) ? 2 : 1
}
/**
 * A fact that asks for a named thing (which transaction, the issuer flag, what a holder must submit) rather than an
 * explanation ("what a Credential proves", "how to make an escrow release").
 */
const asksForName = (fact: string) => /\bwhich\b|\b(?:transaction|field|flag|type|amendment|setting|header|scheme|submit)s?\b/i.test(fact)
export const REPEATS_PURCHASES = 'Its title and topics name no part of the requested fact that a bought article does not already name.'
/**
 * R8-A2, fixture judge only: a further purchase for a protocol question must add part of the requested fact that no
 * verified purchase of this run already names in its public title or topics. The fixture coverage judge needs a
 * figure or an exact identifier in a cited passage, so it graded "How do I make an XRPL escrow release only when a
 * secret is revealed" missing after the crypto-condition explainer was bought, and the run bought two more generic
 * escrow references that named nothing the first did not. Two things count as new:
 * - a word of the fact that no purchase names ("accept" in the CredentialAccept reference after CredentialCreate);
 * - a protocol identifier in the title, related to the fact by its glossary family or a shared word, that no purchase
 *   names. For a fact asking for a named thing, any member of the family counts unless the fact already names the
 *   members it wants (the TrustSet reference after the trust-line explainer for "What must a holder submit before an
 *   account can receive an issued token", whose answer is that identifier; not CredentialDelete for "which
 *   transactions create and accept one"). For any other fact it counts only while no purchase names a member of that
 *   family (SignerListSet after the multi-signing explainer; not EscrowCreate after an article naming EscrowFinish).
 * A first purchase is never affected, and a live judge decides unaided. Story-bible cue rules keep their own tests.
 */
function repeatsPurchases(provider: DecisionProvider, input: Pick<DecideInput, 'question' | 'gap' | 'requirement' | 'verifiedPurchases'>, candidate: Pick<PublicCandidate, 'title' | 'facets'>): boolean {
  if (provider.name !== 'fixture' || !input.requirement || !input.verifiedPurchases?.length || !isProtocolQuery(input.question) || FIXTURE_GAP_RULES.some(rule => rule.cue.test(input.gap))) return false
  // QUAL: once the bought titles and topics name a member for every verb the fact asks for (EscrowFinish and EscrowCancel
  // for "release or return"), any further article only repeats them.
  const groups = askedKind(input.gap) === 'transaction' ? actionGroups(input.gap) : []
  const boughtMembers = new Set(input.verifiedPurchases.flatMap(bought => identifiersIn(`${bought.title} ${bought.facets.join(' ')}`).map(memberOf)))
  if (groups.length && groups.every(group => group.some(m => boughtMembers.has(m)))) return true
  const named = new Set(input.verifiedPurchases.flatMap(bought => [...metadataWords(bought)]))
  const own = metadataWords(candidate)
  // QUAL: a fact's verbs name the members it wants ("release or return" → finish, cancel), as its own words do.
  const asked = askedKind(input.gap) === 'transaction' ? actionMembers(input.gap) : new Set<string>()
  if ([...topicWords(input.gap), ...asked].some(word => !/^\d+$/.test(word) && !GENERIC.has(word) && own.has(word) && !named.has(word))) return false
  const namedIds = new Set(input.verifiedPurchases.flatMap(bought => identifiersIn(`${bought.title} ${bought.facets.join(' ')}`)).map(id => id.toLowerCase()))
  const namedFamilies = new Set<string | undefined>([...namedIds].map(identifierFamily))
  const factFamilies = new Set(subjectFamilies(input.gap).map(group => group[0] as string))
  const factWords = new Set([...topicWords(input.gap).filter(word => !GENERIC.has(word)), ...asked])
  return !identifiersIn(candidate.title).some(id => {
    if (namedIds.has(id.toLowerCase())) return false
    // QUAL: another member than the one the fact's verbs ask for adds nothing (PermissionedDomainDelete for "creates or
    // modifies", EscrowCreate for "release or return").
    const member = memberOf(id)
    if (asked.size && member && !asked.has(member)) return false
    const family = identifierFamily(id)
    // Related to the fact through its glossary family (TrustSet for an issued token) or a shared word (PermissionedDomainSet).
    // R8-A3: a shared word that is the name of a family a purchase already covers adds nothing. "Which XRPL transactions
    // finish or cancel an escrow?" bought the EscrowFinish and EscrowCancel references, then TokenEscrow only for its
    // word "escrow". A word no family owns (PermissionedDomainSet's "domain") still counts.
    if (!family) return identifierWords(id).some(word => factWords.has(word) && !namedFamilies.has(word))
    if (!factFamilies.has(family)) return false
    // A fact that names the members it wants ("which transactions create and accept one") already got any of them
    // through the word check above; another member (CredentialDelete) is not its answer.
    if (asksForName(input.gap)) return ![...familyMemberWords(family)].some(word => factWords.has(word))
    return !namedFamilies.has(family)
  })
}
/**
 * H9-08: a technical question that names no glossary family but names a place or organisation ("Which XRPL validators
 * are run by Singapore banks?") is on a candidate's topic only when the candidate's title and topics name that entity
 * and one more of the question's subject words. One shared word let the Singapore regulation explainer (Singapore) and
 * the validation-quorum article (validators) each pass for a question neither answers, and the run paid S$0.80 for it.
 * Questions with a family, or with no such entity ("What is the XRPL base reserve today…?"), keep their rule.
 */
function namesEntityAndSubject(question: string, candidate: Pick<PublicCandidate, 'title' | 'facets'>): boolean {
  if (subjectFamilies(question).length) return true
  const entities = new Set([...questionEntities(question)].filter(entity => !GENERIC.has(entity)).flatMap(entity => topicWords(entity)))
  if (!entities.size) return true
  const own = metadataWords(candidate)
  const subjects = topicWords(question).filter(word => !GENERIC.has(word) && !/^\d+$/.test(word) && !entities.has(word))
  return [...entities].some(word => own.has(word)) && (!subjects.length || subjects.some(word => own.has(word)))
}
/**
 * R9-A: an article whose title alone names every clause of the question (titlesNameQuestion) is the question's own
 * article, like one titled with it, whatever wording the planner gave the requested fact. "If my agent pays for an
 * article and the writer never reveals the key, what happens to my money?" names no protocol family, and a live plan
 * whose first fact was "How key-reveal payment works…" refused "How do I recover funds when a writer never reveals the
 * escrow key?" for want of the words "key reveal", then bought the key-reveal delivery note instead. Requested facts of
 * a protocol question or fact only; never a story-bible question.
 */
const namesWholeQuestion = (input: Pick<DecideInput, 'question' | 'gap' | 'requirement'>, candidate: Pick<PublicCandidate, 'title'>) =>
  Boolean(input.requirement) && isProtocolQuery(`${input.question} ${input.gap}`) && !FIXTURE_GAP_RULES.some(rule => rule.cue.test(input.question)) && titlesNameQuestion(input.question, [candidate.title])
function purchaseTopicMatches(input: Pick<DecideInput, 'question' | 'gap' | 'requirement'>, candidate: PublicCandidate): boolean {
  // H8-05: for a protocol question, an article titled with the question is on topic whatever wording the planner
  // gave the requested fact, so the same question admits the same article on every run.
  if (titledWithQuestion(input.question, candidate) || namesWholeQuestion(input, candidate)) return true
  if (input.requirement && isProtocolQuery(`${input.question} ${input.gap}`)) {
    if (isProtocolQuery(input.question) && !namesEntityAndSubject(input.question, candidate)) return false
    const own = `${candidate.title} ${candidate.facets.join(' ')}`
    // A requested fact that names only a qualifier ("can my agent pay it with XRP on Testnet") keeps the question's
    // subject: a Testnet server list does not answer a question about paying an x402 response (H8-01).
    return topicMatches(input.gap, own) && (subjectFamilies(input.gap).length > 0 || !subjectFamilies(input.question).length || topicMatches(input.question, own))
  }
  const metadata = publicTopicMetadata(candidate)
  if (topicMatches(input.question, metadata) || topicMatches(input.gap, metadata)) return true
  const own = new Set(topicWords(metadata))
  return Boolean(input.requirement && factMenuMatch(input.gap, candidate) && topicWords(`${input.question} ${input.gap}`).filter(word => !/^\d+$/.test(word) && own.has(word)).length >= 2)
}

/**
 * Generic metadata heuristics, with no named-source or hidden corpus knowledge.
 * addressesGap = word/tag overlap with the gap × (0.5 + 0.5 × named-entity overlap with the question) × the hit's
 * claimed relevance (a promise that calibration later checks); originality from family/derivedFrom; credibility
 * from the publisher kind (carried as `authority`). Price never enters.
 */
export class FixtureDecisionProvider implements DecisionProvider {
  readonly name = 'fixture' as const
  readonly model = 'metadata-fixture'
  /** Calibration fixture: word overlap between the gap and the granted body. */
  async judgePaidRelevance({ gap, content }: { question: string; gap: string; content: ContentEnvelope }) {
    return { observed: gap.trim() ? textOverlap(gap, content.spans.map(s => s.text).join(' ')) : 0 }
  }
  async judgeRound({ gap }: { question: string; conclusion: string; gap: string }) {
    return { gapMaterial: gap.trim() ? 0.9 : 0 }
  }
  /** Coverage fixture: the story-bible cue rules, else entity or word overlap with a figure (requirements.ts). */
  async judgeCoverage({ requirements, evidence }: CoverageInput) {
    return fixtureCoverage(requirements, evidence)
  }
  async judgeCandidate({ question, gap, readSources, candidate: raw }: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate }): Promise<CandidateJudgment> {
    const candidate = publicCandidate(raw)
    const sources = publicSources(readSources)
    const rewrite = Boolean(candidate.derivedFrom)
    const repeated = sources.some(source => source.family === candidate.family)
    return {
      // On the gap's words AND the question's entities: UC3 round 2 prefers the Kestrel/Penang deep-dive over a generic lead-times post.
      addressesGap: gap.trim() ? Math.max(0.05, gapOverlap(gap, candidate)) * (0.5 + 0.5 * entityOverlap(question, candidate)) * (candidate.relevance ?? 1) : 0,
      originality: rewrite ? { original: 0.02, rewrite: 0.96, overlap: 0.02 } : repeated ? { original: 0.05, rewrite: 0.05, overlap: 0.9 } : { original: 0.9, rewrite: 0.03, overlap: 0.07 },
      credibility: candidate.authority,
    }
  }
}
export type DecideInput = {
  question: string; conclusion: string; gap: string
  candidates: PublicCandidate[]; readSources: PublicSourceRef[]
  budgetMinor: number; spentMinor: number; reservedMinor: number; perSourceCapMinor: number
  round: number; provider?: DecisionProvider; threshold?: number; boughtResourceIds?: string[]
  /** Only free or verified-granted content, passed locally by the run's grant accessor; never added to provider input. */
  accessibleEvidence?: ContentEnvelope[]
  /** Trust by publisher wallet (D6, D21). A wallet with no entry is a newcomer. */
  reputation?: Record<string, ReputationSummary>
  /** Wallets with no sale, reservation, or earlier probe, read from the durable ledger. */
  probeWallets?: string[]
  /** Abandons the round from outside (e.g. Stop); the round's own controller also aborts siblings on the first failure (#206). */
  signal?: AbortSignal
  /**
   * The gap is a frozen requested fact (#208): derived from the question and clarify answers before any evidence, so
   * it is part of what the question asks by construction. gapMaterial is 1 and the model is not asked (the live
   * gap_material score swung 0.06–0.94 on on-question gaps and dropped right articles under the threshold).
   */
  requirement?: boolean
  /** Public metadata of the articles this run has bought and verified; the run's own record, never paid text. */
  verifiedPurchases?: Pick<PublicCandidate, 'title' | 'facets'>[]
  /** The run's other requested facts still open (QUAL): an article on their topic too ranks first among equals. */
  otherFacts?: string[]
}
/** Raw-score buy thresholds per model. gpt-6-luna runs raw at 0.20 with no calibrator (#214): never the benchmark's calibrated 0.05. */
export function buyThreshold(model: string, configured: unknown = loadConfig().BUY_THRESHOLD): number {
  const value = configured === undefined || configured === '' ? (model.endsWith('/clef') ? 0.35 : model.endsWith('/clef-flash') ? 0.15 : 0.20) : Number(configured)
  return z.number().min(0).max(1).parse(value)
}
/**
 * A live decision provider failed (timeout, HTTP error, daily quota, refusal, invalid answer). Decision 2 (8 Oct, #197):
 * the round fails and nothing is bought; the word-overlap fixture is never substituted for a live provider.
 */
export class DecisionUnavailableError extends Error {
  constructor(readonly status: string) { super(`Decision model unavailable (${status})`) }
}
/** A short, secret-free status: the provider's status when it gave one, otherwise the failure class. */
export function decisionFailureStatus(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status === 'string' && /^[\w .-]{1,40}$/.test(status)) return status
  return error instanceof z.ZodError ? 'invalid response' : 'provider error'
}
/** The SKIP_NO_GAP reason when the gap is empty: policy decides without asking any model (#214). */
export const NO_GAP_NOT_CALLED = 'no open gap — decision model not called'
/** Placeholder judgment for rows the model never saw (empty gap): every probability 0, so value is 0. */
const NOT_JUDGED: CandidateJudgment = { addressesGap: 0, originality: { original: 0, rewrite: 0, overlap: 0 }, credibility: 0 }
const GapMaterialSchema = z.object({ gapMaterial: z.number().min(0).max(1) })
/** Traced as a chain: the provider's generations nest inside; the output is the full verdict table. */
export function decide(input: DecideInput): Promise<DecisionRound> {
  return startActiveObservation('decide-purchase', async observation => {
    observation.update({ input: { round: input.round, gap: input.gap, remainingMinor: input.budgetMinor - input.spentMinor - input.reservedMinor, capMinor: input.perSourceCapMinor } })
    const live = Boolean(input.provider && input.provider.name !== 'fixture' && input.gap.trim())
    let round: DecisionRound
    try { round = await decideRound(input) } catch (error) {
      if (error instanceof DecisionUnavailableError) {
        scoreStep('decision-unavailable', true, error.status)
        // The refusal rate (#214): a refusal fails the round like any other failure, and is counted on its own.
        if (live) scoreStep('decision-refusal', error.status === 'refusal')
        observation.update({ level: 'ERROR', statusMessage: error.message })
      }
      throw error
    }
    if (input.provider) scoreStep('decision-unavailable', false)
    if (live) scoreStep('decision-refusal', false)
    scoreStep('gap-material', round.gapMaterial, round.gap)
    observation.update({ output: { provider: round.provider, model: round.model, promptVersion: round.promptVersion ?? null, gapMaterial: round.gapMaterial, threshold: round.threshold, selected: round.selectedResourceId ?? null, calibration: round.calibration ?? null, rows: round.rows.map(r => ({ resourceId: r.candidate.resourceId, priceMinor: r.candidate.price.amountMinor, addressesGap: r.judgment.addressesGap, original: r.judgment.originality.original, ...(r.calibrated ? { calibratedAddressesGap: r.calibrated.addressesGap, calibratedOriginal: r.calibrated.original } : {}), credibility: r.judgment.credibility, value: r.value, verdict: r.verdict })) } })
    return round
  }, { asType: 'chain' })
}
/**
 * The model's view of the round. Batch providers get one request; the rest one round call plus one call per candidate,
 * in parallel. Every answer is validated, and any failure fails the round (#197). One AbortController per round (#206):
 * the first failure, or the caller abandoning the round, aborts every sibling still in flight.
 */
async function judgeAll(provider: DecisionProvider, input: DecideInput, candidates: PublicCandidate[], readSources: PublicSourceRef[]): Promise<{ gapMaterial: number; judgments: CandidateJudgment[] }> {
  const controller = new AbortController()
  const abandon = () => controller.abort()
  if (input.signal?.aborted) abandon()
  input.signal?.addEventListener('abort', abandon, { once: true })
  const { signal } = controller
  const failRound = (error: unknown): never => { controller.abort(); throw error }
  try {
    const fixed = input.requirement ? { gapMaterial: 1 } : undefined
    // Nothing left to ask: a requested fact with no paid candidate makes no model call.
    if (fixed && !candidates.length) return { gapMaterial: 1, judgments: [] }
    if (provider.judgeBatch) {
      const result = await provider.judgeBatch({ question: input.question, ...(input.requirement ? {} : { conclusion: input.conclusion }), gap: input.gap, readSources, candidates: candidates.map(publicCandidate), signal, ...(fixed ? { skipGapMaterial: true } : {}) })
      return { gapMaterial: fixed?.gapMaterial ?? GapMaterialSchema.parse(result).gapMaterial, judgments: z.array(CandidateJudgmentSchema).length(candidates.length).parse(result.judgments) }
    }
    const [{ gapMaterial }, judgments] = await Promise.all([
      fixed ? Promise.resolve(fixed) : provider.judgeRound({ question: input.question, conclusion: input.conclusion, gap: input.gap, signal }).then(result => GapMaterialSchema.parse(result)).catch(failRound),
      Promise.all(candidates.map(candidate => provider.judgeCandidate({ question: input.question, gap: input.gap, readSources, candidate: publicCandidate(candidate), signal }).then(result => CandidateJudgmentSchema.parse(result)).catch(failRound))),
    ])
    return { gapMaterial, judgments }
  } catch (error) {
    controller.abort()
    throw new DecisionUnavailableError(input.signal?.aborted ? 'abandoned' : decisionFailureStatus(error))
  } finally { input.signal?.removeEventListener('abort', abandon) }
}
async function decideRound(input: DecideInput): Promise<DecisionRound> {
  // Zod strips every unknown property, including body, spans, and injected commands.
  const candidates = z.array(PublicCandidateSchema).parse(input.candidates).filter(candidate => candidate.tier === 'PAID')
  const readSources = publicSources(input.readSources)
  const remaining = z.number().int().nonnegative().parse(input.budgetMinor) - z.number().int().nonnegative().parse(input.spentMinor) - z.number().int().nonnegative().parse(input.reservedMinor)
  const cap = z.number().int().nonnegative().parse(input.perSourceCapMinor)
  const provider: DecisionProvider = input.provider ?? new FixtureDecisionProvider()
  // An empty gap makes no model call for any provider (#214): nothing is worth buying, and Luna refused or scored it 0.87.
  const covered = alreadyCovered(input.gap, input.accessibleEvidence ?? [])
  const open = input.gap.trim().length > 0 && !covered
  const { gapMaterial, judgments } = open ? await judgeAll(provider, input, candidates, readSources) : { gapMaterial: 0, judgments: candidates.map(() => NOT_JUDGED) }
  // H8-05, fixture judge only: a protocol question's own explainer is also scored against the question, and the higher
  // score counts, so the planner's wording of the fact cannot drop it under the bar (A3 scored 0.197 against 0.20).
  // The threshold is unchanged; a live judge already reads the question with every candidate.
  if (open && provider.name === 'fixture' && input.gap !== input.question) {
    for (const [index, candidate] of candidates.entries()) {
      if (!titledWithQuestion(input.question, candidate)) continue
      const asked = await provider.judgeCandidate({ question: input.question, gap: input.question, readSources, candidate: publicCandidate(candidate) })
      if (asked.addressesGap > judgments[index].addressesGap) judgments[index] = { ...judgments[index], addressesGap: asked.addressesGap }
    }
  }
  // #207: a versioned calibrator for this exact (provider, model, prompt version), only with DECISION_CALIBRATION=on.
  // Its threshold is on the calibrated scale; an explicit threshold still wins, and BUY_THRESHOLD (raw scale) never applies to it.
  const calibrator = open && provider.name !== 'compatible' ? activeCalibrator(provider) : undefined
  const threshold = calibrator && input.threshold === undefined ? calibrator.buyThreshold : buyThreshold(provider.model, input.threshold)
  const acquired = new Set([...input.readSources.map(source => source.source ? sourceKey(source) : source.resourceId), ...(input.boughtResourceIds ?? [])])
  const valueFit = provider.name === 'compatible' ? undefined : activeValueFit(provider)
  const useValuePolicy = input.requirement && input.accessibleEvidence !== undefined && process.env.DECISION_VALUE_POLICY !== 'off'
  const rows: DecisionRound['rows'] = []
  for (const [index, candidate] of candidates.entries()) {
    if (index % 4 === 0) await yieldToLoop()
    const judgment = judgments[index]
    // Trust can only lower value (T ∈ [0, 1]); it never touches the budget or the cap.
    const reputation = input.reputation && candidate.wallet ? input.reputation[candidate.wallet] ?? NEWCOMER : undefined
    const trust = reputation ? Math.min(1, Math.max(0, reputation.T)) : 1
    const calibrated = calibrator ? calibrate(calibrator, judgment) : undefined
    const value = gapMaterial * (calibrated?.addressesGap ?? judgment.addressesGap) * (calibrated?.original ?? judgment.originality.original) * (0.5 + 0.25 * judgment.credibility) * trust
    const marginal = useValuePolicy ? marginalValue({ candidate, evidence: input.accessibleEvidence!, probability: judgment.addressesGap, trust, model: valueFit?.model, minFactsPerDollar: valueFit?.minFactsPerDollar }) : undefined
    const price = candidate.price.amountMinor
    const probe = open && input.probeWallets?.includes(candidate.wallet ?? '') && probeMetadata(input.question, candidate, input.candidates[0])
    // A zero-price PAID resource ranks by value, avoiding Infinity in JSON.
    const valuePerDollar = value / (Math.max(price, 1) / 100)
    // With no model call, a rewrite is known from its public metadata only (derivedFrom, set by retrieval for a shared family).
    // Always the RAW originality (#207): a calibrator that lifts P(original) can never let a rewrite through.
    const rewrite = open ? judgment.originality.rewrite >= judgment.originality.original : Boolean(candidate.derivedFrom)
    let verdict: DecisionRound['rows'][number]['verdict'] = 'BUY'
    let reason = 'Clears the value threshold and spending policy.'
    // A rewrite is labelled as one even when no gap is open (story bible UC1).
    if (provider.name === 'compatible') { verdict = 'SKIP_LOW_VALUE'; reason = 'UNCALIBRATED generic judge: purchases disabled.' }
    else if (reputation && reputation.status !== 'active') { verdict = 'SKIP_LOW_TRUST'; reason = `Publisher ${reputation.status}: never bought or cited.` }
    else if (acquired.has(candidate.source ? sourceKey(candidate) : candidate.resourceId) || (candidate.derivedFrom && acquired.has(candidate.derivedFrom)) || rewrite) { verdict = 'SKIP_REWRITE'; reason = 'Already acquired or a rewrite of existing evidence.' }
    else if (!open) { verdict = 'SKIP_NO_GAP'; reason = covered ? 'Earlier delivered evidence already covers this gap; no further purchase.' : NO_GAP_NOT_CALLED }
    else if (gapMaterial === 0) { verdict = 'SKIP_NO_GAP'; reason = 'No material open gap.' }
    else if (!purchaseTopicMatches(input, candidate)) { verdict = 'SKIP_LOW_VALUE'; reason = 'The article title and topics do not cover the requested subject.' }
    else if (process.env.DECISION_SCOPE_POLICY !== 'off' && input.requirement && scopeContradiction(input.gap, candidate)) { verdict = 'SKIP_LOW_VALUE'; reason = 'Public source scope contradicts the requested country; model confidence cannot authorize this purchase.' }
    else if (price > cap) { verdict = 'SKIP_OVER_CAP'; reason = 'Price exceeds the per-source cap.' }
    else if (value < threshold && !probe) { verdict = 'SKIP_LOW_VALUE'; reason = 'Value is below the model threshold.' }
    else if (process.env.R8A2_MARGINAL !== 'off' && repeatsPurchases(provider, input, candidate)) { verdict = 'SKIP_LOW_VALUE'; reason = REPEATS_PURCHASES }
    else if (process.env.DECISION_NUMBERS_POLICY !== 'off' && input.requirement && factMenuMismatch(input.gap, candidate)) { verdict = 'SKIP_LOW_VALUE'; reason = 'Signed fact menu does not offer the requested fact key and entity/period scope.' }
    else if (marginal && !marginal.eligible) { verdict = 'SKIP_LOW_VALUE'; reason = `Expected missing facts per S$ ${marginal.factsPerDollar.toFixed(3)} < ${marginal.threshold.toFixed(3)} (covered menu entries ${marginal.coveredEntries}/${marginal.menuEntries}).` }
    else if (price > remaining || input.budgetMinor === 0) { verdict = 'SKIP_OVER_BUDGET'; reason = input.budgetMinor === 0 ? 'Would buy with a sufficient budget; S$0 authorizes no purchase.' : 'Price exceeds the remaining budget.' }
    if (verdict === 'BUY' && probe && value < threshold) reason = 'probe purchase · new writer'
    rows.push({ ...(verdict === 'BUY' && probe && value < threshold ? { probe: true } : {}), candidate, judgment, value, valuePerDollar, verdict, reason, wouldBuy: verdict === 'BUY' || (input.budgetMinor === 0 && verdict === 'SKIP_OVER_BUDGET'), ...(reputation ? { reputation } : {}), ...(calibrated ? { calibrated } : {}), ...(marginal ? { marginalValue: { ...marginal, ...(valueFit ? { fitVersion: valueFit.version } : {}) }, reason: verdict === 'BUY' ? `Expected missing facts per S$ ${marginal.factsPerDollar.toFixed(3)} >= ${marginal.threshold.toFixed(3)}; spending policy clears.` : reason } : {}) })
  }
  // Order among eligible rows: a protocol question's own explainer first (H8-05: it depends only on the question, so
  // repeated runs agree), then subject specificity, then entity precision, then value per dollar; equal value per dollar takes a neutral hash
  // order (#204), never alphabetical and never the claimed relevance. Only BUY rows are ordered: nothing here can
  // make an ineligible article eligible.
  const titled = (row: DecisionRound['rows'][number]) => titledWithQuestion(input.question, row.candidate) || namesWholeQuestion(input, row.candidate) ? 1 : 0
  // H9-06: a "how much" question first prefers a title naming what it measures (fee, cost, reserve, price), more so with
  // the answer's unit (XRP drops, SGD): "EscrowFinish fulfillment fees: XRP drops and SGD prices" before the key-reveal
  // delivery note for "How much does one key-reveal purchase cost in XRPL network fees?".
  const measure = (row: DecisionRound['rows'][number]) => measureRank(input.question, row.candidate.title)
  // Then a specific subject family before a broad one (H8-01): a payment-channel explainer before a finality article
  // for a micropayment question that mentions settling. Protocol questions only, like the title rule.
  const subjectOf = subjectFamilies(input.gap).length ? input.gap : input.question
  const subject = (row: DecisionRound['rows'][number]) => isProtocolQuery(input.question) ? subjectRank(subjectOf, `${row.candidate.title} ${row.candidate.facets.join(' ')}`) : 0
  // QUAL: for a question asking for a named transaction, the member its verbs ask for ranks first and another member last
  // (PermissionedDomainSet before PermissionedDomainDelete for "creates or modifies"; EscrowFinish and EscrowCancel before
  // EscrowCreate for "release or return").
  // A question asking for a field, flag or type ("Which EscrowCreate field…") is not ranked by its verbs.
  const asksTransaction = isProtocolQuery(input.question) && clausesAskTransaction(input.question)
  const member = (row: DecisionRound['rows'][number]) => asksTransaction ? memberRank(input.question, row.candidate.title) : 0
  // QUAL: then the article that is also on the topic of more of the run's other open facts, so one purchase can answer
  // several: "What spending controls … constrain the ResearchAgent language model" is the prompt-injection explainer's
  // topic too, so it is bought for "Whether the language model … can initiate spending" before the decision explainer, and
  // the second fact needs no second purchase. Public titles and topics only; never a story-bible question.
  const facts = new Map<DecisionRound['rows'][number], number>()
  const story = FIXTURE_GAP_RULES.some(rule => rule.cue.test(input.question))
  const otherFacts = (row: DecisionRound['rows'][number]) => {
    if (story || !input.otherFacts?.length) return 0
    if (!facts.has(row)) facts.set(row, input.otherFacts.filter(fact => purchaseTopicMatches({ question: input.question, gap: fact, requirement: true }, row.candidate)).length)
    return facts.get(row)!
  }
  const selected = rows.filter(row => row.verdict === 'BUY').sort((a, b) => titled(b) - titled(a) || measure(b) - measure(a) || subject(b) - subject(a) || member(b) - member(a) || entityPrecision(input.question, b.candidate, candidates) - entityPrecision(input.question, a.candidate, candidates) || otherFacts(b) - otherFacts(a) || b.valuePerDollar - a.valuePerDollar || compareTieBreak(input.question, { id: a.candidate.source ? sourceKey(a.candidate) : a.candidate.resourceId, version: a.candidate.version }, { id: b.candidate.source ? sourceKey(b.candidate) : b.candidate.resourceId, version: b.candidate.version }))[0]
  if (selected && !selected.probe && titled(selected)) selected.reason += ' Prefers the article whose title matches the question.'
  else if (selected && !selected.probe && measure(selected)) selected.reason += ' Prefers the title naming the amount asked for.'
  else if (selected && !selected.probe && entityPrecision(input.question, selected.candidate, candidates) > 0) selected.reason += ' Prefers the title or topics naming the requested entity; then value per dollar.'
  return DecisionRoundSchema.parse({ round: input.round, gap: input.gap, gapMaterial, ...(open ? { gapMaterialSource: input.requirement ? 'requirement' : 'model' } : {}), provider: provider.name, model: provider.model, ...(provider.promptVersion ? { promptVersion: provider.promptVersion } : {}), ...(calibrator ? { calibration: roundCalibration(calibrator) } : {}), threshold, rows, ...(selected ? { selectedSourceKey: sourceKey(selected.candidate), selectedResourceId: selected.candidate.resourceId } : {}) })
}
