import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Wallet } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { chain } from './fixtures/key-reveal-ledger.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle, alphaLeakArticle } from './fixtures/pay-path.js'

// A deterministic ledger SIMULATION. Production protocol, signer, journal and HTTP publisher.
const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
async function setup(options: { opted?: boolean; broken?: boolean; budget?: number } = {}) {
  vi.stubEnv('ESCROW_MODE', 'key-reveal')
  const c = chain(), dir = mkdtempSync(join(tmpdir(), 'escrow-'))
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  const env = { ESCROW_MODE: 'key-reveal', XRPL_PUBLISHER_LOAD_FACTOR_SEED: Wallet.generate().seed!, XRPL_PUBLISHER_ALPHALEAK_SEED: Wallet.generate().seed! }
  const app = createPublisherApp({ journal: join(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger: c.ledger, writers: alphaLeakCorpus, env, escrowWriters: options.opted === false ? [] : ['load-factor', 'alphaleak'], facilitatorTiming: { pollMs: 1, timeoutMs: 10 } })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  cleanup.push(() => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); app.locals.journal.close() }))
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const client = new PublisherClient({ baseUrl }), wallet = Wallet.generate()
  const db = join(dir, 'buyer.db')
  let store = new Store(db)
  cleanup.push(() => store.close())
  const payer = () => new XrplPayer(c.ledger, wallet, { pollMs: 1, timeoutMs: 10 })
  let manager = new PurchaseManager(store, client, payer())
  const candidate = await candidateFrom(baseUrl, options.broken ? alphaLeakArticle : honestArticle)
  const run = store.createRun('SYNTHETIC escrow check', options.budget ?? 200)
  const buy = (intentId = 'escrow-one', escrow = true) => manager.purchase({ runId: run.runId, candidate, intentId, escrow })
  return { c, client, candidate, run, wallet, buy, get store() { return store }, get manager() { return manager }, restart() { store.close(); store = new Store(db); manager = new PurchaseManager(store, client, payer()) } }
}

it('key reveal pays only through writer finish and grants only after validated key', async () => {
  const s = await setup()
  const result = await s.buy()
  expect(result.status).toBe('VERIFIED')
  expect(result.escrow?.mode).toBe('key-reveal')
  expect(s.store.getEscrow(result.intentId)!.secret).toBe('')
  const finish = [...s.c.txs.values()].find(t => t.tx_json.TransactionType === 'EscrowFinish')!
  expect(finish.tx_json.Account).toBe(s.candidate.wallet)
  expect(finish.tx_json.Account).not.toBe(s.wallet.classicAddress)
  s.restart(); await s.manager.reconcile(); await s.buy()
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
  expect([...s.c.txs.values()].filter(t => t.tx_json.TransactionType === 'EscrowCreate')).toHaveLength(1)
})

it('quarantines ciphertext from snapshot, model contents, UI, logs and exports while writer is absent; cancels once', async () => {
  const s = await setup()
  vi.spyOn(s.client, 'paidGet').mockRejectedValue(new Error('writer absent'))
  expect((await s.buy()).status).toBe('SUBMITTING')
  const e = s.store.getEscrow('escrow-one')!
  s.store.addAnswer(s.run.runId, { conclusion: 'Waiting for delivery.', claims: [], openGaps: [], version: 1, provider: 'fixture', model: 'extractive-fixture' })
  const { receiptBundle } = await import('../server/receipt-bundle.js')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const { default: PaymentRow } = await import('../src/components/PaymentRow.js')
  const run = s.store.getRun(s.run.runId)
  const html = renderToStaticMarkup(createElement(PaymentRow, { run, intent: run.intents[0], onRetry: () => {}, onReceipt: () => {} }))
  expect(html).toContain('Escrow locked · waiting for writer to reveal key')
  const publicBytes = JSON.stringify([run, html, receiptBundle(s.store, s.run.runId), s.store.auditEntries(), s.store.receiptRows()])
  expect(publicBytes).not.toContain(e.quote.ciphertext)
  expect(s.store.getRun(s.run.runId).contents).toEqual([])
  expect(s.store.getRun(s.run.runId).grants).toEqual([])
  expect(() => s.store.keyRevealEvidence('escrow-one')).toThrow()
  s.c.state.now = e.quote.terms.cancelAfter + 1
  s.restart(); await s.manager.reconcile(); await s.manager.reconcile()
  expect(s.store.getIntent('escrow-one')!.escrow?.state).toBe('CANCELLED')
  expect(s.store.getRun(s.run.runId).spentMinor).toBe(0)
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
})

for (const boundary of ['persistReveal', 'addGrant'] as const) it(`recovers after durable ${boundary} and one charge`, async () => {
  const s = await setup(), original = s.store[boundary].bind(s.store)
  const spy = vi.spyOn(s.store, boundary)
  // A process death after persistence is simulated at the durable boundary.
  spy.mockImplementation(((...args: unknown[]) => { (original as (...args: unknown[]) => unknown)(...args); throw new Error('simulated process death') }) as never)
  await s.buy()
  spy.mockRestore(); s.restart(); await s.manager.reconcile(); await s.buy()
  expect(s.store.getIntent('escrow-one')!.status).toBe('VERIFIED')
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
})

it('exports an offline verifiable key reveal and rejects tampering', async () => {
  const { receiptBundle } = await import('../server/receipt-bundle.js')
  const { verifyAnswer } = await import('../sdk/verify.js')
  const s = await setup()
  s.store.updateRun(s.run.runId, { candidates: [s.candidate] })
  await s.buy()
  const run = s.store.getRun(s.run.runId), source = run.contents[0]
  s.store.addAnswer(run.runId, { conclusion: 'Verified key reveal delivery.', claims: [{ id: 'key-reveal', text: source.spans[0].text, stance: 'SUPPORTS', citations: [{ resourceId: source.resourceId, version: source.version, spanId: source.spans[0].id }] }], openGaps: [], version: 1, provider: 'fixture', model: 'extractive-fixture' })
  const bundle = receiptBundle(s.store, run.runId)
  const result = await verifyAnswer(bundle)
  if (process.env.KEY_REVEAL_FIXTURE === '1') {
    const { writeFileSync } = await import('node:fs')
    writeFileSync('tests/fixtures/receipt-conformance/key-reveal.json', JSON.stringify(bundle, null, 2) + '\n')
  }
  expect(result.checks.filter(c => c.status === 'FAIL')).toEqual([])
  for (const field of ['key', 'ciphertext', 'condition', 'manifest'] as const) {
    const b = structuredClone(bundle), reveal = b.proofs[0].keyReveal!
    if (field === 'key') reveal.key = '00'.repeat(32)
    if (field === 'ciphertext') reveal.quote.ciphertext = '00'.repeat(reveal.quote.ciphertext!.length / 2)
    if (field === 'condition') reveal.quote.terms.condition = 'A0258020' + '00'.repeat(32) + '810120'
    if (field === 'manifest') b.proofs[0].manifest.root = '00'.repeat(32)
    expect((await verifyAnswer(b)).ok).toBe(false)
  }
})

it('a paid invalid article stays quarantined and yields fraud evidence plus reputation rejection', async () => {
  const s = await setup({ broken: true })
  const intent = await s.buy()
  expect(intent.status).toBe('CLAIM_FAILED')
  expect(intent.escrow?.state).toBe('RELEASED')
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
  expect(s.store.getRun(s.run.runId).grants).toHaveLength(0)
  expect(s.store.keyRevealEvidence(intent.intentId).transaction?.TransactionType).toBe('EscrowFinish')
  expect(s.store.getReputation(s.candidate.wallet!)).toBeDefined()
  s.restart(); await s.buy()
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
})
