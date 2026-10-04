import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { ContentEnvelopeSchema, CorpusResourceSchema, PublicCandidateSchema, type CorpusResource } from '../shared/contracts/corpus.js'
import { ProfileSchema, QuoteRequestSchema, SettlementRequestSchema } from '../shared/contracts/publisher.js'
import { loadCorpus } from './corpus.js'
import { digestBytes, PublisherError, PublisherJournal } from './journal.js'

export type PublisherConfig = {
  corpus?: CorpusResource[] | Promise<CorpusResource[]>
  journal?: PublisherJournal | string
  secret?: string
  faults?: boolean
}
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
  let failNextDelivery = false
  let corpus: CorpusResource[] = []
  const ready = Promise.resolve(config.corpus ?? loadCorpus()).then(resources => {
    corpus = resources.map(resource => CorpusResourceSchema.parse(resource))
  })
  // Attach a rejection handler immediately; requests/startup still receive the original error.
  void ready.catch(() => {})
  app.locals.ready = ready
  app.locals.journal = journal
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
    res.json({ status: 'ok', publisher: 'local', settlement: 'SIMULATED SGD · no real funds' })
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
      res.status(402).json({
        x402Version: 1, label: 'x402-shaped · SIMULATED SGD · no real funds',
        accepts: [{ network: 'simulated-sgd', amount: String(resource!.price.amountMinor),
          resource: req.path, payTo: p, quoteEndpoint: '/v1/quotes' }],
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
    res.json(journal.quote(request, resource.price.amountMinor, serializeEnvelope(resource)))
  })
  app.post('/v1/settlements', authenticate, (req, res) => {
    const parsed = SettlementRequestSchema.safeParse(req.body)
    if (!parsed.success) throw new PublisherError(400, 'Invalid settlement request')
    res.json(journal.settle(parsed.data))
  })
  app.get('/v1/settlements/:intentId', authenticate, (req, res) => {
    res.json(journal.settlement(String(req.params.intentId)))
  })
  if (faults) app.post('/__faults', authenticate, (req, res) => {
    if (req.body?.failNextDelivery !== true) throw new PublisherError(400, 'Expected failNextDelivery: true')
    failNextDelivery = true
    res.json({ failNextDelivery: true, label: 'SIMULATED fault' })
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
