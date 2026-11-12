// Opt-in Testnet proof. Public output contains only addresses, timings and ledger hashes.
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ResourceScope } from '../shared/resource-scope.js'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { XrplPayer } from '../server/xrpl.js'
import { testnetLedger } from '../shared/xrpl.js'
import { fundTestnetWallet } from '../publisher/publishing/testnet-funding.js'
import { Wallet } from 'xrpl'
if (!process.argv.includes('--testnet')) throw Error('Requires --testnet')
const scope = new ResourceScope(), ledger = testnetLedger(), store = new Store(':memory:')
const root = scope.evidenceDir('web-publishing-', 'Private writer keys and publisher journal; retain for Testnet reconciliation')
const operator = randomBytes(32).toString('hex')
const app = createPublisherApp({writers:{publishers:[],writers:[],articles:[]},rail:'xrpl-testnet',journal:join(root,'publisher.db'),env:{WEB_PUBLISHING:'on',SETTLEMENT_RAIL:'xrpl-testnet',OPERATOR_TOKEN:operator,AUTO_APPROVE:'on',AUTO_APPROVE_SECONDS:'5',ESCROW_MODE:'key-reveal'}})
try {
  await app.locals.ready
  const server = app.listen(0,'127.0.0.1'); scope.defer(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await app.locals.closePublishing();app.locals.journal.close()})
  await new Promise<void>(r=>server.listening?r():server.once('listening',r))
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  const body=readFileSync('tests/web-publishing.test.ts','utf8').match(/body:\[([\s\S]+?)\]\.join/)! [1].split('\n').map(s=>s.trim()).filter(s=>s.startsWith("'")).map(s=>s.replace(/^'|',?$/g,'')).join('\n\n')
  const start=performance.now()
  const submitted=await (await fetch(base+'/api/publishing/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Ledger reserve checklist',body,topics:['reserve','escrow'],priceMinor:10,payout:'create',displayName:'Publishing acceptance probe'})})).json()
  if(!submitted.id) throw Error('Submission failed')
  let status
  const deadline=Date.now()+90000
  do { await new Promise(r=>setTimeout(r,500)); status=await (await fetch(`${base}/api/publishing/notes/${submitted.id}`,{headers:{'X-Publishing-Key':submitted.key}})).json(); if(Date.now()>deadline||status.state==='failed')throw Error('Publishing did not reach live') }while(status.state!=='live')
  const readySeconds=(performance.now()-start)/1000
  const buyer=Wallet.generate();writeFileSync(join(root,'buyer.private.json'),JSON.stringify({seed:buyer.seed}),{mode:0o600});await fundTestnetWallet(buyer)
  process.env.ESCROW_MODE='key-reveal';process.env.SETTLEMENT_RAIL='xrpl-testnet'
  const client=new PublisherClient({baseUrl:base}), roster=await client.registry(), hit=(await client.searchPublisher(roster[0].slug,'ledger reserve escrow',5))[0]
  const { retrieve }=await import('../server/agents/research.js')
  const candidate=(await retrieve(client,'ledger reserve escrow')).candidates.find(c=>c.tier==='PAID'&&c.profileId===status.slug)!
  if(!candidate || !hit) throw Error('Published note not searchable')
  const run=store.createRun('Check ledger reserve before escrow',100), manager=new PurchaseManager(store,client,new XrplPayer(ledger,buyer))
  let intent=await manager.purchase({runId:run.runId,candidate,intentId:`publish-${run.runId}`})
  const until=Date.now()+60000
  while(intent.status==='SUBMITTING'&&Date.now()<until){await manager.reconcile();intent=store.getIntent(intent.intentId)!}
  if(intent.status!=='VERIFIED')throw Error(`Purchase failed: ${intent.status}`)
  const proof={label:'Local HTTP form submission, scripted authored note; real XRPL Testnet account and key-reveal sale; no independent human or hosted deployment measured',readySeconds,serverSeconds:status.secondsToLive,totalSeconds:(performance.now()-start)/1000,address:status.address,transactions:{create:intent.escrow?.createHash,finish:intent.escrow?.finishHash},bought:1,earnedMinor:intent.amountMinor}
  mkdirSync('docs/evidence/publish',{recursive:true});writeFileSync('docs/evidence/publish/onboarding.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof))
} finally { await scope.close();store.close();await ledger.close();await app.locals.ledger?.close?.() }
