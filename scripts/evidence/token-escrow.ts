// Public-faucet Testnet only. Private wallets remain in the 0600 scratch store.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { Wallet } from 'xrpl'
import { walletFile, isolatedEnv } from '../testnet-wallets.js'
import { testnetLedger } from '../../shared/xrpl.js'
import { createPublisherApp } from '../../publisher/routes.js'
import { alphaLeakCorpus } from '../../tests/fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle } from '../../tests/fixtures/pay-path.js'
import { Store } from '../../server/store.js'
import { PurchaseManager } from '../../server/purchases.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { XrplPayer } from '../../server/xrpl.js'
import { receiptBundle } from '../../server/receipt-bundle.js'
const seeds=JSON.parse(await readFile(walletFile,'utf8'))
process.env.ESCROW_ASSET='test-iou'
const env=Object.fromEntries(Object.entries(isolatedEnv(seeds)).filter(([,v])=>v!==undefined))
for(const name of Object.keys(process.env)) if(!(name in env)) delete process.env[name]
Object.assign(process.env,env)
const ledger=testnetLedger()
const records=process.argv.includes('--no-show') ? JSON.parse(await readFile('docs/evidence/round3-e/runs.json','utf8')) : []
await mkdir('docs/evidence/round3-e',{recursive:true})
try {
 for (const mode of (process.argv.includes('--no-show') ? ['no-show'] : ['happy-1','happy-2','happy-3','no-show'])) {
  const start=Date.now(), store=new Store(':memory:')
  const app=createPublisherApp({journal:':memory:',rail:'xrpl-testnet',ledger,writers:alphaLeakCorpus,env:process.env,escrowWriters:['load-factor']})
  await app.locals.ready
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r))
  try {
   const client=new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
   const candidate=await candidateFrom(client.origin,honestArticle)
   const run=store.createRun('SYNTHETIC fixture article; TEST-SGD stand-in for RLUSD',200)
   store.updateRun(run.runId,{candidates:[candidate]})
   if(mode==='no-show') client.paidGet=async()=>{throw Error('Deliberate writer no-show')}
   const manager=new PurchaseManager(store,client,new XrplPayer(ledger,Wallet.fromSeed(seeds.buyer)))
   let intent=await manager.purchase({runId:run.runId,candidate,intentId:mode,escrow:true})
   while(mode==='no-show' && intent.escrow?.state!=='CANCELLED') {
    await new Promise(r=>setTimeout(r,1000)); await manager.reconcile(); intent=store.getIntent(mode)!
    if(Date.now()-start>190000) throw Error('Cancel deadline exceeded')
   }
   if(intent.escrow?.state!==(mode==='no-show'?'CANCELLED':'RELEASED')) throw Error('Unexpected terminal state: '+intent.error)
   const hashes=[intent.escrow.createHash!,intent.txHash!], fees=[]
   const responses:Record<string,unknown>={}
   // Independently re-fetch each hash from JSON-RPC, not the signing WebSocket.
   for(const hash of hashes) {
    const response=await fetch('https://s.altnet.rippletest.net:51234',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'tx',params:[{transaction:hash,binary:false}]})})
    const {result}=await response.json() as {result:Record<string,any>} // eslint-disable-line @typescript-eslint/no-explicit-any
    if(!result.validated || result.meta.TransactionResult!=='tesSUCCESS') throw Error('Independent validation failed')
    responses[hash]=result; fees.push((result.tx_json??result).Fee)
   }
   if(mode!=='no-show') {
    const source=store.getRun(run.runId).contents[0]
    store.addAnswer(run.runId,{conclusion:'Fixture key reveal.',claims:[{id:'claim',text:source.spans[0].text,stance:'SUPPORTS',citations:[{resourceId:source.resourceId,version:source.version,spanId:source.spans[0].id}]}],openGaps:[],version:1,provider:'fixture',model:'extractive-fixture'})
   }
   if(mode==='no-show') store.addAnswer(run.runId,{conclusion:'Writer absent; principal returned.',claims:[],openGaps:[],version:1,provider:'fixture',model:'extractive-fixture'})
   await writeFile(`tests/fixtures/receipt-conformance/iou-${mode}.json`,JSON.stringify(receiptBundle(store,run.runId),null,2)+'\n')
   await writeFile(`tests/fixtures/receipt-conformance/iou-${mode}-ledger.json`,JSON.stringify(responses,null,2)+'\n')
   const record={mode,hashes,elapsedMs:Date.now()-start,feeDrops:fees}; records.push(record)
   await writeFile('docs/evidence/round3-e/runs.json',JSON.stringify(records,null,2)+'\n')
   console.log(JSON.stringify(record))
  } finally { server.closeAllConnections(); server.close(); app.locals.journal.close(); store.close() }
 }
} finally {await ledger.close()}
