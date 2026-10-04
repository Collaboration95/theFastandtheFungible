import type { Answer, Citation, Claim, ContentEnvelope } from '../../shared/contracts/index.js'
export function resolveCitation(citation: Citation, contents: ContentEnvelope[]) {
  const content = contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version)
  return content?.spans.find(s => s.id === citation.spanId && s.text.length > 0 && content.body.includes(s.text))
}

export function validateClaims(claims: Claim[], contents: ContentEnvelope[]): Claim[] {
  return claims.filter(claim => claim.citations.length > 0 && claim.citations.every(c => Boolean(resolveCitation(c, contents))))
}

/** Conclusions have no citation binding: display only the surviving cited claims. */
export function validateAnswer(answer: Answer, contents: ContentEnvelope[]): Answer {
  const claims = validateClaims(answer.claims, contents)
  return { ...answer, claims, conclusion: claims.map(c => c.text).join(' ') || 'No verifiable evidence is available.' }
}
