import { afterEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherJournal } from '../publisher/journal.js'
import type { Manifests } from '../publisher/manifest.js'
import { SearchHitSchema } from '../shared/contracts/manifest.js'
import type { WriterCorpus } from '../shared/contracts/writers.js'
import { verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function serve(writers: WriterCorpus = miniCorpus, journal: string | PublisherJournal = ':memory:') {
  const app = createPublisherApp({ secret: 'manifest-test', journal, rail: 'simulated', writers, env: {} })
  await app.locals.ready
  await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  return { base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, manifests: app.locals.manifests as Manifests }
}
const searchHits = async (base: string, slug: string, q: string) =>
  SearchHitSchema.array().parse(await (await fetch(`${base}/w/${slug}/search?${new URLSearchParams({ q, k: '10' })}`)).json())

describe('publisher manifests (#125)', () => {
  it('every PAID hit carries a signed manifest that the client verifies, and the delivery checks out', async () => {
    const { base, manifests } = await serve()
    const paid = miniCorpus.articles.filter(a => a.tier === 'PAID')
    expect(paid.length).toBeGreaterThan(0)
    for (const article of paid) {
      const hit = (await searchHits(base, article.publisherSlug, article.title)).find(h => h.articleId === article.articleId)!
      expect(hit.manifest && verifyManifestSignature(hit.manifest)).toBe(true)
      expect(hit.manifest!.relevance).toBe(hit.relevance)
      const check = verifyDelivery(article.body, article.passages, manifests.saltsFor(article), hit.manifest!)
      expect(check).toEqual({ ok: true, rootOk: true, wordCountOk: true, failedClaims: [] })
      expect(hit.manifest!.claims.length).toBeGreaterThan(0)
    }
  })

  it('caches proofs per article version: only relevance and the signature change per query', async () => {
    const { base } = await serve()
    const [a] = (await searchHits(base, 'load-factor', 'Kestrel TSMC')).filter(h => h.tier === 'PAID')
    const [b] = (await searchHits(base, 'load-factor', 'Kestrel TSMC capacity packaging N3 margins')).filter(h => h.tier === 'PAID')
    expect(b.manifest!.root).toBe(a.manifest!.root)
    expect(b.manifest!.leaves).toEqual(a.manifest!.leaves)
    expect(verifyManifestSignature(b.manifest!)).toBe(true)
    expect(verifyManifestSignature({ ...b.manifest!, relevance: a.manifest!.relevance === b.manifest!.relevance ? 0.01 : a.manifest!.relevance })).toBe(false)
  })

  it('persists salts in publisher.db, so a restart signs the same root', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'manifest-salts-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    const file = join(dir, 'publisher.db')
    const first = await serve(miniCorpus, file)
    const before = (await searchHits(first.base, 'load-factor', 'Kestrel')).find(h => h.tier === 'PAID')!.manifest!.root
    await cleanups.pop()!()
    const second = await serve(miniCorpus, file)
    expect((await searchHits(second.base, 'load-factor', 'Kestrel')).find(h => h.tier === 'PAID')!.manifest!.root).toBe(before)
  })

  it('never puts a salt in a /search response', async () => {
    const { base, manifests } = await serve()
    const salts = miniCorpus.articles.filter(a => a.tier === 'PAID').flatMap(a => manifests.saltsFor(a))
    for (const publisher of miniCorpus.publishers) {
      for (const q of ['Kestrel TSMC wafers', 'BoJ band', 'packaging capacity']) {
        const text = await (await fetch(`${base}/w/${publisher.slug}/search?q=${encodeURIComponent(q)}&k=10`)).text()
        for (const salt of salts) expect(text).not.toContain(salt)
      }
    }
  })
})
