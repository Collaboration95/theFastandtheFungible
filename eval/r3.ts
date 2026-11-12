// Two paired live-DeepSeek arms, 200 existing questions each, simulated settlement.
// No model-generated label is used as ground truth. Saves every completed run.
import 'dotenv/config'
import {once} from 'node:events'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {setTimeout as pause} from 'node:timers/promises'
import {createPublisherApp} from '../publisher/routes.js'
import {createApiApp} from '../server/routes.js'
import {CalibratedDecisionProvider} from '../server/agents/calibrated-policy.js'
import {loadWriterCorpus} from '../publisher/corpus.js'
import {factHolds,loadBank,type Fact} from './questions/bank.js'
import {answersFromAccessible,answersIt} from '../scripts/judge-bank-scorer.js'
import {auditRuns} from '../scripts/gate-audit.js'
import {resolveCitation} from '../server/agents/citations.js'
import {leadFinding} from '../shared/lead-finding.js'
import type {Observation} from '../tests/scenarios/harness.js'
import {sameSource} from '../shared/source-identity.js'
import {BUDGET,type RunSnapshot} from '../shared/contracts/index.js'

type Question={id:string;question:string;gold?:string;requested?:Fact[]}
const bank:Question[]=[...loadBank().questions,...['v3','v4','v5'].flatMap(v=>(JSON.parse(readFileSync(`eval/questions/judge-xrpl.${v}.json`,'utf8')).questions as Question[]).map(q=>({...q,id:`${v}-${q.id}`})))]
if(bank.length!==200)throw new Error('Expected exactly 200 questions')
if(process.argv.includes('--plan')){console.log(JSON.stringify({questions:bank.length,arms:['free','paid'],runs:bank.length*2,budgetMinor:[0,BUDGET.initialMinor],modelSpendCapUsd:5,settlement:'simulated',providers:{writerPlanner:'deepseek-flash',decision:'calibrated',embeddings:'local'}}));process.exit(0)}
const dir=resolve(process.env.R3_OUT||'scratch/r3-eval'), limit=Number(process.env.R3_LIMIT||200)
if(!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('R3_LIMIT must be 1..200')
mkdirSync(dir,{recursive:true})
if(existsSync(join(dir,'results.json')))throw new Error('Use a fresh R3_OUT; previous evidence must remain intact')
const results:Record<string,unknown>[]=[]
let gateFailure=false
const costLedger=resolve(process.env.R3_COST_LEDGER||'scratch/r3-model-cost.json')
mkdirSync(dirname(costLedger),{recursive:true})
const costs:{reserved:number;actual:number;missingUsage:number;calls:number;inputTokens:number;outputTokens:number}=existsSync(costLedger)?JSON.parse(readFileSync(costLedger,'utf8')):{reserved:0,actual:0,missingUsage:0,calls:0,inputTokens:0,outputTokens:0}
if(Object.values(costs).some(n=>!Number.isFinite(n)||n<0)||costs.actual+costs.reserved>5)throw new Error('Invalid or exhausted cumulative cost ledger')
const save=()=>{writeFileSync(costLedger,JSON.stringify(costs)+'\n');writeFileSync(join(dir,'results.json'),JSON.stringify({schema:'researchagent.r3/v1',bankSha256:createHash('sha256').update(JSON.stringify(bank)).digest('hex'),profile:process.env.CORPUS_PROFILE||'default',freeTier:process.env.FREE_TIER||'default',rail:'simulated',costs,results},null,2)+'\n')}
save()
const key=process.env.DEEPSEEK_API_KEY||process.env.LLM_API_KEY
if(!key)throw new Error('Live DeepSeek credential unavailable')
Object.assign(process.env,{HOSTED:'0',LLM_PROVIDER:'deepseek',LLM_MODEL:'deepseek-flash',LLM_BASE_URL:'https://api.deepseek.com',LLM_API_KEY:key,
 DECISION_PROVIDER:'calibrated',EMBEDDING_PROVIDER:'local',SEARCH_EMBEDDINGS:'off',SETTLEMENT_RAIL:'simulated',ANCHOR_RAIL:'off',PUBLISHER_FAULTS:'0',LANGFUSE_ENABLED:'0',WALLET_DAILY_CAP_MINOR:'100000'})
const realFetch=globalThis.fetch
const peak=()=>{const d=new Date(),h=d.getUTCHours();return d.getUTCDay()>0&&d.getUTCDay()<6&&((h>=1&&h<4)||(h>=6&&h<10))}
globalThis.fetch=(async (url,init)=>{
 const target=new URL(String(url))
 if(['127.0.0.1','localhost'].includes(target.hostname))return realFetch(url,init)
 if(target.hostname!=='api.deepseek.com'||target.pathname!=='/chat/completions')throw new Error('Evaluation network destination refused')
 const payload=JSON.parse(String(init?.body||'{}'))
 if(payload.model!=='deepseek-flash'||!Number.isSafeInteger(payload.max_tokens)||payload.max_tokens<1||payload.max_tokens>3000)throw new Error('Unqualified model budget')
 const multiplier=peak()?2:1
 const reservation=((Buffer.byteLength(String(init?.body||''))+1024)*.3+3000*1.2)/1e6
 if(costs.reserved+costs.actual+reservation>5)throw new Error('US$5 model-spend ceiling reached')
 costs.reserved+=reservation;costs.calls++;costs.missingUsage++;save()
 const response=await realFetch(url,init)
 if(!response.ok||!response.body){save();return response}
 let pending='',settled=false
 const decoder=new TextDecoder()
 const consume=(line:string)=>{
  if(settled||!line.startsWith('data:'))return
  let usage: {prompt_tokens:number;completion_tokens:number;prompt_cache_hit_tokens?:number}|undefined
  try{usage=JSON.parse(line.slice(5)).usage}catch{return}
  if(!usage||!Number.isFinite(usage.prompt_tokens)||!Number.isFinite(usage.completion_tokens))return
  const hits=usage.prompt_cache_hit_tokens||0
  costs.actual+=((usage.prompt_tokens-hits)*.15+hits*.003+usage.completion_tokens*.6)*multiplier/1e6
  costs.inputTokens+=usage.prompt_tokens;costs.outputTokens+=usage.completion_tokens
  costs.reserved=Math.max(0,costs.reserved-reservation);costs.missingUsage--;settled=true;save()
 }
 return new Response(response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){pending+=decoder.decode(chunk,{stream:true});const lines=pending.split('\n');pending=lines.pop()!;for(const line of lines)consume(line);controller.enqueue(chunk)},flush(){consume(pending)}})),{status:response.status,headers:response.headers})
}) as typeof fetch
const corpus=await loadWriterCorpus(undefined,{allowMini:false})
const publisher=createPublisherApp({writers:corpus,journal:join(dir,'publisher.db'),rail:'simulated'})
let ps:ReturnType<typeof publisher.listen>|undefined
const apis:Awaited<ReturnType<typeof createApiApp>>[]=[],servers:ReturnType<typeof publisher.listen>[]=[]
try{
 await publisher.locals.ready
 ps=publisher.listen(0,'127.0.0.1');await once(ps,'listening')
 const publisherUrl=`http://127.0.0.1:${(ps.address() as {port:number}).port}`
 await Promise.all(['free','paid'].map(async arm=>{
  const api=await createApiApp({dbPath:join(dir,`${arm}.db`),publisherUrl,reportDir:join(dir,`${arm}-reports`),provider:new CalibratedDecisionProvider()});apis.push(api)
  const server=api.app.listen(0,'127.0.0.1');servers.push(server);await once(server,'listening')
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  const headers={'Content-Type':'application/json',...(process.env.RA_API_TOKEN?{Authorization:`Bearer ${process.env.RA_API_TOKEN}`}:{})}
  let next=0
  await Promise.all(Array.from({length:2},async()=>{
   while(next<limit&&!gateFailure){const q=bank[next++],start=performance.now()
    const res=await fetch(base+'/runs',{method:'POST',headers,body:JSON.stringify({question:q.question,budgetMinor:arm==='free'?0:BUDGET.initialMinor})})
    if(!res.ok)throw new Error(`Evaluation admission failed (${res.status})`)
    let run=await res.json() as RunSnapshot
    const observations:Observation[]=[],abort=new AbortController()
    const sse=await fetch(`${base}/runs/${run.runId}/events`,{headers,signal:abort.signal})
    if(!sse.ok||!sse.body)throw new Error('Evaluation SSE unavailable')
    const reader=sse.body.getReader()
    const stream=(async()=>{let pending='';let grants:Observation['grants']=[];const decoder=new TextDecoder();try{while(true){const next=await reader.read();if(next.done)break;pending+=decoder.decode(next.value,{stream:true});const frames=pending.split('\n\n');pending=frames.pop()!;for(const frame of frames){const raw=frame.split('\n').find(l=>l.startsWith('data: '))?.slice(6);if(!raw)continue;const v=JSON.parse(raw);if(frame.startsWith('event: snapshot'))grants=v.grants;observations.push({kind:'SSE',raw,runId:run.runId,grants:structuredClone(grants)})}}}catch(error){if(!abort.signal.aborted)throw error}finally{await reader.cancel().catch(()=>{})}})()

    const deadline=performance.now()+180000
    while(!['DONE','FAILED','STOPPED'].includes(run.phase)&&performance.now()<deadline){await pause(100);run=api.store.getRun(run.runId)}
    if(!['DONE','FAILED','STOPPED'].includes(run.phase)){await fetch(`${base}/runs/${run.runId}/stop`,{method:'POST',headers});run=api.store.getRun(run.runId)}
    abort.abort();await stream
    const answer=run.answers.at(-1),cites=answer?.claims.flatMap(c=>c.citations)||[]
    const valid=cites.filter(c=>resolveCitation(c,run.contents))
    const lead=(answer?.lead||leadFinding(q.question,answer?.claims||[])).map(item=>({text:item.text,citations:item.claim.citations}))
    const scored=q.requested?q.requested.map(f=>answer?.claims.some(c=>c.citations.length&&factHolds(f,c.text))?1:0):[answersFromAccessible(q.gold,lead,valid)]
    const violations=auditRuns([run],corpus,observations).violations
    // Stop admitting questions after a failed gate; retain and finish in-flight runs.
    if(violations.length)gateFailure=true
    results.push({id:q.id,stratum:q.id.startsWith('v')?'judge-gold':'requested-facts',arm,runId:run.runId,phase:run.phase,answered:scored.some(Boolean),correct:scored.every(Boolean),facts:scored,citations:cites.length,validCitations:valid.length,paidGoldScore:answersIt(q.gold,lead,valid.filter(c=>run.intents.some(i=>i.status==='VERIFIED'&&sameSource(i,c)))),spentMinor:run.spentMinor,latencyMs:performance.now()-start,violations,fallbacks:run.events.filter(e=>e.type==='MODEL_FALLBACK').length,modelCalls:run.events.filter(e=>e.type==='MODEL_USAGE').length,search:run.labels.search})
    save();console.log(`${arm} ${q.id} ${run.phase} ${scored.every(Boolean)?'correct':'miss'} ${run.spentMinor}`)
   }
  }))
 }))
 const percentile=(xs:number[],p:number)=>xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)*p)]
 const summary=Object.fromEntries(['free','paid'].map(arm=>{const rs=results.filter(r=>r.arm===arm);return [arm,{n:rs.length,answeredRate:rs.filter(r=>r.answered).length/rs.length,correctRate:rs.filter(r=>r.correct).length/rs.length,citationsValid:rs.reduce((s,r)=>s+Number(r.validCitations),0),citations:rs.reduce((s,r)=>s+Number(r.citations),0),spendMinor:rs.reduce((s,r)=>s+Number(r.spentMinor),0),medianSpendMinor:percentile(rs.map(r=>Number(r.spentMinor)),.5),latencyP50Ms:percentile(rs.map(r=>Number(r.latencyMs)),.5),latencyP90Ms:percentile(rs.map(r=>Number(r.latencyMs)),.9),gateViolations:rs.flatMap(r=>r.violations as unknown[]).length,fallbacks:rs.reduce((s,r)=>s+Number(r.fallbacks),0),liveOnlyCorrectRate:rs.filter(r=>r.correct&&r.fallbacks===0).length/rs.length}]}))
 writeFileSync(join(dir,'summary.json'),JSON.stringify({summary,costs,rail:'simulated',questions:limit,strata:Object.fromEntries(['free','paid'].map(arm=>[arm,Object.fromEntries(['judge-gold','requested-facts'].map(stratum=>{const rs=results.filter(r=>r.arm===arm&&r.stratum===stratum);return[stratum,{n:rs.length,correctRate:rs.filter(r=>r.correct).length/(rs.length||1)}]}))]))},null,2)+'\n')
 console.log(JSON.stringify({summary,costs}))
 if(results.some(r=>(r.violations as unknown[]).length))throw new Error('Gate violations recorded')
}finally{
 await Promise.all(apis.map(api=>api.close()))
 for(const s of servers){s.closeAllConnections();await new Promise<void>(done=>s.close(()=>done()))}
 if(ps){ps.closeAllConnections();await new Promise<void>(done=>ps!.close(()=>done()))}
 publisher.locals.journal.close();globalThis.fetch=realFetch;save()
}
