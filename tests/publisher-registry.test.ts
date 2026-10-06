import { afterEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { createPublisherApp, type PublisherConfig } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { publisherKeys, seedEnvName, simulatedKeys, simulatedSeed } from '../publisher/registry.js'
import { SearchHitSchema } from '../shared/contracts/manifest.js'
import { sha256, verifyManifestSignature } from '../shared/manifest.js'
import { embeddingText } from '../publisher/search.js'

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function servePublishers(config: PublisherConfig = {}) {
  const app = createPublisherApp({ secret: 'registry-test', journal: ':memory:', rail: 'simulated', writers: miniCorpus, env: {}, ...config })
  await app.locals.ready
  await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`
}

describe('multi-publisher host (#122)', () => {
  it('lists every publisher with root-relative endpoints', async () => {
    const base = await servePublishers()
    const { publishers } = await (await fetch(`${base}/registry`)).json() as { publishers: { slug: string; synthetic: boolean; endpoints: Record<string, string> }[] }
    expect(publishers.map(p => p.slug)).toEqual(miniCorpus.publishers.map(p => p.slug))
    for (const p of publishers) {
      expect(p.synthetic).toBe(true)
      expect(p.endpoints.search).toBe(`/w/${p.slug}/search`)
      for (const url of Object.values(p.endpoints)) expect(url.startsWith('/w/')).toBe(true)
    }
  })

  it('lists all 8 roster publishers from data/writers/, even before the v2 articles land', async () => {
    const base = await servePublishers({ writers: undefined })
    const { publishers } = await (await fetch(`${base}/registry`)).json() as { publishers: { slug: string }[] }
    expect(publishers.map(p => p.slug).sort()).toEqual(readdirSync('data/writers').map(f => f.replace(/\.json$/, '')).sort())
    expect(publishers).toHaveLength(8)
  })

  it('serves a discovery doc whose pubKey derives to its wallet', async () => {
    const base = await servePublishers()
    const doc = await (await fetch(`${base}/w/load-factor/.well-known/agent-publisher.json`)).json() as Record<string, unknown>
    expect(deriveAddress(doc.pubKey as string)).toBe(doc.wallet)
    expect(doc).toMatchObject({ name: 'Load Factor', domain: 'loadfactor.example', prices: { standard: 60 }, licence: expect.any(String), synthetic: true, label: 'SYNTHETIC', keyLabel: expect.stringContaining('SIMULATED') })
    expect((doc.endpoints as Record<string, string>).articles).toBe('/w/load-factor/articles/{articleId}')
    expect((await fetch(`${base}/w/no-such-writer/.well-known/agent-publisher.json`)).status).toBe(404)
  })

  it('returns FREE articles with passages and PAID articles as 402 without body bytes', async () => {
    const base = await servePublishers()
    const free = await fetch(`${base}/w/load-factor/articles/lf-n3-capacity`)
    expect(free.status).toBe(200)
    const article = await free.json() as { body: string; passages: { id: string; text: string }[] }
    expect(article.passages.length).toBeGreaterThanOrEqual(4)
    for (const p of article.passages) expect(article.body).toContain(p.text)
    const paid = await fetch(`${base}/w/load-factor/articles/lf-kestrel-tsmc-deal`)
    expect(paid.status).toBe(402)
    const text = await paid.text()
    const body = miniCorpus.articles.find(a => a.articleId === 'lf-kestrel-tsmc-deal')!.body
    expect(text).not.toContain(body.slice(20, 80))
    expect((await fetch(`${base}/w/mira-tan/articles/lf-n3-capacity`)).status).toBe(404)
  })

  it('returns schema-valid hits; PAID hits carry a manifest signed by the publisher wallet', async () => {
    const base = await servePublishers()
    const hits = SearchHitSchema.array().parse(await (await fetch(`${base}/w/load-factor/search?q=Kestrel%20TSMC%20wafers&k=10`)).json())
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every(h => h.searchMode === 'keyword')).toBe(true)
    const paid = hits.find(h => h.tier === 'PAID')!
    expect(paid.manifest && verifyManifestSignature(paid.manifest)).toBe(true)
    expect(paid.manifest!.wallet).toBe(simulatedKeys('load-factor').wallet)
  })

  it('uses hybrid search when a query embedder answers, and keyword when it fails', async () => {
    const vector = (n: number) => Array.from({ length: 4 }, (_, i) => (i === n ? 1 : 0.1))
    const embeddings = { model: 'stub', dims: 4, vectors: Object.fromEntries(miniCorpus.articles.map((a, i) => [`${a.articleId}@${a.version}`, { hash: sha256(embeddingText(a)), vector: vector(i % 4) }])) }
    const hybrid = await servePublishers({ embeddings, embedder: async () => vector(0) })
    const hits = SearchHitSchema.array().parse(await (await fetch(`${hybrid}/w/load-factor/search?q=kestrel`)).json())
    expect(hits[0].searchMode).toBe('hybrid')
    const fallback = await servePublishers({ embeddings, embedder: async () => undefined })
    expect((await (await fetch(`${fallback}/w/load-factor/search?q=kestrel`)).json() as { searchMode: string }[])[0].searchMode).toBe('keyword')
  })
})

describe('publisher keys (#122)', () => {
  it('derives deterministic SIMULATED keys on the simulated rail', () => {
    const a = publisherKeys('load-factor', 'simulated', {})
    expect(a).toEqual(publisherKeys('load-factor', 'simulated', {}))
    expect(a.simulated).toBe(true)
    expect(publisherKeys('mira-tan', 'simulated', {}).wallet).not.toBe(a.wallet)
  })

  it('reads XRPL_PUBLISHER_<SLUG>_SEED on the Testnet rail and refuses missing or simulated keys', () => {
    expect(seedEnvName('load-factor')).toBe('XRPL_PUBLISHER_LOAD_FACTOR_SEED')
    expect(() => publisherKeys('load-factor', 'xrpl-testnet', {})).toThrow('XRPL_PUBLISHER_LOAD_FACTOR_SEED is required')
    const seed = generateSeed({ entropy: new Uint8Array(16).fill(7), algorithm: 'ed25519' })
    const real = publisherKeys('load-factor', 'xrpl-testnet', { XRPL_PUBLISHER_LOAD_FACTOR_SEED: seed })
    expect(real.simulated).toBe(false)
    expect(real.wallet).toBe(deriveAddress(deriveKeypair(seed).publicKey))
    expect(() => publisherKeys('load-factor', 'xrpl-testnet', { XRPL_PUBLISHER_LOAD_FACTOR_SEED: simulatedSeed('load-factor') })).toThrow('refused on the xrpl-testnet rail')
  })
})

describe('writer corpus loader (#122)', () => {
  it('loads one roster file per publisher plus the v2 articles', async () => {
    const root = mkdtempSync(join(tmpdir(), 'writers-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    mkdirSync(join(root, 'writers')); mkdirSync(join(root, 'corpus/v2/articles'), { recursive: true })
    for (const publisher of miniCorpus.publishers) {
      writeFileSync(join(root, 'writers', `${publisher.slug}.json`), JSON.stringify({ publisher, writers: miniCorpus.writers.filter(w => w.publisherSlug === publisher.slug) }))
    }
    for (const a of miniCorpus.articles) writeFileSync(join(root, 'corpus/v2/articles', `${a.articleId}.json`), JSON.stringify(a))
    // Mini articles are below the v2 word floor; the loader validates them strictly.
    await expect(loadWriterCorpus(pathToFileURL(`${root}/`))).rejects.toThrow('outside 600–1400')
  })

  it('falls back to the mini corpus while the roster or the v2 articles are missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'writers-empty-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    const corpus = await loadWriterCorpus(pathToFileURL(`${root}/`))
    expect(corpus.articles.map(a => a.articleId)).toEqual(miniCorpus.articles.map(a => a.articleId))
  })
})
