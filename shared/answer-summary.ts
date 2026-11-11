import { topicMatches } from './relevance.js'
import { answerBoilerplate, leadFinding, onTopicSentence, sentences } from './lead-finding.js'
import { sameSource } from './source-identity.js'
import type { Answer, Claim, ContentEnvelope, PublicCandidate } from './contracts/index.js'

const STOP = new Set('the a an what which how why when where does do can is are to of in on for and or with from my should use before after today much each this that work available question'.split(' '))
export const questionTerms = (text: string) => [...new Set(text.toLowerCase().match(/[a-z0-9_]+/g) ?? [])].filter(t => t.length > 2 && !STOP.has(t))

/** Public metadata may identify a topic, but never supplies answer text. */
export function onTopic(question: string, content: ContentEnvelope, candidates: PublicCandidate[]): boolean {
  const metadata = candidates.find(c => sameSource(c, content))
  const own = new Set(questionTerms(`${metadata?.title ?? content.title} ${metadata?.facets.join(' ') ?? ''} ${content.spans.map(s => s.text).join(' ')}`))
  const need = questionTerms(question)
  const identifiers = (question.match(/\b(?:[A-Z]{2,}[A-Z0-9]*|[A-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+\d+[a-z]*)\b/g) ?? []).map(t => t.toLowerCase()).filter(t => need.includes(t))
  const subject = `${metadata?.title ?? content.title} ${metadata?.facets.join(' ') ?? ''}`
  return topicMatches(question, `${subject} ${content.spans.map(s => s.text).join(' ')}`) && (!identifiers.length || identifiers.some(t => own.has(t) || t === 'xrp' && own.has('xrpl') || t === 'xrpl' && own.has('xrp'))) && (!need.length || need.filter(t => own.has(t)).length >= Math.min(2, need.length))
}

/** A sentence about what the sources lack or do not establish ("The docs contain no verified list of …", "They are not a determination …"). */
const LACKS = /\b(?:contains?|provides?|includes?|lists?|states?|says?|establish(?:es)?|covers?)\s+no\b|\bno (?:verified|public|reliable|confirmed|independent)\b|\b(?:does|do|did) not (?:contain|include|list|provide|state|say|establish|cover)\b|\bnot (?:a|an) (?:determination|guarantee|promise)\b|\bnot evidence of\b|\bcannot be inferred\b/i
/** "They", "These", "It", "This": a sentence that only makes sense after the one it points back to. */
const ANAPHORIC = /^(?:They|These|Those|It|This|Such|Both|He|She|Its|Their)\b/
/** Whether a sentence of the context paragraph reads on its own here (H8-21):
 * - a sentence that points back ("They are not a determination …") needs the sentence it points back to to be in the paragraph, and a disclaimer never rides on one;
 * - a statement about what the sources lack must be about the question, not a different one that shares a word ("… no verified list of Singapore banks piloting RLUSD …"). */
function belongsHere(question: string, text: string, previous: string | undefined, accepted: string[]): boolean {
  const lacks = LACKS.test(text)
  if (ANAPHORIC.test(text) && (lacks || !previous || !accepted.some(t => previous.includes(t) || t.includes(previous)))) return false
  if (lacks) {
    const sentence = new Set(questionTerms(text)), terms = questionTerms(question)
    if (terms.filter(term => sentence.has(term)).length / Math.max(1, terms.length) < 0.34) return false
  }
  return true
}

/** Exact delivered extracts only. Caller supplies free / verified-grant contents. */
export function summarizeAnswer(question: string, answer: Answer, contents: ContentEnvelope[], candidates: PublicCandidate[], firstRequirement?: string): Answer {
  const topical = contents.filter(c => onTopic(question, c, candidates))
  const extracts: Claim[] = topical.flatMap(c => c.spans.filter(s => c.body.includes(s.text)).map(s => ({
    id: `lead-${JSON.stringify([c.source, c.resourceId, c.version, s.id])}`, text: s.text, stance: 'UNCERTAIN',
    citations: [{ source: c.source, resourceId: c.resourceId, version: c.version, spanId: s.id }],
  })))
  const claims = answer.claims.filter(c => !/\b(?:I recommend|we recommend|integration recommendation)\b|^Test missing/i.test(c.text) && c.citations.every(ref => topical.some(t => sameSource(t, ref))))
  const paid = extracts.filter(c => c.citations.some(ref => candidates.some(m => m.tier === 'PAID' && sameSource(m, ref))))
  const lead = leadFinding(question, paid, topical, firstRequirement, candidates)
  const chosen = lead.length ? lead : leadFinding(question, extracts.filter(c => c.citations.some(ref => candidates.some(m => m.tier === 'FREE' && sameSource(m, ref)))), topical, firstRequirement, candidates)
  // Retain a selected span in claims so receipts, coverage and citation numbering share its binding.
  for (const item of chosen) {
    const existing = claims.find(c => c.citations.some(ref => item.claim.citations.some(r => sameSource(ref, r) && ref.spanId === r.spanId)))
    if (existing) item.claim = { ...existing, citations: item.claim.citations }
    else claims.push(item.claim)
  }
  let count = 0
  const texts: string[] = []
  const leadTexts = new Set(chosen.map(c => c.text))
  const terms = questionTerms(question)
  const entries = [...chosen.map(c => ({ text: c.text, prev: undefined as string | undefined })), ...extracts.filter(e => claims.some(c => c.citations.some(ref => e.citations.some(r => sameSource(r, ref) && r.spanId === ref.spanId)))).flatMap(c => {
    // The sentence a pronoun points back to: the one before it in its passage, or the last of the passage before it in the same article.
    const own = sentences(c.text), before = extracts[extracts.indexOf(c) - 1], sameArticle = before && before.citations[0].resourceId === c.citations[0].resourceId
    return own.map((text, i) => ({ text, prev: i ? own[i - 1] : sameArticle ? sentences(before.text).at(-1) : undefined }))
  }).filter(({ text }) => !terms.length || terms.some(t => questionTerms(text).includes(t)))]
  for (const { text, prev } of entries) {
    if (text.length > 1800 || answerBoilerplate(text) || /^Test missing/i.test(text)) continue
    // The context paragraph obeys the same floor as the lead: an unrelated sentence stays out.
    if (!leadTexts.has(text) && !onTopicSentence(question, text, firstRequirement)) continue
    if (!leadTexts.has(text) && !belongsHere(question, text, prev, texts)) continue
    if (texts.some(t => t.includes(text) || text.includes(t))) continue
    const n = text.split(/\s+/).length
    if (count + n > 120) continue
    texts.push(text); count += n
  }
  const refusals = ['No listed writer covers this yet · nothing bought', 'Matched articles supplied no citable answer · nothing bought', 'No verifiable evidence is available.']
  const fallback = claims.length ? 'See the cited passages under Show work.' : refusals.includes(answer.conclusion) ? answer.conclusion : 'No verifiable evidence is available.'
  return { lead: chosen, conclusion: texts.join(' ') || fallback, claims, openGaps: answer.openGaps, version: answer.version, provider: answer.provider, model: answer.model }
}
