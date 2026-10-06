import { afterEach, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { fuse, markRewrites, RETRIEVAL, retrieve } from '../server/agents/research.js'
import type { SearchHit } from '../shared/contracts/manifest.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const cleanup of cleanups.splice(0)) await cleanup() })

async function serve() {
  const app = createPublisherApp({ secret: 'retrieval-test', journal: ':memory:', rail: 'simulated', corpus: [], writers: alphaLeakCorpus, env: {} })
  await app.locals.ready
  await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  return new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
}
const plan = { restatement: 'Kestrel and TSMC', subqueries: ['Kestrel TSMC deal', 'Kestrel packaging lead times Penang'] }
const hit = (articleId: string, extra: Partial<SearchHit> = {}): SearchHit => ({
  publisherSlug: 'p', writerSlug: 'p', articleId, version: 'v1', url: `/w/p/articles/${articleId}`, title: articleId, abstract: 'An abstract.', tags: [],
  tier: 'FREE', priceMinor: 0, relevance: 0.5, publishedAt: '2026-09-01', family: articleId, searchMode: 'keyword', ...extra,
})

describe('federated retrieval (#138)', () => {
  it('fans out sub-queries × publishers, reads only FREE hits and passes verified PAID hits on', async () => {
    const client = await serve()
    const search = vi.spyOn(client, 'searchPublisher')
    const read = vi.spyOn(client, 'readFree')
    const result = await retrieve(client, 'ignored when a plan exists', plan)
    const publishers = (await client.registry()).map(p => p.slug)
    expect(search.mock.calls.map(([slug, q, k]) => `${slug}|${q}|${k}`).sort()).toEqual(publishers.flatMap(slug => plan.subqueries.map(q => `${slug}|${q}|${RETRIEVAL.perPublisherK}`)).sort())
    expect(read.mock.calls.every(([h]) => h.tier === 'FREE')).toBe(true)
    expect(result.contents.map(c => c.resourceId).sort()).toEqual(result.candidates.filter(c => c.tier === 'FREE').map(c => c.resourceId).sort())
    const paid = result.candidates.filter(c => c.tier === 'PAID').map(c => c.resourceId).sort()
    expect(paid).toEqual(['alphaleak-kestrel-penang-lead-times', 'lf-kestrel-tsmc-deal'])
    expect(result.candidates.filter(c => c.tier === 'FREE').length).toBeLessThanOrEqual(RETRIEVAL.freeReads)
    // Public hit fields only; credibility comes from the publisher kind.
    const deal = result.candidates.find(c => c.resourceId === 'lf-kestrel-tsmc-deal')!
    expect(deal).toMatchObject({ profileId: 'load-factor', publisherSlug: 'load-factor', authority: 1.5, tier: 'PAID', url: '/w/load-factor/articles/lf-kestrel-tsmc-deal' })
    expect(deal.wallet).toMatch(/^r/)
    expect(deal.manifest).toEqual(result.hits.find(h => h.articleId === 'lf-kestrel-tsmc-deal')!.manifest)
    expect(JSON.stringify(result.candidates)).not.toMatch(/"body"|"passages"/)
    expect(result.search).toBe('keyword only (embeddings unavailable)')
    expect(result.dropped).toEqual([])
  })

  it('drops a PAID hit with a tampered manifest or a foreign key and never passes it on', async () => {
    const client = await serve()
    const original = client.searchPublisher.bind(client)
    vi.spyOn(client, 'searchPublisher').mockImplementation(async (...args) => (await original(...args)).map(h => h.articleId === 'lf-kestrel-tsmc-deal' ? { ...h, manifest: { ...h.manifest!, relevance: 0.99 } } : h))
    const tampered = await retrieve(client, 'q', plan)
    expect(tampered.dropped).toEqual([{ publisherSlug: 'load-factor', resourceId: 'lf-kestrel-tsmc-deal', reason: 'manifest signature invalid' }])
    expect(tampered.candidates.some(c => c.resourceId === 'lf-kestrel-tsmc-deal')).toBe(false)
    vi.restoreAllMocks()
    const registry = client.registry.bind(client)
    vi.spyOn(client, 'registry').mockImplementation(async () => (await registry()).map(p => p.slug === 'alphaleak' ? { ...p, wallet: 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp' } : p))
    const foreign = await retrieve(client, 'q', plan)
    expect(foreign.dropped.map(d => [d.resourceId, d.reason])).toEqual([['alphaleak-kestrel-penang-lead-times', 'manifest key does not derive to the registered wallet']])
    expect(foreign.candidates.some(c => c.publisherSlug === 'alphaleak')).toBe(false)
  })

  it('a publisher that fails is skipped; the others still answer', async () => {
    const client = await serve()
    const original = client.searchPublisher.bind(client)
    vi.spyOn(client, 'searchPublisher').mockImplementation(async (slug, ...rest) => { if (slug === 'alphaleak') throw new Error('timeout'); return original(slug, ...rest) })
    const result = await retrieve(client, 'q', plan)
    expect(result.unavailable).toEqual(['alphaleak'])
    expect(result.candidates.length).toBeGreaterThan(0)
  })

  it('fuses with RRF: order-stable and price-blind', () => {
    const lists = [[hit('a'), hit('b'), hit('c')], [hit('b'), hit('d')], [hit('d'), hit('a')]]
    const order = fuse(lists).map(h => h.articleId)
    expect(order).toEqual(['a', 'b', 'd', 'c'])
    // Any list order gives the same ranking; ties break on the article id.
    expect(fuse([...lists].reverse()).map(h => h.articleId)).toEqual(order)
    expect(fuse([[hit('y')], [hit('x')]]).map(h => h.articleId)).toEqual(['x', 'y'])
    // Prices do not move rank.
    const priced = lists.map(list => list.map((h, i) => ({ ...h, tier: 'PAID' as const, priceMinor: (i + 1) * 37 })))
    expect(fuse(priced).map(h => h.articleId)).toEqual(order)
    // The highest claimed relevance of a repeated hit is kept.
    expect(fuse([[hit('a', { relevance: 0.2 })], [hit('a', { relevance: 0.9 })]])[0].relevance).toBe(0.9)
  })

  it('keeps both rows of a rewrite but marks it', async () => {
    const marked = markRewrites([hit('copy', { family: 'f', publishedAt: '2026-09-03' }), hit('orig', { family: 'f', publishedAt: '2026-09-01' }), hit('alone')])
    expect(marked.map(h => [h.articleId, h.derivedFrom])).toEqual([['copy', 'orig'], ['orig', undefined], ['alone', undefined]])
    const client = await serve()
    const result = await retrieve(client, 'q', { restatement: 'Kestrel deal', subqueries: ['Kestrel deal TSMC'] })
    expect(result.candidates.find(c => c.resourceId === 'lf-kestrel-rewrite')?.derivedFrom).toBe('lf-kestrel-tsmc-deal')
    expect(result.candidates.some(c => c.resourceId === 'lf-kestrel-tsmc-deal')).toBe(true)
  })
})
