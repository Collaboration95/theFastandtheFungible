// Opt-in real Testnet evidence: fixture models/writers, faucet funds only.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { prepareMcpTestnet, testnetStateDir } from '../mcp/testnet.js'
import { startEngine } from '../server/engine.js'
import { createMcpServer } from '../mcp/tools.js'
import { createClient } from '../sdk/index.js'
if (process.env.RA_ACCEPT_TESTNET !== '1') throw Error('RA_ACCEPT_TESTNET=1 required')
const start = performance.now()
const setup = await prepareMcpTestnet(undefined, 'test-iou')
assert(setup.testnet, 'live acceptance requires Testnet')
assert.equal(statSync(join(testnetStateDir(), 'wallets.private.json')).mode & 0o777, 0o600)
const fundedSeconds = (performance.now() - start) / 1000
const cached = performance.now()
assert((await prepareMcpTestnet(undefined, 'test-iou')).testnet)
const cachedSeconds = (performance.now() - cached) / 1000
const engine = await startEngine({ dataDir: join(testnetStateDir(), 'm1-probe-' + Date.now()), env: setup.env })
const server = createMcpServer({ apiUrl: engine.apiUrl, token: engine.apiToken, labels: setup.labels })
const [a,b] = InMemoryTransport.createLinkedPair()
const client = new Client({ name: 'm1-iou', version: '1' })
try {
 await server.connect(a); await client.connect(b)
 const call = async (name: string, args = {}) => {
  const r = await client.callTool({name, arguments: args}, undefined, {timeout:180000})
  assert(!r.isError); return JSON.parse((r.content as {text:string}[])[0].text)
 }
 const wallet = await call('wallet_status')
 assert.equal(wallet.amountUnit,'TEST-SGD'); assert(wallet.amountLabel.includes('stand-in for RLUSD'))
 const args = {question:'What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?',budget_sgd:999,idempotency_key:'m1-iou'}
 const purchase = performance.now()
 let run = await call('ask_expert',args)
 const deadline = Date.now()+120000
 while (!run.ledger?.anchor && Date.now()<deadline) run = await call('get_run',{run_id:run.run_id})
 assert(run.ledger?.anchor)
 assert(run.budgetMinor<=200); assert(run.spentMinor>0 && run.spentMinor<=200)
 const retry = await call('ask_expert',args); assert.equal(retry.run_id,run.run_id); assert.equal(retry.spentMinor,run.spentMinor)
 const capped = await call('ask_expert',{...args,idempotency_key:'m1-cap'})
 assert(capped.spentMinor + run.spentMinor <= 200)
 const bundle = await createClient({baseUrl:engine.apiUrl,token:engine.apiToken}).receipts(run.run_id)
 assert(bundle.receipts.some(r=>r.xrpl?.asset !== 'XRP'))
 const dir = 'docs/evidence/m1-iou'
 mkdirSync(dir,{recursive:true})
 writeFileSync(join(dir,'receipts.json'), JSON.stringify(bundle,null,2)+'\n')
 const evidence = {fundedSeconds,cachedSeconds,purchaseSeconds:(performance.now()-purchase)/1000,ledger:run.ledger, amountLabel:run.amountLabel, budgetMinor:run.budgetMinor,spentMinor:run.spentMinor,retrySameRun:true,capSpend:capped.spentMinor}
 writeFileSync(join(dir,'probe.json'),JSON.stringify(evidence,null,2)+'\n')
 console.log(JSON.stringify(evidence))
} finally { await client.close(); await server.close(); await engine.close() }
