// Per-publisher full-text + vector search (D2, #123). Node only; never import from src/.
import { existsSync, readFileSync } from 'node:fs'
import { create, insertMultiple, search, type AnyOrama } from '@orama/orama'
import type { Article } from '../shared/contracts/writers.js'
import { sha256 } from '../shared/manifest.js'

export type SearchMode = 'hybrid' | 'keyword'
export type Ranked = { articleId: string; relevance: number }
export type Embedder = (query: string) => Promise<number[] | undefined>
export type EmbeddingCache = { model: string; dims: number; vectors: Record<string, { hash: string; vector: number[] }> }

/** Every ranking knob in one place, so it can be tuned on the story-bible questions. */
export const SEARCH_TUNING = {
  // Tuned 8 Oct on 162 eval queries (eval/README.md): body 1 → 0.5 and vector weight 0.5 → 0.8 lift
  // within-publisher MRR 0.978 → 0.997; BM25 k1/b changes moved MRR < 0.005, so Orama defaults stay.
  boost: { title: 3, abstract: 2, tags: 2, body: 0.5 },
  /** Orama full-text threshold: 1 keeps any article matching at least one term. */
  threshold: 1,
  /** Minimum cosine similarity for the vector half. */
  similarity: 0.3,
  hybridWeights: { text: 0.2, vector: 0.8 },
  /** Hybrid relevance = cosine(query, article) mapped linearly from [lo, hi] to [0, 1]. Across writers it separates the
   *  right article from other writers' best hits with AUC 0.984 (the blended hybrid score: 0.76; top-normalised: 0.48).
   *  lo ≈ other writers' median best-hit cosine, hi ≈ the target's p90. */
  cosineRange: { lo: 0.65, hi: 0.9 },
  /** Keyword relevance = bm25 / (bm25 + this): absolute, so a weak top hit is not promised as 1.0 (#142).
   *  12 puts the target's median BM25 (28) near 0.7 and other writers' median best hit (9.5) near 0.44. */
  keywordHalfScore: 12,
  /** Live query embedding budget; 1.5 s lost hybrid search on ~1 in 6 live runs (8 Oct smoke). */
  queryTimeoutMs: 2500,
  queryCacheTtlMs: 10 * 60_000,
  /** Characters of body sent to the embedder (bge-base reads at most 512 tokens). */
  embedBodyChars: 1500,
}
export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
export const EMBEDDING_DIMS = 768
const EMBEDDINGS_FILE = new URL('../data/corpus/v2/embeddings.json', import.meta.url)

export const embeddingKey = (article: Pick<Article, 'articleId' | 'version'>) => `${article.articleId}@${article.version}`
export const embeddingText = (article: Article) => `${article.title}\n${article.abstract}\n${article.tags.join(', ')}\n${article.body.slice(0, SEARCH_TUNING.embedBodyChars)}`
/** Cached vector for an article, only while the hash of its embedded text (title, abstract, tags, body head) still matches. */
export const cachedVector = (cache: EmbeddingCache | undefined, article: Article) => {
  const entry = cache?.vectors[embeddingKey(article)]
  return entry && entry.hash === sha256(embeddingText(article)) ? entry.vector : undefined
}
export function loadEmbeddingCache(file: URL | string = EMBEDDINGS_FILE): EmbeddingCache | undefined {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as EmbeddingCache : undefined
}

export type PublisherIndex = { db: AnyOrama; vectors: boolean; vectorOf?: Map<string, number[]> }

/** One in-memory index per publisher. Vectors are used only when every article has one. */
export async function buildIndex(articles: Article[], cache?: EmbeddingCache): Promise<PublisherIndex> {
  const vectors = articles.map(article => cachedVector(cache, article))
  const withVectors = articles.length > 0 && vectors.every(Boolean)
  const dims = withVectors ? vectors[0]!.length : 0
  const db = create({
    schema: { articleId: 'string', title: 'string', abstract: 'string', tags: 'string[]', body: 'string', ...(withVectors ? { embedding: `vector[${dims}]` as const } : {}) },
  })
  await insertMultiple(db, articles.map((article, i) => ({
    articleId: article.articleId, title: article.title, abstract: article.abstract, tags: article.tags, body: article.body,
    ...(withVectors ? { embedding: vectors[i] } : {}),
  })))
  return { db, vectors: withVectors, ...(withVectors ? { vectorOf: new Map(articles.map((a, i) => [a.articleId, vectors[i]!])) } : {}) }
}

const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/**
 * Ranks one publisher's articles. Relevance is an absolute 0–1 promise, never normalised to the top hit:
 * per-response normalisation made every publisher promise 1.0 for its best hit, so an inflated
 * claim (AlphaLeak's 0.96) looked modest and calibration had nothing to check (#142).
 */
export async function searchIndex(index: PublisherIndex, term: string, k: number, queryVector?: number[]): Promise<{ mode: SearchMode; ranked: Ranked[] }> {
  const mode: SearchMode = index.vectors && queryVector ? 'hybrid' : 'keyword'
  const common = { term, limit: k, properties: ['title', 'abstract', 'tags', 'body'], boost: SEARCH_TUNING.boost, threshold: SEARCH_TUNING.threshold }
  const result = mode === 'hybrid'
    ? await search(index.db, { ...common, mode: 'hybrid', vector: { value: queryVector!, property: 'embedding' }, similarity: SEARCH_TUNING.similarity, hybridWeights: SEARCH_TUNING.hybridWeights })
    : await search(index.db, { ...common, mode: 'fulltext' })
  // Hybrid: query–article cosine on a fixed scale (comparable across writers). Keyword: BM25 is unbounded, so it saturates.
  const { lo, hi } = SEARCH_TUNING.cosineRange
  const absolute = (id: string, score: number) => {
    const vector = mode === 'hybrid' ? index.vectorOf?.get(id) : undefined
    const value = vector ? (cosine(queryVector!, vector) - lo) / (hi - lo) : score / (score + SEARCH_TUNING.keywordHalfScore)
    return Math.min(1, Math.max(0.01, value)) // a returned hit matched something: never promise exactly 0
  }
  const ranked = result.hits.map(hit => ({ articleId: String(hit.document.articleId), relevance: absolute(String(hit.document.articleId), hit.score) }))
  return { mode, ranked }
}

/** `SEARCH_EMBEDDINGS=live|off`, default off: tests and the fixture demo never call Workers AI. */
export const embeddingsLive = (env: NodeJS.ProcessEnv = process.env) => env.SEARCH_EMBEDDINGS === 'live'

type Fetch = typeof fetch
/** Calls Workers AI with a batch of texts and returns one vector per text. */
let resolvedAccountId: string | undefined
export async function embedTexts(texts: string[], options: { token?: string; accountId?: string; fetch?: Fetch; signal?: AbortSignal } = {}): Promise<number[][]> {
  const token = options.token ?? process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')
  const call = options.fetch ?? fetch
  const api = 'https://api.cloudflare.com/client/v4'
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  let accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? (options.fetch ? undefined : resolvedAccountId)
  if (!accountId) {
    const accounts = await (await call(`${api}/accounts`, { headers, signal: options.signal })).json() as { result?: { id: string }[] }
    if (accounts.result?.length !== 1) throw new Error('Set CLOUDFLARE_ACCOUNT_ID: the token sees zero or several accounts')
    accountId = accounts.result[0].id
    // Resolve once per process: a second round trip per query pushed live query embeddings past the 1.5 s timeout.
    if (!options.fetch) resolvedAccountId = accountId
  }
  const response = await call(`${api}/accounts/${encodeURIComponent(accountId)}/ai/run/${EMBEDDING_MODEL}`, { method: 'POST', headers, body: JSON.stringify({ text: texts }), signal: options.signal })
  if (!response.ok) throw new Error(`Workers AI embedding failed (${response.status})`)
  const data = (await response.json() as { result?: { data?: number[][] } }).result?.data
  if (!data || data.length !== texts.length || data.some(v => v.length !== EMBEDDING_DIMS)) throw new Error('Workers AI returned an unexpected embedding shape')
  return data
}

export const normaliseQuery = (query: string) => query.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Query embedder shared by every publisher in the process: cached by normalised
 * query (short TTL) so a fan-out to N publishers costs one call. Any failure or
 * a timeout returns undefined, and the caller falls back to keyword search.
 */
export function createQueryEmbedder(embed: (texts: string[], signal: AbortSignal) => Promise<number[][]> = (texts, signal) => embedTexts(texts, { signal }), now = Date.now): Embedder {
  const cache = new Map<string, { at: number; vector: Promise<number[] | undefined> }>()
  return query => {
    const key = normaliseQuery(query)
    const hit = cache.get(key)
    if (hit && now() - hit.at < SEARCH_TUNING.queryCacheTtlMs) return hit.vector
    const signal = AbortSignal.timeout(SEARCH_TUNING.queryTimeoutMs)
    const vector = Promise.race([
      embed([key], signal).then(vectors => vectors[0]),
      new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('embedding timeout')), { once: true })),
    ]).catch(() => { cache.delete(key); return undefined })
    cache.set(key, { at: now(), vector })
    return vector
  }
}
