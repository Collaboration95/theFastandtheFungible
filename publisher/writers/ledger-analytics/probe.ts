// Local Testnet acceptance: dedicated payer, normal x402 delivery, same-intent retry.
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { once } from 'node:events'
import { Client, Wallet } from 'xrpl'
import { localWriterRoot } from '../../local-writers.js'
import { ledgerCorpus } from './catalogue.js'
import { computeReport } from './reports.js'
import { createPublisherApp } from '../../routes.js'
import { Store } from '../../../server/store.js'
import { PublisherClient } from '../../../server/publisher-client.js'
import { PurchaseManager } from '../../../server/purchases.js'
import { XrplPayer } from '../../../server/xrpl.js'
import { testnetLedger, testnetUrl } from '../../../shared/xrpl.js'
import { exampleCandidate } from '../../../shared/contracts/examples.js'
if(!process.argv.includes('--testnet')) throw Error('Use --testnet for the explicit Testnet purchase probe')
const dir=join(localWriterRoot(),'ledger-analytics','content-probe');mkdirSync(dir,{recursive:true,mode:0o700})
const seedFile=join(dir,'payer.seed')
if(!existsSync(seedFile)) writeFileSync(seedFile,Wallet.generate().seed!,{mode:0o600,flag:'wx'})
const payer=Wallet.fromSeed(readFileSync(seedFile,'utf8')), rpc=testnetLedger(), faucet=new Client(testnetUrl())
const report=await computeReport('amm'),corpus={...ledgerCorpus(),articles:[report.article]}
const publisher=createPublisherApp({journal:join(dir,'publisher.db'),rail:'xrpl-testnet',writers:corpus,ledger:rpc})
const store=new Store(join(dir,'buyer.db'))
let server:ReturnType<typeof publisher.listen>|undefined
try {
  await faucet.connect()
  try { await faucet.request({command:'account_info',account:payer.address,ledger_index:'validated'}) } catch { await faucet.fundWallet(payer) }
  await publisher.locals.ready
  await publisher.locals.ledgerAnalytics?.prewarmed
  server=publisher.listen(0,'127.0.0.1');await once(server,'listening')
  const client=new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
  await client.registry()
  const hit=(await client.searchPublisher('ledger-analytics','RLUSD XRP AMM pool statistics',1))[0]
  if(!hit?.manifest)throw Error('No paid report manifest')
  const candidate={...exampleCandidate,profileId:hit.publisherSlug,resourceId:hit.articleId,version:hit.version,title:hit.title,family:hit.family,url:hit.url,wallet:hit.manifest.wallet,manifest:hit.manifest,tier:'PAID' as const,price:{amountMinor:hit.priceMinor,currency:'SGD' as const}}
  const run=store.createRun('RLUSD/XRP AMM pool statistics',200), manager=new PurchaseManager(store,client,new XrplPayer(rpc,payer))
  const intentId=`content-proof-${run.runId}`
  let intent=await manager.purchase({runId:run.runId,candidate,intentId})
  const deadline=Date.now()+120000
  while(intent.status==='SUBMITTING'&&Date.now()<deadline){await manager.reconcile();intent=store.getIntent(intentId)!;if(intent.status==='SUBMITTING')await new Promise(r=>setTimeout(r,500))}
  if(intent.status!=='VERIFIED')throw Error(`Content proof did not verify: ${intent.status}`)
  await manager.purchase({runId:run.runId,candidate,intentId})
  const snapshot=store.getRun(run.runId),delivery=store.getDelivery(intentId),manifest=store.getManifest(intentId)
  if(snapshot.receipts.length!==1 || snapshot.contents.length!==1)throw Error('Duplicate charge or missing verified grant')
  const funding=await faucet.request({command:'account_tx',account:payer.address,ledger_index_min:-1,ledger_index_max:-1,limit:10})
  const evidence={provenance:'Live local x402 Testnet purchase; public Mainnet report reads; no model calls.',writer:hit.manifest.wallet,payer:payer.address,receipt:snapshot.receipts[0],intent,manifest,delivery,events:snapshot.events,fundingTransactions:funding.result.transactions.map(t=>{const row=t as unknown as Record<string,unknown>,tx=(row.tx??row.tx_json) as Record<string,unknown>|undefined;return {hash:tx?.hash??row.hash,ledgerIndex:row.ledger_index,validated:row.validated}})}
  writeFileSync('docs/evidence/content/testnet-purchase.json',JSON.stringify(evidence,null,2)+'\n')
  console.log(JSON.stringify({writer:hit.manifest.wallet,payer:payer.address,transaction:intent.txHash,status:intent.status,receipts:snapshot.receipts.length}))
} finally {server?.close();server?.closeAllConnections();await publisher.locals.ledgerAnalytics?.stop();store.close();publisher.locals.journal.close();await rpc.close();await faucet.disconnect()}
