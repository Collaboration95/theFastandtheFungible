// SYNTHETIC escrow recovery probes; run only after #273 is present. No network ledger or live funds.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { Wallet, decode, hashes } from 'xrpl'
import type { Ledger } from '../../shared/xrpl.js'
import { createPublisherApp } from '../../publisher/routes.js'
import { Store } from '../../server/store.js'
import { PurchaseManager } from '../../server/purchases.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { XrplPayer } from '../../server/xrpl.js'
import { alphaLeakCorpus } from '../../tests/fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle, alphaLeakArticle } from '../../tests/fixtures/pay-path.js'

const seed = Number(process.argv[2] ?? 279)
const wallet = (s: string) => Wallet.fromEntropy(createHash('sha256').update(`chaos-escrow-fixture:${seed}:${s}`).digest().subarray(0,16))
const faults = ['create-pending','finish-pending','cancel-pending','publisher-down']
const summary = { label: 'SYNTHETIC escrow; controlled policy BUY; ledger survives manager/store restart; no Testnet', iterations: 0, faultsInjected: 0, creates: 0, releases: 0, cancellations: 0, invariantViolations: 0 }
for (const [index, fault] of faults.entries()) {
  const dir = mkdtempSync(join(tmpdir(),'chaos-escrow-')), payerWallet = wallet(`payer-${index}`)
  let now = 800000000, pending: string | undefined, fired = false
  const txs = new Map<string,Record<string,unknown>>(), objects = new Map<number,Record<string,unknown>>()
  const expected = fault === 'cancel-pending' || fault === 'publisher-down' ? 'EscrowCancel' : 'EscrowFinish'
  const ledger: Ledger = { async request(r) {
    switch (r.command) {
      case 'server_info': return {result:{info:{network_id:1,validated_ledger:{age:0,reserve_base_xrp:1,reserve_inc_xrp:0.2}}}}
      case 'account_info': return {result:{account_data:{Sequence:1+txs.size,Balance:'100000000',OwnerCount:objects.size}}}
      case 'ledger': return {result:{ledger_index:100,ledger:{close_time:now}}}
      case 'ledger_current': return {result:{ledger_current_index:100}}
      case 'fee': return {result:{drops:{open_ledger_fee:'12'}}}
      case 'account_tx': return {result:{transactions:[...txs].map(([hash,tx]) => ({hash,tx_json:tx}))}}
      case 'ledger_entry': return {result:{node:objects.get(Number((r.escrow as {seq:number}).seq))}}
      case 'tx': {
        const hash = String(r.transaction), tx = txs.get(hash)
        if (!tx) throw Object.assign(new Error('Synthetic missing tx'),{data:{error:'txnNotFound'}})
        return {result:{validated:hash!==pending,tx_json:tx,ledger_index:100,meta:{TransactionResult:'tesSUCCESS'}}}
      }
      case 'submit': {
        const blob = String(r.tx_blob), hash = hashes.hashSignedTx(blob), tx = decode(blob) as Record<string,unknown>
        if (txs.has(hash)) return {result:{engine_result:'tefALREADY'}}
        if (tx.TransactionType === 'EscrowCreate') { assert.equal(objects.size,0); objects.set(Number(tx.Sequence),tx) }
        else {
          const object = objects.get(Number(tx.OfferSequence)); assert(object)
          assert.equal(tx.Owner,object.Account)
          assert(tx.TransactionType === 'EscrowCancel' ? now > Number(object.CancelAfter) : now < Number(object.CancelAfter))
          objects.delete(Number(tx.OfferSequence))
        }
        txs.set(hash,tx)
        const target = fault === 'create-pending' ? 'EscrowCreate' : expected
        if (!fired && fault !== 'publisher-down' && tx.TransactionType === target) {
          fired = true; pending = hash; summary.faultsInjected++; throw new Error('Injected ambiguous escrow submit timeout')
        }
        return {result:{engine_result:'tesSUCCESS'}}
      }
      default: throw new Error('Unexpected synthetic escrow RPC')
    }
  } }
  const app = createPublisherApp({journal:join(dir,'publisher.db'),rail:'xrpl-testnet',ledger,writers:alphaLeakCorpus,
    env:{XRPL_PUBLISHER_LOAD_FACTOR_SEED:wallet('writer').seed!,XRPL_PUBLISHER_ALPHALEAK_SEED:wallet('bad-writer').seed!},
    escrowWriters:['load-factor','alphaleak'],facilitatorTiming:{pollMs:1,timeoutMs:20}})
  await app.locals.ready
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening')
  let store = new Store(join(dir,'buyer.db'))
  try {
    const client = new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
    if (fault === 'publisher-down') {
      client.paidGet = async () => { if (!fired) { fired = true; summary.faultsInjected++ }; throw new Error('Injected publisher offline after create') }
    }
    const payer = () => new XrplPayer(ledger,payerWallet,{pollMs:1,timeoutMs:20})
    let manager = new PurchaseManager(store,client,payer())
    const run = store.createRun('SYNTHETIC trusted policy BUY escrow recovery probe',200)
    const candidate = await candidateFrom(client.options.baseUrl!, fault === 'cancel-pending' ? alphaLeakArticle : honestArticle)
    const input = {runId:run.runId,candidate,intentId:'escrow-chaos',escrow:true}
    await Promise.all(Array.from({length:2+seed%5},() => manager.purchase(input)))
    assert.equal(store.getRun(run.runId).contents.length,0,'Pending escrow bytes must stay quarantined')
    assert.equal(store.getRun(run.runId).receipts.length,0,'Pending escrow must not have a spent receipt')
    if (expected === 'EscrowCancel') {
      now = store.getIntent(input.intentId)!.escrow!.cancelAfter + 1
      await manager.reconcile()
    }
    store.close(); store = new Store(join(dir,'buyer.db')); pending = undefined
    manager = new PurchaseManager(store,client,payer())
    await manager.reconcile()
    const before = txs.size
    await Promise.all(Array.from({length:5},() => manager.purchase(input)))
    await manager.reconcile()
    assert.equal(txs.size,before,'Escrow replay must not sign or apply another principal/terminal')
    const txList = [...txs.values()], snapshot = store.getRun(run.runId)
    assert.equal(txList.filter(t => t.TransactionType==='EscrowCreate').length,1)
    assert.equal(txList.filter(t => t.TransactionType===expected).length,1)
    assert.equal(txList.length,2); assert.equal(objects.size,0); assert.equal(snapshot.reservedMinor,0)
    assert.equal(snapshot.receipts.length,1)
    assert.equal(snapshot.receipts[0].amountMinor,expected==='EscrowCancel'?0:candidate.price.amountMinor)
    assert.equal(snapshot.contents.length,expected==='EscrowCancel'?0:1)
    store.updateRun(run.runId,{phase:'DONE'})
    assert.equal(store.walletStatus().reservedMinor,0)
    assert(store.auditVerify().ok)
    summary.iterations++; summary.creates++; summary[expected==='EscrowCancel'?'cancellations':'releases']++
  } finally {
    store.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); app.locals.journal.close(); rmSync(dir,{recursive:true,force:true})
  }
}
console.log(JSON.stringify(summary))
