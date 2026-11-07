import { ResourceScope } from '../shared/resource-scope.js'
// Frozen-bank acceptance through packed stdio MCP. Faucet Testnet only; never loads .env.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { processTransport } from './release-processes.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { Store } from '../server/store.js'
import { auditRuns } from './gate-audit.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { createHash } from 'node:crypto'
if (process.env.RA_ACCEPT_TESTNET !== '1') throw Error('RA_ACCEPT_TESTNET=1 required')
const scope = new ResourceScope()
try {
const tgz = resolve(process.argv[2]), scratch = process.env.J1_STATE_DIR || scope.evidenceDir('j1-judge-', 'Testnet wallets and potentially signed obligations; retain for manual reconciliation')
const out = resolve(process.env.JUDGE_OUT_DIR || 'docs/evidence/round4-j1'); mkdirSync(out,{recursive:true})
const bankBytes=readFileSync(process.env.JUDGE_BANK || 'eval/questions/judge-xrpl.v1.json');const bank=JSON.parse(bankBytes.toString())
const resume = process.env.J1_RESUME === '1'
if (resume && !process.env.J1_STATE_DIR) throw Error('Resume requires the original private J1_STATE_DIR')
const previous = resume ? JSON.parse(readFileSync(join(out,'results.json'),'utf8')) : undefined
const artifactSha256 = existsSync(tgz) ? createHash('sha256').update(readFileSync(tgz)).digest('hex') : previous?.artifactSha256
assert(artifactSha256, 'Original packed artifact or recorded resume digest required')
if (previous) { assert.equal(previous.bankSha256,createHash('sha256').update(bankBytes).digest('hex')); assert.equal(previous.artifactSha256,artifactSha256) }
const packed=join(scratch,'packed');mkdirSync(packed,{recursive:true});if (!resume) execFileSync('tar',['-xzf',tgz,'-C',packed])
const transport = processTransport(scope.spawn(process.execPath, [join(packed,'package/bin.mjs'),'--testnet'], { env: {PATH:process.env.PATH!,HOME:process.env.HOME!,XDG_STATE_HOME:scratch,MCP_MAX_BUDGET_MINOR:'200',MCP_DAILY_CAP_MINOR:'5000'} }))
const client=new Client({name:'frozen-judge-bank',version:'1'})
const results: Record<string,unknown>[]=(previous?.results ?? []).map((r: Record<string,unknown>) => ({...r, violations:Array.isArray(r.violations) ? r.violations : (r.violations as {violations:unknown[]}).violations}))
const call=async(name:string,args={})=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:240000});assert(!r.isError,`${name} failed: ${JSON.stringify(r.content)}`);return JSON.parse((r.content as {text:string}[])[0].text)}
try {
 await client.connect(transport)
 const wallet=await call('wallet_status');assert.equal(wallet.rail,'xrpl-testnet','Simulated fallback is not acceptance')
 for(const q of bank.questions){
  if (results.some(r=>r.id===q.id)) continue
  let a=await call('ask_expert',{question:q.question,budget_sgd:2,idempotency_key:(process.env.JUDGE_INTENT_PREFIX || 'j1-')+q.id})
  const deadline=Date.now()+180000
  while(!['DONE','STOPPED','FAILED'].includes(a.phase)&&Date.now()<deadline) a=await call('get_run',{run_id:a.run_id})
  const store=new Store(join(scratch,'researchagent/testnet/app.db'))
  let run=store.getRun(a.run_id), bundle=receiptBundle(store,a.run_id)
  // DONE can precede the asynchronous audit anchor. Observe the same run, within the existing deadline.
  while (!bundle.ledgerAnchor && run.intents.some(i=>i.status==='VERIFIED') && Date.now()<deadline) {
   await new Promise(done=>setTimeout(done,500)); run=store.getRun(a.run_id);bundle=receiptBundle(store,a.run_id)
  }
  store.close()
  writeFileSync(join(out,q.id+'.receipts.json'),JSON.stringify(bundle,null,2)+'\n')
  const verification=await verifyAnswer(bundle,{testnet:true,onlineLedger:true})
  writeFileSync(join(out,q.id+'.verification.json'),JSON.stringify(verification,null,2)+'\n')
  const violations=auditRuns([run],await loadWriterCorpus()).violations
  const cited=run.answers.at(-1)?.claims.flatMap(c=>c.citations)??[]
  const bought=run.intents.filter(i=>i.status==='VERIFIED' && cited.some(c=>c.resourceId===i.resourceId))
  const blank=!a.answer?.conclusion && !run.answers.at(-1)?.conclusion
  const transactions=run.intents.flatMap(i=>[i.escrow?.createHash,i.escrow?.finishHash,i.refund?.txHash]).concat(run.ledgerAnchor?.txHash).filter(Boolean).map(hash=>`https://testnet.xrpl.org/transactions/${hash}`)
  const result={...q,runId:run.runId,phase:run.phase,buyAndCite:bought.length>0,blank,violations,verificationOk:verification.ok,conclusion:run.answers.at(-1)?.conclusion,citations:cited.length,spentMinor:run.spentMinor,transactions}
  results.push(result);writeFileSync(join(out,'results.json'),JSON.stringify({bankSha256:createHash('sha256').update(bankBytes).digest('hex'),artifactSha256,labels:'Fixture models · team-authored real content · not an independent writer · XRPL Testnet · faucet only',results},null,2)+'\n')
  console.log(q.id, result.buyAndCite?'BUY+CITE':'MISS',result.phase,'violations',violations.length)
 }
 assert.equal(results.length,20);assert(results.filter(r=>r.buyAndCite).length>=12);assert(!results.some(r=>r.blank));assert(results.every(r=>r.verificationOk));assert(!results.some(r=>(r.violations as unknown[]).length))
}finally{await client.close()}

} finally { await scope.close() }
