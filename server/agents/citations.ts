import { sameSource } from '../../shared/source-identity.js'
import { sentences } from '../../shared/lead-finding.js'
import type { Answer, Citation, Claim, ContentEnvelope } from '../../shared/contracts/index.js'
export function resolveCitation(citation: Citation, contents: ContentEnvelope[]) {
  const matches = contents.filter(c => sameSource(c, citation))
  const content = matches.length === 1 ? matches[0] : undefined
  return content?.spans.find(s => s.id === citation.spanId && s.text.length > 0 && content.body.includes(s.text))
}

export function validateClaims(claims: Claim[], contents: ContentEnvelope[]): Claim[] {
  return claims.filter(claim => claim.citations.length > 0 && claim.citations.every(c => Boolean(resolveCitation(c, contents))))
}

/** Only whole delivered sentences enter the summary; a citation does not prove a paraphrase. */
export function validateAnswer(answer: Answer, contents: ContentEnvelope[]): Answer {
  const claims = validateClaims(answer.claims, contents)
  const bound = [...new Set(claims.flatMap(c => c.citations.flatMap(ref => sentences(resolveCitation(ref, contents)!.text))))]
  let remaining = 120
  const selected = bound.filter(text => { const n = text.split(/\s+/).length; if (n > remaining) return false; remaining -= n; return true })
  return { ...answer, claims, conclusion: selected.join(' ') || 'No verifiable evidence is available.' }
}
