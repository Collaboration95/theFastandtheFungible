// Real Testnet settlement, synthetic signed fixture content. No live models or hosted deployment.
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'xrpl'
import { ResourceScope } from '../shared/resource-scope.ts'
import { createPublisherApp } from '../publisher/routes.ts'
import { Store } from '../server/store.ts'
import { PurchaseManager } from '../server/purchases.ts'
import { PublisherClient } from '../server/publisher-client.ts'
import { XrplPayer } from '../server/xrpl.ts'
import { alphaLeakCorpus } from '../tests/fixtures/corpus-mini/index.ts'
import { candidateFrom, honestArticle, alphaLeakArticle } from '../tests/fixtures/pay-path.ts'
import { receiptBundle } from '../server/receipt-bundle.ts'
process.env.ESCROW_MODE='key-reveal'; process.env.ESCROW_HOLDBACK='on'; process.env.HOLDBACK_CANCEL_AFTER_S='60'
const scope = new ResourceScope(), dir = scope.tempDir('holdback-testnet-'), c = new Client('wss://s.altnet.rippletest.net:51233',{timeout:20000})
const output = 'docs/evidence/money', previous=!process.argv.includes('--fresh') && existsSync('docs/evidence/money/holdback-transactions.json') ? JSON.parse(readFileSync('docs/evidence/money/holdback-transactions.json','utf8')) : undefined, rows=previous?.rows ?? []
mkdirSync(output,{recursive:true})
try {
  await c.connect(); scope.defer(() => c.disconnect())
  assert.equal((await c.request({command:'server_info'})).result.info.network_id,1)
  const buyer=(await c.fundWallet()).wallet, writer=(await c.fundWallet()).wallet
  const ledger = {request:r=>c.request(r)}
  const app = createPublisherApp({ journal:join(dir,'writer.db'),rail:'xrpl-testnet',ledger,writers:alphaLeakCorpus,env:{ESCROW_MODE:'key-reveal',XRPL_PUBLISHER_LOAD_FACTOR_SEED:writer.seed,XRPL_PUBLISHER_ALPHALEAK_SEED:writer.seed},escrowWriters:['load-factor','alphaleak'] })
  await app.locals.ready; scope.defer(()=>app.locals.journal.close())
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); scope.defer(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}))
  const url=`http://127.0.0.1:${server.address().port}`,client=new PublisherClient({baseUrl:url}),store=scope.own(new Store(join(dir,'buyer.db'))),payer=new XrplPayer(ledger,buyer,{pollMs:500,timeoutMs:45000}),manager=new PurchaseManager(store,client,payer)
  const save=()=>writeFileSync(`${output}/holdback-transactions.json`,JSON.stringify({at:new Date().toISOString(),network:'XRPL Testnet',content:'Synthetic fixture writers and promises',buyer:buyer.address,writer:writer.address,rows},null,2)+'\n')
  for(let i=rows.length;i<(process.argv.includes('--controls')?17:15);i++) {
    const fail=i>=10 && i!==15
    if(fail) store.resetReputation() // Independent synthetic promise-failure trials, not a production policy bypass.
    const candidate=await candidateFrom(url,fail?alphaLeakArticle:honestArticle)
    const run=store.createRun(`Synthetic holdback ${fail?'promise mismatch':'passing promise'} ${i+1}`,200,{research:'fixture',decision:'fixture',publisher:'local fixture',settlement:'XRPL TESTNET · no real value'})
    store.updateRun(run.runId,{candidates:[candidate]}); store.addAnswer(run.runId,{version:1,conclusion:'Synthetic holdback evidence run.',claims:[],openGaps:[],provider:'fixture',model:'fixture'})
    const intentId=`holdback-evidence-${i+1}`,result=await manager.purchase({runId:run.runId,candidate,intentId,escrow:true})
    assert.equal(result.status,fail?'CLAIM_FAILED':'VERIFIED',result.error ?? 'Unexpected purchase result')
    if(fail) {
      while(store.getIntent(intentId).escrow.holdback.state==='pending') { await new Promise(r=>setTimeout(r,1000)); await manager.reconcile() }
    }
    const final=store.getIntent(intentId),h=final.escrow.holdback
    assert.equal(h.state,fail?'refunded':'released')
    const terminalRecord = (await c.request({command:'tx',transaction:h.finishHash??h.cancelHash,api_version:2})).result
    assert.equal(terminalRecord.meta.TransactionResult,'tesSUCCESS'); if(fail) assert.ok(terminalRecord.tx_json.date > h.cancelAfter)
    rows.push({terminalLedger:terminalRecord.ledger_index,terminalCloseTime:terminalRecord.tx_json.date,runId:run.runId,intentId,forcedPromiseFailure:fail,amountMinor:final.amountMinor,holdback:h,batch:h.batchHash,keyCreate:final.escrow.createHash,keyFinish:final.escrow.finishHash,holdbackCreate:h.createHash,holdbackTerminal:h.finishHash??h.cancelHash})
    writeFileSync(`${output}/holdback-${String(i+1).padStart(2,'0')}.receipt.json`,JSON.stringify(receiptBundle(store,run.runId),null,2)+'\n')
    save(); console.log(JSON.stringify({completed:i+1,state:h.state,batch:h.batchHash,terminal:h.finishHash??h.cancelHash}))
  }
} finally { await scope.close() }
