import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Wallet, decode, hashes } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { createApiApp } from '../server/routes.js'
import { alphaLeakCorpus, miniCorpus } from './fixtures/corpus-mini/index.js'
import { alphaLeakArticle, candidateFrom } from './fixtures/pay-path.js'
import { challenge } from '../server/challenges.js'
import { testnetUrl, type Ledger } from '../shared/xrpl.js'
import { encodeHeader, ledgerInvoiceId } from '../shared/x402.js'
import { required } from './fixtures/x402-payer.js'

// Throwaway Testnet test seeds for the two paid publishers (Load Factor and AlphaLeak); each signs its manifests.
const GRID_SEED = Wallet.generate().seed!, SUPPLIER_SEED = Wallet.generate().seed!
const GRID_WALLET = Wallet.fromSeed(GRID_SEED).classicAddress, SUPPLIER_WALLET = Wallet.fromSeed(SUPPLIER_SEED).classicAddress
import { PublicCandidateSchema, type PublicCandidate } from '../shared/contracts/index.js'

/** In-memory Testnet: applies submitted blobs, validates them (or not), and answers tx lookups. */
function fakeLedger() {
  const state = { balance: '100000000', owners: 0, ledgerAge: 1, ledger: 100, submits: 0, validate: true, record: true, sequenceUsedElsewhere: 0, result: 'tesSUCCESS', delivered: undefined as string | undefined }
  const txs = new Map<string, { tx_json: Record<string, unknown>; meta: Record<string, unknown>; validated: boolean; ledger_index: number }>()
  const ledger: Ledger = {
    async request(r) {
      switch (r.command) {
        case 'account_info': return { result: { account_data: { Sequence: 7 + txs.size + state.sequenceUsedElsewhere, Balance: state.balance, OwnerCount: state.owners } } }
        case 'ledger_current': return { result: { ledger_current_index: state.ledger } }
        case 'server_info': return { result: { info: { validated_ledger: { age: state.ledgerAge, reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }
        case 'fee': return { result: { drops: { open_ledger_fee: '10' } } }
        case 'ledger': return { result: { ledger_index: state.ledger } }
        case 'submit': {
          state.submits++
          const blob = String(r.tx_blob), hash = hashes.hashSignedTx(blob)
          if (state.record && !txs.has(hash)) {
            const tx = decode(blob) as Record<string, unknown>
            txs.set(hash, { tx_json: tx, meta: { TransactionResult: state.result, delivered_amount: state.delivered ?? tx.Amount }, validated: state.validate, ledger_index: ++state.ledger })
          }
          return { result: { engine_result: 'tesSUCCESS' } }
        }
        case 'tx': {
          const found = txs.get(String(r.transaction).toUpperCase())
          if (!found) throw Object.assign(new Error('Transaction not found.'), { data: { error: 'txnNotFound' } })
          return { result: found }
        }
      }
      throw new Error(`unexpected ${String(r.command)}`)
    },
  }
  return { state, txs, ledger }
}

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn() })

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'xrpl-test-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  const chain = fakeLedger()
  const app = createPublisherApp({ journal: join(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger: chain.ledger, facilitatorTiming: { pollMs: 5, timeoutMs: 100 },
    // The ledger view lists paid publishers from the writer registry (#138).
    writers: alphaLeakCorpus, env: { XRPL_PUBLISHER_LOAD_FACTOR_SEED: GRID_SEED, XRPL_PUBLISHER_ALPHALEAK_SEED: SUPPLIER_SEED } })
  await app.locals.ready
  await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  cleanup.push(() => new Promise(resolve => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const client = new PublisherClient({ baseUrl })
  const store = new Store(join(dir, 'app.db')); cleanup.push(() => store.close())
  const wallet = Wallet.generate()
  const payer = new XrplPayer(chain.ledger, wallet, { pollMs: 5, timeoutMs: 200 })
  const candidate = PublicCandidateSchema.parse(await candidateFrom(baseUrl, PAID))
  const run = store.createRun('Will it be operating by 2028?', 200)
  return { chain, client, store, payer, wallet, candidate, run, baseUrl, dir }
}
const PAID = miniCorpus.articles.find(a => a.tier === 'PAID')!
const CONTENT = `/w/${PAID.publisherSlug}/articles/${PAID.articleId}`
const DROPS = String(PAID.priceMinor * 1000)
/** Resend the buyer's persisted blob, exactly as reconcile() would. */
function resend(s: Awaited<ReturnType<typeof setup>>, intentId: string) {
  const intent = s.store.getIntent(intentId)!
  const accepted = { scheme: 'exact' as const, network: 'xrpl:1' as const, amount: intent.quote!.payment!.amountDrops, asset: 'XRP' as const, payTo: intent.quote!.payment!.payTo, maxTimeoutSeconds: 60, extra: { invoiceId: intent.quote!.quoteId, areFeesSponsored: false as const } }
  return fetch(s.baseUrl + CONTENT, { headers: { 'PAYMENT-SIGNATURE': encodeHeader('PAYMENT-SIGNATURE', { x402Version: 2, accepted, payload: { signedTxBlob: s.store.getSubmission(intentId)!.txBlob } }) } })
}
const buy = (s: Awaited<ReturnType<typeof setup>>, manager: PurchaseManager, intentId = 'intent-1', candidate: PublicCandidate = s.candidate) =>
  manager.purchase({ runId: s.run.runId, candidate, intentId })

describe('XRPL Testnet settlement rail', () => {
  it('advertises xrpl:1 in the 402 and pays exactly once, bound to the quote by InvoiceID', async () => {
    const s = await setup()
    const challenge = await fetch(`${s.baseUrl}${CONTENT}`)
    expect(challenge.status).toBe(402)
    const header = required(challenge)
    expect(header.resource.description).toContain('XRPL TESTNET · no real value')
    expect(header.accepts[0]).toMatchObject({ network: 'xrpl:1', asset: 'XRP', amount: DROPS, payTo: GRID_WALLET })
    expect(await challenge.text()).not.toContain(PAID.passages[0].text)

    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    expect(intent.status).toBe('VERIFIED')
    expect(s.chain.txs.size).toBe(1)
    const [[hash, onLedger]] = [...s.chain.txs]
    expect(onLedger.tx_json.LastLedgerSequence).toBe(s.store.getSubmission(intent.intentId)!.lastLedgerSequence)
    expect(onLedger.tx_json).toMatchObject({ TransactionType: 'Payment', Account: s.wallet.classicAddress, Destination: GRID_WALLET, Amount: DROPS, InvoiceID: intent.quote!.quoteHash.toUpperCase() })
    const run = s.store.getRun(s.run.runId)
    expect(run.spentMinor).toBe(PAID.priceMinor)
    expect(run.receipts[0]).toMatchObject({ label: 'XRPL TESTNET · no real value', xrpl: { txHash: hash, payTo: GRID_WALLET, amountDrops: DROPS, payer: s.wallet.classicAddress, explorerUrl: `https://testnet.xrpl.org/transactions/${hash}` } })
    expect(run.intents[0].txHash).toBe(hash)
    expect(run.events.filter(e => e.type === 'XRPL').map(e => e.label).join(' ')).toMatch(/Signed payment · S\$0\.60 ≈ 0\.06 XRP \(Testnet rate\).*Validated in ledger.*Publisher verified/)
    expect(JSON.stringify(run)).not.toContain(s.wallet.seed!)
  })

  it('pays each publisher at its own wallet and refuses a payee the policy did not evaluate', async () => {
    const s = await setup()
    const payees = await Promise.all([`/w/alphaleak/articles/${alphaLeakArticle.articleId}`, CONTENT].map(async path => required(await fetch(s.baseUrl + path)).accepts[0].payTo))
    expect(payees).toEqual([SUPPLIER_WALLET, GRID_WALLET])
    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer), 'redirected', { ...s.candidate, wallet: SUPPLIER_WALLET })
    expect(intent).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining('payee differs') })
    expect(s.chain.state.submits).toBe(0)
  })

  it('signs and submits once when the same intent is bought concurrently', async () => {
    const s = await setup()
    const a = new PurchaseManager(s.store, s.client, s.payer), b = new PurchaseManager(s.store, s.client, s.payer)
    await Promise.all([buy(s, a), buy(s, a), buy(s, b)])
    expect(s.chain.txs.size).toBe(1)
    expect(s.chain.state.submits).toBe(1)
    expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
  })

  it('refuses a payment whose ledger amount differs from the quote and issues no receipt', async () => {
    const s = await setup()
    s.chain.state.delivered = '1'
    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    expect(intent.status).toBe('SUBMITTING')
    expect(s.store.getRun(s.run.runId).receipts).toHaveLength(0)
    const response = await resend(s, intent.intentId)
    expect(response.status).toBe(402)
    expect((await response.json()).error).toContain('wrong delivered amount')
  })

  it('never lets one ledger payment settle a different quote', async () => {
    const s = await setup()
    const first = await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    expect(first.status).toBe('VERIFIED')
    const other = required(await fetch(s.baseUrl + CONTENT)).accepts[0]
    const blob = s.store.getSubmission(first.intentId)!.txBlob
    const response = await fetch(s.baseUrl + CONTENT, { headers: { 'PAYMENT-SIGNATURE': encodeHeader('PAYMENT-SIGNATURE', { x402Version: 2, accepted: other, payload: { signedTxBlob: blob } }) } })
    expect(response.status).toBe(402)
    expect((await response.json()).error).toContain('another invoice')
  })

  it('refuses to sign when the quoted drops differ from the policy-approved price', async () => {
    const s = await setup()
    const accepted = required(await fetch(s.baseUrl + CONTENT)).accepts[0]
    const quoteHash = ledgerInvoiceId(accepted.extra.invoiceId)
    s.store.reserveIntent({ runId: s.run.runId, intentId: 'tampered', profileId: PAID.publisherSlug, resourceId: PAID.articleId, version: 'v1', amountMinor: PAID.priceMinor, status: 'QUOTED', paidPath: CONTENT, quote: {
      runId: s.run.runId, intentId: 'tampered', profileId: PAID.publisherSlug, resourceId: PAID.articleId, version: 'v1', quoteId: accepted.extra.invoiceId, quoteHash, amountMinor: PAID.priceMinor, currency: 'SGD',
      expiresAt: new Date(Date.now() + 60_000).toISOString(), contentDigest: JSON.parse(accepted.extra.invoiceId).manifestRoot,
      payment: { rail: 'xrpl-testnet', network: 'xrpl:1', asset: 'XRP', payTo: accepted.payTo, amountDrops: '8000000', invoiceId: quoteHash },
    } })
    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer), 'tampered')
    expect(intent.status).toBe('FAILED_NOT_SETTLED')
    expect(s.chain.state.submits).toBe(0)
    expect(s.store.getRun(s.run.runId).reservedMinor).toBe(0)
  })

  it('after a restart, settles a stored payment that validated without signing again', async () => {
    const s = await setup()
    s.chain.state.validate = false
    expect((await buy(s, new PurchaseManager(s.store, s.client, s.payer))).status).toBe('SUBMITTING')
    for (const tx of s.chain.txs.values()) tx.validated = true
    const restarted = new PurchaseManager(s.store, s.client, new XrplPayer(s.chain.ledger, s.wallet, { pollMs: 5, timeoutMs: 200 }))
    await restarted.reconcile()
    const run = s.store.getRun(s.run.runId)
    expect(run.intents[0].status).toBe('VERIFIED')
    expect(s.chain.txs.size).toBe(1)
    expect(run.receipts).toHaveLength(1)
  })

  it('after a restart, releases the reservation when the payment expired off-ledger', async () => {
    const s = await setup()
    s.chain.state.record = false
    expect((await buy(s, new PurchaseManager(s.store, s.client, s.payer))).status).toBe('SUBMITTING')
    expect(s.store.getRun(s.run.runId).reservedMinor).toBe(PAID.priceMinor)
    s.chain.state.ledger += 50 // past LastLedgerSequence (current + 20)
    await new PurchaseManager(s.store, s.client, s.payer).reconcile()
    const run = s.store.getRun(s.run.runId)
    expect(run.intents[0]).toMatchObject({ status: 'FAILED_NOT_SETTLED' })
    expect(run.reservedMinor).toBe(0); expect(run.spentMinor).toBe(0)
  })

  it('keeps the reservation when the payer Sequence moved (the payment may have applied)', async () => {
    const s = await setup()
    s.chain.state.record = false
    await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    s.chain.state.ledger += 50; s.chain.state.sequenceUsedElsewhere = 1
    await new PurchaseManager(s.store, s.client, s.payer).reconcile()
    expect(s.store.getRun(s.run.runId)).toMatchObject({ reservedMinor: PAID.priceMinor, intents: [{ status: 'SUBMITTING' }] })
  })

  it('refuses to settle simulated while the run is labelled XRPL', async () => {
    const s = await setup()
    const simulated = createPublisherApp({ journal: join(s.dir, 'simulated.db'), rail: 'simulated', writers: alphaLeakCorpus, env: {} })
    await simulated.locals.ready
    const server = simulated.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    cleanup.push(() => new Promise(resolve => server.close(resolve)))
    const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })
    const intent = await new PurchaseManager(s.store, client, s.payer).purchase({ runId: s.run.runId, candidate: s.candidate, intentId: 'off-rail' })
    expect(intent).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining('not on the XRPL') })
    expect(s.store.getRun(s.run.runId).receipts).toHaveLength(0)
  })

  it('without a payer seed, nothing is signed and the purchase fails visibly', async () => {
    const s = await setup()
    const intent = await buy(s, new PurchaseManager(s.store, s.client, new XrplPayer(s.chain.ledger)))
    expect(intent).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: expect.stringContaining('not configured') })
    expect(s.chain.state.submits).toBe(0)
  })

  it('serves a read-only ledger view: buyer plus the registry paid publisher wallets, never a seed', async () => {
    const s = await setup()
    const api = await createApiApp({ dbPath: join(s.dir, 'api.db'), publisherUrl: s.baseUrl, secret: 'xrpl-secret', reportDir: join(s.dir, 'reports'), payer: s.payer })
    const server = api.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    cleanup.push(() => new Promise(resolve => { server.close(resolve); api.close() }))
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ledger`)
    const view = await response.json()
    expect(view.rail).toBe('xrpl-testnet')
    expect(view.wallets.map((w: { name: string }) => w.name).sort()).toEqual(['AlphaLeak', 'Load Factor', 'ResearchAgent (buyer)'])
    expect(new Set(view.wallets.map((w: { address: string }) => w.address)).size).toBe(3)
    expect(view.wallets[0]).toMatchObject({ address: s.wallet.classicAddress, balanceDrops: '100000000' })
    expect(JSON.stringify(view)).not.toContain(s.wallet.seed!)
  })

  it('gate-5: a failed proof is challenged and refunded on the Testnet once, verified by the buyer on the ledger, labelled XRPL TESTNET', async () => {
    const chain = fakeLedger()
    const alphaSeed = Wallet.generate().seed!
    const app = createPublisherApp({ journal: ':memory:', rail: 'xrpl-testnet', ledger: chain.ledger, facilitatorTiming: { pollMs: 5, timeoutMs: 100 }, writers: alphaLeakCorpus, env: { XRPL_PUBLISHER_LOAD_FACTOR_SEED: Wallet.generate().seed!, XRPL_PUBLISHER_ALPHALEAK_SEED: alphaSeed } })
    await app.locals.ready; await app.locals.writersReady
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    cleanup.push(() => new Promise(resolve => server.close(() => { app.locals.journal.close(); resolve(undefined) })))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const store = new Store(':memory:'); cleanup.push(() => store.close())
    const wallet = Wallet.generate()
    const manager = new PurchaseManager(store, new PublisherClient({ baseUrl }), new XrplPayer(chain.ledger, wallet, { pollMs: 5, timeoutMs: 200 }))
    const run = store.createRun('question', 200)
    const intent = await manager.purchase({ runId: run.runId, candidate: await candidateFrom(baseUrl), intentId: 'leak' })
    expect(intent.status).toBe('CLAIM_FAILED')
    const [refunded, again] = await Promise.all([challenge(manager, 'leak', { pollMs: 5, timeoutMs: 500 }), challenge(manager, 'leak', { pollMs: 5 })])
    expect(refunded.status).toBe('REFUNDED')
    expect(again.refund).toEqual(refunded.refund)
    const refunds = [...chain.txs.values()].filter(t => t.tx_json.InvoiceID === intent.txHash)
    expect(refunds).toHaveLength(1)
    expect(refunds[0].tx_json).toMatchObject({ TransactionType: 'Payment', Account: Wallet.fromSeed(alphaSeed).classicAddress, Destination: wallet.classicAddress, Amount: String(alphaLeakArticle.priceMinor * 1000) })
    const snapshot = store.getRun(run.runId)
    expect(snapshot.events.find(e => e.type === 'REFUND')).toMatchObject({ label: expect.stringContaining('XRPL TESTNET'), data: { explorerUrl: `https://testnet.xrpl.org/transactions/${refunded.refund!.txHash}` } })
    expect(snapshot).toMatchObject({ spentMinor: alphaLeakArticle.priceMinor, refundedMinor: alphaLeakArticle.priceMinor })
    expect(JSON.stringify(snapshot)).not.toContain(alphaSeed)
  })

  it('gate-3: a matching payment from a wallet other than the paid publisher is not a refund (CHALLENGE_REFUSED)', async () => {
    const chain = fakeLedger()
    const app = createPublisherApp({ journal: ':memory:', rail: 'xrpl-testnet', ledger: chain.ledger, facilitatorTiming: { pollMs: 5, timeoutMs: 100 }, writers: alphaLeakCorpus, env: { XRPL_PUBLISHER_LOAD_FACTOR_SEED: Wallet.generate().seed!, XRPL_PUBLISHER_ALPHALEAK_SEED: Wallet.generate().seed! } })
    await app.locals.ready; await app.locals.writersReady
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    cleanup.push(() => new Promise(resolve => server.close(() => { app.locals.journal.close(); resolve(undefined) })))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const store = new Store(':memory:'); cleanup.push(() => store.close())
    const buyer = Wallet.generate()
    const manager = new PurchaseManager(store, new PublisherClient({ baseUrl }), new XrplPayer(chain.ledger, buyer, { pollMs: 5, timeoutMs: 200 }))
    const run = store.createRun('question', 200)
    const intent = await manager.purchase({ runId: run.runId, candidate: await candidateFrom(baseUrl), intentId: 'leak' })
    expect(intent.status).toBe('CLAIM_FAILED')
    // A stranger sends exactly the refund the buyer expects (destination, amount, InvoiceID); the publisher claims it.
    const stranger = Wallet.generate()
    const forged = stranger.sign({ TransactionType: 'Payment', Account: stranger.classicAddress, Destination: buyer.classicAddress, Amount: String(alphaLeakArticle.priceMinor * 1000), InvoiceID: intent.txHash!, Sequence: 1, Fee: '12', LastLedgerSequence: 999 })
    await chain.ledger.request({ command: 'submit', tx_blob: forged.tx_blob })
    manager.client.challenge = async () => ({ status: 'REFUNDED', refundTxHash: forged.hash.toUpperCase() })
    const result = await challenge(manager, 'leak', { pollMs: 5, timeoutMs: 200 })
    expect(result.status).toBe('CHALLENGE_REFUSED')
    expect(result.refund).toBeUndefined()
    expect(store.getRun(run.runId).refundedMinor).toBe(0)
  })

  it('only accepts Testnet endpoints', () => {
    expect(testnetUrl('wss://s.altnet.rippletest.net:51233')).toBe('wss://s.altnet.rippletest.net:51233')
    expect(() => testnetUrl('wss://xrplcluster.com')).toThrow(/Testnet/)
    expect(() => testnetUrl('wss://s1.ripple.com')).toThrow(/Testnet/)
  })
})


describe('live payment operations (#287)', () => {
  it('refuses low balance before signing, with no submission row or charge', async () => {
    const s = await setup()
    s.chain.state.balance = '1001000'
    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    expect(intent).toMatchObject({ status: 'FAILED_NOT_SETTLED', error: 'Payer balance below reserve; nothing was charged' })
    expect(s.store.getSubmission(intent.intentId)).toBeUndefined()
    expect(s.chain.state.submits).toBe(0)
    expect(s.store.getRun(s.run.runId).reservedMinor).toBe(0)
  })

  it.each(['before-submit', 'submit-timeout', 'confirmed-not-recorded'])('recovers %s in live ticks with one persisted signature and one charge', async fault => {
    const s = await setup()
    const manager = new PurchaseManager(s.store, s.client, s.payer)
    const original = s.client.paidGet.bind(s.client)
    let inject = true
    s.client.paidGet = async (path, signature, observer) => {
      if (signature && inject) {
        inject = false
        if (fault !== 'before-submit') await original(path, signature, observer)
        throw new Error('Injected crash/timeout after persist')
      }
      return original(path, signature, observer)
    }
    const pending = await buy(s, manager)
    const blob = s.store.getSubmission(pending.intentId)!
    expect(pending.status).toBe('SUBMITTING')
    expect(s.store.getRun(s.run.runId).receipts).toHaveLength(0)
    await manager.reconcile()
    await manager.reconcile()
    expect(s.store.getIntent(pending.intentId)?.status).toBe('VERIFIED')
    expect(s.store.getSubmission(pending.intentId)).toEqual(blob)
    expect(s.chain.txs.size).toBe(1)
    expect(s.chain.state.submits).toBe(1)
    expect(s.store.getRun(s.run.runId)).toMatchObject({ spentMinor: PAID.priceMinor, reservedMinor: 0 })
    expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
  })

  it('records a ledger-confirmed payment while the publisher is down, preserving the charge', async () => {
    const s = await setup()
    const original = s.client.paidGet.bind(s.client)
    s.client.paidGet = async (path, signature, observer) => {
      const result = await original(path, signature, observer)
      if (signature) throw new Error('Lost receipt')
      return result
    }
    const manager = new PurchaseManager(s.store, s.client, s.payer)
    const pending = await buy(s, manager)
    s.client.paidGet = async () => { throw new Error('Publisher down') }
    await manager.reconcile()
    expect(s.store.getIntent(pending.intentId)?.status).toBe('DELIVERY_FAILED')
    expect(s.store.getRun(s.run.runId)).toMatchObject({ spentMinor: PAID.priceMinor, reservedMinor: 0 })
    expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
    expect(s.chain.state.submits).toBe(1)
  })

  it('releases the payer sequence before a slow writer delivers, and fails unresolved sequences without signing', async () => {
    const s = await setup()
    // Obtain a valid immutable invoice through the normal purchase path first.
    await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    const terms = s.store.getIntent('intent-1')!.quote!.payment!
    let release!: () => void
    const delivery = new Promise<void>(resolve => { release = resolve })
    const signed: import('../server/xrpl.js').Submission[] = []
    const persist = (blob: import('../server/xrpl.js').Submission) => { signed.push(blob); return blob }
    const first = await s.payer.pay(terms, persist, async blob => {
      await s.chain.ledger.request({ command: 'submit', tx_blob: blob.txBlob })
      await delivery
    })
    const second = await s.payer.pay(terms, persist, async blob => { await s.chain.ledger.request({ command: 'submit', tx_blob: blob.txBlob }) })
    expect(signed).toHaveLength(2) // The first HTTP delivery is still blocked.
    expect((decode(signed[1].txBlob) as { Sequence: number }).Sequence).toBe((decode(signed[0].txBlob) as { Sequence: number }).Sequence + 1)
    release(); await first.sent; await second.sent
    s.chain.state.record = false
    const pending = await s.payer.pay(terms, persist, async () => {})
    await pending.sent
    const count = signed.length
    await expect(s.payer.pay(terms, persist, async () => {})).rejects.toThrow('Previous payer sequence unresolved')
    expect(signed).toHaveLength(count)
  })

  it('deep health reports a stale ledger and guards metrics and dependency detail with #301 auth', async () => {
    const s = await setup()
    s.chain.state.ledgerAge = 90
    vi.stubEnv('RA_API_TOKEN', 'ops-test-token-287')
    const api = await createApiApp({ dbPath: ':memory:', publisherUrl: s.baseUrl, payer: s.payer })
    const server = api.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    cleanup.push(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await api.close(); vi.unstubAllEnvs() })
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    expect((await fetch(base + '/health')).status).toBe(200)
    for (const path of ['/api/metrics', '/api/health?deep=1']) expect((await fetch(base + path)).status).toBe(401)
    const headers = { Authorization: 'Bearer ops-test-token-287' }
    const health = await (await fetch(base + '/api/health?deep=1', { headers })).json()
    expect(health).toMatchObject({ status: 'degraded', database: 'ok', publisher: 'ok', ledger: { ledgerAgeSeconds: expect.any(Number) } })
    expect(health.reasons).toContain('Validated ledger is stale (>30 s)')
    const metric = await (await fetch(base + '/api/metrics', { headers })).json()
    expect(metric).toMatchObject({ schema: 'operations-v1', reconcileBacklog: { count: 0 }, spendTodayBySurface: { mcp: { spentMinor: 0 } } })
    expect(JSON.stringify([health, metric])).not.toContain(s.wallet.seed!)
    expect(JSON.stringify([health, metric])).not.toContain('ops-test-token-287')
  })
})

it('uses live owner reserves and caches the balance conservatively for five seconds', async () => {
  const s = await setup()
  s.chain.state.balance = '3000000'; s.chain.state.owners = 5
  expect(await s.payer.balance()).toMatchObject({ balanceDrops: 3000000, reserveDrops: 2000000, availableDrops: 1000000 })
  s.chain.state.balance = '1001000'
  expect((await s.payer.balance()).balanceDrops).toBe(3000000)
  const now = Date.now
  Date.now = () => now() + 5001
  try { expect((await s.payer.balance()).balanceDrops).toBe(1001000) } finally { Date.now = now }
})
