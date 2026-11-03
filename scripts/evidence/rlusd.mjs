// Explicit live Testnet proof. Uses the operator-supplied RLUSD_TESTNET_SEED only for the payer; fresh writer signers are private.
import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { Wallet } from 'xrpl'
import { createPublisherApp } from '../../publisher/routes.ts'
import { createApiApp } from '../../server/routes.ts'
import { loadWriterCorpus } from '../../publisher/corpus.ts'
import { createClient } from '../../sdk/index.ts'
import { XrplPayer } from '../../server/xrpl.ts'
import { testnetLedger, lookupTx } from '../../shared/xrpl.ts'
import { RLUSD_CURRENCY, RLUSD_TESTNET_ISSUER, matchesAmount } from '../../shared/contracts/asset.ts'
import { USE_CASES } from '../../tests/scenarios/use-cases.ts'
import { auditRuns } from '../gate-audit.ts'
import { receiptBundle } from '../../server/receipt-bundle.ts'
if (!process.argv.includes('--testnet') || process.env.OFFSET !== '1400') throw Error('Explicit --testnet and OFFSET=1400 required')
const dir='scratch/real-rlusd-owner', corpus=await loadWriterCorpus()
const seeds=JSON.parse(readFileSync('scratch/real-rlusd/writers.private.json'))
for(const p of corpus.publishers) if(!seeds[p.slug]) seeds[p.slug]=Wallet.generate().seed
writeFileSync('scratch/real-rlusd/writers.private.json',JSON.stringify(seeds),{mode:0o600})
for(const k of Object.keys(process.env)) if(/^XRPL_PUBLISHER_.*_(SEED|CURRENCY)$/.test(k)) delete process.env[k]
for(const [slug,seed] of Object.entries(seeds)) {
 const prefix=`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-','_')}`
 process.env[`${prefix}_SEED`]=seed;process.env[`${prefix}_CURRENCY`]='RLUSD'
}
Object.assign(process.env,{LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off',LANGFUSE_ENABLED:'0',MCP_MAX_BUDGET_MINOR:'200',MCP_DAILY_CAP_MINOR:'500',XRPL_RLUSD_ISSUER:RLUSD_TESTNET_ISSUER,ESCROW_WRITERS:''})
const wallet=Wallet.fromSeed(process.env.RLUSD_TESTNET_SEED), ledger=testnetLedger()
if(wallet.classicAddress!==process.env.RLUSD_TESTNET_ADDRESS) throw Error('Payer address mismatch')
const app=createPublisherApp({journal:`${dir}/publisher.db`,writers:corpus,rail:'xrpl-testnet',ledger,env:process.env})
await app.locals.ready
const listen=async app=>{const s=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{s.once('listening',r);s.once('error',j)});return s}
const pub=await listen(app)
const api=await createApiApp({payer:new XrplPayer(ledger,wallet),publisherUrl:`http://127.0.0.1:${pub.address().port}`,dbPath:`${dir}/app.db`})
const server=await listen(api.app)
try {
 const sdk=createClient({baseUrl:`http://127.0.0.1:${server.address().port}`,token:process.env.RA_API_TOKEN})
 const evidencePath='docs/evidence/rlusd.json', evidence=existsSync(`${dir}/evidence.json`)?JSON.parse(readFileSync(`${dir}/evidence.json`)):{label:'RLUSD (Testnet) · SYNTHETIC corpus · fixture research and decisions · no real value',issuer:RLUSD_TESTNET_ISSUER,currency:RLUSD_CURRENCY,runs:{}}
 for(const id of ['UC2','UC3']) {
  const question=id==='UC2'?USE_CASES.UC2.question.replace(/\?$/,' (pricing & margins)?'):USE_CASES.UC3.question
  const result=await sdk.ask(question,{budgetSgd:2,idempotencyKey:`real-rlusd-${id}`})
  const run=api.store.getRun(result.run_id)
  writeFileSync(`${dir}/${id}-run.json`,JSON.stringify(run,null,2))
  const intents=run.intents.filter(i=>i.txHash)
  if(!intents.length || (id==='UC2'&&!intents.some(i=>i.status==='VERIFIED')) || (id==='UC3'&&!intents.some(i=>i.status==='REFUNDED')))throw Error(`${id} did not reach required outcome: ${run.intents.map(i=>i.status+':'+i.error).join(',')}`)
  const transactions=[]
  for(const i of intents) for(const [kind,hash] of [['purchase',i.txHash],...(i.refund?[['refund',i.refund.txHash]]:[])]) {
   const tx=await lookupTx(ledger,hash), asset=i.quote.payment.asset
   if(asset==='XRP'||asset.issuer!==RLUSD_TESTNET_ISSUER||asset.label!=='RLUSD (Testnet)'||tx.state!=='validated'||tx.meta.TransactionResult!=='tesSUCCESS'||!matchesAmount(tx.meta.delivered_amount,i.quote.payment.amountDrops,asset)|| (Number(tx.tx.Flags)&0x20000))throw Error('Ledger settlement mismatch')
   transactions.push({kind,hash,ledgerIndex:tx.ledgerIndex,deliveredAmount:tx.meta.delivered_amount,feeDrops:tx.tx.Fee,from:tx.tx.Account,to:tx.tx.Destination,invoiceId:tx.tx.InvoiceID})
  }
  const replay=await sdk.ask(question,{budgetSgd:2,idempotencyKey:`real-rlusd-${id}`})
  if(JSON.stringify(replay.purchases)!==JSON.stringify(result.purchases))throw Error('Replay differs')
  const gate=auditRuns([run],corpus)
  if(gate.total||!api.store.auditVerify().ok)throw Error('Gate/audit failed')
  const bundle=receiptBundle(api.store,run.runId)
  writeFileSync(`docs/evidence/rlusd-${id.toLowerCase()}-receipts.json`,JSON.stringify(bundle,null,2))
  evidence.runs[id]={runId:run.runId,transactions,replayIdentical:true,gateAudit:gate,auditChain:api.store.auditVerify(),outcomes:intents.map(i=>({intentId:i.intentId,status:i.status,refund:i.refund}))}
  writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2));writeFileSync(evidencePath,JSON.stringify(evidence,null,2));console.log(JSON.stringify({id,...evidence.runs[id]}))
 }
} finally {
 for(const s of [server,pub]){s.closeAllConnections();await new Promise(r=>s.close(r))}
 await api.close();app.locals.journal.close();await ledger.close()
}
