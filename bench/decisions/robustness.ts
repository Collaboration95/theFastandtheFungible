/* eslint-disable @typescript-eslint/no-explicit-any -- Research-only heterogeneous provider fixtures; production schemas validate policy inputs. */
import {fileURLToPath} from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import {save,forecast,hash,OUT,type Arm} from './transport.js'
import {loadData,candidateState} from './run.js'
import {call,judgment} from './providers/openai-decisions.js'
import {variants} from './variants.js'
export async function robustness(){
 const dev=loadData().filter(s=>s.split==='dev'),items=dev.flatMap(s=>s.candidates.map((c:any)=>({s,c}))).sort((a,b)=>hash(a.c.candidate.resourceId).localeCompare(hash(b.c.candidate.resourceId)))
 const unique=items.filter((x,i)=>items.findIndex(y=>y.c.candidate.resourceId===x.c.candidate.resourceId)===i).slice(0,24)
 const ai=process.argv.indexOf('--arms'),arms=(ai<0?'flash,clef,luna':process.argv[ai+1]).split(',') as Arm[]
 forecast('robustness',24*8,24*8*1400,arms)
 const rows:any[]=[]
 await Promise.all(arms.map(async arm=>{
  for(const {s,c}of unique){
   const state=candidateState(s,c),repeats:any[]=[]
   for(let repeat=101;repeat<=105;repeat++){const r=await call(arm,state,variants.baseline.candidate,{phase:'stability',kind:'candidate',repeat});try{repeats.push({repeat,judgment:judgment(r.answers),key:r.record.key,failed:r.record.timeout3s||!r.valid})}catch{repeats.push({repeat,key:r.record.key,failed:true})}}
   const entries=Object.entries(variants.baseline.candidate.originality.criteria),permutations:any[]=[]
   for(let k=0;k<3;k++){const criteria=Object.fromEntries([...entries.slice(k),...entries.slice(0,k)]),questions={originality:{...variants.baseline.candidate.originality,criteria}},r=await call(arm,state,questions,{phase:'position-bias',kind:'originality',repeat:201});permutations.push({order:Object.keys(criteria),probabilities:r.answers.originality?.probabilities??null,key:r.record.key,failed:r.record.timeout3s||!r.valid})}
   rows.push({arm,scenarioId:s.id,resourceId:c.candidate.resourceId,repeats,permutations})
  }
 }))
 const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/a.length
 const summary=Object.fromEntries(arms.map(arm=>{
  const r=rows.filter(x=>x.arm===arm),stds=r.map(x=>{const p=x.repeats.filter((r:any)=>r.judgment).map((r:any)=>r.judgment.addressesGap);const m=mean(p);return Math.sqrt(mean(p.map((v:number)=>(v-m)**2)))}).filter(Number.isFinite)
  const deltas=r.flatMap(x=>['original','rewrite','overlap'].map(c=>{const p=x.permutations.map((p:any)=>p.probabilities?.[c]).filter((v:any)=>typeof v==='number');return p.length?Math.max(...p)-Math.min(...p):null})).filter((x:any)=>x!==null)
  return[arm,{items:r.length,meanAddressesGapStd:mean(stds),maxPositionDelta:Math.max(...deltas),meanPositionDelta:mean(deltas),failures:r.reduce((s,x)=>s+x.repeats.filter((y:any)=>y.failed).length+x.permutations.filter((y:any)=>y.failed).length,0)}]
 }))
 const previousFile=path.join(OUT,'robustness.json'),previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):{summary:{},rows:[]}
 save('robustness.json',{summary:{...previous.summary,...summary},rows:[...previous.rows.filter((r:any)=>!arms.includes(r.arm)),...rows],note:'Dev-only diagnostics. Repeats use identical request payloads in distinct cache namespaces. Failures retained; variability calculated from parsed raw predictions. Position tests isolate the originality question, three cyclic option permutations. Separate arm invocations preserve prior arms.'})
}
if(process.argv[1]===fileURLToPath(import.meta.url))robustness().catch(e=>{console.error(e.message);process.exitCode=1})
