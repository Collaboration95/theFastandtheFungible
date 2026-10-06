import { afterEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { createPublisherApp } from '../publisher/routes.js'
import type { Manifests } from '../publisher/manifest.js'
import { SearchHitSchema } from '../shared/contracts/manifest.js'
import { verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'

const plant = (JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { alphaLeakPlant: { articleId: string; relevance: number; manifestClaim: { id: string } } }).alphaLeakPlant
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

async function serve() {
  const app = createPublisherApp({ secret: 'alphaleak-test', journal: ':memory:', rail: 'simulated', writers: alphaLeakCorpus, env: {} })
  await app.locals.ready
  await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  return { base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, manifests: app.locals.manifests as Manifests }
}
const search = async (base: string, slug: string, q: string) =>
  SearchHitSchema.array().parse(await (await fetch(`${base}/w/${slug}/search?${new URLSearchParams({ q, k: '10' })}`)).json())

describe('AlphaLeak bad actor (#126)', () => {
  it('reports inflated relevance and a validly signed manifest, like any honest publisher', async () => {
    const { base } = await serve()
    const hit = (await search(base, 'alphaleak', 'Kestrel packaging lead times Penang')).find(h => h.articleId === plant.articleId)!
    expect(hit.relevance).toBe(plant.relevance)
    expect(hit.manifest!.relevance).toBe(plant.relevance)
    expect(verifyManifestSignature(hit.manifest!)).toBe(true)
    expect(hit.manifest!.claims.map(c => c.id)).toContain(plant.manifestClaim.id)
  })

  it('verifyDelivery fails exactly the planted claim; every other publisher passes', async () => {
    const { base, manifests } = await serve()
    for (const article of alphaLeakCorpus.articles.filter(a => a.tier === 'PAID')) {
      const hit = (await search(base, article.publisherSlug, article.title)).find(h => h.articleId === article.articleId)!
      const check = verifyDelivery(article.body, article.passages, manifests.saltsFor(article), hit.manifest!)
      expect(check.rootOk && check.wordCountOk).toBe(true)
      expect(check.failedClaims).toEqual(article.articleId === plant.articleId ? [plant.manifestClaim.id] : [])
    }
  })

  it('does not call itself a bad actor in its discovery doc', async () => {
    const { base } = await serve()
    const doc = await (await fetch(`${base}/w/alphaleak/.well-known/agent-publisher.json`)).text()
    expect(doc).not.toMatch(/bad.actor/i)
  })
})
