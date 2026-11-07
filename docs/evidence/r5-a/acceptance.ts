// Faucet-only packed consumer acceptance. Private state stays outside evidence.
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { packedStdio, withPackedSession } from '../../../scripts/packed-consumer.js'
import { stopProcess } from '../../../scripts/release-processes.js'
import { Store } from '../../../server/store.js'
import { receiptBundle } from '../../../server/receipt-bundle.js'
import { createClient } from '../../../sdk/index.js'
import { prepareMcpTestnet } from '../../../mcp/testnet.js'
import { startEngine } from '../../../server/engine.js'
const out = resolve('docs/evidence/r5-a')
await withPackedSession(true, async ({ scope, scratch }) => {
const state = process.env.R5_STATE || scratch
const packed = join(state, 'package')
execFileSync('tar', ['-xzf', process.env.R5_TGZ || '/tmp/r5-final/researchagent-mcp-1.0.0.tgz', '-C', state])
const env = { PATH: process.env.PATH!, HOME: process.env.HOME!, XDG_STATE_HOME: state, MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '5000' }
const question = 'What is the best watering schedule for my balcony orchid?'
async function exportRun(runId: string, name: string) {
 const store = scope.own(new Store(join(state, name === 'app' ? 'researchagent/testnet/app/app.db' : 'researchagent/testnet/app.db')))
  const deadline = Date.now() + 90000
  let bundle = receiptBundle(store, runId)
  while (!bundle.ledgerAnchor && Date.now() < deadline) { await new Promise(r => setTimeout(r, 250)); bundle = receiptBundle(store, runId) }
  assert(bundle.ledgerAnchor); assert.equal(bundle.receipts.length, 0)
  writeFileSync(join(out, `${name}.receipts.json`), JSON.stringify(bundle, null, 2)+'\n')
 store.close()
}
 const timings: Record<string, number> = {}
 for (const name of (process.env.R5_RESUME ? [] : ['iou-cold', 'iou-warm'])) {
  const started = performance.now()
  const child = scope.spawn(process.execPath, [join(packed, 'bin.mjs'), '--testnet', '--iou'], { env })
  let stderr = ''; child.stderr.on('data', b => { stderr += b })
  const { client, call } = await packedStdio(scope, child, 240000)
   const a = await call('ask_expert', { question, budget_sgd: 2, idempotency_key: name })
   timings[name] = (performance.now() - started) / 1000
   assert.equal(a.phase, 'DONE'); assert(a.ledger.anchor); assert.deepEqual(a.ledger.purchases, [])
   writeFileSync(join(out, `${name}.result.json`), JSON.stringify(a,null,2)+'\n')
   await exportRun(a.run_id, name)
  await client.close()
  writeFileSync(join(out, `${name}.progress.txt`), stderr.split('\n').filter(l => /Testnet IOU|wallets ready/.test(l)).join('\n')+'\n')
  console.log(name, timings[name])
 }
 if (!process.env.R5_RESUME) writeFileSync(join(out, 'timings.json'), JSON.stringify(timings,null,2)+'\n')
 // Packed app consumer: SDK uses the same HTTP proxy as the shipped UI.
 const child = scope.spawn(process.execPath, [join(packed, 'bin.mjs'), 'app', '--testnet', '--port', '0'], { env })
 let stdout = ''
 const url = await new Promise<string>((done, fail) => {
  child.stdout.on('data', b => { stdout += b; const u = stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]; if(u) done(u) })
  child.once('exit', () => fail(Error('App exited before URL')))
 })
 const app = createClient({baseUrl:url})
 const answer = await app.ask(question, {budgetSgd:2,idempotencyKey:'app-abstention-final'})
 assert.equal(answer.phase,'DONE'); await exportRun(answer.run_id,'app')
 await stopProcess(child)
 // SDK consumer uses the same engine/setup as try, with an off-corpus question.
 process.env.XDG_STATE_HOME = state
 const setup = await prepareMcpTestnet(); assert(setup.testnet)
 const engine = scope.own(await startEngine({dataDir:join(state,'researchagent/testnet'),live:false,env:setup.env}))
  const sdk = createClient({baseUrl:engine.apiUrl,token:engine.apiToken})
  const a = await sdk.ask(question,{budgetSgd:2,idempotencyKey:'try-style-abstention'})
  assert.equal(a.phase,'DONE'); await exportRun(a.run_id,'try-style')
 await engine.close()
})
