import { describe, expect, it } from 'vitest'
import { validateClaimBindings } from '../server/dossier-validation.js'
import type { Claim, Source } from '../src/domain.js'

const source = (id: string, spanId: string): Source => ({
  id, publisher: id, title: id, date: '2026-01-01', kind: 'ARTICLE', accessTier: 'OPEN',
  priceCents: 0, preview: 'preview', tags: ['evidence'], entities: ['fixture'], authority: 'HIGH', originality: 'ORIGINAL',
  familyId: `family-${id}`, familyLabel: id, relevance: 90, gapMatch: 90, novelty: 80, trustNote: 'fixture',
  license: { kind: 'SYNTHETIC_FIXTURE', label: 'Fixture', attribution: 'Local', bodyAccess: 'OPEN' }, fixture: true,
  evidenceSpans: [{ id: spanId, label: 'Span', text: 'Evidence.' }],
})

const claim = (sourceIds: string[], spanIds: string[]): Claim => ({
  id: 'claim-1', text: 'Grounded claim.', stance: 'SUPPORTS', materiality: 'MATERIAL', sourceIds, spanIds, familyCount: sourceIds.length,
})

describe('citation binding validation', () => {
  it('rejects a valid span when it belongs to a source omitted from the claim', () => {
    expect(() => validateClaimBindings([claim(['source-a'], ['source-b-span'])], [source('source-a', 'source-a-span'), source('source-b', 'source-b-span')])).toThrow(/not bound to a source named by claim/)
  })

  it('accepts a span only when its owning source is named by the claim', () => {
    expect(validateClaimBindings([claim(['source-a', 'source-b'], ['source-a-span', 'source-b-span'])], [source('source-a', 'source-a-span'), source('source-b', 'source-b-span')])[0].spanIds).toEqual(['source-a-span', 'source-b-span'])
  })
})
