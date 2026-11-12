import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { afterEach, expect, it, vi } from 'vitest'
import { ResourceScope } from '../shared/resource-scope.js'
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
async function setup(options: { opted?: boolean; broken?: boolean; budget?: number; iou?: boolean } = {}) {
  vi.stubEnv('ESCROW_MODE', 'key-reveal')
  vi.stubEnv('ESCROW_HOLDBACK','on')
  if(options.iou) { vi.stubEnv('ESCROW_ASSET','test-iou'); vi.stubEnv('TESTNET_IOU_ISSUER',Wallet.generate().classicAddress) }
  const c = chain(), scope = new ResourceScope(), dir = scope.tempDir('holdback-')
  cleanup.push(() => scope.close())
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
  store.updateRun(run.runId,{candidates:[candidate]})
  store.addAnswer(run.runId,{version:1,conclusion:'Synthetic holdback evidence',claims:[],openGaps:[],provider:'fixture',model:'fixture'})
  const buy = (intentId = 'escrow-one', escrow = true) => manager.purchase({ runId: run.runId, candidate, intentId, escrow })
  return { c, client, candidate, run, wallet, buy, journal:app.locals.journal as import('../publisher/journal.js').PublisherJournal, writer:Wallet.fromSeed(env.XRPL_PUBLISHER_LOAD_FACTOR_SEED), get store() { return store }, get manager() { return manager }, restart() { store.close(); store = new Store(db); manager = new PurchaseManager(store, client, payer()) } }
}

it('uses one Batch, gates bytes on key escrow and releases buyer-held holdback', async () => {
  const s = await setup()
  const result = await s.buy()
  expect(result.status).toBe('VERIFIED')
  expect(result.escrow?.holdback).toMatchObject({state:'released',percent:20})
  const transactions = [...s.c.txs.values()].map(t => t.tx_json)
  expect(transactions.filter(t => t.TransactionType === 'Batch')).toHaveLength(1)
  expect(transactions.filter(t => t.TransactionType === 'EscrowCreate')).toHaveLength(2)
  expect(transactions.filter(t => t.TransactionType === 'EscrowFinish')).toHaveLength(2)
  const run = s.store.getRun(s.run.runId)
  expect(run.spentMinor).toBe(s.candidate.price.amountMinor)
  expect(run.contents).toHaveLength(1)
  const secret = s.store.holdbackPrivate<{secret:string}>(result.intentId)!.secret
  expect(JSON.stringify(run)).not.toContain(secret)
  expect(JSON.stringify(s.store.auditEntries())).not.toContain(secret)
  expect(run.receipts[0].escrow?.holdback?.state).toBe('released')
  const bundle = receiptBundle(s.store,s.run.runId)
  const verified = await verifyAnswer(bundle)
  expect(verified.checks.filter(c => c.status === 'FAIL')).toEqual([])
  expect((await verifyAnswer(bundle,{testnet:true,ledger:s.c.ledger})).checks.filter(c => c.status === 'FAIL')).toEqual([])
  const tampered = structuredClone(bundle); tampered.intents[0].escrow!.holdback!.createSequence!++
  expect((await verifyAnswer(tampered)).ok).toBe(false)
  s.restart(); await s.manager.reconcile(); await s.buy()
  expect([...s.c.txs.values()].filter(t => t.tx_json.TransactionType === 'Batch')).toHaveLength(1)
})
it('a failed promise cancels without a writer signature after CancelAfter', async () => {
  const s = await setup({broken:true})
  const result = await s.buy()
  expect(result.status).toBe('CLAIM_FAILED')
  expect(result.escrow?.holdback).toMatchObject({state:'pending',checks:'fail'})
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
  const count = s.c.txs.size
  await s.manager.reconcile(); expect(s.c.txs.size).toBe(count)
  s.c.state.now = result.escrow!.holdback!.cancelAfter + 1
  s.restart(); await s.manager.reconcile()
  const next = s.store.getIntent(result.intentId)!
  expect(next.escrow?.holdback?.state).toBe('refunded')
  const cancel = [...s.c.txs.values()].find(t => t.tx_json.TransactionType === 'EscrowCancel')!
  expect(cancel.tx_json.Account).toBe(s.wallet.classicAddress)
  expect(cancel.tx_json.OfferSequence).toBe(next.escrow!.holdback!.createSequence)
  expect(s.store.getRun(s.run.runId).spentMinor).toBe(s.candidate.price.amountMinor)
})
it('keeps the holdback refundable when the existing ledger-freshness check fails', async () => {
  const s=await setup(), freshness=await import('../publisher/writers/ledger-analytics/freshness.js')
  vi.spyOn(freshness,'checkFreshness').mockResolvedValue({ok:false,failedClaimId:'p1:dated-figure',reason:'Synthetic stale-report failure'})
  const result=await s.buy()
  expect(result.status).toBe('CLAIM_FAILED')
  expect(result.escrow!.holdback).toMatchObject({state:'pending',checks:'fail'})
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
  s.c.state.now=result.escrow!.holdback!.cancelAfter+1; await s.manager.reconcile()
  expect(s.store.getIntent(result.intentId)!.escrow!.holdback!.state).toBe('refunded')
})
it('refuses body release on outer success with rolled back inner creates', async () => {
  const s = await setup(); s.c.state.batchRollback = true
  const result = await s.buy()
  expect(result.status).toBe('SUBMITTING')
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
  s.restart(); await s.buy()
  expect([...s.c.txs.values()].filter(t => t.tx_json.TransactionType === 'Batch')).toHaveLength(1)
})
it('cancels both escrows without negative net spend when the writer never reveals', async () => {
  const s=await setup()
  vi.spyOn(PublisherClient.prototype,'paidGet').mockRejectedValue(Error('Synthetic writer unavailable'))
  const result=await s.buy()
  expect(result.status).toBe('SUBMITTING')
  s.c.state.now=Math.max(result.escrow!.cancelAfter,result.escrow!.holdback!.cancelAfter)+1
  await s.manager.reconcile()
  const run=s.store.getRun(s.run.runId), bundle=receiptBundle(s.store,s.run.runId)
  expect(run.intents[0].escrow).toMatchObject({state:'CANCELLED',holdback:{state:'refunded'}})
  expect(run).toMatchObject({spentMinor:0,refundedMinor:0,contents:[]})
  expect(bundle.contributions!.purchases[0]).toMatchObject({grossMinor:0,refundMinor:0,netMinor:0})
  expect((await verifyAnswer(bundle,{testnet:true,ledger:s.c.ledger})).checks.filter(c=>c.status==='FAIL')).toEqual([])
})
it('reserves full price and signs nothing when the budget is insufficient', async () => {
  const s = await setup({budget:1}); const result = await s.buy()
  expect(result.status).toBe('SKIPPED'); expect(s.c.txs.size).toBe(0)
})
for (const stage of ['before submit','after submit','after validation'] as const) it(`crash ${stage} retries only the same durable Batch`, async () => {
  const s = await setup()
  const persist = s.store.recordEscrowSubmission.bind(s.store)
  const transition = s.store.escrowTransition.bind(s.store)
  let interrupted = false
  if (stage === 'before submit') vi.spyOn(s.store,'recordEscrowSubmission').mockImplementation((id,op,tx) => {
    // Simulate a stop immediately after the committed outbox, before send.
    const value = persist(id,op,tx)
    if (op === 'create') s.c.state.submitEnabled = false
    return value
  })
  if (stage === 'after submit') s.c.state.validate = false
  if (stage === 'after validation') vi.spyOn(s.store,'escrowTransition').mockImplementation((id,patch,index) => {
    if (patch.state === 'LOCKED' && !interrupted) { interrupted=true; throw Error('synthetic crash') }
    return transition(id,patch,index)
  })
  await s.buy()
  const first = s.store.escrowOutbox('escrow-one')[0]
  expect(first).toBeDefined()
  s.c.state.submitEnabled = true; s.c.state.validate = true
  for (const row of s.c.txs.values()) row.validated=true
  s.restart(); await s.buy()
  const second = s.store.escrowOutbox('escrow-one')[0]
  expect(second.txBlob).toBe(first.txBlob)
  expect(second.txHash).toBe(first.txHash)
  expect(s.store.getIntent('escrow-one')!.status).toBe('VERIFIED')
  expect([...s.c.txs.values()].filter(t => t.tx_json.TransactionType === 'Batch')).toHaveLength(1)
})

for (const restart of [false,true]) it(`recovers a crash between durable sequence reservation and signing${restart?' across restart':''}`, async () => {
  const s = await setup()
  const save = s.store.holdbackPrivate.bind(s.store)
  // Commit the reservation, then make signing fail before any outbox or submit.
  const originalSign = s.wallet.sign.bind(s.wallet)
  vi.spyOn(s.wallet,'sign').mockImplementation(tx => {
    if (tx.TransactionType === 'Batch') throw Error('synthetic crash before signing')
    return originalSign(tx)
  })
  await s.buy()
  expect(s.store.escrowOutbox('escrow-one')).toHaveLength(0)
  const unsigned=save<{unsigned?:{LastLedgerSequence:number}}>('escrow-one')?.unsigned
  expect(unsigned).toBeDefined()
  expect(s.c.txs.size).toBe(0)
  s.c.state.index+=3
  vi.restoreAllMocks(); if(restart) s.restart(); await s.buy()
  expect(s.store.escrowOutbox('escrow-one')[0].lastLedgerSequence).toBe(unsigned!.LastLedgerSequence)
  expect(s.store.getIntent('escrow-one')!.status).toBe('VERIFIED')
  expect([...s.c.txs.values()].filter(t => t.tx_json.TransactionType === 'Batch')).toHaveLength(1)
})
it('binds the refunded and pending holdback states in offline receipts', async () => {
  const s = await setup({broken:true}); await s.buy()
  const pending = receiptBundle(s.store,s.run.runId)
  expect((await verifyAnswer(pending)).checks.find(c => c.check === 'holdback escrow-one')?.status).toBe('PASS')
  s.c.state.now = s.store.getIntent('escrow-one')!.escrow!.holdback!.cancelAfter + 1
  await s.manager.reconcile()
  const refunded = receiptBundle(s.store,s.run.runId)
  expect((await verifyAnswer(refunded)).checks.find(c => c.check === 'holdback escrow-one')?.status).toBe('PASS')
  expect((await verifyAnswer(refunded,{testnet:true,ledger:s.c.ledger})).checks.filter(c => c.status === 'FAIL')).toEqual([])
  const tampered = structuredClone(refunded); tampered.intents[0].escrow!.holdback!.cancelHash='F'.repeat(64)
  expect((await verifyAnswer(tampered)).checks.find(c => c.check === 'holdback escrow-one')?.status).toBe('FAIL')
})

it('keeps F2 private when a signed holdback finish has not validated', async () => {
  const s = await setup()
  const original = s.c.ledger.request.bind(s.c.ledger)
  vi.spyOn(s.c.ledger,'request').mockImplementation(async request => {
    if (request.command === 'submit') {
      const tx = (await import('xrpl')).decode(String(request.tx_blob))
      if (tx.TransactionType === 'EscrowFinish' && tx.Account === s.wallet.classicAddress) s.c.state.validate=false
    }
    return original(request)
  })
  const result = await s.buy()
  expect(result.escrow?.holdback?.state).toBe('pending')
  const bundle = receiptBundle(s.store,s.run.runId)
  const secret = s.store.holdbackPrivate<{secret:string}>('escrow-one')!.secret
  expect(JSON.stringify(bundle)).not.toContain(secret)
  expect(bundle.holdbacks![0].terminal).toBeUndefined()
})
it('does not release a holdback while live relevance calibration is unavailable', async () => {
  const s = await setup()
  s.store.updateRun(s.run.runId,{labels:{...s.run.labels,search:'hybrid'}})
  const result = await s.buy()
  expect(result.escrow?.holdback?.state).toBe('pending')
  expect(result.escrow?.holdback?.checks).toBeUndefined()
  s.store.updateRun(s.run.runId,{checkpoint:{holdbackCalibration:{'escrow-one':{claimed:1,observed:0}}}})
  s.c.state.now=result.escrow!.holdback!.cancelAfter+1
  await s.manager.reconcile()
  expect(s.store.getIntent('escrow-one')!.escrow!.holdback).toMatchObject({state:'refunded',checks:'fail'})
})

for (const restart of [false,true]) it(`does not turn an unsigned reservation into spending after Stop${restart?' and restart':''}`, async () => {
  const s = await setup()
  const original = s.wallet.sign.bind(s.wallet)
  vi.spyOn(s.wallet,'sign').mockImplementation(tx => { if(tx.TransactionType==='Batch') throw Error('crash'); return original(tx) })
  await s.buy(); s.store.updateRun(s.run.runId,{stopped:true})
  vi.restoreAllMocks(); if(restart) s.restart(); await s.buy()
  expect(s.c.txs.size).toBe(0)
  expect(s.store.getIntent('escrow-one')!.status).toBe('FAILED_NOT_SETTLED')
  const next=s.store.createRun('New synthetic authorization after Stop',200)
  const result=await s.manager.purchase({runId:next.runId,candidate:s.candidate,intentId:'after-stop',escrow:true})
  expect(result.status).toBe('VERIFIED')
})
it('preserves check evidence while a completed run still owes holdback settlement', async () => {
  const s = await setup()
  s.store.updateRun(s.run.runId,{labels:{...s.run.labels,search:'hybrid'}})
  await s.buy(); s.store.updateRun(s.run.runId,{phase:'DONE'})
  expect(s.store.prune({olderThanDays:0,now:Date.now()+86400000,dryRun:true}).runIds).toEqual([])
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(1)
})

for (const broken of [false,true]) it(`verifies exact issued-currency credits for ${broken?'refund':'release'}`, async () => {
  const s = await setup({iou:true,broken}); const result=await s.buy()
  expect(result.status).toBe(broken?'CLAIM_FAILED':'VERIFIED')
  if(broken) { s.c.state.now=result.escrow!.holdback!.cancelAfter+1; await s.manager.reconcile() }
  expect(s.store.getIntent('escrow-one')!.escrow!.holdback!.state).toBe(broken?'refunded':'released')
  expect((await verifyAnswer(receiptBundle(s.store,s.run.runId),{testnet:true,ledger:s.c.ledger})).checks.filter(c=>c.status==='FAIL')).toEqual([])
})

it('records sub-cent holdbacks exactly rather than rounding their refund to zero', async () => {
  const s = await setup({broken:true}); vi.stubEnv('HOLDBACK_PERCENT','1')
  const result=await s.buy()
  expect(result.escrow!.holdback!.amountMinor).toBe(s.candidate.price.amountMinor/100)
  s.c.state.now=result.escrow!.holdback!.cancelAfter+1; await s.manager.reconcile()
  const bundle=receiptBundle(s.store,s.run.runId)
  expect(bundle.contributions!.purchases[0]).toMatchObject({refundMinor:s.candidate.price.amountMinor/100,netMinor:s.candidate.price.amountMinor*0.99,refundStatus:'recorded verified holdback refund'})
  expect((await verifyAnswer(bundle)).ok).toBe(true)
})
