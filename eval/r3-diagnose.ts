// Offline export from retained stores; never makes provider or ledger calls.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {auditEntries} from '../server/audit.js'
import {auditAgentAuthority} from '../server/agent-audit.js'
import {Store} from '../server/store.js'
import {factHolds,type Fact} from './questions/bank.js'
import {resolveCitation} from '../server/agents/citations.js'

type Result={id:string;arm:string;runId:string;correct:boolean;phase:string;liveOnly:boolean;violations:unknown[]}
type Question={id:string;stratum:string;gold?:string;requested?:Fact[]}
const out=process.argv[2]||'scratch/r3-real-200'
const target=process.argv[3]||'docs/evidence/models/r3-real-200'
const saved=JSON.parse(readFileSync(join(out,'results.json'),'utf8')) as {results:Result[]}
const bank=JSON.parse(readFileSync('eval/questions/r3-real.v1.json','utf8')) as {questions:Question[]}
const questions=new Map(bank.questions.map(q=>[q.id,q]))
const rows=[]
const authorityAudits=[]
for(const arm of ['free','paid']){
 const db=new DatabaseSync(join(out,`${arm}.db`),{readOnly:true})
 try{authorityAudits.push({arm,violations:auditAgentAuthority(auditEntries(db))})}finally{db.close()}
 const store=new Store(join(out,`${arm}.db`))
 try{for(const result of saved.results.filter(r=>r.arm===arm)){
  const run=store.getRun(result.runId),q=questions.get(result.id)!,answer=run.answers.at(-1)
  const spans=run.contents.flatMap(c=>c.spans.map(s=>s.text))
  const goldPresent=q.requested?q.requested.every(f=>spans.some(s=>factHolds(f,s))):Boolean(q.gold&&spans.some(s=>s.toLowerCase().includes(q.gold!.toLowerCase())))
  const taxonomy=result.correct?'correct':result.violations.length?'gate-failure':q.stratum==='historical-out-of-profile'?'excluded-historical-source':result.phase!=='DONE'?'run-failed-or-stopped':!answer?'no-answer':!result.liveOnly?'model-substitution':goldPresent?'answer-or-lead-mismatch':'gold-not-in-accessible-spans'
  rows.push({id:result.id,arm,runId:run.runId,taxonomy,goldPresent,answerProvider:answer?.provider,purchases:run.receipts.length,purchaseAmountsMinor:run.receipts.map(r=>r.amountMinor),intents:run.intents.map(i=>({resourceId:i.resourceId,status:i.status,amountMinor:i.amountMinor})),fallbackLabels:run.events.filter(e=>e.type==='MODEL_FALLBACK'||e.type==='ERROR').map(e=>e.label),sources:run.contents.map(c=>({resourceId:c.resourceId,version:c.version})),claims:answer?.claims.length||0,unresolvedCitations:answer?.claims.flatMap(c=>c.citations).filter(c=>!resolveCitation(c,run.contents)).length||0})
 }}finally{store.close()}
}
mkdirSync(target,{recursive:true})
writeFileSync(join(target,'diagnoses.json'),JSON.stringify({authorityAudits,method:'Mutually exclusive diagnostic precedence; scores unchanged. Missing gold in accessible spans is a retrieval/coverage observation, not a proven policy or source root cause.',rows},null,2)+'\n')
console.log(JSON.stringify(Object.fromEntries(['free','paid'].map(arm=>[arm,rows.filter(r=>r.arm===arm).reduce<Record<string,number>>((counts,r)=>{counts[r.taxonomy]=(counts[r.taxonomy]||0)+1;return counts},{})]))))

if(authorityAudits.some(a=>a.violations.length))throw Error('Agent authority violations retained')
