// Development-only measurement: real engine/publisher/proofs, fixture models,
// SIMULATED payments. Explicit allowlist prevents opening held-out banks.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { PublisherClient } from '../server/publisher-client.js'
import { PurchaseManager } from '../server/purchases.js'
import { Store } from '../server/store.js'
import { RunLoop } from '../server/agents/loop.js'
import { fixturePlan } from '../server/agents/scope.js'
import { fixtureRequirements, withIds } from '../server/agents/requirements.js'
import { FixtureDecisionProvider } from '../server/agents/decision.js'
import { sameSource } from '../shared/source-identity.js'
import { answersIt } from './judge-bank-scorer.js'
import { auditRuns } from './gate-audit.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { Reputation } from '../server/reputation.js'
import { TESTNET_QUESTIONS, DEMO_QUESTIONS } from '../shared/contracts/examples.js'
const out = resolve(process.argv[2]); mkdirSync(out, { recursive: true })
const banks = ['v1', 'v3', 'v3-dev', 'v3-negatives'] as const
const corpus = await loadWriterCorpus()
const summary: Record<string, unknown> = {}
for (const bank of [...banks, 'uc', 'presets']) {
 const questions: { id: string; question: string; gold?: string; expect?: string }[] = bank === 'uc' ? DEMO_QUESTIONS.slice(0,3).map(q=>({id:q.id,question:q.text})) : bank === 'presets' ? TESTNET_QUESTIONS.map(q=>({id:q.id,question:q.text})) : JSON.parse(readFileSync(`eval/questions/judge-xrpl.${bank}.json`, 'utf8')).questions
 const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} }); await app.locals.ready; await app.locals.writersReady
 const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
 const store = new Store(':memory:')
 try {
  const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as {port:number}).port}` })
  const loop = new RunLoop(store, client, new PurchaseManager(store,client), undefined, {provider:new FixtureDecisionProvider(), reputation:new Reputation(store)})
  const results = []
  for (const q of questions) {
   const run = store.createRun(q.question,200)
   const answers = q.id==='UC2' ? {angle:'pricing & margins'} : {}
   const plan=fixturePlan(q.question,answers)
   store.updateRun(run.runId,{checkpoint:{plan,answers,...(bank==='uc'?{}:{requirements:withIds(fixtureRequirements(q.question,answers))})}})
   await loop.start(run.runId)
   const final=store.getRun(run.runId); const answer=final.answers.at(-1)
   const paid=answer?.claims.flatMap(c=>c.citations).filter(ref=>final.intents.some(i=>i.status==='VERIFIED'&&sameSource(i,ref)))??[]
   const bundle=receiptBundle(store,run.runId)
   const verification=await verifyAnswer(bundle)
   const violations=auditRuns([final],corpus).violations
   const result={...q,phase:final.phase,lead:answer?.lead,conclusion:answer?.conclusion,buyAndCite:paid.length>0,answersIt:answersIt(q.gold,(answer?.lead??[]).map(l=>({text:l.text,citations:l.claim.citations})),paid),purchases:final.intents.filter(i=>i.status==='VERIFIED'||i.status==='REFUNDED').length,spentMinor:final.spentMinor,verificationOk:verification.ok,violations}
   results.push(result)
   writeFileSync(join(out,`${bank}-${q.id}.json`),JSON.stringify({result,run:final,bundle,verification},null,2))
   console.log(bank,q.id,result.buyAndCite?'BUY+CITE':'NO BUY','answersIt',result.answersIt,JSON.stringify(answer?.lead?.map(l=>l.text)))
  }
  summary[bank]={N:results.length,buyAndCite:results.filter(r=>r.buyAndCite).length,answersIt:results.filter(r=>r.answersIt).length,negativeBuys:results.filter(r=>r.expect==='no_purchase'&&r.purchases>0).length,violations:results.reduce((n,r)=>n+r.violations.length,0),verificationFailures:results.filter(r=>!r.verificationOk).length,results}
  writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2))
  assert(results.every(r=>r.phase==='DONE'))
  assert(results.every(r=>r.verificationOk))
  assert(results.every(r=>r.violations.length===0))
 } finally {store.close(); server.closeAllConnections(); await new Promise<void>(done=>server.close(()=>done()));app.locals.journal.close()}
}
const bankHashes=Object.fromEntries(banks.map(b=>[b,createHash('sha256').update(readFileSync(`eval/questions/judge-xrpl.${b}.json`)).digest('hex')]))
writeFileSync(join(out,'bank-hashes.json'),JSON.stringify(bankHashes,null,2))
