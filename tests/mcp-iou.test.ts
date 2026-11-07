// Labelled ledger simulation: real MCP tools, HTTP engine, policy, publisher and signer.
import { expect, test, vi } from 'vitest'
import { Wallet } from 'xrpl'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../mcp/tools.js'
import { createApiApp } from '../server/routes.js'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { chain } from './fixtures/key-reveal-ledger.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { TEST_SGD_LABEL } from '../shared/contracts/asset.js'

test.each([false, true])('IOU MCP clamps, labels, retries and cancels an absent writer (no-show=%s)', async noShow => {
 const buyer = Wallet.generate(), writer = Wallet.generate(), issuer = Wallet.generate()
 for (const [k,v] of Object.entries({ESCROW_MODE:'key-reveal',ESCROW_ASSET:'test-iou',TESTNET_IOU_ISSUER:issuer.classicAddress,SETTLEMENT_RAIL:'xrpl-testnet',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off',MCP_MAX_BUDGET_MINOR:'200',MCP_DAILY_CAP_MINOR:'200',ANCHOR_RAIL:'off'})) vi.stubEnv(k,v)
 const c = chain()
 if (noShow) vi.spyOn(PublisherClient.prototype,'paidGet').mockRejectedValue(new Error('Labelled fixture writer no-show'))
 const pub = createPublisherApp({journal:':memory:',rail:'xrpl-testnet',ledger:c.ledger,writers:alphaLeakCorpus,env:{ESCROW_MODE:'key-reveal',XRPL_PUBLISHER_LOAD_FACTOR_SEED:writer.seed,XRPL_PUBLISHER_ALPHALEAK_SEED:Wallet.generate().seed},escrowWriters:['load-factor'],facilitatorTiming:{pollMs:1,timeoutMs:10}})
 await pub.locals.ready
 const listen = async (app: ReturnType<typeof createPublisherApp>) => { const s=app.listen(0,'127.0.0.1'); await new Promise(r=>s.once('listening',r)); return s }
 const publisher = await listen(pub)
 const api = await createApiApp({provider:{name:'fixture',model:'labelled-test-judge',judgeRound:async()=>({gapMaterial:1}),judgeCandidate:async()=>({addressesGap:1,originality:{original:1,rewrite:0,overlap:0},credibility:2})},dbPath:':memory:',publisherUrl:`http://127.0.0.1:${(publisher.address() as {port:number}).port}`,payer:new XrplPayer(c.ledger,buyer,{pollMs:1,timeoutMs:10}),reconcileIntervalMs:0})
 const http = await listen(api.app)
 const server = createMcpServer({apiUrl:`http://127.0.0.1:${(http.address() as {port:number}).port}`,labels:['SIMULATED ledger fixture',TEST_SGD_LABEL]})
 const reconcile = noShow ? setInterval(() => {
  const locked = [...c.txs.values()].filter(t=>t.tx_json.TransactionType==='EscrowCreate')
  if (locked.length) {
   c.state.now = Math.max(c.state.now,...locked.map(t=>Number(t.tx_json.CancelAfter)+1))
   void api.purchases.reconcile()
  }
 },20) : undefined
 const [a,b] = InMemoryTransport.createLinkedPair()
 const client = new Client({name:'m1-conformance',version:'1'})
 try {
  await server.connect(a); await client.connect(b)
  const call = async (name:string,args={}) => { const r=await client.callTool({name,arguments:args}); expect(r.isError).not.toBe(true); return JSON.parse((r.content as {text:string}[])[0].text) }
  const wallet = await call('wallet_status'); expect(wallet.amountLabel).toContain('stand-in for RLUSD')
  const args={question:'What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?',budget_sgd:999,idempotency_key:'iou-once'}
  const first=await call('ask_expert',args), again=await call('ask_expert',args)
  expect(first.budgetMinor).toBeLessThanOrEqual(200)
  if (noShow) {
   expect(first.spentMinor).toBe(0)
   expect([...c.txs.values()].some(t=>t.tx_json.TransactionType==='EscrowCancel')).toBe(true)
   expect(api.store.getRun(first.run_id).grants).toHaveLength(0)
   const snapshot = api.store.getRun(first.run_id)
   expect(snapshot.contents.filter(c=>snapshot.candidates.some(p=>p.tier==='PAID' && p.resourceId===c.resourceId))).toHaveLength(0)
  } else expect(first.spentMinor).toBeGreaterThan(0)
  expect(first.amountUnit).toBe('TEST-SGD')
  expect(again.run_id).toBe(first.run_id); expect(again.spentMinor).toBe(first.spentMinor)
  const capped=await call('ask_expert',{...args,idempotency_key:'iou-cap'})
  expect(first.spentMinor+capped.spentMinor).toBeLessThanOrEqual(200)
 } finally {
  clearInterval(reconcile); vi.restoreAllMocks()
  await client.close(); await server.close(); await api.close()
  for (const s of [http,publisher]) { s.closeAllConnections(); await new Promise<void>(r=>s.close(()=>r())) }
  pub.locals.journal.close(); vi.unstubAllEnvs()
 }
},60000)
