// Recompute transparent summaries from allowlisted evidence; never reads credentials/journals.
import { readFileSync, writeFileSync } from 'node:fs'
import { readRuns, auditRuns } from '../gate-audit.ts'
import { loadWriterCorpus } from '../../publisher/corpus.ts'
const corpus = await loadWriterCorpus(undefined, { allowMini: false })
const pct=(v,p)=>v.length?[...v].sort((a,b)=>a-b)[Math.ceil(v.length*p)-1]:null
const timing=v=>({n:v.length,p50:pct(v,.5),p95:pct(v,.95)})
for(const phase of ['before','after']) {
  const path=`docs/evidence/live-reliability-${phase}.json`
  const r=JSON.parse(readFileSync(path))
  const stored=readRuns(`scratch/live-reliability/${phase}/app.db`)
  const audit=auditRuns(stored,corpus,[])
  r.gateAudit={...audit,scope:'Persisted state/events; no raw SSE wire capture in this probe'}
  for (const row of r.runs) {
    const run=stored.find(x=>x.runId===row.runId)
    row.testnetTransactions=(run?.intents??[]).filter(i=>i.txHash).map(i=>({intentId:i.intentId,resourceId:i.resourceId,status:i.status,txHash:i.txHash,refundTxHash:i.refund?.txHash??null}))
  }
  const usage=r.runs.filter(x=>x.modelUsage)
  r.modelCost={billingUsd:null,scenarioUsd:usage.reduce((s,x)=>s+(x.modelUsage.inputTokens*.3+x.modelUsage.outputTokens*1.2)/1e6,0),basis:'Reported aggregate model tokens at conservative blended 0.30 input / 1.20 output USD per million (historical repository scenario, not billing). Cloudflare embedding reservations reported separately. Missing/unreported calls not invented as zero.',reportedCalls:usage.reduce((s,x)=>s+x.modelUsage.reportedCalls,0),embeddingReservedUsd:r.calls.filter(x=>x.provider==='cloudflare').reduce((s,x)=>s+x.reservedUsd,0)}
  r.summary.successfulOnlyTimings={firstAnswerMs:timing(r.runs.filter(x=>x.success).map(x=>x.firstAnswerMs).filter(x=>x!==null)),finalMs:timing(r.runs.filter(x=>x.success).map(x=>x.finalMs).filter(x=>x!==null))}
  r.summary.allCompletedFirstAnswerMs=timing(r.runs.map(x=>x.firstAnswerMs).filter(x=>x!==null))
  r.summary.allCompletedFinalMs=timing(r.runs.map(x=>x.finalMs).filter(x=>x!==null))
  r.summary.firstAnswerMs=r.summary.allCompletedFirstAnswerMs
  r.summary.finalMs=r.summary.allCompletedFinalMs
  r.summary.failureClasses=Object.fromEntries([...new Set(r.runs.map(x=>x.failureClass).filter(Boolean))].map(c=>[c,r.runs.filter(x=>x.failureClass===c).length]))
  for (const row of r.runs) row.substitutions=row.fallbacks.map(reason=>({configuredProvider:reason.startsWith('plan') || reason.startsWith('answer') || reason.startsWith('research') ? 'deepseek' : reason.startsWith('search') ? 'cloudflare' : 'openai',actualProvider:reason.startsWith('search') ? 'keyword-only' : reason.startsWith('decision unavailable') ? 'unavailable (no purchase)' : 'fixture',reason}))
  const names=r.runs.flatMap(x=>x.substitutions.map(s=>`${s.configuredProvider} -> ${s.actualProvider}: ${s.reason}`))
  r.summary.fallbackProviders=Object.fromEntries([...new Set(names)].map(c=>[c,names.filter(n=>n===c).length]))
  writeFileSync(path,JSON.stringify(r,null,2)+'\n')
  console.log(phase,JSON.stringify({summary:r.summary,modelCost:r.modelCost,reserved:r.reservedModelUsd}))
}
const before=JSON.parse(readFileSync('docs/evidence/live-reliability-before.json'))
const after=JSON.parse(readFileSync('docs/evidence/live-reliability-after.json'))
if(before.planHash!==after.planHash || before.runs.length!==30 || after.runs.length!==30)throw new Error('Incomplete paired experiment')

if(before.gateAudit.total || after.gateAudit.total) throw new Error('Raw audit findings retained; inspect evidence note. No automatic waiver.')
