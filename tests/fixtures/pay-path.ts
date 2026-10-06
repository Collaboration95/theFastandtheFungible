// The new payment path end to end on the SIMULATED rail (#131–#134): a real publisher app on an
// ephemeral port serving the mini corpus plus AlphaLeak, the real Store and PurchaseManager.
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createPublisherApp } from '../../publisher/routes.js'
import { PurchaseManager } from '../../server/purchases.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { Store } from '../../server/store.js'
import type { PublicCandidate } from '../../shared/contracts/index.js'
import { exampleCandidate } from '../../shared/contracts/examples.js'
import { SearchHitSchema } from '../../shared/contracts/manifest.js'
import { alphaLeakCorpus } from './corpus-mini/index.js'

export const plant = (JSON.parse(readFileSync(new URL('../../data/corpus/v2/story-bible.json', import.meta.url), 'utf8')) as { alphaLeakPlant: { articleId: string; passageText: string; manifestClaim: { id: string } } }).alphaLeakPlant
export const alphaLeakArticle = alphaLeakCorpus.articles.find(a => a.articleId === plant.articleId)!
export const honestArticle = alphaLeakCorpus.articles.find(a => a.tier === 'PAID' && a.publisherSlug !== 'alphaleak')!

/** The PAID search hit as the policy sees it: public metadata plus its verified signed manifest. */
export async function candidateFrom(base: string, article = alphaLeakArticle): Promise<PublicCandidate> {
  const hits = SearchHitSchema.array().parse(await (await fetch(`${base}/w/${article.publisherSlug}/search?${new URLSearchParams({ q: article.title, k: '10' })}`)).json())
  const hit = hits.find(h => h.articleId === article.articleId)!
  return { ...exampleCandidate, profileId: hit.publisherSlug, resourceId: hit.articleId, version: hit.version, title: hit.title, family: hit.articleId, url: hit.url, wallet: hit.manifest!.wallet, manifest: hit.manifest, tier: 'PAID', price: { amountMinor: hit.priceMinor, currency: 'SGD' } }
}

export async function payPath(options: { refuseChallenges?: boolean; storePath?: string } = {}) {
  const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', writers: alphaLeakCorpus, env: {}, refuseChallenges: options.refuseChallenges })
  await app.locals.ready; await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const store = new Store(options.storePath ?? ':memory:')
  const client = new PublisherClient({ baseUrl: base })
  const manager = new PurchaseManager(store, client)
  const candidate = (article = alphaLeakArticle) => candidateFrom(base, article)
  async function close() {
    store.close()
    await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
    app.locals.journal.close()
  }
  return { app, base, store, client, manager, candidate, close, journal: app.locals.journal as import('../../publisher/journal.js').PublisherJournal }
}
