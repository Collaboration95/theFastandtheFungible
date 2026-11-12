import { afterEach, expect, it, vi } from 'vitest'
import { createServer, request } from 'node:http'
import { once } from 'node:events'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { Wallet } from 'xrpl'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { seedEnvName } from '../publisher/registry.js'
import { createApiApp } from '../server/routes.js'
import { XrplPayer } from '../server/xrpl.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { payAndFetch } from '../sdk/x402.js'
import { openPaymentJournal } from '../sdk/x402-journal.js'
import { hireLedger } from './fixtures/hire-ledger.js'
import { resources } from './helpers/resource-scope.js'
import { USE_CASES } from './scenarios/use-cases.js'
const clean:(()=>unknown)[]=[]
afterEach(async()=>{for(const close of clean.splice(0).reverse())await close();vi.unstubAllEnvs()})
async function setup(enabled='on',rail='xrpl-testnet'){
 const dir=resources().tempDir('reach-paid-'),chain=hireLedger(),wallet=Wallet.generate(),caller=Wallet.generate()
 const corpus=await loadWriterCorpus(),env=Object.fromEntries(corpus.publishers.map(p=>[seedEnvName(p.slug),Wallet.generate().seed]))
 const pub=createPublisherApp({writers:corpus,rail:'xrpl-testnet',ledger:chain.ledger,journal:join(dir,'publisher.db'),env})
 await pub.locals.ready;clean.push(()=>pub.locals.journal.close())
 const publisher=pub.listen(0,'127.0.0.1');await once(publisher,'listening');clean.push(()=>new Promise<void>(r=>{publisher.closeAllConnections();publisher.close(()=>r())}))
 const server=createServer().listen(0,'127.0.0.1');await once(server,'listening')
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,control=join(dir,'control.json')
 for(const [k,v] of Object.entries({HOSTED:'1',PAID_ENDPOINT_PUBLIC:enabled,MCP_PUBLIC:'on',HOSTED_ORIGIN:base.replace('http:','https:'),HOSTED_TRUSTED_PROXY:'127.0.0.1',HOSTED_IP_HMAC_KEY:'a'.repeat(32),HOSTED_CONTROL_PATH:control,SETTLEMENT_RAIL:rail,LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off',ANCHOR_RAIL:'off',WALLET_DAILY_CAP_MINOR:'1000'}))vi.stubEnv(k,v)
 const pause=(paused:boolean)=>writeFileSync(control,JSON.stringify({admissionsPaused:paused,spendingPaused:paused,reasonCode:'test',expiresAt:'2026-11-19T16:00:00Z'}));pause(false)
 const api=await createApiApp({payer:new XrplPayer(chain.ledger,wallet,{pollMs:1,timeoutMs:100}),dbPath:join(dir,'app.db'),publisherUrl:`http://127.0.0.1:${(publisher.address() as {port:number}).port}`,hostedReadiness:async()=>true})
 clean.push(()=>api.close());clean.push(()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r())}));server.on('request',api.app)
 const journal=openPaymentJournal(join(dir,'buyer.db'));clean.push(()=>journal.close())
 const body=JSON.stringify({question:USE_CASES.UC2.question,budgetMinor:200}),headers={'Content-Type':'application/json'}
 const opts={wallet:caller,maxDrops:'220000',journal,ledger:chain.ledger,headers,body,method:'POST',idempotencyKey:'public-hire-once'}
 return{api,base,url:base+'/v1/ask',opts,chain,pause,limits:new HostedLimits(api.store,loadConfig())}
}
it('public exact payment is opt in, scoped and Testnet-only before any money moves',async()=>{
 const s=await setup('off')
 expect((await fetch(s.url,{method:'POST',headers:s.opts.headers,body:s.opts.body})).status).toBe(404)
 expect(s.chain.submits).toBe(0)
})
it('paid public ask shares hosted holds, rejects excess budgets, recovers original payment, and honors pause',async()=>{
 const s=await setup()
 const headers={...s.opts.headers,'Idempotency-Key':'invalid-budget'}
 expect((await fetch(s.url,{method:'POST',headers,body:JSON.stringify({question:'x',budgetMinor:500})})).status).toBe(400)
 const hostile=await new Promise<number>(done=>{const r=request(s.url,{method:'POST',headers:{...headers,Host:'evil.example'}},res=>{res.resume();done(res.statusCode!)});r.end(s.opts.body)})
 expect(hostile).toBe(403);expect(s.chain.submits).toBe(0)
 const paid=await payAndFetch(s.url,s.opts);expect(paid.response.status).toBe(200)
 const result=await paid.response.json();expect(result.phase).toBe('DONE');expect(result.moneyChain.inbound.txHash).toMatch(/^[A-F0-9]{64}$/)
 const hold=s.limits.forRun(result.run_id);expect(hold).toBeDefined();expect(hold?.state).toBe('done')
 expect(s.api.store.runPrincipal(result.run_id)).toEqual({surface:'x402',principal:hold!.principal})
 const connect=async(ip?:string)=>{
  const client=new Client({name:'paid-run-reader',version:'1'});clean.push(()=>client.close())
  await client.connect(new StreamableHTTPClientTransport(new URL(s.base+'/mcp'),{requestInit:{headers:ip?{'X-Forwarded-For':ip}:{}}}))
  return client
 }
 const client=await connect()
 for(const name of ['get_run','lookup_receipt','verify_answer']){
  const response=await client.callTool({name,arguments:{run_id:result.run_id}})
  expect(response.isError,JSON.stringify(response)).not.toBe(true)
  const data=JSON.parse((response.content as {text:string}[])[0].text)
  if(name==='get_run')expect(data.run_id).toBe(result.run_id)
  if(name==='lookup_receipt')expect(data.receipts.length).toBeGreaterThan(0)
  if(name==='verify_answer')expect(data.ok).toBe(true)
 }
 const other=await connect('198.51.100.2')
 expect((await other.callTool({name:'get_run',arguments:{run_id:result.run_id}})).isError).toBe(true)
 expect(s.limits.remaining(hold!.principal).questions).toBe(4)
 const submits=s.chain.submits
 const replay=await payAndFetch(s.url,s.opts);expect(await replay.response.json()).toEqual(result);expect(s.chain.submits).toBe(submits)
 s.pause(true)
 expect((await fetch(s.url,{method:'POST',headers:{...headers,'Idempotency-Key':'paused'},body:s.opts.body})).status).toBe(503)
 expect(s.chain.submits).toBe(submits)
})

it('refuses the public paid route on a simulated rail',async()=>{
 const s=await setup('on','simulated')
 expect((await fetch(s.url,{method:'POST',headers:{...s.opts.headers,'Idempotency-Key':'no-network'},body:s.opts.body})).status).toBe(503)
 expect(s.chain.submits).toBe(0)
})

it('an expired unpaid hold cannot accept money using released hosted authority',async()=>{
 const s=await setup()
 const headers={...s.opts.headers,'Idempotency-Key':'expired-quote'}
 expect((await fetch(s.url,{method:'POST',headers,body:s.opts.body})).status).toBe(402)
 s.api.store.hostedState(db=>db.prepare('UPDATE hosted_holds SET created=? WHERE run_id IS NULL').run(Date.now()-100000))
 const response=await fetch(s.url,{method:'POST',headers,body:s.opts.body})
 expect(response.status).toBe(409);expect((await response.json()).error).toBe('quote_expired')
 expect(s.chain.submits).toBe(0)
})

it('background failed-inbound reconciliation releases its hosted active hold',async()=>{
 const s=await setup(),original=s.chain.ledger.request.bind(s.chain.ledger)
 s.chain.ledger.request=async request=>{
  const response=await original(request)
  if(request.command==='tx')response.result.meta.TransactionResult='tecUNFUNDED_PAYMENT'
  return response
 }
 let responseStatus:number|undefined
 const fetcher:typeof fetch=async(url,init)=>{const response=await fetch(url,init);responseStatus=response.status;return response}
 await expect(payAndFetch(s.url,{...s.opts,fetch:fetcher})).rejects.toThrow('x402 settlement receipt mismatch')
 expect(responseStatus).toBe(402)
 const run=s.api.store.listRuns()[0],hold=s.limits.forRun(run.runId)!
 expect(hold.state).toBe('active')
 await s.api.reconcileOnce()
 expect(s.api.store.getRun(run.runId).phase).toBe('FAILED')
 expect(s.limits.forRun(run.runId)?.state).toBe('done')
 expect(s.chain.submits).toBe(1)
 const next=await fetch(s.url,{method:'POST',headers:{...s.opts.headers,'Idempotency-Key':'after-failed-inbound'},body:s.opts.body})
 expect(next.status).toBe(402)
})
