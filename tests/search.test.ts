import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { buildIndex, createQueryEmbedder, loadEmbeddingCache, embeddingKey, embeddingText, embedTexts, EMBEDDING_DIMS, embeddingsLive, normaliseQuery, searchIndex, SEARCH_TUNING, type EmbeddingCache } from '../publisher/search.js'
import { sha256 } from '../shared/manifest.js'
import type { Article } from '../shared/contracts/writers.js'

// Stub embedding: hashed bag of words, unit length. Deterministic and offline.
function stubVector(text: string, dims = 64): number[] {
  const v = new Array<number>(dims).fill(0)
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) v[parseInt(sha256(word).slice(0, 8), 16) % dims] += 1
  const norm = Math.hypot(...v) || 1
  return v.map(x => x / norm)
}
const stubCache = (articles: Article[]): EmbeddingCache => ({
  model: 'stub', dims: 64,
  vectors: Object.fromEntries(articles.map(a => [embeddingKey(a), { hash: sha256(embeddingText(a)), vector: stubVector(`${a.title} ${a.abstract} ${a.tags.join(' ')} ${a.body}`) }])),
})

/** Mini-corpus stand-ins for the story-bible questions; the v2 golden test is at the bottom. */
const GOLDEN = [
  { q: 'Kestrel TSMC wafer agreement N3 allocation', publisher: 'load-factor', articleId: 'lf-kestrel-tsmc-deal' },
  { q: 'why is advanced node capacity scarce', publisher: 'load-factor', articleId: 'lf-n3-capacity' },
  { q: 'Bank of Japan yield curve band change', publisher: 'mira-tan', articleId: 'mt-boj-band' },
  { q: 'will Japanese life insurers repatriate foreign bonds', publisher: 'mira-tan', articleId: 'mt-insurers' },
  { q: 'advanced packaging capacity for accelerators', publisher: 'open-records', articleId: 'or-packaging-note' },
]
const articlesOf = (slug: string) => miniCorpus.articles.filter(a => a.publisherSlug === slug)

afterEach(() => { vi.unstubAllEnvs() })

describe('publisher search engine (#123)', () => {
  it.each(GOLDEN)('BM25: $articleId ranks top 5 for "$q"', async ({ q, publisher, articleId }) => {
    const index = await buildIndex(articlesOf(publisher))
    expect(index.vectors).toBe(false)
    const { mode, ranked } = await searchIndex(index, q, 5)
    expect(mode).toBe('keyword')
    expect(ranked.map(r => r.articleId)).toContain(articleId)
    expect(ranked[0].articleId).toBe(articleId)
    // Absolute, not normalised to the top hit (#142): bounded, ordered like the scores.
    for (const r of ranked) { expect(r.relevance).toBeGreaterThan(0); expect(r.relevance).toBeLessThan(1) }
    expect(ranked.map(r => r.relevance)).toEqual([...ranked.map(r => r.relevance)].sort((a, b) => b - a))
  })

  it.each(GOLDEN)('hybrid with cached + stubbed query vectors: $articleId ranks top 5', async ({ q, publisher, articleId }) => {
    const articles = articlesOf(publisher)
    const index = await buildIndex(articles, stubCache(articles))
    expect(index.vectors).toBe(true)
    const { mode, ranked } = await searchIndex(index, q, 5, stubVector(q))
    expect(mode).toBe('hybrid')
    expect(ranked.map(r => r.articleId)).toContain(articleId)
    expect(ranked[0].articleId).toBe(articleId)
    for (const r of ranked) expect(r.relevance).toBeGreaterThan(0)
    for (const r of ranked) expect(r.relevance).toBeLessThanOrEqual(1)
  })

  it('ignores a cached vector whose body hash is stale, and searches keyword only', async () => {
    const articles = articlesOf('load-factor')
    const cache = stubCache(articles)
    cache.vectors[embeddingKey(articles[0])].hash = sha256('an older body')
    const index = await buildIndex(articles, cache)
    expect(index.vectors).toBe(false)
    expect((await searchIndex(index, 'Kestrel', 5, stubVector('Kestrel'))).mode).toBe('keyword')
  })

  it('defaults SEARCH_EMBEDDINGS to off', () => {
    vi.stubEnv('SEARCH_EMBEDDINGS', '')
    expect(embeddingsLive()).toBe(false)
    vi.stubEnv('SEARCH_EMBEDDINGS', 'live')
    expect(embeddingsLive()).toBe(true)
  })
})

describe('query embedder fallback (#123)', () => {
  it('returns no vector when the embedding call fails, so search falls back to keyword', async () => {
    const embed = createQueryEmbedder(async () => { throw new Error('Workers AI down') })
    expect(await embed('kestrel')).toBeUndefined()
    const articles = articlesOf('load-factor')
    const index = await buildIndex(articles, stubCache(articles))
    const { mode, ranked } = await searchIndex(index, 'kestrel', 5, await embed('kestrel'))
    expect(mode).toBe('keyword')
    expect(ranked.length).toBeGreaterThan(0)
  })

  it('times out a slow embedding call', async () => {
    const original = SEARCH_TUNING.queryTimeoutMs
    SEARCH_TUNING.queryTimeoutMs = 20
    try {
      const embed = createQueryEmbedder(() => new Promise(() => {}))
      expect(await embed('kestrel')).toBeUndefined()
    } finally { SEARCH_TUNING.queryTimeoutMs = original }
  })

  it('caches by normalised query, so a fan-out costs one call per sub-query', async () => {
    const calls: string[][] = []
    const embed = createQueryEmbedder(async texts => { calls.push(texts); return [stubVector(texts[0])] })
    await Promise.all(['Kestrel  TSMC', 'kestrel tsmc', ' KESTREL TSMC '].map(q => embed(q)))
    expect(calls).toEqual([[normaliseQuery('kestrel tsmc')]])
  })
})

describe('Workers AI embedding call (#123)', () => {
  it('posts a batch to bge-base-en-v1.5 and checks the 768-dim shape', async () => {
    const calls: [string, RequestInit][] = []
    const stub = (async (url: string, init: RequestInit) => {
      calls.push([url, init])
      const texts = JSON.parse(String(init.body)).text as string[]
      return new Response(JSON.stringify({ success: true, result: { shape: [texts.length, EMBEDDING_DIMS], data: texts.map(() => new Array(EMBEDDING_DIMS).fill(0.1)) } }))
    }) as unknown as typeof fetch
    const vectors = await embedTexts(['a', 'b'], { token: 'test-token', accountId: 'acct', fetch: stub })
    expect(vectors).toHaveLength(2)
    expect(calls[0][0]).toBe('https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/baai/bge-base-en-v1.5')
    const bad = (async () => new Response(JSON.stringify({ result: { data: [[1, 2]] } }))) as unknown as typeof fetch
    await expect(embedTexts(['a'], { token: 't', accountId: 'acct', fetch: bad })).rejects.toThrow('unexpected embedding shape')
  })
})

// Lights up once #120 commits data/corpus/v2/articles; hybrid once `make embeddings Q=...` records query vectors.
const V2_ARTICLES = 'data/corpus/v2/articles'
const QUERY_VECTORS = 'tests/fixtures/query-vectors.json'
type BibleArticle = { articleId: string; publisherSlug: string; role: string }
const goldenCases = () => (JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { useCases: { id: string; question: string; articles: BibleArticle[] }[] })
  .useCases.flatMap(uc => uc.articles.filter(a => a.role === 'free-source' || a.role === 'winner').map(a => ({ uc: uc.id, q: uc.question, ...a })))

describe.skipIf(!existsSync(V2_ARTICLES))('golden ranking on the v2 corpus (#123)', () => {
  it('ranks each golden FREE and PAID article in the top 5 of its publisher', async () => {
    const corpus = await loadWriterCorpus(undefined, { allowMini: false })
    const embeddings = loadEmbeddingCache()
    const queryVectors = existsSync(QUERY_VECTORS) ? (JSON.parse(readFileSync(QUERY_VECTORS, 'utf8')) as { vectors: Record<string, number[]> }).vectors : undefined
    for (const golden of goldenCases()) {
      const articles = corpus.articles.filter(a => a.publisherSlug === golden.publisherSlug)
      const keyword = await searchIndex(await buildIndex(articles), golden.q, 5)
      expect(keyword.ranked.map(r => r.articleId), `${golden.uc} keyword: ${golden.articleId}`).toContain(golden.articleId)
      const vector = queryVectors?.[normaliseQuery(golden.q)]
      if (!vector) continue
      const hybrid = await searchIndex(await buildIndex(articles, embeddings), golden.q, 5, vector)
      expect(hybrid.mode).toBe('hybrid')
      expect(hybrid.ranked.map(r => r.articleId), `${golden.uc} hybrid: ${golden.articleId}`).toContain(golden.articleId)
    }
  })
})
