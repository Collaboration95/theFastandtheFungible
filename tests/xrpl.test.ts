import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { Wallet, decode, hashes } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { loadCorpus } from '../publisher/corpus.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { createApiApp } from '../server/routes.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { testnetUrl, type Ledger } from '../shared/xrpl.js'

const GRID_WALLET = 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp' // Grid Operators Report's own Testnet wallet
import { PublicCandidateSchema, type PublicCandidate } from '../shared/contracts/index.js'

/** In-memory Testnet: applies submitted blobs, validates them (or not), and answers tx lookups. */
function fakeLedger() {
  const state = { ledger: 100, submits: 0, validate: true, record: true, sequenceUsedElsewhere: 0, result: 'tesSUCCESS', delivered: undefined as string | undefined }
  const txs = new Map<string, { tx_json: Record<string, unknown>; meta: Record<string, unknown>; validated: boolean; ledger_index: number }>()
  const ledger: Ledger = {
    async request(r) {
      switch (r.command) {
        case 'account_info': return { result: { account_data: { Sequence: 7 + txs.size + state.sequenceUsedElsewhere, Balance: '100000000', OwnerCount: 0 } } }
        case 'ledger_current': return { result: { ledger_current_index: state.ledger } }
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
  const app = createPublisherApp({ secret: 'xrpl-secret', journal: join(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger: chain.ledger, corpus: loadCorpus(''),
    // The ledger view lists paid publishers from the writer registry (#138); a throwaway test seed keys Load Factor.
    writers: miniCorpus, env: { XRPL_PUBLISHER_LOAD_FACTOR_SEED: Wallet.generate().seed! } })
  await app.locals.ready
  await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  cleanup.push(() => new Promise(resolve => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const client = new PublisherClient({ baseUrl, secret: 'xrpl-secret' })
  const store = new Store(join(dir, 'app.db')); cleanup.push(() => store.close())
  const wallet = Wallet.generate()
  const payer = new XrplPayer(chain.ledger, wallet, { pollMs: 5, timeoutMs: 200 })
  const candidate = PublicCandidateSchema.parse((await client.search('grid-research', 'grid')).find(c => c.resourceId === 'grid-operators-report'))
  const run = store.createRun('Will it be operating by 2028?', 200)
  return { chain, client, store, payer, wallet, candidate, run, baseUrl, dir }
}
const buy = (s: Awaited<ReturnType<typeof setup>>, manager: PurchaseManager, intentId = 'intent-1', candidate: PublicCandidate = s.candidate) =>
  manager.purchase({ runId: s.run.runId, candidate, intentId })

describe('XRPL Testnet settlement rail', () => {
  it('advertises xrpl:1 in the 402 and pays exactly once, bound to the quote by InvoiceID', async () => {
    const s = await setup()
    const challenge = await fetch(`${s.baseUrl}/v1/profiles/grid-research/resources/grid-operators-report/versions/v1/content`)
    expect(challenge.status).toBe(402)
    const body = await challenge.json()
    expect(body.label).toContain('XRPL TESTNET · no real value')
    expect(body.accepts[0]).toMatchObject({ network: 'xrpl:1', asset: 'XRP', amount: '80000', payTo: GRID_WALLET })
    expect(JSON.stringify(body)).not.toContain('Grid Operators Report body')

    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    expect(intent.status).toBe('VERIFIED')
    expect(s.chain.txs.size).toBe(1)
    const [[hash, onLedger]] = [...s.chain.txs]
    expect(onLedger.tx_json.LastLedgerSequence).toBe(s.store.getSubmission(intent.intentId)!.lastLedgerSequence)
    expect(onLedger.tx_json).toMatchObject({ TransactionType: 'Payment', Account: s.wallet.classicAddress, Destination: GRID_WALLET, Amount: '80000', InvoiceID: intent.quote!.quoteHash.toUpperCase() })
    const run = s.store.getRun(s.run.runId)
    expect(run.spentMinor).toBe(80)
    expect(run.receipts[0]).toMatchObject({ label: 'XRPL TESTNET · no real value', xrpl: { txHash: hash, payTo: GRID_WALLET, amountDrops: '80000', payer: s.wallet.classicAddress, explorerUrl: `https://testnet.xrpl.org/transactions/${hash}` } })
    expect(run.intents[0].txHash).toBe(hash)
    expect(run.events.filter(e => e.type === 'XRPL').map(e => e.label).join(' ')).toMatch(/Signed 0\.08 XRP.*Validated in ledger.*Publisher verified/)
    expect(JSON.stringify(run)).not.toContain(s.wallet.seed!)
  })

  it('pays each publisher at its own wallet and refuses a payee the policy did not evaluate', async () => {
    const s = await setup()
    const quotes = await Promise.all(['northstar-wire', 'grid-operators-report'].map((resourceId, i) =>
      s.client.quote({ runId: s.run.runId, intentId: `payee-${i}`, profileId: resourceId === 'northstar-wire' ? 'supplier-wire' : 'grid-research', resourceId, version: 'v1' })))
    expect(quotes.map(q => q.payment!.payTo)).toEqual(['r4uhMW4Fph3YAdjrxsGZmk2mivTBhb8HVd', GRID_WALLET])
    const intent = await buy(s, new PurchaseManager(s.store, s.client, s.payer), 'redirected', { ...s.candidate, wallet: 'r4uhMW4Fph3YAdjrxsGZmk2mivTBhb8HVd' })
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
    const response = await fetch(`${s.baseUrl}/v1/settlements`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer xrpl-secret' }, body: JSON.stringify({ quoteId: intent.quote!.quoteId, quoteHash: intent.quote!.quoteHash, intentId: intent.intentId, txHash: intent.txHash }) })
    expect(response.status).toBe(402)
    expect((await response.json()).error).toContain('wrong delivered amount')
  })

  it('never lets one ledger payment settle a different quote', async () => {
    const s = await setup()
    const first = await buy(s, new PurchaseManager(s.store, s.client, s.payer))
    const other = await s.client.quote({ runId: s.run.runId, intentId: 'intent-2', profileId: 'grid-research', resourceId: 'grid-operators-report', version: 'v1' })
    const response = await fetch(`${s.baseUrl}/v1/settlements`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer xrpl-secret' }, body: JSON.stringify({ quoteId: other.quoteId, quoteHash: other.quoteHash, intentId: 'intent-2', txHash: first.txHash }) })
    expect(response.status).toBe(402)
    expect((await response.json()).error).toContain('InvoiceID')
  })

  it('refuses to sign when the quoted drops differ from the policy-approved price', async () => {
    const s = await setup()
    const quote = await s.client.quote({ runId: s.run.runId, intentId: 'tampered', profileId: 'grid-research', resourceId: 'grid-operators-report', version: 'v1' })
    s.store.reserveIntent({ runId: s.run.runId, intentId: 'tampered', profileId: 'grid-research', resourceId: 'grid-operators-report', version: 'v1', amountMinor: 80, status: 'QUOTED', quote: { ...quote, payment: { ...quote.payment!, amountDrops: '8000000' } } })
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
    expect(s.store.getRun(s.run.runId).reservedMinor).toBe(80)
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
    expect(s.store.getRun(s.run.runId)).toMatchObject({ reservedMinor: 80, intents: [{ status: 'SUBMITTING' }] })
  })

  it('refuses to settle simulated while the run is labelled XRPL', async () => {
    const s = await setup()
    const simulated = createPublisherApp({ secret: 'xrpl-secret', journal: join(s.dir, 'simulated.db'), rail: 'simulated', corpus: loadCorpus('') })
    await simulated.locals.ready
    const server = simulated.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    cleanup.push(() => new Promise(resolve => server.close(resolve)))
    const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, secret: 'xrpl-secret' })
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
    expect(view.wallets.map((w: { name: string }) => w.name).sort()).toEqual(['Load Factor', 'ResearchAgent (buyer)'])
    expect(new Set(view.wallets.map((w: { address: string }) => w.address)).size).toBe(2)
    expect(view.wallets[0]).toMatchObject({ address: s.wallet.classicAddress, balanceDrops: '100000000' })
    expect(JSON.stringify(view)).not.toContain(s.wallet.seed!)
  })

  it('only accepts Testnet endpoints', () => {
    expect(testnetUrl('wss://s.altnet.rippletest.net:51233')).toBe('wss://s.altnet.rippletest.net:51233')
    expect(() => testnetUrl('wss://xrplcluster.com')).toThrow(/Testnet/)
    expect(() => testnetUrl('wss://s1.ripple.com')).toThrow(/Testnet/)
  })
})
