import { describe, expect, it } from 'vitest'
import { AFTER_MERIDIAN, QUESTION, rankSources, tfidfScore, utility } from '../src/domain'
import { loadFixtureCatalog, validateFixtureCatalog } from '../server/catalog'

describe('ResearchAgent fixture contract', () => {
  it('ranks and clusters the canonical JSON catalog', async () => {
    const catalog = await loadFixtureCatalog()
    expect(catalog.sources).toHaveLength(12)
    expect(new Set(catalog.sources.map((source) => source.familyId)).size).toBeLessThan(catalog.sources.length)
    expect(catalog.sources.find((source) => source.id === 'circuit-note')?.familyId).toBe('family-northstar')
    expect(catalog.articles.find((article) => article.id === 'northstar-wire')?.article).toContain('equipment suppliers')
    expect(catalog.sources.find((source) => source.id === 'northstar-wire')).not.toHaveProperty('article')
  })
  it('ranks the grid gap and Northstar above the redundant newsletter', async () => {
    const catalog = await loadFixtureCatalog()
    const ranked = rankSources(QUESTION, catalog.sources)
    expect(ranked.findIndex((source) => source.id === 'meridian-ledger')).toBeLessThan(ranked.findIndex((source) => source.id === 'circuit-note'))
    expect(tfidfScore('grid interconnection capacity', catalog.sources.find((source) => source.id === 'meridian-ledger')!)).toBeGreaterThan(0)
  })
  it('keeps utility separate from price and preserves the canonical change', async () => {
    const catalog = await loadFixtureCatalog()
    expect(utility(catalog.sources.find((source) => source.id === 'meridian-ledger')!, 100)).toBeGreaterThan(utility(catalog.sources.find((source) => source.id === 'circuit-note')!, 100))
    expect(AFTER_MERIDIAN).toContain('operating capacity')
  })
  it('rejects invalid access, price, license, family, and span metadata clearly', async () => {
    const catalog = await loadFixtureCatalog()
    const invalid = catalog.articles.map((article) => ({ ...article, spans: article.spans.map((span) => ({ ...span })) }))
    invalid[0] = { ...invalid[0], accessTier: 'PREMIUM', priceCents: 10, xrpDrops: 10, license: { ...invalid[0].license, bodyAccess: 'OPEN' }, familyId: 'bad-family', spans: [] }
    expect(() => validateFixtureCatalog(invalid, 'test catalog')).toThrow(/Fixture catalog validation failed \(test catalog\)/)
    expect(() => validateFixtureCatalog(invalid, 'test catalog')).toThrow(/priceCents|bodyAccess|familyId|spans/)
  })
})
