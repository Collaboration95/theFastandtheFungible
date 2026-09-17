import { describe, expect, it } from 'vitest'
import { AFTER_MERIDIAN, QUESTION, rankSources, sources, tfidfScore, utility } from '../src/domain'

describe('ResearchAgent fixture contract', () => {
  it('ships twelve sources and collapses derivatives into fewer families', () => {
    expect(sources).toHaveLength(12)
    expect(new Set(sources.map((source) => source.familyId)).size).toBeLessThan(sources.length)
    expect(sources.find((source) => source.id === 'circuit-note')?.familyId).toBe('family-northstar')
  })
  it('ranks the grid gap and Northstar above the redundant newsletter', () => {
    const ranked = rankSources(QUESTION)
    expect(ranked.findIndex((source) => source.id === 'meridian-ledger')).toBeLessThan(ranked.findIndex((source) => source.id === 'circuit-note'))
    expect(tfidfScore('grid interconnection capacity', sources.find((source) => source.id === 'meridian-ledger')!)).toBeGreaterThan(0)
  })
  it('keeps utility separate from price and preserves the canonical change', () => {
    expect(utility(sources.find((source) => source.id === 'meridian-ledger')!, 100)).toBeGreaterThan(utility(sources.find((source) => source.id === 'circuit-note')!, 100))
    expect(AFTER_MERIDIAN).toContain('operating capacity')
  })
})
