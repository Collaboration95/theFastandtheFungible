/* eslint-disable @typescript-eslint/no-explicit-any -- Research-only heterogeneous provider fixtures; production schemas validate policy inputs. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decide,FixtureDecisionProvider,publicCandidate,publicSources,type DecisionProvider } from '../../server/agents/decision.js'
import { clefCandidate } from '../../server/agents/clef.js'
import { OUT,hash,save,forecast,models,type Arm } from './transport.js'
import { call,judgment,prob,type Questions } from './providers/openai-decisions.js'
import { variants } from './variants.js'
export const loadData = (regression=false):any[] => fs.readFileSync(path.resolve('bench/decisions/data',regression?'regression.jsonl':'scenarios.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l))
export const defaults = {flash:.15,clef:.35,luna:.20,fixture:.20}
export const content = (c:any) => ({...c.candidate,body:c.body,spans:[{id:'synthetic-granted-1',text:c.body}]})
export function candidateState(s:any,c:any,config='baseline') {
  const state:any={question:s.question,gap:s.gap,readSources:publicSources(s.readSources),candidate:clefCandidate(publicCandidate(c.candidate))}
  if(config==='no-read')delete state.readSources
  if(config==='abstract-first')return{candidate:state.candidate,readSources:state.readSources,gap:state.gap,question:state.question}
  // Explicit fields only: bodies, prices, wallets and labels never enter candidate requests.
  return state
}
export async function select(s:any,arm:string,gap:number,judgments:any[],threshold:number,failed=false) {
  const provider:DecisionProvider={name:arm==='fixture'?'fixture':'cloudflare',model:arm==='fixture'?'metadata-fixture':models[arm as Arm],judgeRound:async()=>{if(failed)throw new Error('Measured production timeout/error');return{gapMaterial:gap}},judgeCandidate:async({candidate})=>judgments[s.candidates.findIndex((c:any)=>c.candidate.resourceId===candidate.resourceId)]}
  const result=await decide({question:s.question,conclusion:s.conclusion,gap:s.gap,candidates:s.candidates.map((c:any)=>c.candidate),readSources:s.readSources,budgetMinor:s.budgetMinor,spentMinor:0,reservedMinor:0,perSourceCapMinor:s.perSourceCapMinor,round:1,provider,threshold,...(s.reputation?{reputation:s.reputation}:{})})
  return{selected:result.selectedResourceId??null,rows:result.rows.map(r=>({id:r.candidate.resourceId,value:r.value,verdict:r.verdict})),fallback:Boolean(result.fallbackReason),priceMinor:result.rows.find(r=>r.candidate.resourceId===result.selectedResourceId)?.candidate.price.amountMinor??0}
}
export async function evaluate(s:any,arm:Arm|'fixture',config='baseline',repeat=0,phase='baseline',withPaid=true) {
  const started=performance.now();const calls:any[]=[];let gap=0;let js:any[];let paid:any[]=[]
  const questions:any=config==='evidence'||config==='batch-evidence'?variants.evidence:config==='historical'?variants.historical:variants.baseline
  if(arm==='fixture'){
    const p=new FixtureDecisionProvider();gap=(await p.judgeRound(s)).gapMaterial
    js=await Promise.all(s.candidates.map((c:any)=>p.judgeCandidate({question:s.question,gap:s.gap,readSources:s.readSources,candidate:c.candidate})))
    if(withPaid)paid=await Promise.all(s.candidates.filter((c:any)=>s.paidResourceIds.includes(c.candidate.resourceId)).map(async(c:any)=>({resourceId:c.candidate.resourceId,label:c.paidLabel,p:(await p.judgePaidRelevance({question:s.question,gap:s.gap,content:content(c)})).observed})))
  }else{
    const meta={phase,repeat}
    if(config.startsWith('batch')){
      const state={question:s.question,conclusion:s.conclusion,gap:s.gap,readSources:publicSources(s.readSources),candidates:s.candidates.map((c:any)=>clefCandidate(publicCandidate(c.candidate)))}
      const qs:Questions={...questions.round}
      s.candidates.forEach((c:any,i:number)=>{for(const[k,q]of Object.entries<any>(questions.candidate))qs[`c${i}_${k}`]={...q,instructions:`Evaluate only candidates[${i}] (resourceId ${c.candidate.resourceId}). ${q.instructions}`}})
      const r=await call(arm,state,qs,{...meta,kind:'batch'});calls.push(r.record)
      try{gap=prob(r.answers.gap_material);js=s.candidates.map((_:any,i:number)=>judgment(r.answers,`c${i}_`))}catch{js=[]}
    }else{
      const results=await Promise.all([
        call(arm,{question:s.question,conclusion:s.conclusion,gap:s.gap},questions.round,{...meta,kind:'round'}),
        ...s.candidates.map((c:any)=>call(arm,candidateState(s,c,config),questions.candidate,{...meta,kind:'candidate'}))
      ])
      calls.push(...results.map(r=>r.record));try{gap=prob(results[0].answers.gap_material);js=results.slice(1).map(r=>judgment(r.answers))}catch{js=[]}
    }
    const decisionElapsedMs=performance.now()-started
    if(withPaid)paid=await Promise.all(s.candidates.filter((c:any)=>s.paidResourceIds.includes(c.candidate.resourceId)).map(async(c:any)=>{const r=await call(arm,{question:s.question,gap:s.gap,passages:[c.body]},questions.paid,{...meta,kind:'paid'});calls.push(r.record);let p:null|number=null;try{p=prob(r.answers.addresses_gap)}catch{ /* A missing prediction remains null. */ }return{resourceId:c.candidate.resourceId,label:c.paidLabel,p,requestKey:r.record.key}}))
    // Round wall time includes local limiter queue; max individual latency is separately labelled lower bound.
    const failed=js.length!==s.candidates.length||calls.filter(r=>r.kind!=='paid').some(r=>r.error||r.timeout3s)
    const selection=await select(s,arm,gap,js,defaults[arm],failed)
    return{id:s.id,domain:s.domain,split:s.split,slice:s.slice,arm,config,repeat,gap,judgments:js,paid,calls:calls.map(r=>r.key),decisionCacheHits:calls.filter(r=>r.kind!=='paid'&&r.cacheHit).length,decisionElapsedMs,networkLowerBoundMs:Math.max(...calls.filter(r=>r.kind!=='paid').map(r=>r.latencyMs)),failed,...selection,expected:s.expectedResourceId}
  }
  return{id:s.id,domain:s.domain,split:s.split,slice:s.slice,arm,config,repeat,gap,judgments:js,paid,calls:[],decisionElapsedMs:performance.now()-started,networkLowerBoundMs:0,failed:false,...await select(s,arm,gap,js,defaults[arm]),expected:s.expectedResourceId}
}
export function verifyLock(){const test=loadData().filter(s=>s.split==='test');const digest=hash(test);const lock=fs.readFileSync(path.join(OUT,'test-lock.txt'),'utf8').trim();if(lock!==digest)throw new Error('Test lock mismatch')}
export async function runBatch(phase:string,config:string,scenarios:any[],repeat:number,arm:Arm|'fixture',withPaid=true) {
  const name=`runs/${phase}-${config}-${arm}-${repeat}.jsonl`,f=path.join(OUT,name)
  fs.mkdirSync(path.dirname(f),{recursive:true})
  const done=new Set(fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).id):[])
  let n=0
  for(const s of scenarios){if(done.has(s.id))continue;const result=await evaluate(s,arm,config,repeat,phase,withPaid);fs.appendFileSync(f,JSON.stringify(result)+'\n');if(++n%8===0)console.log(JSON.stringify({phase,config,arm,repeat,completed:done.size+n,total:scenarios.length}))}
}
export async function main(){
  const arg=(name:string,fallback:string)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]}
  const phase=arg('--phase','baseline'),arms=arg('--arms','flash,clef,luna,fixture').split(',') as (Arm|'fixture')[]
  const data=loadData();verifyLock()
  if(phase==='baseline'){
    // Test baseline is deliberately deferred until every tuning choice is frozen.
    const dev=data.filter(s=>s.split==='dev');forecast(phase,dev.length*9,dev.length*9*1200,arms.filter(a=>a!=='fixture'))
    await Promise.all(arms.map(arm=>runBatch('baseline','baseline',dev,0,arm)))
  }else if(phase==='tune'){
    const dev=data.filter(s=>s.split==='dev'),configs=['evidence','historical','no-read','abstract-first','batch','batch-evidence']
    const screening=dev.filter(s=>dev.filter(x=>x.domain===s.domain).indexOf(s)<4)
    forecast(phase,dev.length*11+screening.length*21,(dev.length*11+screening.length*21)*1400,arms.filter(a=>a!=='fixture'))
    for(const config of configs){const subset=['historical','no-read','abstract-first'].includes(config)?screening:dev;await Promise.all(arms.filter(a=>a!=='fixture').map(arm=>runBatch('tune',config,subset,0,arm,config==='evidence')))}
  }else if(phase==='promote'){
    const dev=data.filter(s=>s.split==='dev')
    forecast(phase,(dev.length-28)*13,(dev.length-28)*13*1200,arms.filter(a=>a!=='fixture'))
    for(const config of ['historical','no-read','abstract-first'])await Promise.all(arms.filter(a=>a!=='fixture').map(arm=>runBatch('tune',config,dev,0,arm,false)))
  }else if(phase==='operational'){
    const frozen=JSON.parse(fs.readFileSync(path.join(OUT,'frozen-config.json'),'utf8'))
    const test=data.filter(s=>s.split==='test'&&s.slice==='clean')
    forecast(phase,test.length*7,test.length*7*1800,arms.filter(a=>a!=='fixture'))
    // One arm at a time: primary topology timings without cross-arm contention or warmed cache.
    for(const arm of arms.filter(a=>a!=='fixture'))await runBatch('operational',frozen[arm].config,test,401,arm,false)
  }else if(phase==='final'){
    if(!fs.existsSync(path.join(OUT,'frozen-config.json')))throw new Error('Freeze tuning first')
    const frozen=JSON.parse(fs.readFileSync(path.join(OUT,'frozen-config.json'),'utf8')),test=data.filter(s=>s.split==='test'),regression=loadData(true)
    forecast(phase,(test.length+regression.length)*30,(test.length+regression.length)*30*1600,arms.filter(a=>a!=='fixture'))
    await Promise.all(arms.map(arm=>runBatch('test-baseline','baseline',test,0,arm)))
    for(let repeat=1;repeat<=3;repeat++)await Promise.all(arms.map(arm=>runBatch('final',arm==='fixture'?'baseline':frozen[arm].config,[...test,...regression],repeat,arm)))
  }else throw new Error('Unknown phase')
  save(`completed-${phase}.json`,{at:new Date().toISOString(),arms})
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1})
