// #128: the PAID article route answers 402 with an x402 v2 PAYMENT-REQUIRED header bound to the manifest root.
import { afterEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { createPublisherApp } from '../publisher/routes.js'
import { DROPS_PER_MINOR } from '../shared/contracts/publisher.js'
import { SearchHitSchema } from '../shared/contracts/manifest.js'
import { invoiceIdFor, ledgerInvoiceId } from '../shared/x402.js'
import { required } from './fixtures/x402-payer.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })
async function serve() {
  const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', writers: miniCorpus, env: {} })
  await app.locals.ready; await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  return { base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, journal: app.locals.journal }
}
const paid = miniCorpus.articles.find(a => a.tier === 'PAID')!

describe('x402 v2 PAYMENT-REQUIRED (#128)', () => {
  it('decodes, and its invoiceId binds the manifest root of that article version', async () => {
    const { base, journal } = await serve()
    const response = await fetch(`${base}/w/${paid.publisherSlug}/articles/${paid.articleId}`)
    expect(response.status).toBe(402)
    expect(await response.text()).not.toContain(paid.passages[0].text)
    const header = required(response)
    const accepted = header.accepts[0]
    const hit = SearchHitSchema.array().parse(await (await fetch(`${base}/w/${paid.publisherSlug}/search?q=${encodeURIComponent(paid.title)}`)).json()).find(h => h.articleId === paid.articleId)!
    expect(header).toMatchObject({ x402Version: 2, resource: { url: `/w/${paid.publisherSlug}/articles/${paid.articleId}`, description: expect.stringContaining('SIMULATED') } })
    expect(accepted).toMatchObject({ scheme: 'exact', network: 'xrpl:1', asset: 'XRP', amount: String(paid.priceMinor * DROPS_PER_MINOR), payTo: hit.manifest!.wallet, maxTimeoutSeconds: 60 })
    const bound = JSON.parse(accepted.extra.invoiceId) as { quoteId: string }
    expect(accepted.extra.invoiceId).toBe(invoiceIdFor({ quoteId: bound.quoteId, articleId: paid.articleId, version: paid.version, manifestRoot: hit.manifest!.root, amount: accepted.amount, payTo: accepted.payTo }))
    // Persisted, keyed by the on-ledger InvoiceID.
    expect(journal.quoteByInvoice(ledgerInvoiceId(accepted.extra.invoiceId))).toMatchObject({ invoiceId: accepted.extra.invoiceId, articleId: paid.articleId })
  })

  it('issues a fresh quote per 402, and FREE articles never need one', async () => {
    const { base } = await serve()
    const url = `${base}/w/${paid.publisherSlug}/articles/${paid.articleId}`
    const [a, b] = [required(await fetch(url)), required(await fetch(url))]
    expect(a.accepts[0].extra.invoiceId).not.toBe(b.accepts[0].extra.invoiceId)
    const free = miniCorpus.articles.find(x => x.tier === 'FREE')!
    expect((await fetch(`${base}/w/${free.publisherSlug}/articles/${free.articleId}`)).status).toBe(200)
  })

  it('has removed the 5-hop flow: /v1/quotes and /v1/settlements return 404', async () => {
    const { base } = await serve()
    for (const path of ['/v1/quotes', '/v1/settlements']) expect((await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(404)
  })
})
