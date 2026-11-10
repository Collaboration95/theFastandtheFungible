import { leadFinding, sentences } from './lead-finding.js'
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
  return (!identifiers.length || identifiers.some(t => own.has(t))) && (!need.length || need.filter(t => own.has(t)).length >= Math.min(2, need.length))
}

/** Exact delivered extracts only. Caller supplies free / verified-grant contents. */
export function summarizeAnswer(question: string, answer: Answer, contents: ContentEnvelope[], candidates: PublicCandidate[], firstRequirement?: string): Answer {
  const topical = contents.filter(c => onTopic(question, c, candidates))
  const extracts: Claim[] = topical.flatMap(c => c.spans.filter(s => c.body.includes(s.text)).map(s => ({
    id: `lead-${JSON.stringify([c.source, c.resourceId, c.version, s.id])}`, text: s.text, stance: 'UNCERTAIN',
    citations: [{ source: c.source, resourceId: c.resourceId, version: c.version, spanId: s.id }],
  })))
  const claims = answer.claims.filter(c => c.citations.every(ref => topical.some(t => sameSource(t, ref))))
  const paid = extracts.filter(c => c.citations.some(ref => candidates.some(m => m.tier === 'PAID' && sameSource(m, ref))))
  const lead = leadFinding(question, paid, topical, firstRequirement)
  const chosen = lead.length ? lead : leadFinding(question, claims, topical, firstRequirement)
  // Retain a selected span in claims so receipts, coverage and citation numbering share its binding.
  for (const item of chosen) {
    const existing = claims.find(c => c.citations.some(ref => item.claim.citations.some(r => sameSource(ref, r) && ref.spanId === r.spanId)))
    if (existing) item.claim = { ...existing, citations: item.claim.citations }
    else claims.push(item.claim)
  }
  let count = 0
  const texts: string[] = []
  for (const text of [...chosen.map(c => c.text), ...extracts.filter(e => claims.some(c => c.citations.some(ref => e.citations.some(r => sameSource(r, ref) && r.spanId === ref.spanId)))).flatMap(c => sentences(c.text)).filter(text => !questionTerms(question).length || questionTerms(question).some(t => questionTerms(text).includes(t)))]) {
    if (texts.some(t => t.includes(text) || text.includes(t))) continue
    const n = text.split(/\s+/).length
    if (count + n > 120) continue
    texts.push(text); count += n
  }
  const refusals = ['No listed writer covers this yet · nothing bought', 'Matched articles supplied no citable answer · nothing bought', 'No verifiable evidence is available.']
  const fallback = claims.length ? 'See the cited passages under Show work.' : refusals.includes(answer.conclusion) ? answer.conclusion : 'No verifiable evidence is available.'
  return { lead: chosen, conclusion: texts.join(' ') || fallback, claims, openGaps: answer.openGaps, version: answer.version, provider: answer.provider, model: answer.model }
}
