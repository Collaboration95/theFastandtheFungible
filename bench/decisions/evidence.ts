/** Offline publication facts. No provider calls; every number is derived from saved evidence. */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { decisionMetrics, percentile } from './metrics.ts'

const out=path.resolve('bench/decisions/out')
const data=fs.readFileSync(path.resolve('bench/decisions/data/scenarios.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l) as {id:string;split:string;group:string;slice:string;candidates:Array<{body:string}>})
const devIds=new Set(data.filter(s=>s.split==='dev').map(s=>s.id))
const lock=fs.readFileSync(path.join(out,'test-lock.txt'),'utf8').trim()
if(createHash('sha256').update(JSON.stringify(data.filter(s=>s.split==='test'))).digest('hex')!==lock)throw new Error('Test-array lock mismatch')
type RecordValue=Record<string, unknown>
type Call={key:string;arm:string;kind:string;phase:string;inputTokens:number;usd:number;latencyMs:number;status:number;error?:string;timeout3s:boolean;estimatedUsage:boolean}
const calls=fs.readdirSync(path.join(out,'cache')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(out,'cache',f),'utf8')) as Call)
const mean=(a:number[])=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null
const kinds=[...new Set(calls.map(c=>c.kind))].sort()
const callSummary=['flash','clef','luna','deepseek'].flatMap(arm=>kinds.flatMap(kind=>{
 const c=calls.filter(c=>c.arm===arm&&c.kind===kind);if(!c.length)return[]
 return[{arm,kind,n:c.length,meanInputTokens:mean(c.map(x=>x.inputTokens)),meanUsd:mean(c.map(x=>x.usd)),p50Ms:percentile(c.map(x=>x.latencyMs),.5),p95Ms:percentile(c.map(x=>x.latencyMs),.95),p99Ms:percentile(c.map(x=>x.latencyMs),.99),timeouts:c.filter(x=>x.timeout3s).length,httpOrTransportErrors:c.filter(x=>x.error).length,estimatedUsage:c.filter(x=>x.estimatedUsage).length}]
}))
type Run={id:string;arm:string;config:string;repeat:number;selected:string|null;expected:string|null;priceMinor:number;fallback:boolean;calls:string[];decisionCacheHits?:number}
const dev=fs.readdirSync(path.join(out,'runs')).filter(f=>/^(baseline|tune)-/.test(f)).flatMap(f=>{
 const rows=fs.readFileSync(path.join(out,'runs',f),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l) as Run)
 if(!rows.length)return[]
 const ids=new Set(rows.map(r=>r.id))
 return[{arm:rows[0].arm,config:rows[0].config,n:rows.length,complete:rows.length===devIds.size&&ids.size===devIds.size&&[...devIds].every(id=>ids.has(id)),decision:decisionMetrics(rows),fallbackRounds:rows.filter(r=>r.fallback).length}]
})
const reference=new Map(calls.map(c=>[c.key,c]))
const baselineCallCost=['flash','clef','luna'].map(arm=>{
 const file=path.join(out,'runs',`baseline-baseline-${arm}-0.jsonl`)
 const rows=fs.readFileSync(file,'utf8').trim().split('\n').map(l=>JSON.parse(l) as Run)
 const roundCosts=rows.map(r=>r.calls.map(k=>reference.get(k)!).filter(c=>c.kind!=='paid').reduce((s,c)=>s+c.usd,0))
 const byKind=['round','candidate','paid'].map(kind=>{
  const c=[...new Map(rows.flatMap(r=>r.calls.map(k=>reference.get(k)!)).filter(c=>c.kind===kind).map(c=>[c.key,c])).values()]
  return{kind,nUniqueCalls:c.length,meanInputTokens:mean(c.map(c=>c.inputTokens)),meanUsd:mean(c.map(c=>c.usd)),p50Ms:percentile(c.map(c=>c.latencyMs),.5),p95Ms:percentile(c.map(c=>c.latencyMs),.95)}
 })
 return{arm,byKind,meanUsdPerRound:mean(roundCosts),usdPer1000Rounds:mean(roundCosts)!*1000,n:rows.length,nCandidates:6,convention:'Replay-priced seven-call rounds, including referenced cached responses at their original token charge; not the cost of executing warm cache hits. Excludes paid relevance.'}
})
const qa=JSON.parse(fs.readFileSync(path.join(out,'label-qa.json'),'utf8')) as {sampleCount:number;completed:number;agreement:unknown}
const attempts=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l) as Call)
const articles=fs.readFileSync(path.resolve('bench/decisions/data/articles.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l) as {resourceId:string;body:string})
const dataset={...JSON.parse(fs.readFileSync(path.join(out,'dataset-summary.json'),'utf8')) as RecordValue,
 libraryArticles:articles.length,distinctBodies:new Set(articles.map(a=>a.body)).size,
 generator:'GPT-6.1 Sol high structured specifications plus deterministic realization; generator used the Codex subagent, not a billed benchmark model',
 testArrayLock:lock,
 splitFamilies:Object.fromEntries(['dev','test'].map(split=>[split,new Set(data.filter(s=>s.split===split).map(s=>s.group)).size])),
 independentRelabel:{source:'label-qa.json',performed:qa.completed>0,n:qa.completed,expected:qa.sampleCount,agreement:qa.agreement},
 metadataCorrection:'This merged publication record supersedes the standalone builder summary for generator naming, test-array lock and independent QA status. Builder hashes use their documented serialization and remain preserved.'}
const result={generatedAt:new Date().toISOString(),dataset,callSummary,baselineCallCost,rawDev:dev,
 attemptCounts:Object.fromEntries(['flash','clef','luna','deepseek'].map(arm=>[arm,attempts.filter(c=>c.arm===arm).length])),
 sourceFiles:['out/cache/*.json','out/runs/baseline-*.jsonl','out/runs/tune-*.jsonl','out/dataset-summary.json','out/test-lock.txt','out/label-qa.json'],
 notes:['Call summaries pool experiment phases and distinct request kinds; they do not estimate a production traffic mix. Cache summaries use the latest record per key; attemptCounts/requests.jsonl retain retried attempts and cost.json is the total meter.','Raw dev metrics use default thresholds and include recorded fixture fallbacks.','Dataset samples are synthetic; wrong-purchase SGD values are counterfactual, never real payments.']}
fs.writeFileSync(path.join(out,'publication-facts.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({output:'bench/decisions/out/publication-facts.json',cachedCalls:calls.length,devConfigurations:dev.length}))
