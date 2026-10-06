import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { ContentEnvelopeSchema, CorpusResourceSchema, PublicCandidateSchema, type CorpusResource } from '../shared/contracts/corpus.js'
import { DROPS_PER_MINOR, ProfileSchema, QuoteRequestSchema, SettlementRequestSchema, SIMULATED_LABEL, XRPL_LABEL, type Rail } from '../shared/contracts/publisher.js'
import { TESTNET_RECEIVER, testnetLedger, verifyPayment, type Ledger } from '../shared/xrpl.js'
import { SearchHitSchema, type Manifest, type SearchHit } from '../shared/contracts/manifest.js'
import type { Article, WriterCorpus } from '../shared/contracts/writers.js'
import { reportedRelevance } from './bad-actors.js'
import { createManifests } from './manifest.js'
import { loadCorpus, loadWriterCorpus } from './corpus.js'
import { digestBytes, PublisherError, PublisherJournal } from './journal.js'
import { buildRegistry, SIMULATED_KEY_LABEL, type PublisherEntry } from './registry.js'
import { createQueryEmbedder, embeddingsLive, loadEmbeddingCache, searchIndex, type EmbeddingCache, type Embedder } from './search.js'

export type PublisherConfig = {
  corpus?: CorpusResource[] | Promise<CorpusResource[]>
  journal?: PublisherJournal | string
  secret?: string
  faults?: boolean
  rail?: Rail
  ledger?: Ledger
  /** The v2 writer corpus behind /registry and /w/:slug/* (defaults to loadWriterCorpus()). */
  writers?: WriterCorpus | Promise<WriterCorpus>
  /** Query embedder; defaults to Workers AI when SEARCH_EMBEDDINGS=live, otherwise none (keyword only). */
  embedder?: Embedder
  embeddings?: EmbeddingCache
  env?: NodeJS.ProcessEnv
}

const ArticleParam = /^[A-Za-z0-9._-]+$/
const endpointsFor = (slug: string) => ({
  discovery: `/w/${slug}/.well-known/agent-publisher.json`, search: `/w/${slug}/search`, articles: `/w/${slug}/articles/{articleId}`,
})
/** A search result never carries a body or passages (gate 1): only the writer's abstract, signals and a manifest. */
export function toSearchHit(article: Article, relevance: number, searchMode: SearchHit['searchMode'], manifest: Manifest | undefined): SearchHit {
  return SearchHitSchema.parse({
    publisherSlug: article.publisherSlug, writerSlug: article.writerSlug, articleId: article.articleId, version: article.version,
    url: `/w/${article.publisherSlug}/articles/${article.articleId}`, title: article.title, abstract: article.abstract, tags: article.tags,
    tier: article.tier, priceMinor: article.priceMinor, relevance, publishedAt: article.publishedAt, family: article.family,
    derivedFrom: article.derivedFrom, manifest, searchMode,
  })
}
/** Each paid publisher is paid at its own public wallet; the phase 1 receiver remains the fallback. */
export const payToFor = (resource: Pick<CorpusResource, 'wallet'>) => resource.wallet ?? process.env.XRPL_RECEIVER_ADDRESS ?? TESTNET_RECEIVER
export function serializeEnvelope(resource: CorpusResource): string {
  return JSON.stringify(ContentEnvelopeSchema.parse(resource))
}

/** The app stays synchronous; locals.ready exposes asynchronous corpus loading to startup/tests. */
export function createPublisherApp(config: PublisherConfig = {}) {
  const app = express()
  const secret = config.secret ?? process.env.PUBLISHER_SECRET
  if (!secret) throw new Error('PUBLISHER_SECRET is required')
  const journal = config.journal instanceof PublisherJournal ? config.journal : new PublisherJournal(config.journal ?? 'data/publisher.db')
  const faults = config.faults ?? process.env.PUBLISHER_FAULTS === '1'
  const rail: Rail = config.rail ?? (process.env.SETTLEMENT_RAIL === 'xrpl-testnet' ? 'xrpl-testnet' : 'simulated')
  const ledger = rail === 'xrpl-testnet' ? config.ledger ?? testnetLedger() : undefined
  const label = rail === 'xrpl-testnet' ? XRPL_LABEL : SIMULATED_LABEL
  const terms = (resource: CorpusResource) => rail === 'xrpl-testnet'
    ? { rail, network: 'xrpl:1' as const, asset: 'XRP' as const, payTo: payToFor(resource), amountDrops: String(resource.price.amountMinor * DROPS_PER_MINOR) }
    : undefined
  let failNextDelivery = false
  let corpus: CorpusResource[] = []
  const ready = Promise.resolve(config.corpus ?? loadCorpus()).then(resources => {
    corpus = resources.map(resource => CorpusResourceSchema.parse(resource))
  })
  // Attach a rejection handler immediately; requests/startup still receive the original error.
  void ready.catch(() => {})
  app.locals.ready = ready
  // The writer registry loads separately, so a missing v2 corpus never blocks the legacy /v1 flow.
  let registry = new Map<string, PublisherEntry>()
  const env = config.env ?? process.env
  const embedder = config.embedder ?? (embeddingsLive(env) ? createQueryEmbedder() : undefined)
  const writersReady = Promise.resolve(config.writers ?? loadWriterCorpus())
    .then(corpus => buildRegistry(corpus, { rail, env, embeddings: config.embeddings ?? loadEmbeddingCache() }))
    .then(built => { registry = built })
  void writersReady.catch(() => {})
  app.locals.writersReady = writersReady
  const manifests = createManifests(journal)
  app.locals.manifests = manifests
  app.locals.journal = journal
  app.locals.ledger = ledger
  app.disable('x-powered-by')
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  app.use(express.json({ limit: '16kb' }))
  const authenticate: RequestHandler = (req, res, next) => {
    const actual = Buffer.from(req.get('Authorization') ?? '')
    const expected = Buffer.from(`Bearer ${secret}`)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.status(401).json({ error: 'Unauthorized' }); return
    }
    next()
  }
  app.get('/health', async (_req, res) => {
    await ready
    res.json({ status: 'ok', publisher: 'local', settlement: label })
  })
  app.use('/v1', async (_req, _res, next) => { await ready; next() })
  app.get('/v1/profiles', (_req, res) => {
    const profiles = [...new Set(corpus.map(resource => resource.profileId))].map(id => {
      const resource = corpus.find(item => item.profileId === id)!
      return ProfileSchema.parse({ id, name: id, tier: resource.tier })
    })
    res.json(profiles)
  })
  app.get('/v1/profiles/:p/search', (req, res) => {
    // Return all resources for the buyer's lexical/facet ranking. Always strip private fields.
    res.json(corpus.filter(resource => resource.profileId === req.params.p).map(resource => PublicCandidateSchema.parse(resource)))
  })
  app.get('/v1/profiles/:p/resources/:id', (req, res) => {
    const resource = corpus.find(item => item.profileId === req.params.p && item.resourceId === req.params.id)
    if (!resource) throw new PublisherError(404, 'Resource not found')
    res.json(PublicCandidateSchema.parse(resource))
  })
  app.get('/v1/profiles/:p/resources/:id/versions/:v/content', (req, res) => {
    const { p, id, v } = req.params
    const token = req.get('X-Delivery-Token')
    const delivery = token ? journal.delivery(token, p, id, v) : undefined
    const resource = corpus.find(item => item.profileId === p && item.resourceId === id && item.version === v)
    if (!resource && !delivery) throw new PublisherError(404, 'Resource version not found')
    if (!delivery && resource?.tier !== 'FREE') {
      const xrpl = terms(resource!)
      res.status(402).json({
        x402Version: 1, label: `x402-shaped · ${label}`,
        accepts: [xrpl
          ? { scheme: 'exact', network: xrpl.network, asset: 'XRP', amount: xrpl.amountDrops, payTo: xrpl.payTo, resource: req.path, quoteEndpoint: '/v1/quotes', invoice: 'quote hash as InvoiceID' }
          : { network: 'simulated-sgd', amount: String(resource!.price.amountMinor), resource: req.path, payTo: p, quoteEndpoint: '/v1/quotes' }],
      })
      return
    }
    if (delivery && failNextDelivery) {
      failNextDelivery = false
      throw new PublisherError(503, 'Simulated delivery failure; retry with the same token')
    }
    const bytes = delivery?.bytes ?? serializeEnvelope(resource!)
    res.set('Digest', `sha-256=${digestBytes(bytes)}`).type('application/json').send(bytes)
  })
  app.post('/v1/quotes', (req, res) => {
    const parsed = QuoteRequestSchema.safeParse(req.body)
    if (!parsed.success || Object.values(parsed.data).some(value => !value)) throw new PublisherError(400, 'Invalid quote request')
    const request = parsed.data
    const existing = journal.existingQuote(request)
    if (existing) { res.json(existing); return }
    const resource = corpus.find(item => item.profileId === request.profileId && item.resourceId === request.resourceId && item.version === request.version)
    if (!resource) throw new PublisherError(404, 'Resource version not found')
    if (resource.tier !== 'PAID') throw new PublisherError(400, 'Free resources do not require settlement')
    res.json(journal.quote(request, resource.price.amountMinor, serializeEnvelope(resource), terms(resource)))
  })
  app.post('/v1/settlements', authenticate, async (req, res) => {
    const parsed = SettlementRequestSchema.safeParse(req.body)
    if (!parsed.success) throw new PublisherError(400, 'Invalid settlement request')
    const quote = journal.storedQuote(parsed.data.intentId)
    const existing = journal.settlement(parsed.data.intentId)
    if (!quote?.payment || existing.status === 'SETTLED') { res.json(journal.settle(parsed.data)); return }
    if (!parsed.data.txHash) throw new PublisherError(400, 'XRPL settlement requires txHash')
    if (!ledger) throw new PublisherError(503, 'XRPL ledger unavailable')
    // Verified against the ledger, never against anything the buyer claims.
    const verdict = await verifyPayment(ledger, parsed.data.txHash, quote.payment)
    if (verdict.state === 'pending') { res.status(202).json({ status: 'PENDING' }); return }
    if (verdict.state === 'invalid') throw new PublisherError(402, `XRPL payment not accepted: ${verdict.reason}`)
    res.json(journal.settle(parsed.data, verdict.proof))
  })
  app.get('/v1/settlements/:intentId', authenticate, (req, res) => {
    res.json(journal.settlement(String(req.params.intentId)))
  })
  if (faults) app.post('/__faults', authenticate, (req, res) => {
    if (req.body?.failNextDelivery !== true) throw new PublisherError(400, 'Expected failNextDelivery: true')
    failNextDelivery = true
    res.json({ failNextDelivery: true, label: 'SIMULATED fault' })
  })
  const entryFor = (slug: string) => {
    const entry = registry.get(slug)
    if (!entry) throw new PublisherError(404, 'Publisher not found')
    return entry
  }
  app.use(['/registry', '/w'], async (_req, _res, next) => { await writersReady; next() })
  app.get('/registry', (_req, res) => {
    res.json({ publishers: [...registry.values()].map(({ publisher }) => ({
      slug: publisher.slug, name: publisher.name, kind: publisher.kind, domain: publisher.domain, wallet: publisher.wallet,
      synthetic: publisher.synthetic, endpoints: endpointsFor(publisher.slug),
    })) })
  })
  app.get('/w/:slug/.well-known/agent-publisher.json', (req, res) => {
    const { publisher, writers, keys } = entryFor(req.params.slug)
    res.json({
      ...publisher, label: 'SYNTHETIC', keyLabel: keys?.simulated ? SIMULATED_KEY_LABEL : undefined,
      writers: writers.map(w => ({ slug: w.slug, name: w.name, bio: w.bio })), endpoints: endpointsFor(publisher.slug),
    })
  })
  app.get('/w/:slug/search', async (req, res) => {
    const entry = entryFor(req.params.slug)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const kRaw = req.query.k ?? '5'
    const k = typeof kRaw === 'string' && /^\d+$/.test(kRaw) ? Number(kRaw) : NaN
    if (!q || q.length > 300 || !Number.isInteger(k) || k < 1 || k > 10) throw new PublisherError(400, 'Expected q (1–300 characters) and k (1–10)')
    const vector = entry.index.vectors && embedder ? await embedder(q) : undefined
    const { mode, ranked } = await searchIndex(entry.index, q, k, vector)
    const byId = new Map(entry.articles.map(a => [a.articleId, a]))
    res.json(ranked.map(r => {
      const article = byId.get(r.articleId)!
      const relevance = reportedRelevance(entry.publisher.slug, r.relevance)
      return toSearchHit(article, relevance, mode, manifests.manifestFor(entry, article, relevance))
    }))
  })
  app.get('/w/:slug/articles/:id', (req, res) => {
    const entry = entryFor(req.params.slug)
    const article = ArticleParam.test(req.params.id) ? entry.articles.find(a => a.articleId === req.params.id) : undefined
    if (!article) throw new PublisherError(404, 'Article not found')
    // TODO(#128): x402 v2 PAYMENT-REQUIRED terms; until then a bare 402 with no body bytes.
    if (article.tier === 'PAID') { res.status(402).json({ error: 'Payment required', priceMinor: article.priceMinor, label }); return }
    const { body, passages, ...meta } = article
    res.json({ ...meta, label: 'SYNTHETIC', body, passages })
  })
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const malformed = error instanceof SyntaxError && 'body' in error
    const status = error instanceof PublisherError ? error.status : malformed ? 400 : 500
    // Never reflect input, corpus bytes, authorization headers or internal errors.
    res.status(status).json({ error: error instanceof PublisherError ? error.message : status === 400 ? 'Invalid JSON' : 'Publisher unavailable' })
  }
  app.use(handleError)
  return app
}
