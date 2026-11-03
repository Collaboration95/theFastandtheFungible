import { openPaymentJournal } from '../sdk/x402-journal.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { Wallet } from 'xrpl'
import type { AddressInfo } from 'node:net'
import { createPublisherApp } from '../publisher/routes.js'
import { XrplPayer } from '../server/xrpl.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { RLUSD_CURRENCY, RLUSD_TESTNET_ISSUER, ledgerAmount } from '../shared/contracts/asset.js'
import { challenge } from '../server/challenges.js'
import { verifyPayment } from '../shared/xrpl.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle, alphaLeakArticle } from './fixtures/pay-path.js'
import { hireLedger } from './fixtures/hire-ledger.js'
import { payAndFetch } from '../sdk/x402.js'
import { decodeHeader } from '../shared/x402.js'
import { signFor } from './fixtures/x402-payer.js'
import { Facilitator, requirementsFor } from '../publisher/facilitator.js'
import { PublisherJournal } from '../publisher/journal.js'
import { verifyAnswer } from '../sdk/verify.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyOnTestnet } from '../server/audit.js'
const asset = { currency: RLUSD_CURRENCY, issuer: RLUSD_TESTNET_ISSUER, label: 'RLUSD (Testnet)' as const } as const
const clean: (() => unknown)[] = []
afterEach(async () => { for (const fn of clean.splice(0).reverse()) await fn(); vi.unstubAllEnvs() })
async function setup() {
  vi.stubEnv('SEARCH_EMBEDDINGS', 'off')
  const chain = hireLedger(), payer = Wallet.generate(), writer = Wallet.generate(), alpha = Wallet.generate()
  const state = { missing: false, balance: '100000000', owners: 1, tokenBalance: '10', frozen: false }
  const request = chain.ledger.request.bind(chain.ledger)
  chain.ledger.request = async r => {
    if (r.command === 'account_info') return { result: { account_data: { Flags: state.frozen ? 0x400000 : 0, Sequence: 1 + chain.txs.size, Balance: state.balance, OwnerCount: state.owners } } }
    if (r.command === 'account_lines') return { result: { lines: state.missing ? [] : [{ account: asset.issuer, currency: asset.currency, balance: state.tokenBalance, limit: '10' }] } }
    return request(r)
  }
  // Destination starts empty; source has a funded balance.
  const lineRequest = chain.ledger.request.bind(chain.ledger)
  chain.ledger.request = async r => {
    const result = await lineRequest(r)
    if (r.command === 'account_lines' && [writer.classicAddress, alpha.classicAddress].includes(String(r.account)) && result.result.lines.length) result.result.lines[0].balance = '0'
    return result
  }
  const app = createPublisherApp({ writers: alphaLeakCorpus, journal: ':memory:', rail: 'xrpl-testnet', ledger: chain.ledger, env: {
    XRPL_PUBLISHER_LOAD_FACTOR_SEED: writer.seed, XRPL_PUBLISHER_ALPHALEAK_SEED: alpha.seed,
    XRPL_PUBLISHER_LOAD_FACTOR_CURRENCY: 'RLUSD', XRPL_PUBLISHER_ALPHALEAK_CURRENCY: 'RLUSD',
  } })
  await app.locals.ready
  clean.push(() => app.locals.journal.close())
  const server = app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done))
  clean.push(() => { server.closeAllConnections(); return new Promise(done => server.close(done)) })
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const store = new Store(':memory:'); clean.push(() => store.close())
  const manager = new PurchaseManager(store, new PublisherClient({ baseUrl: url }), new XrplPayer(chain.ledger, payer, { pollMs: 1, timeoutMs: 100 }))
  return { chain, state, app, url, store, manager, payer, writer }
}
it('policy buys issued currency, verifies proof before access, replays once, exports asset and delivered_amount; SDK supports explicit asset authority', async () => {
  const s = await setup(), candidate = await candidateFrom(s.url, honestArticle)
  const run = s.store.createRun('pricing', 100)
  const input = { runId: run.runId, intentId: 'rlusd-test', candidate }
  expect((await s.manager.purchase(input)).status).toBe('VERIFIED')
  expect((await s.manager.purchase(input)).status).toBe('VERIFIED')
  expect(s.chain.submits).toBe(1)
  expect(s.store.getRun(run.runId).receipts[0].xrpl).toMatchObject({ asset, amountDrops: '0.60', deliveredAmount: ledgerAmount('0.6', asset) })
  expect(s.store.auditEntries().find(e => e.kind === 'settle')?.data).toMatchObject({ asset, deliveredAmount: ledgerAmount('0.6', asset) })
  const rows = s.store.receiptRows(); expect(rows[0].asset).toEqual(asset)
  expect((await verifyOnTestnet(rows, s.chain.ledger))[0]).toMatchObject({ status: 'ok', detail: expect.stringContaining('RLUSD (Testnet)') })
  s.store.updateRun(run.runId, { candidates: [candidate] })
  const content = s.store.getRun(run.runId).contents[0]
  s.store.addAnswer(run.runId, { conclusion: 'Verified issued payment.', claims: [{ id: 'issued', text: content.spans[0].text, stance: 'SUPPORTS', citations: [{ resourceId: content.resourceId, version: content.version, spanId: content.spans[0].id }] }], openGaps: [], version: 1, provider: 'fixture', model: 'extractive-fixture' })
  const verified = await verifyAnswer(receiptBundle(s.store, run.runId), { testnet: true, ledger: s.chain.ledger })
  expect(verified.checks.filter(c => c.status === 'FAIL')).toEqual([])
  const journal = openPaymentJournal(join(mkdtempSync(join(tmpdir(), 'rlusd-caller-')), 'caller.db')); clean.push(() => journal.close())
  const paid = await payAndFetch(`${s.url}${candidate.url}`, { journal, wallet: s.payer, ledger: s.chain.ledger, maxDrops: '1', issued: { asset, maxAmount: '0.60' } })
  expect(paid.payment.asset).toEqual(asset); expect(paid.response.ok).toBe(true)
})
it.each(['missing', 'reserve', 'balance', 'freeze'] as const)('refuses %s before signing and releases the purchase reservation', async problem => {
  const s = await setup(), candidate = await candidateFrom(s.url, honestArticle)
  if (problem === 'missing') s.state.missing = true
  if (problem === 'reserve') s.state.balance = '1201000'
  if (problem === 'balance') s.state.tokenBalance = '0.01'
  if (problem === 'freeze') s.state.frozen = true
  const run = s.store.createRun('pricing', 100)
  const intent = await s.manager.purchase({ runId: run.runId, intentId: problem, candidate })
  expect(intent.status).toBe('FAILED_NOT_SETTLED'); expect(s.chain.submits).toBe(0)
  expect(s.store.getSubmission(problem)).toBeUndefined(); expect(s.store.getRun(run.runId).reservedMinor).toBe(0)
})
it('rejects tfPartialPayment before submission and rejects lower, unavailable or wrong-issuer delivered amounts on lookup', async () => {
  const s = await setup(), candidate = await candidateFrom(s.url, honestArticle)
  const response = await fetch(`${s.url}${candidate.url}`)
  const terms = decodeHeader('PAYMENT-REQUIRED', response.headers.get('PAYMENT-REQUIRED')).accepts[0]
  const signed = signFor(terms, { Amount: ledgerAmount(terms.amount, asset), Flags: 0x20000 }, s.payer)
  const result = await fetch(`${s.url}${candidate.url}`, { headers: { 'PAYMENT-SIGNATURE': signed.header } })
  expect(result.status).toBe(402); expect(s.chain.submits).toBe(0)
  const tx = { TransactionType: 'Payment', Account: s.payer.classicAddress, Destination: s.writer.classicAddress, Amount: ledgerAmount('0.60', asset), InvoiceID: 'A'.repeat(64) }
  for (const delivered of [ledgerAmount('0.01', asset), 'unavailable', { ...ledgerAmount('0.60', asset) as object, issuer: s.payer.classicAddress }]) {
    const ledger = { request: async () => ({ result: { validated: true, tx_json: tx, meta: { TransactionResult: 'tesSUCCESS', delivered_amount: delivered }, ledger_index: 5 } }) }
    expect(await verifyPayment(ledger, 'B'.repeat(64), { rail: 'xrpl-testnet', network: 'xrpl:1', asset, payTo: s.writer.classicAddress, amountDrops: '0.60', invoiceId: tx.InvoiceID })).toMatchObject({ state: 'invalid', reason: 'wrong delivered amount' })
  }
})
it('binds a quote to its first signed blob before ledger submission', async () => {
  const s = await setup(), journal = s.app.locals.journal as PublisherJournal
  const response = await fetch(`${s.url}/w/load-factor/articles/${honestArticle.articleId}`)
  const terms = decodeHeader('PAYMENT-REQUIRED', response.headers.get('PAYMENT-REQUIRED')).accepts[0]
  const q = journal.quoteByInvoice((await import('../shared/x402.js')).ledgerInvoiceId(terms.extra.invoiceId))!
  const f = new Facilitator(journal, 'xrpl-testnet', s.chain.ledger)
  const signature = (sequence: number) => decodeHeader('PAYMENT-SIGNATURE', signFor(requirementsFor(q), { Amount: ledgerAmount(q.amount, asset), Sequence: sequence }, s.payer).header)
  expect((await f.settle(signature(1))).ok).toBe(true)
  expect(await f.settle(signature(2))).toMatchObject({ ok: false, reason: 'Invoice already settled or bound to another payment' })
  expect(s.chain.submits).toBe(1)
})
it('screens the issuer as well as the writer before signing', async () => {
  const s = await setup(), candidate = await candidateFrom(s.url, honestArticle)
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(`${tmpdir()}/issuer-screen-`); clean.push(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(`${dir}/deny.json`, JSON.stringify([{ address: asset.issuer, reason: 'issuer test entry' }]))
  vi.stubEnv('PAYEE_DENYLIST_FILE', `${dir}/deny.json`)
  const run = s.store.createRun('pricing', 100)
  const intent = await s.manager.purchase({ runId: run.runId, intentId: 'issuer-denied', candidate })
  expect(intent.status).toBe('FAILED_NOT_SETTLED'); expect(s.chain.submits).toBe(0)
  expect(s.store.auditEntries().find(e => e.kind === 'refusal')?.data).toMatchObject({ listedAddress: asset.issuer, listReason: 'issuer test entry' })
})

it('refunds a failed claim in issuer-bound RLUSD and replays purchase and challenge without a second charge', async () => {
  const s = await setup(), candidate = await candidateFrom(s.url, alphaLeakArticle)
  const run = s.store.createRun('SYNTHETIC failed claim', 100)
  const request = { runId: run.runId, intentId: 'rlusd-refund', candidate }
  expect((await s.manager.purchase(request)).status).toBe('CLAIM_FAILED')
  const result = await challenge(s.manager, request.intentId, { pollMs: 1, timeoutMs: 1000 })
  expect(result.status).toBe('REFUNDED')
  const refund = s.chain.txs.get(result.refund!.txHash)!
  expect(refund.Amount).toEqual(ledgerAmount('0.3', asset))
  expect(await verifyPayment(s.chain.ledger, result.refund!.txHash, { rail: 'xrpl-testnet', network: 'xrpl:1', asset, payTo: s.payer.classicAddress, amountDrops: '0.30', invoiceId: result.txHash! })).toMatchObject({ state: 'ok' })
  const count = s.chain.submits
  expect((await s.manager.purchase(request)).txHash).toBe(result.txHash)
  expect((await challenge(s.manager, request.intentId)).refund).toEqual(result.refund)
  expect(s.chain.submits).toBe(count)
})
