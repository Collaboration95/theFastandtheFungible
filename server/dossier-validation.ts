import type { Claim, Source } from '../src/domain.js'

/**
 * Validate citation bindings as relationships, not as two independent global
 * lists. A span is usable for a claim only when it belongs to one of the
 * sources named by that same claim. This prevents a valid span from another
 * source being silently attached to an otherwise valid claim.
 */
type IncomingClaim = Omit<Claim, 'familyCount'> & Partial<Pick<Claim, 'familyCount'>>

export function validateClaimBindings(claims: IncomingClaim[], sources: Source[], fallback = false): Claim[] {
  const sourceIds = new Set(sources.map((source) => source.id))
  const spansBySource = new Map<string, Set<string>>(sources.map((source) => [
    source.id,
    new Set((source.evidenceSpans ?? []).map((span) => span.id)),
  ]))

  return claims.map((claim) => {
    if (!claim.sourceIds.length || claim.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) {
      throw new Error(`Cited claim names an unknown source: ${claim.sourceIds.join(', ')}`)
    }

    let spanIds = claim.spanIds
    if (!spanIds.length && fallback) {
      spanIds = claim.sourceIds.flatMap((sourceId) => [...(spansBySource.get(sourceId) ?? [])].slice(0, 1))
    }

    if (!spanIds.length) throw new Error(`Cited claim has no evidence span: ${claim.id}`)
    const boundSourceIds = new Set(claim.sourceIds)
    for (const spanId of spanIds) {
      const owner = [...spansBySource.entries()].find(([, ids]) => ids.has(spanId))?.[0]
      if (!owner || !boundSourceIds.has(owner)) {
        throw new Error(`Cited evidence span ${spanId} is not bound to a source named by claim ${claim.id}`)
      }
    }
    return { ...claim, spanIds, familyCount: claim.familyCount ?? 0 }
  })
}
