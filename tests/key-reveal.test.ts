import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Wallet, hashes } from 'xrpl'
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
async function setup(options: { opted?: boolean; broken?: boolean; budget?: number; iou?: boolean } = {}) {
  vi.stubEnv('ESCROW_MODE', 'key-reveal')
  if(options.iou) { vi.stubEnv('ESCROW_ASSET','test-iou'); vi.stubEnv('TESTNET_IOU_ISSUER',Wallet.generate().classicAddress) }
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
  return { c, client, candidate, run, wallet, buy, journal:app.locals.journal as import('../publisher/journal.js').PublisherJournal, writer:Wallet.fromSeed(env.XRPL_PUBLISHER_LOAD_FACTOR_SEED), get store() { return store }, get manager() { return manager }, restart() { store.close(); store = new Store(db); manager = new PurchaseManager(store, client, payer()) } }
}

it('records opt-in phase observations durably without changing payment authority or offline proofs', async () => {
  vi.stubEnv('SETTLEMENT_TIMING', '1')
  const s = await setup()
  const result = await s.buy()
  const timing = s.store.getIntent(result.intentId)!.timing!
  expect(Object.keys(timing.phases)).toEqual(['quote', 'createSubmitted', 'createValidated', 'lockProven', 'finishSubmitted', 'finishValidated', 'unlocked'])
  expect(timing.phases.lockProven?.source).toBe('writer')
  expect(timing.phases.finishSubmitted?.txHash).toBe(result.escrow!.finishHash)
  expect(timing.phases.createValidated?.ledgerIndex).toBeGreaterThan(0)
  expect(timing.phases.finishValidated?.ledgerIndex).toBeGreaterThan(timing.phases.createValidated!.ledgerIndex!)
  expect(Object.values(timing.phases).every(p => Number.isFinite(p!.elapsedMs) && p!.elapsedMs >= 0)).toBe(true)
  expect(s.store.getRun(s.run.runId).receipts[0].timing).toEqual(timing)
  s.restart(); await s.buy()
  expect(s.store.getIntent(result.intentId)!.timing).toEqual(timing)
  expect(s.store.auditEntries().filter(e => e.kind === 'settlement-timing')).toHaveLength(7)
  expect(s.store.getRun(s.run.runId).events.filter(e => e.type === 'SETTLEMENT_TIMING')).toHaveLength(7)
  expect(s.c.txs.size).toBe(2)
})

it('key reveal pays only through writer finish and grants only after validated key', async () => {
  const s = await setup()
  const result = await s.buy()
  expect(result.status).toBe('VERIFIED')
  expect(result.escrow?.mode).toBe('key-reveal')
  expect(s.store.getEscrow(result.intentId)!.secret).toBe('')
  const finish = [...s.c.txs.values()].find(t => t.tx_json.TransactionType === 'EscrowFinish')!
  expect(finish.tx_json.Account).toBe(s.candidate.wallet)
  expect(finish.tx_json.Account).not.toBe(s.wallet.classicAddress)
  const released = s.store.getRun(s.run.runId)
  const audit = s.store.auditEntries()
  const grant = audit.find(e => e.kind === 'grant' && e.intentId === result.intentId)!
  const terminal = audit.find(e => e.kind === 'ESCROW_FINISH' && e.intentId === result.intentId)!
  const reads = audit.filter(e => e.kind === 'read_paid' && e.intentId === result.intentId)
  expect(grant.seq).toBeGreaterThan(terminal.seq)
  expect(reads).toHaveLength(released.contents[0].spans.length)
  expect(reads.every(e => e.seq > grant.seq)).toBe(true)
  s.restart(); await s.manager.reconcile(); await s.buy()
  expect(s.store.auditEntries().filter(e => e.kind === 'read_paid')).toEqual(reads)
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
  expect(s.store.getRun(s.run.runId).events.filter(e => e.type === 'GRANT' && e.data?.intentId === result.intentId)).toHaveLength(1)
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
  expect(html).toContain('Held in escrow · waiting for the writer’s key')
  const publicBytes = JSON.stringify([run, html, receiptBundle(s.store, s.run.runId), s.store.auditEntries(), s.store.receiptRows()])
  expect(publicBytes).not.toContain(e.quote.ciphertext)
  expect(s.store.getRun(s.run.runId).contents).toEqual([])
  expect(s.store.getRun(s.run.runId).grants).toEqual([])
  expect(s.store.auditEntries().filter(e => ['grant', 'read_paid'].includes(e.kind))).toEqual([])
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
  vi.stubEnv('SETTLEMENT_TIMING', '1')
  const { receiptBundle } = await import('../server/receipt-bundle.js')
  const { verifyAnswer } = await import('../sdk/verify.js')
  const s = await setup()
  s.store.updateRun(s.run.runId, { candidates: [s.candidate] })
  await s.buy()
  const run = s.store.getRun(s.run.runId), source = run.contents[0]
  s.store.addAnswer(run.runId, { conclusion: 'Verified key reveal delivery.', claims: [{ id: 'key-reveal', text: source.spans[0].text, stance: 'SUPPORTS', citations: [{ resourceId: source.resourceId, version: source.version, spanId: source.spans[0].id }] }], openGaps: [], version: 1, provider: 'fixture', model: 'extractive-fixture' })
  const bundle = receiptBundle(s.store, run.runId)
  expect(bundle.intents[0].timing).toEqual(bundle.receipts[0].timing)
  expect(bundle.audit.entries.filter(e => 'kind' in e && e.kind === 'settlement-timing')).toHaveLength(7)
  const result = await verifyAnswer(bundle)
  const { createApiApp } = await import('../server/routes.js')
  vi.stubEnv('RA_API_TOKEN', 'timing-api-test')
  const api = await createApiApp({ dbPath: s.store.path, publisherUrl: 'http://127.0.0.1:1', payer: new XrplPayer(s.c.ledger, s.wallet), reconcileIntervalMs: 600000 })
  const server = api.app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await api.close() })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  for (const route of [`/runs/${run.runId}`, `/runs/${run.runId}/receipts.json`]) {
    const response = await fetch(base + route, { headers: { Authorization: 'Bearer timing-api-test' } })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.intents[0].timing).toEqual(bundle.intents[0].timing)
    expect(body.receipts[0].timing).toEqual(bundle.receipts[0].timing)
  }
  if (process.env.KEY_REVEAL_FIXTURE === '1') {
    const { writeFileSync } = await import('node:fs')
    writeFileSync('tests/fixtures/receipt-conformance/key-reveal.json', JSON.stringify(bundle, null, 2) + '\n')
  }
  expect(result.checks.filter(c => c.status === 'FAIL')).toEqual([])
  const changedTiming = structuredClone(bundle)
  const timingEntry = changedTiming.audit.entries.find(e => 'kind' in e && e.kind === 'settlement-timing')!
  if ('data' in timingEntry) timingEntry.data.elapsedMs = Number(timingEntry.data.elapsedMs) + 1
  expect((await verifyAnswer(changedTiming)).ok).toBe(false)
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

it('writer retries return the persisted finish without a second transaction', async () => {
  const s = await setup()
  await s.buy()
  const e = s.store.getEscrow('escrow-one')!, create = s.store.escrowOutbox('escrow-one')[0]
  const { encodeHeader } = await import('../shared/x402.js')
  const { escrowInvoice } = await import('../shared/escrow.js')
  const header = encodeHeader('PAYMENT-SIGNATURE', { x402Version: 2, accepted: { scheme: 'escrow-v1', network: 'xrpl:1', asset: 'XRP', amount: e.quote.terms.amount, payTo: e.quote.terms.payTo, maxTimeoutSeconds: 120, extra: { invoiceId: escrowInvoice(e.quote.terms), areFeesSponsored: false } }, payload: { signedTxBlob: create.txBlob } })
  for (let n = 0; n < 2; n++) {
    const response = await s.client.paidGet(s.store.getIntent('escrow-one')!.paidPath!, header)
    expect(response.delivery).toEqual({ finishHash: e.publicStatus.finishHash, ledgerPreCheck: true })
  }
  // Reopen the writer's durable journal to model a process restart. The report
  // belongs to the persisted signature; a retry must not sign or infer a new one.
  const { PublisherJournal } = await import('../publisher/journal.js')
  const { revealEscrow } = await import('../publisher/escrow.js')
  const recovered = new PublisherJournal(s.journal.path)
  try {
    const sign = vi.spyOn(Wallet.prototype, 'sign')
    const result = await revealEscrow(e.quote, create.txBlob, { publicKey: s.writer.publicKey, privateKey: s.writer.privateKey, wallet: s.writer.classicAddress, simulated: false }, s.c.ledger, recovered)
    expect(result).toEqual({ finishHash: e.publicStatus.finishHash, ledgerPreCheck: true })
    expect(sign).not.toHaveBeenCalled()
  } finally { recovered.close() }
  expect(s.c.txs.size).toBe(2)
})

it('retries grant persistence errors after validated reveal without charging again', async () => {
  const s = await setup()
  const spy = vi.spyOn(s.store, 'addGrant').mockImplementationOnce(() => { throw new Error('temporary persistence failure') })
  expect((await s.buy()).status).toBe('SUBMITTING')
  spy.mockRestore(); s.restart(); await s.manager.reconcile()
  expect(s.store.getIntent('escrow-one')!.status).toBe('VERIFIED')
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(1)
  expect(s.c.txs.size).toBe(2)
})

it('explicit key-reveal mode never downgrades a trusted writer to exact payment', async () => {
  const s = await setup()
  const { newRecord } = await import('../server/reputation.js')
  s.store.putReputation({ ...newRecord(s.candidate.profileId, s.candidate.wallet!), passes: 1, T: 0.95 })
  const intent = await s.buy()
  expect(intent.status).toBe('VERIFIED')
  expect(intent.escrow?.mode).toBe('key-reveal')
  expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate', 'EscrowFinish'])
})

it('refunds a failed escrow delivery once with a separate Payment and buys a replacement', async () => {
  const s = await setup({ broken: true })
  const original = await s.buy()
  const { challenge } = await import('../server/challenges.js')
  const refunded = await challenge(s.manager, original.intentId, { pollMs: 1, timeoutMs: 100 })
  expect(refunded.status).toBe('REFUNDED')
  expect(refunded.refund?.txHash).not.toBe(original.txHash)
  const { verifyOnTestnet } = await import('../server/audit.js')
  const checks = await verifyOnTestnet(s.store.receiptRows(), s.c.ledger)
  expect(checks.map(c => [c.kind,c.status])).toEqual([['escrow-create','ok'],['escrow-finish','ok'],['refund','ok']])
  await challenge(s.manager, original.intentId)
  const replacement = await candidateFrom(s.client.origin, honestArticle)
  const result = await s.manager.purchase({ runId: s.run.runId, candidate: replacement, intentId: 'replacement', escrow: true })
  expect(result.status).toBe('VERIFIED')
  expect(result.escrow?.keyVerified).toBe(true)
  expect(result.escrow?.decryptVerified).toBe(true)
  expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate', 'EscrowFinish', 'Payment', 'EscrowCreate', 'EscrowFinish'])
})

it('waits for a submitted writer finish to validate in the normal purchase flow', async () => {
  const s = await setup(), request = s.c.ledger.request.bind(s.c.ledger)
  let deferred = false
  vi.spyOn(s.c.ledger, 'request').mockImplementation(async r => {
    if (r.command === 'tx' && !deferred && s.c.txs.get(String(r.transaction))?.tx_json.TransactionType === 'EscrowFinish') {
      deferred = true
      return { result: { validated: false } }
    }
    return request(r)
  })
  expect((await s.buy()).status).toBe('VERIFIED')
  expect(deferred).toBe(true)
  expect(s.c.txs.size).toBe(2)
})

it('IOU key reveal preserves one charge after recovery and binds settlement asset', async () => {
  const s=await setup({iou:true})
  expect((await s.buy()).status).toBe('VERIFIED')
  s.restart(); await s.manager.reconcile(); await s.buy()
  const run=s.store.getRun(s.run.runId)
  expect(run.receipts).toHaveLength(1)
  expect(run.receipts[0].xrpl?.asset).toMatchObject({currency:'SGT',issuer:process.env.TESTNET_IOU_ISSUER})
  expect([...s.c.txs.values()].filter(t=>t.tx_json.TransactionType==='EscrowCreate')).toHaveLength(1)
})
it('IOU no-show returns principal once and never grants plaintext', async () => {
  const s=await setup({iou:true})
  vi.spyOn(s.client,'paidGet').mockRejectedValue(new Error('no-show'))
  await s.buy()
  s.c.state.now=s.store.getEscrow('escrow-one')!.quote.terms.cancelAfter+1
  s.restart(); await s.manager.reconcile(); await s.manager.reconcile()
  expect(s.store.getIntent('escrow-one')?.escrow?.state).toBe('CANCELLED')
  expect(s.store.getRun(s.run.runId).contents).toEqual([])
  expect(s.store.getRun(s.run.runId).spentMinor).toBe(0)
  expect([...s.c.txs.values()].filter(t=>t.tx_json.TransactionType==='EscrowCancel')).toHaveLength(1)
})

it('A05 recovers a failed paid proof challenge independently of failed answer phase', async()=>{
  const s=await setup({broken:true})
  const first=await s.buy()
  s.store.updateRun(s.run.runId,{phase:'FAILED',checkpoint:{intentId:first.intentId}})
  s.restart(); await s.manager.reconcile()
  expect(s.store.getIntent(first.intentId)!.status).toBe('REFUNDED')
})
it('A13 verifies failed TEST-SGD escrow proof followed by a full writer refund', async()=>{
  const s=await setup({broken:true,iou:true}), original=await s.buy()
  const {challenge}=await import('../server/challenges.js'), {verifyEscrowEvents}=await import('../server/audit.js')
  expect((await challenge(s.manager,original.intentId,{pollMs:1,timeoutMs:100})).status).toBe('REFUNDED')
  if (process.env.HM_GENERATE_FIXTURE === '1') {
    const {writeFileSync}=await import('node:fs')
    writeFileSync('tests/fixtures/receipt-conformance/test-sgd-refund-ledger.json',JSON.stringify({payments:s.store.receiptRows(),entries:s.store.auditEntries(),transactions:Object.fromEntries(s.c.txs)},null,2)+'\n')
  }
  expect((await verifyEscrowEvents(s.store.auditEntries(),s.c.ledger)).find(c=>c.kind==='key-reveal-proof')?.status).toBe('refunded')
})
it('A07 keeps a writer-offered unvalidated refund pending',async()=>{
  const s=await setup({broken:true}), original=await s.buy()
  const {challenge}=await import('../server/challenges.js')
  s.c.state.validate=false
  const pending=await challenge(s.manager,original.intentId,{timeoutMs:200,pollMs:1})
  expect(pending.status).toBe('CHALLENGED')
  expect(pending.refundCandidate).toBeDefined()
})

it('A07 replaces a ledger-proven expired writer refund and retains both attempts',async()=>{
  const s=await setup({broken:true}), original=await s.buy()
  const {challenge}=await import('../server/challenges.js')
  const {decode}=await import('xrpl')
  s.c.state.validate=false
  const pending=await challenge(s.manager,original.intentId,{timeoutMs:200,pollMs:1})
  const old=pending.refundCandidate!.txHash, tx=s.c.txs.get(old)!.tx_json
  s.c.txs.delete(old); s.c.state.index=Number(tx.LastLedgerSequence)+1; s.c.state.validate=true
  const recovered=await challenge(s.manager,original.intentId,{timeoutMs:200,pollMs:1})
  expect(recovered.status).toBe('REFUNDED'); expect(recovered.refund!.txHash).not.toBe(old)
  const paid=[...s.c.txs.values()].filter(t=>t.tx_json.TransactionType==='Payment')
  expect(paid).toHaveLength(1)
  expect(decode(s.store.escrowOutbox(original.intentId)[0].txBlob).TransactionType).toBe('EscrowCreate')
})

it('A04 concurrent retries of one invoice share one durable writer finish',async()=>{
 const s=await setup(), failed=vi.spyOn(s.client,'paidGet').mockRejectedValue(new Error('synthetic interrupted writer'))
 await s.buy();failed.mockRestore()
 const {revealEscrow}=await import('../publisher/escrow.js'),e=s.store.getEscrow('escrow-one')!,create=s.store.escrowOutbox('escrow-one')[0]
 const results=await Promise.all(Array.from({length:8},()=>revealEscrow(e.quote,create.txBlob,{publicKey:s.writer.publicKey,privateKey:s.writer.privateKey,wallet:s.writer.classicAddress,simulated:false},s.c.ledger,s.journal)))
 expect(new Set(results.map(r=>r.finishHash)).size).toBe(1)
 expect([...s.c.txs.values()].filter(t=>t.tx_json.TransactionType==='EscrowFinish')).toHaveLength(1)
 const {escrowInvoice}=await import('../shared/escrow.js')
 expect(s.journal.terminalAttempts(escrowInvoice(e.quote.terms))).toHaveLength(1)
})

it('stream metadata keeps quarantine, policy limits, receipts and single-charge recovery intact', async () => {
  vi.stubEnv('XRPL_STREAM_WAITS', '1')
  const { streamTransaction } = await import('../shared/xrpl.js')
  const s = await setup()
  const cache = new Map<string, Extract<import('../shared/xrpl.js').TxLookup, { state: 'validated' }>>()
  const listeners = new Set<() => void>()
  s.c.ledger.cachedTx = hash => cache.get(hash)
  s.c.ledger.streamActive = () => true
  s.c.ledger.activity = listener => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const request = s.c.ledger.request.bind(s.c.ledger)
  const calls: string[] = []
  vi.spyOn(s.c.ledger, 'request').mockImplementation(async r => {
    calls.push(String(r.command))
    const response = await request(r)
    if (r.command === 'submit') {
      const hash = hashes.hashSignedTx(String(r.tx_blob)), row = s.c.txs.get(hash)!
      expect(s.store.getRun(s.run.runId).grants).toHaveLength(0)
      expect(streamTransaction({ ...row, hash, validated: false })).toBeUndefined()
      for (const listener of listeners) listener() // ledger event before the transaction
      const observed = streamTransaction({ ...row, hash })!
      for (let i = 0; i < 2; i++) { cache.set(hash, observed.found); for (const listener of listeners) listener() }
    }
    return response
  })
  expect((await s.buy()).status).toBe('VERIFIED')
  s.restart(); await s.buy()
  expect(s.c.txs.size).toBe(2)
  expect(calls.filter(c => c === 'submit')).toHaveLength(2)
  expect(calls.filter(c => c === 'tx')).toHaveLength(0)
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
  expect(listeners.size).toBe(0)
})

for (const guard of ['network', 'fee'] as const) it(`stream autofill retains the ${guard} signing guard`, async () => {
  vi.stubEnv('XRPL_STREAM_WAITS', '1')
  const s = await setup(), request = s.c.ledger.request.bind(s.c.ledger)
  vi.spyOn(s.c.ledger, 'request').mockImplementation(async r => {
    const response = await request(r)
    if (guard === 'network' && r.command === 'server_info') response.result.info.network_id = 0
    if (guard === 'fee' && r.command === 'fee') response.result.drops.open_ledger_fee = '2001'
    return response
  })
  expect((await s.buy()).status).toBe('FAILED_NOT_SETTLED')
  expect(s.c.txs.size).toBe(0)
  expect(s.store.escrowOutbox()).toHaveLength(0)
})

it('a missing validation stream holds the original signature and grant across retries', async () => {
  vi.stubEnv('XRPL_STREAM_WAITS', '1')
  const s = await setup()
  s.c.state.validate = false
  const sign = vi.spyOn(Wallet.prototype, 'sign')
  expect((await s.buy()).status).toBe('SUBMITTING')
  const create = s.store.escrowOutbox('escrow-one')[0]
  s.restart()
  expect((await s.buy()).status).toBe('SUBMITTING')
  expect(s.store.escrowOutbox('escrow-one')[0].txHash).toBe(create.txHash)
  expect(sign).toHaveBeenCalledTimes(1)
  expect(s.c.txs.size).toBe(1)
  expect(s.store.getRun(s.run.runId).grants).toHaveLength(0)
  s.c.txs.get(create.txHash)!.validated = true
  s.c.state.validate = true
  expect((await s.buy()).status).toBe('VERIFIED')
  expect(s.c.txs.size).toBe(2)
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
})
