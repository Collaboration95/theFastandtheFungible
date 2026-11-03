/** Pinned t54 package on both HTTP boundaries. Offline uses an explicitly synthetic ledger. */
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { Client, Wallet, decode, hashes } from 'xrpl'
import { requirePayment } from 'x402-xrpl/express'
import { FacilitatorClient, XRPLPresignedPaymentPayer, x402Fetch } from 'x402-xrpl'
import { openPaymentJournal } from '../../sdk/x402-journal.js'
import { createClient } from '../../sdk/index.js'
import { createPublisherApp } from '../../publisher/routes.js'
import { PublisherJournal } from '../../publisher/journal.js'
import { miniCorpus } from '../../tests/fixtures/corpus-mini/index.js'
import { hireLedger } from '../../tests/fixtures/hire-ledger.js'
import { decodeHeader } from '../../shared/x402.js'
import { DROPS_PER_MINOR } from '../../shared/contracts/publisher.js'
import type { Ledger } from '../../shared/xrpl.js'

export async function interop(live = false) {
  const ws = 'wss://s.altnet.rippletest.net:51233'
  const client = live ? new Client(ws) : undefined
  const synthetic = hireLedger()
  const ledger: Ledger = client ? { request: r => client.request(r as Parameters<Client['request']>[0]) } : synthetic.ledger
  const servers: ReturnType<express.Express['listen']>[] = []
  const journal = new PublisherJournal(':memory:')
  const payments = openPaymentJournal(':memory:')
  async function serve(app: express.Express) {
    const server = app.listen(0, '127.0.0.1'); servers.push(server); await once(server, 'listening')
    return `http://127.0.0.1:${(server.address() as { port: number }).port}`
  }
  try {
    await client?.connect()
    // Fresh faucet-only wallets, never environment seeds or real value.
    const payer = live ? (await client!.fundWallet()).wallet : Wallet.generate()
    const payee = live ? (await client!.fundWallet()).wallet : Wallet.generate()
    let facilitatorUrl = 'https://xrpl-facilitator-testnet.t54.ai'
    if (!live) {
      const fixture = express(); fixture.use(express.json())
      fixture.post('/verify', (req, res) => {
        const p = req.body.paymentPayload
        const tx = decode(String(p.payload.signedTxBlob))
        assert.equal(tx.SourceTag, 804681468)
        assert.equal(tx.DestinationTag, 7)
        res.json({ isValid: true, payer: tx.Account })
      })
      fixture.post('/settle', async (req, res) => {
        const p = req.body.paymentPayload
        const blob = String(p.payload.signedTxBlob)
        await ledger.request({ command: 'submit', tx_blob: blob })
        res.json({ success: true, transaction: hashes.hashSignedTx(blob), payer: decode(blob).Account, network: 'xrpl:1' })
      })
      facilitatorUrl = await serve(fixture)
    }
    const merchant = express()
    merchant.use(requirePayment({ path: '/hello', price: '1000', payToAddress: payee.classicAddress,
      network: 'xrpl:1', facilitator: new FacilitatorClient({ baseUrl: facilitatorUrl }), asset: 'XRP',
      maxTimeoutSeconds: 60, sourceTag: 804681468, extra: { destinationTag: 7 } }))
    merchant.get('/hello', (_req, res) => res.json({ label: live ? 'XRPL TESTNET; synthetic content; no real value' : 'SYNTHETIC ledger and content' }))
    const merchantUrl = await serve(merchant)
    const challenge = await fetch(`${merchantUrl}/hello`)
    assert.equal(challenge.status, 402)
    assert.ok(!(await challenge.text()).includes('synthetic content'))
    const sdk = createClient({ baseUrl: merchantUrl, payment: { wallet: payer, maxDrops: '1000', ledger, journal: payments } })
    if (!live) {
      const limited = createClient({ baseUrl: merchantUrl, payment: { wallet: payer, maxDrops: '999', ledger, journal: payments } })
      await assert.rejects(limited.pay(`${merchantUrl}/hello`))
      assert.equal(synthetic.submits, 0)
    }
    const a = await sdk.pay(`${merchantUrl}/hello`, { idempotencyKey: 'starter-kit-a' })
    assert.equal(a.response.status, 200); await a.response.body?.cancel()

    if (!live) {
      const count = synthetic.submits
      // t54 consumes the invoice. Retry may refuse delivery, but cannot sign/charge again.
      await assert.rejects(sdk.pay(`${merchantUrl}/hello`, { idempotencyKey: 'starter-kit-a' }))
      assert.equal(synthetic.submits, count)
    }

    const paid = miniCorpus.articles.find(a => a.tier === 'PAID')!
    const env = Object.fromEntries(miniCorpus.publishers.map(p => [`XRPL_PUBLISHER_${p.slug.toUpperCase().replace(/-/g, '_')}_SEED`, payee.seed!]))
    const publisher = createPublisherApp({ writers: miniCorpus, journal, rail: 'xrpl-testnet', ledger, env })
    await publisher.locals.ready
    const publisherUrl = await serve(publisher)
    const url = `${publisherUrl}/w/${paid.publisherSlug}/articles/${paid.articleId}`
    const unpaid = await fetch(url); assert.equal(unpaid.status, 402)
    assert.ok(!(await unpaid.text()).includes(paid.passages[0].text))
    const fakeClient = {
      request: async (r: Record<string, unknown>) => r.command === 'server_info' ? { result: { info: { network_id: 1 } } } : ledger.request(r),
      autofill: async (tx: object) => ({ ...tx, Fee: '12', Sequence: 1 + synthetic.txs.size }),
    } as unknown as Client
    const upstream = new XRPLPresignedPaymentPayer({ wallet: payer, network: 'xrpl:1', wsUrl: ws, maxFeeDrops: '2000' }, { client: client ?? fakeClient })
    let signedHeader = ''
    const buyer = x402Fetch({ wallet: payer, network: 'xrpl:1', maxValue: String(paid.priceMinor * DROPS_PER_MINOR),
      paymentHeaderFactory: async (req, params) => { signedHeader = await upstream.createPaymentHeader(req, params); return signedHeader } })
    const b = await buyer(url)
    assert.equal(b.status, 200, await b.clone().text())
    assert.ok((await b.text()).includes(paid.passages[0].text))
    const receipt = decodeHeader('PAYMENT-RESPONSE', b.headers.get('PAYMENT-RESPONSE'))
    const count = synthetic.submits
    const replay = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': signedHeader } })
    assert.equal(replay.status, 200); await replay.body?.cancel()
    assert.equal(decodeHeader('PAYMENT-RESPONSE', replay.headers.get('PAYMENT-RESPONSE')).transaction, receipt.transaction)
    if (!live) assert.equal(synthetic.submits, count)
    return { label: live ? 'XRPL TESTNET; no real value' : 'SYNTHETIC ledger; no network submission', sdkToStarterKit: a.payment.txHash, starterKitToPublisher: receipt.transaction }
  } finally {
    for (const server of servers) { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) }
    payments.close(); journal.close(); await client?.disconnect()
  }
}
