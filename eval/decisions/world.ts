// The offline world the harnesses run in: the real v2 writer corpus, searched in-process with the
// publishers' own keyword index (no embeddings, no network), projected into the same public candidate
// and content shapes the server builds. Labelled: keyword only, SIMULATED wallets, fixture rail.
import type { ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'
import { PublicCandidateSchema } from '../../shared/contracts/index.js'
import type { Article, Publisher, WriterCorpus } from '../../shared/contracts/writers.js'
import { verifyDelivery } from '../../shared/manifest.js'
import { createManifests } from '../../publisher/manifest.js'
import { PublisherJournal } from '../../publisher/journal.js'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import { buildIndex, searchIndex, type PublisherIndex } from '../../publisher/search.js'
import { reportedRelevance } from '../../publisher/bad-actors.js'
import { simulatedKeys } from '../../publisher/registry.js'
import { RETRIEVAL } from '../../server/agents/research.js'

export const WORLD_LABELS = { search: 'keyword only (embeddings unavailable)', settlement: 'SIMULATED · no payment', wallets: 'SIMULATED publisher keys', corpus: 'data/corpus/v2 (synthetic articles)' } as const
/** Credibility prior by publisher kind, as server/agents/research.ts assigns it. */
const KIND_AUTHORITY = { records: 2, masthead: 1.5, independent: 1 } as const

const journal = new PublisherJournal(':memory:')
const manifests = createManifests(journal)
const publisherKeys = new Map<string, ReturnType<typeof simulatedKeys>>()
function keysFor(slug: string) {
  if (!publisherKeys.has(slug)) publisherKeys.set(slug, simulatedKeys(slug))
  return publisherKeys.get(slug)!
}

export type World = { corpus: WriterCorpus; articles: Map<string, Article>; publishers: Map<string, Publisher>; indexes: Map<string, PublisherIndex> }
export async function loadWorld(corpus?: WriterCorpus): Promise<World> {
  const c = corpus ?? await loadWriterCorpus(undefined, { allowMini: false })
  const indexes = new Map<string, PublisherIndex>()
  for (const p of c.publishers) indexes.set(p.slug, await buildIndex(c.articles.filter(a => a.publisherSlug === p.slug)))
  return { corpus: c, articles: new Map(c.articles.map(a => [a.articleId, a])), publishers: new Map(c.publishers.map(p => [p.slug, p])), indexes }
}

/** The public search-hit view of an article: what the decision step may see (no body, no passages). */
export function candidateOf(world: World, article: Article, relevance?: number): PublicCandidate {
  const publisher = world.publishers.get(article.publisherSlug)!
  const keys = keysFor(article.publisherSlug)
  const manifest = manifests.manifestFor({ publisher: { ...publisher, wallet: keys.wallet, pubKey: keys.publicKey }, keys }, article, reportedRelevance(article.publisherSlug, relevance ?? 0))
  return PublicCandidateSchema.parse({
    profileId: article.publisherSlug, resourceId: article.articleId, version: article.version, title: article.title, publisher: publisher.name, preview: article.abstract,
    ...(manifest ? { manifest } : {}),
    price: { amountMinor: article.priceMinor, currency: 'SGD' }, ...(article.tier === 'PAID' ? { wallet: keysFor(article.publisherSlug).wallet } : {}),
    family: article.family, ...(article.derivedFrom ? { derivedFrom: article.derivedFrom } : {}), facets: article.tags, authority: KIND_AUTHORITY[publisher.kind], tier: article.tier,
    license: { kind: 'SYNTHETIC', attribution: publisher.name }, publisherSlug: article.publisherSlug, writerSlug: article.writerSlug,
    url: `/w/${article.publisherSlug}/articles/${article.articleId}`, ...(relevance === undefined ? {} : { relevance: reportedRelevance(article.publisherSlug, relevance) }),
  })
}
/** The envelope a free read (or a verified grant) yields: the passages are the citable spans. */
export const contentOf = (world: World, article: Article): ContentEnvelope => ({
  profileId: article.publisherSlug, resourceId: article.articleId, version: article.version, title: article.title, publisher: world.publishers.get(article.publisherSlug)!.name,
  body: article.body, spans: article.passages.map(p => ({ id: p.id, text: p.text, ...(p.heading ? { label: p.heading } : {}) })),
})

/**
 * retrieveSources() in process: top-k per publisher per query, reciprocal-rank fusion with ties broken by
 * article id, the first 8 FREE hits read and the first 8 PAID hits handed to the decision step.
 */
export async function retrieveOffline(world: World, queries: string[]): Promise<{ candidates: PublicCandidate[]; contents: ContentEnvelope[] }> {
  const fused = new Map<string, { score: number; relevance: number }>()
  for (const q of queries) for (const [, index] of world.indexes) {
    const { ranked } = await searchIndex(index, q.slice(0, 300), RETRIEVAL.perPublisherK)
    ranked.forEach((hit, rank) => {
      const prev = fused.get(hit.articleId) ?? { score: 0, relevance: 0 }
      fused.set(hit.articleId, { score: prev.score + 1 / (RETRIEVAL.rrfK + rank + 1), relevance: Math.max(prev.relevance, hit.relevance) })
    })
  }
  const order = [...fused.entries()].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
  const hits = order.map(([id, h]) => ({ article: world.articles.get(id)!, relevance: h.relevance }))
  const kept = [...hits.filter(h => h.article.tier === 'FREE').slice(0, RETRIEVAL.freeReads), ...hits.filter(h => h.article.tier === 'PAID').slice(0, RETRIEVAL.paidToDecide)]
  return { candidates: kept.map(h => candidateOf(world, h.article, h.relevance)), contents: kept.filter(h => h.article.tier === 'FREE').map(h => contentOf(world, h.article)) }
}

/** verifyDelivery's claim check on the delivered passages: a failed planted claim is a failed proof (D4). */
export function proofPasses(article: Article): boolean {
  const keys = keysFor(article.publisherSlug)
  const publisher = { slug: article.publisherSlug, wallet: keys.wallet, pubKey: keys.publicKey }
  const manifest = manifests.manifestFor({ publisher, keys }, article, 0)
  return Boolean(manifest && verifyDelivery(article.body, article.passages, manifests.saltsFor(article), manifest).ok)
}
