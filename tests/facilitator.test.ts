// #129: the publisher's facilitator on the SIMULATED rail: same checks as the Testnet, local signer, no network.
import { afterEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { Wallet } from 'xrpl'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { createPublisherApp } from '../publisher/routes.js'
import type { Manifests } from '../publisher/manifest.js'
import { leafHash, manifestRoot } from '../shared/manifest.js'
import { simulatedLedgerIndex } from '../shared/xrpl.js'
import { paymentResponse, required, signFor, type Tamper } from './fixtures/x402-payer.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })
const paid = miniCorpus.articles.find(a => a.tier === 'PAID')!
async function serve() {
  const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', writers: miniCorpus, env: {} })
  await app.locals.ready; await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanups.push(async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const url = `${base}/w/${paid.publisherSlug}/articles/${paid.articleId}`
  const quote = async () => required(await fetch(url)).accepts[0]
  const pay = (header: string) => fetch(url, { headers: { 'PAYMENT-SIGNATURE': header } })
  return { base, url, quote, pay, journal: app.locals.journal, manifests: app.locals.manifests as Manifests }
}

describe('publisher facilitator (#129)', () => {
  it('happy path: delivers body, passages and salts that recompute the invoiced root, with PAYMENT-RESPONSE', async () => {
    const s = await serve()
    const accepted = await s.quote()
    const { header, hash } = signFor(accepted)
    const response = await s.pay(header)
    expect(response.status).toBe(200)
    expect(paymentResponse(response)).toMatchObject({ success: true, transaction: hash, network: 'xrpl:1' })
    const delivery = await response.json() as { body: string; passages: { id: string; text: string }[]; salts: string[]; label: string }
    expect(delivery.body).toBe(paid.body)
    expect(delivery.label).toContain('SIMULATED')
    const root = manifestRoot(delivery.passages.map((p, i) => leafHash(delivery.salts[i], i, p.id, p.text)))
    expect(JSON.parse(accepted.extra.invoiceId).manifestRoot).toBe(root)
  })

  it.each<[string, (accepted: { payTo: string }) => Tamper]>([
    ['wrong amount', () => ({ Amount: '1' })],
    ['wrong payee', () => ({ Destination: Wallet.generate().classicAddress })],
    ['unknown invoice', () => ({ InvoiceID: 'A'.repeat(64) })],
    ['past LastLedgerSequence', () => ({ LastLedgerSequence: simulatedLedgerIndex() - 1 })],
  ])('%s → 402 with an error and no settlement', async (_name, tamper) => {
    const s = await serve()
    const accepted = await s.quote()
    const { header, hash } = signFor(accepted, tamper(accepted))
    const response = await s.pay(header)
    expect(response.status).toBe(402)
    expect(paymentResponse(response)).toMatchObject({ success: false, transaction: '', errorReason: expect.any(String) })
    expect(await response.text()).not.toContain(paid.passages[0].text)
    expect(s.journal.settlementByTx(hash)).toBeUndefined()
  })

  it('refuses a payer other than the SIMULATED test key on the simulated rail', async () => {
    const s = await serve()
    const response = await s.pay(signFor(await s.quote(), {}, Wallet.generate()).header)
    expect(response.status).toBe(402)
    expect(paymentResponse(response).errorReason).toContain('SIMULATED test payer')
  })

  it('a duplicate blob returns the same delivery with one settlement; another payment for the same quote is refused', async () => {
    const s = await serve()
    const accepted = await s.quote()
    const { header, hash } = signFor(accepted)
    const [a, b] = [await s.pay(header), await s.pay(header)]
    expect([a.status, b.status]).toEqual([200, 200])
    expect(await a.text()).toBe(await b.text())
    expect(paymentResponse(b).transaction).toBe(hash)
    const other = signFor(accepted, { Sequence: 2 })
    const response = await s.pay(other.header)
    expect(response.status).toBe(402)
    expect(paymentResponse(response).errorReason).toContain('already settled')
  })

  it('parallel identical requests settle once', async () => {
    const s = await serve()
    const { header, hash } = signFor(await s.quote())
    const responses = await Promise.all(Array.from({ length: 12 }, () => s.pay(header)))
    expect(responses.map(r => r.status)).toEqual(Array(12).fill(200))
    expect(new Set(responses.map(r => paymentResponse(r).transaction))).toEqual(new Set([hash]))
    expect(s.journal.settlementByTx(hash)).toMatchObject({ txHash: hash })
  })

  it('exposes verify (read-only), settle and supported', async () => {
    const s = await serve()
    const facilitator = `${s.base}/w/${paid.publisherSlug}/facilitator`
    expect(await (await fetch(`${facilitator}/supported`)).json()).toMatchObject({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'xrpl:1' }] })
    const accepted = await s.quote()
    const { blob, hash } = signFor(accepted)
    const body = JSON.stringify({ paymentPayload: { x402Version: 2, accepted, payload: { signedTxBlob: blob } }, paymentRequirements: accepted })
    const post = (path: string) => fetch(`${facilitator}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    expect(await (await post('verify')).json()).toMatchObject({ isValid: true })
    expect(s.journal.settlementByTx(hash)).toBeUndefined()
    expect(await (await post('settle')).json()).toMatchObject({ success: true, transaction: hash })
    expect((await fetch(`${facilitator}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(400)
  })

  it('never puts salts in search results', async () => {
    const s = await serve()
    const salts = s.manifests.saltsFor(paid)
    const text = await (await fetch(`${s.base}/w/${paid.publisherSlug}/search?q=${encodeURIComponent(paid.title)}`)).text()
    for (const salt of salts) expect(text).not.toContain(salt)
  })
})
