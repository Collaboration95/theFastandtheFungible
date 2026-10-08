/* eslint-disable @typescript-eslint/no-explicit-any -- Research-only heterogeneous provider fixtures; production schemas validate policy inputs. */
import type { DecisionProvider } from '../../../server/agents/decision.js'
import { publicCandidate, publicSources } from '../../../server/agents/decision.js'
import { clefCandidate, clefQuestions } from '../../../server/agents/clef.js'
import { CandidateJudgmentSchema } from '../../../shared/contracts/index.js'
import { request, models, type Arm } from '../transport.js'

export type Questions = Record<string, {type:string,instructions:string,criteria?:any}>
export function mapQuestions(questions:Questions) {
  return Object.entries(questions).map(([name,q])=>q.type==='noul'?{name,type:'predicate',instructions:q.instructions}:q.type==='choice'?{name,type:'choice',instructions:q.instructions,choices:Object.entries(q.criteria).map(([value,description])=>({value,description}))}:{name,type:'score',instructions:q.instructions,levels:q.criteria.map((description:string,i:number)=>({label:String(i),description}))})
}
export function normalize(arm:Arm,payload:any):Record<string,any> {
  if(arm!=='luna'){if(payload?.success!==true||!payload.result?.answers)throw new Error('Invalid Clef response');return payload.result.answers}
  if(!Array.isArray(payload?.answers))throw new Error('Invalid Decisions response')
  return Object.fromEntries(payload.answers.map((a:any)=>{
    if(a.type==='refusal')throw new Error('Decisions refusal')
    if(a.type==='predicate')return[a.name,{type:'noul',noul:a.probability}]
    const probabilities=Object.fromEntries(a.probabilities.map((p:any)=>[String(p.value),p.probability]))
    return[a.name,{...a,probabilities}]
  }))
}
export function judgment(answers:Record<string,any>,prefix='') {
  return CandidateJudgmentSchema.parse({addressesGap:answers[prefix+'addresses_gap']?.noul,originality:answers[prefix+'originality']?.probabilities,credibility:answers[prefix+'credibility']?.score})
}
export const prob = (a:any) => {const p=a?.noul;if(typeof p!=='number'||p<0||p>1)throw new Error('Invalid predicate');return p}
export async function call(arm:Arm,state:any,questions:Questions,meta:{phase:string,kind:string,repeat?:number,ordinal?:string}) {
  const body=arm==='luna'?{model:models.luna,input:JSON.stringify(state,null,2),questions:mapQuestions(questions)}:{model:arm==='clef'?'clef':'clef-flash',state,questions}
  const record=await request(arm,body,meta)
  try{return{record,answers:normalize(arm,record.response),valid:!record.error}}catch{return{record,answers:{},valid:false}}
}
/** Research-only adapter. The legacy interface has no OpenAI discriminator; external artifacts
 * always identify arm=luna. No adapter output is displayed in production or sent to payment. */
export class OpenAIDecisionsProvider implements DecisionProvider {
  readonly name='cloudflare' as const
  readonly model=models.luna
  constructor(private phase='adapter',private repeat=0){}
  async judgeRound(input:Parameters<DecisionProvider['judgeRound']>[0]) {
    const r=await call('luna',input,clefQuestions.round,{phase:this.phase,kind:'round',repeat:this.repeat});if(!r.valid||r.record.timeout3s)throw new Error('Decision unavailable');return{gapMaterial:prob(r.answers.gap_material)}
  }
  async judgeCandidate(input:Parameters<DecisionProvider['judgeCandidate']>[0]) {
    const state={question:input.question,gap:input.gap,readSources:publicSources(input.readSources),candidate:clefCandidate(publicCandidate(input.candidate))}
    const r=await call('luna',state,clefQuestions.candidate,{phase:this.phase,kind:'candidate',repeat:this.repeat});if(!r.valid||r.record.timeout3s)throw new Error('Decision unavailable');return judgment(r.answers)
  }
  async judgePaidRelevance(input:Parameters<NonNullable<DecisionProvider['judgePaidRelevance']>>[0]) {
    const state={question:input.question,gap:input.gap,passages:input.content.spans.map(s=>s.text)}
    const r=await call('luna',state,clefQuestions.paid,{phase:this.phase,kind:'paid',repeat:this.repeat});if(!r.valid||r.record.timeout3s)throw new Error('Decision unavailable');return{observed:prob(r.answers.addresses_gap)}
  }
}
