import { answersIt, decisionValues, valueHistograms, type ValueRow } from './judge-bank-scorer.js'
import { sameSource } from '../shared/source-identity.js'
import { leadFinding } from '../shared/lead-finding.js'
import { withPackedSession, packedStdio } from './packed-consumer.js'
// Frozen-bank acceptance through packed stdio MCP. Faucet Testnet only; never loads .env.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { Store } from '../server/store.js'
import { auditRuns } from './gate-audit.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { createHash } from 'node:crypto'
await withPackedSession(true, async ({ scope, scratch: retained }) => {
const tgz = resolve(process.argv[2]), scratch = process.env.J1_STATE_DIR || retained
const out = resolve(process.env.JUDGE_OUT_DIR || 'docs/evidence/round4-j1'); mkdirSync(out,{recursive:true})
const bankBytes=readFileSync(process.env.JUDGE_BANK || 'eval/questions/judge-xrpl.v1.json');const bank=JSON.parse(bankBytes.toString())
assert(Array.isArray(bank.questions) && bank.questions.every((q: {id: string; question: string}) => /^[A-Za-z0-9_-]+$/.test(q.id) && typeof q.question === 'string'), 'Invalid bank')
assert.equal(new Set(bank.questions.map((q: {id: string}) => q.id)).size, bank.questions.length, 'Duplicate question id')
const bankSha256 = createHash('sha256').update(bankBytes).digest('hex')
const resume = process.env.J1_RESUME === '1'
if (resume && !process.env.J1_STATE_DIR) throw Error('Resume requires the original private J1_STATE_DIR')
if (!resume) assert(!existsSync(join(out,'results.json')), 'Output already has results; use a fresh directory or explicit resume')
const previous = resume ? JSON.parse(readFileSync(join(out,'results.json'),'utf8')) : undefined
const artifactSha256 = existsSync(tgz) ? createHash('sha256').update(readFileSync(tgz)).digest('hex') : previous?.artifactSha256
assert(artifactSha256, 'Original packed artifact or recorded resume digest required')
if (previous) { assert.equal(previous.bankSha256,createHash('sha256').update(bankBytes).digest('hex')); assert.equal(previous.artifactSha256,artifactSha256) }
const packed=join(scratch,'packed');mkdirSync(packed,{recursive:true});if (!resume) execFileSync('tar',['-xzf',tgz,'-C',packed])
const child = scope.spawn(process.execPath, [join(packed,'package/bin.mjs'),'--testnet'], { env: {PATH:process.env.PATH!,HOME:process.env.HOME!,XDG_STATE_HOME:scratch,MCP_MAX_BUDGET_MINOR:'200',MCP_DAILY_CAP_MINOR:'5000'} })
const { call } = await packedStdio(scope, child, 240000)
const corpus = await loadWriterCorpus()
const results: Record<string,unknown>[]=(previous?.results ?? []).map((r: Record<string,unknown>) => ({...r, violations:Array.isArray(r.violations) ? r.violations : (r.violations as {violations:unknown[]}).violations}))
const values: ValueRow[] = previous?.values ?? []
if (resume) assert(Array.isArray(previous.values), 'Resume requires value rows from this runner version')
const save = () => {
 const positive = results.filter(r => r.expect !== 'no_purchase')
 const negatives = results.filter(r => r.expect === 'no_purchase')
 const summary = { bankSha256, artifactSha256, completed: results.length, total: bank.questions.length,
  buyAndCite: { n: results.filter(r => r.buyAndCite).length, N: results.length },
  answersIt: { n: positive.filter(r => r.answersIt === 1).length, N: positive.filter(r => typeof r.gold === 'string' && r.gold.trim()).length },
  negativeBuys: { n: negatives.filter(r => r.purchased).length, N: negatives.length },
  valueHistograms: valueHistograms(values) }
 writeFileSync(join(out,'values.jsonl'), values.map(v => JSON.stringify(v)).join('\n') + (values.length ? '\n' : ''))
 writeFileSync(join(out,'results.json'),JSON.stringify({bankSha256,artifactSha256,labels:'Fixture models · XRPL Testnet · faucet only; content provenance in receipts',summary,results,values},null,2)+'\n')
 return summary
}
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
  const violations=auditRuns([run],corpus).violations
  const cited=run.answers.at(-1)?.claims.flatMap(c=>c.citations)??[]
  const purchasedCitations = cited.filter(c => run.intents.some(i => i.status === 'VERIFIED' && sameSource(i,c)) && run.contents.some(content => sameSource(content,c) && content.spans.some(span => span.id === c.spanId)))
  const lead = (run.answers.at(-1)?.lead ?? leadFinding(q.question, run.answers.at(-1)?.claims ?? [])).map(item => ({text: item.text, citations: item.claim.citations}))
  const score = answersIt(q.gold, lead, purchasedCitations)
  // A settled/refunded purchase still counts as a negative buy, even without a citation.
  const purchased = run.intents.some(i => Boolean(i.settledAt || i.txHash || i.escrow?.createHash) || ['VERIFIED','SETTLED','REFUNDED'].includes(i.status)) || run.spentMinor > 0
  values.push(...decisionValues(q.id, q.expect === 'no_purchase', run.decisions))
  const blank=!a.answer?.conclusion && !run.answers.at(-1)?.conclusion
  const transactions=run.intents.flatMap(i=>[i.escrow?.createHash,i.escrow?.finishHash,i.refund?.txHash]).concat(run.ledgerAnchor?.txHash).filter(Boolean).map(hash=>`https://testnet.xrpl.org/transactions/${hash}`)
  const conclusionWords=(run.answers.at(-1)?.conclusion ?? '').trim().split(/\s+/).filter(Boolean).length
  const purchases=run.intents.filter(i=>Boolean(i.settledAt || i.txHash || i.escrow?.createHash) || ['VERIFIED','SETTLED','REFUNDED'].includes(i.status)).length
  const result={...q,conclusionWords,purchases,leadWords:lead.map(l=>l.text).join(' ').trim().split(/\s+/).filter(Boolean).length,runId:run.runId,phase:run.phase,buyAndCite:purchasedCitations.length>0,answersIt:score,purchased,expectationPass:q.expect === 'no_purchase' ? !purchased && run.phase === 'DONE' : purchasedCitations.length>0,blank,violations,verificationOk:verification.ok,conclusion:run.answers.at(-1)?.conclusion,citations:cited.length,spentMinor:run.spentMinor,transactions}
  results.push(result);save()
  console.log(q.id, q.expect === 'no_purchase' ? (purchased ? 'NEGATIVE_BUY' : 'ABSTAIN') : (result.buyAndCite ? 'BUY+CITE' : 'MISS'), 'answersIt',score,result.phase,'violations',violations.length)
 }
 const summary=save()
 console.log(JSON.stringify(summary))
 assert.equal(results.length,bank.questions.length)
 // Measurement mode reports misses without imposing the old 20-question acceptance target.
 // Explicit legacy acceptance keeps that target unchanged for its original bank.
 if (process.env.JUDGE_ACCEPTANCE === '1') { assert.equal(bank.questions.length,20);assert(results.filter(r=>r.buyAndCite).length>=12) }
 assert(!results.some(r=>r.blank));assert(results.every(r=>r.phase === 'DONE'));assert(results.every(r=>r.verificationOk));assert(!results.some(r=>(r.violations as unknown[]).length))
 assert.equal(summary.negativeBuys.n,0,'Negative purchases fail the bank')
})
