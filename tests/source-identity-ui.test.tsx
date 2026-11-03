import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { citationNumbers, getValidatedAnswer } from '../src/components/Answer'
import { getAccessibleContent } from '../src/components/Sources'
import { ReceiptBundleSchema } from '../shared/contracts/receipts.js'
import { RunSnapshotSchema } from '../shared/contracts/run.js'
import { exampleRun } from '../shared/contracts/examples.js'
import Sources from '../src/components/Sources'
import { sourceKey } from '../shared/source-identity.js'
it('renders both collided origins and binds each passage and citation independently', () => {
  const b = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-f/receipt-v2.json','utf8')))
  const run = RunSnapshotSchema.parse({ ...exampleRun, runId: b.runId, candidates:b.candidates, contents:b.sources, answers:b.answers, grants:b.grants, intents:b.intents, receipts:b.receipts })
  const collided = run.candidates.filter(c => c.profileId === 'collision')
  expect(new Set(collided.map(sourceKey)).size).toBe(2)
  for(const c of collided) expect(getAccessibleContent(run,c)?.source).toEqual(c.source)
  expect(getValidatedAnswer(run, run.answers[0])?.claims.flatMap(c => c.citations).filter(c=>c.source?.profileId === 'collision')).toHaveLength(2)
  const markup = renderToStaticMarkup(<Sources run={run}/>)
  for(const c of collided) expect(markup).toContain(c.source!.origin)
  const refs = collided.map(c => ({source:c.source,resourceId:c.resourceId,version:c.version,spanId:'p1'}))
  expect(citationNumbers([{...run.answers[0],claims:[{id:'both',text:'evidence',stance:'SUPPORTS',citations:refs}]}]).size).toBe(2)
})

it('keeps collided-purchase statuses and activity writer names distinct', async()=>{
  const {default:DecisionPanel}=await import('../src/components/DecisionPanel')
  const {default:RunActivity}=await import('../src/components/RunActivity')
  const b=ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-f/receipt-v2.json','utf8')))
  const candidates=b.candidates.filter(c=>c.profileId === 'collision')
  const intents=candidates.map((c,index)=>({...b.intents.find(i=>sourceKey(i) === sourceKey(c))!,status:index ? 'VERIFIED' as const : 'REFUNDED' as const}))
  const run={...exampleRun,phase:'DONE' as const,runId:b.runId,candidates:b.candidates,contents:b.sources,answers:b.answers,intents,grants:b.grants,receipts:b.receipts,decisions:[{round:1,gap:'capacity',gapMaterial:1,provider:'fixture' as const,model:'fixture',threshold:0.2,selectedResourceId:candidates[1].resourceId,selectedSourceKey:sourceKey(candidates[1]),rows:candidates.map(c=>({candidate:c,judgment:{addressesGap:1,credibility:1,originality:{original:1,rewrite:0,overlap:0}},value:1,valuePerDollar:2,verdict:'BUY' as const,reason:'fixture',wouldBuy:false}))}],events:[{id:1,runId:b.runId,type:'DECIDE',label:'decide',at:'2026-11-04T00:00:00Z'},{id:2,runId:b.runId,type:'BUY',label:'buy',at:'2026-11-04T00:00:01Z',data:{intentId:intents[1].intentId,resourceId:intents[1].resourceId}}]}
  const decision=renderToStaticMarkup(<DecisionPanel run={run}/>)
  expect(decision.match(/>Bought</g)).toHaveLength(1); expect(decision.match(/>Refunded</g)).toHaveLength(1)
  const activity=renderToStaticMarkup(<RunActivity run={run} onStop={()=>{}} stopping={false} onShowWork={()=>{}}/>)
  expect(activity).toContain(`Paid ${candidates[1].publisher}`)
  expect(activity).not.toContain(`Paid ${candidates[0].publisher}`)
})
