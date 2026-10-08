/* eslint-disable @typescript-eslint/no-explicit-any -- Research-only heterogeneous provider fixtures; production schemas validate policy inputs. */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalize,judgment,mapQuestions } from './providers/openai-decisions.js'
import { candidateState,select } from './run.js'
import { clefQuestions,ClefDecisionProvider } from '../../server/agents/clef.js'
const sample={profileId:'writer',resourceId:'paper',version:'1',title:'Title',publisher:'SYNTHETIC Writer',preview:'Public abstract',price:{amountMinor:50,currency:'SGD'},family:'new',facets:['semis'],authority:2,tier:'PAID',license:{kind:'synthetic',attribution:'writer'}}
test('metadata projection excludes payment, hidden text and construction labels',()=>{
  const s={question:'question',gap:'gap',readSources:[],labels:{hidden:true}}
  const c={candidate:{...sample,body:'premium secret',spans:[{text:'premium'}]},body:'premium secret',labels:{addressesGap:1}}
  const state=candidateState(s,c);const text=JSON.stringify(state)
  for(const forbidden of ['premium','price','wallet','labels','amountMinor','spans'])assert.ok(!text.includes(forbidden))
})
test('all three real smoke responses normalize into the production judgment schema',()=>{
  for(const arm of ['luna','flash','clef'] as const){const r=JSON.parse(fs.readFileSync(`bench/decisions/out/smoke/${arm}.json`,'utf8'));const j=judgment(normalize(arm,r.response));assert.ok(j.addressesGap>=0&&j.addressesGap<=1)}
})
test('Luna refuses and missing fields fail validation rather than producing confident zeroes',()=>{
  assert.throws(()=>normalize('luna',{answers:[{name:'a',type:'refusal'}]}));assert.throws(()=>judgment({}))
  assert.deepEqual(mapQuestions(clefQuestions.candidate).map(q=>q.type),['predicate','choice','score'])
})
test('existing ClefDecisionProvider accepts recorded live payload with transport injection',async()=>{
  const payload=JSON.parse(fs.readFileSync('bench/decisions/out/smoke/flash.json','utf8')).response
  const p=new ClefDecisionProvider({accountId:'test',token:'test',fetch:async()=>new Response(JSON.stringify(payload),{status:200})})
  const j=await p.judgeCandidate({question:'question',gap:'gap',readSources:[],candidate:sample as any});assert.ok(j.addressesGap>0)
})
test('real policy keeps budget and cap binding under maximally positive model judgment',async()=>{
  const s={question:'question',conclusion:'known',gap:'gap',readSources:[],budgetMinor:0,perSourceCapMinor:100,candidates:[{candidate:sample}]}
  const js=[{addressesGap:1,originality:{original:1,rewrite:0,overlap:0},credibility:2}]
  assert.equal((await select(s,'luna',1,js,.2)).selected,null)
  assert.equal((await select({...s,budgetMinor:100,perSourceCapMinor:10},'luna',1,js,.2)).selected,null)
  assert.equal((await select({...s,budgetMinor:100},'luna',1,js,.2)).selected,'paper')
})
