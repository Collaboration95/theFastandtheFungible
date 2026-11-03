// Full-live reliability probe. No fixture replacement is accepted as live success.
import dotenv from 'dotenv'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { once } from 'node:events'
import { randomBytes, createHash } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import { detectFallbacks, checkRun } from '../live-smoke.mjs'
dotenv.config({ quiet: true })
const phase = process.argv[2]
if (!['before', 'after'].includes(phase)) throw new Error('Pass before or after')
if (process.env.VITEST) throw new Error('Live probe is never a unit test')
const dir = `scratch/live-reliability/${phase}`
if (existsSync(dir)) throw new Error('Preserve prior journals; use a new evidence directory for a new experiment')
mkdirSync(dir, { recursive: true, mode: 0o700 })
const token = randomBytes(32).toString('hex')
Object.assign(process.env, { DEMO_PORT_OFFSET: '800', LLM_PROVIDER: 'deepseek', DECISION_PROVIDER: 'openai', SETTLEMENT_RAIL: 'xrpl-testnet', SEARCH_EMBEDDINGS: 'live', LANGFUSE_ENABLED: '0', RA_API_TOKEN: token, PUBLISHER_DB: `${dir}/publisher.db`, APP_DB: `${dir}/app.db`, REPORT_DIR: `${dir}/reports`, PUBLISHER_URL: 'http://127.0.0.1:9590' })
if (!process.env.XRPL_PAYER_SEED) throw new Error('Testnet payer required')
const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json'))
const bank = JSON.parse(readFileSync('eval/questions/bank.v2.json'))
const split = JSON.parse(readFileSync('eval/scorecard/receipt-split.json'))
const questions = [...bible.useCases.filter(u => ['UC1','UC2','UC3'].includes(u.id)).map(u => ({ id: u.id, question: u.question })), ...split.heldoutIds.slice(0,10).map(id => bank.questions.find(q => q.id === id))]
const plan = [...questions, ...questions, ...questions.slice(0,4)].map(q => ({ id: q.id, question: q.question, answers: q.answers }))
const planHash = createHash('sha256').update(JSON.stringify(plan)).digest('hex')
if (phase === 'after') {
  const before = JSON.parse(readFileSync('docs/evidence/live-reliability-before.json'))
  if (before.runs.length !== 30 || before.stopReason) throw new Error('Baseline incomplete; do not resume spending after a quota stop')
  if (before.planHash !== planHash) throw new Error('Paired question order changed')
}
const runtimeSources = ['server/agents/scope.ts','server/agents/llm.ts','publisher/search.ts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))
const report = { runtimeSources, worktreeDirty: Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()), schema: 'full-live-reliability/v1', phase, commit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), startedAt: new Date().toISOString(), planHash, plan, plannedN: 30, labels: { research: 'DeepSeek', decision: 'OpenAI Decisions', search: 'Cloudflare embeddings', settlement: 'XRPL TESTNET · no real value', corpus: 'SYNTHETIC v2 articles' }, calls: [], runs: [], stopReason: null }
// Conservative scenario charge: every input byte is a token, max output charged in advance,
// including failed/retried requests. Historical repository rates; not a provider invoice.
let reservedUsd = 0, activeRun = null
const realFetch = globalThis.fetch
// Settle completed reservations only when every model request has reported usage.
const settledCost = r => r.runs.reduce((sum, run) => {
  const calls = r.calls.filter(c => c.run === run.index)
  const models = calls.filter(c => c.provider !== 'cloudflare')
  const usage = run.modelUsage
  return sum + (usage && usage.reportedCalls === models.length ? (usage.inputTokens * .3 + usage.outputTokens * 1.2) / 1e6 + calls.filter(c => c.provider === 'cloudflare').reduce((n,c) => n+c.reservedUsd,0) : calls.reduce((n,c) => n+c.reservedUsd,0))
}, r.calls.filter(c => c.run === null).reduce((n,c) => n+c.reservedUsd,0))
const beforeCost = phase === 'after' ? settledCost(JSON.parse(readFileSync('docs/evidence/live-reliability-before.json'))) : 0
const cap = 2.8 - beforeCost
const save = () => {
  report.reservedModelUsd = reservedUsd
  report.budgetScenarioUsd = settledCost(report)
  report.finishedAt = new Date().toISOString()
  const pct = (values,p) => values.length ? [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1] : null
  const timing = key => { const v = report.runs.map(r=>r[key]).filter(v=>v!==null); return { n:v.length, p50:pct(v,.5), p95:pct(v,.95) } }
  report.summary = { completedN: report.runs.length, successfulN: report.runs.filter(r=>r.success).length, fallbackRuns: report.runs.filter(r=>r.fallbacks.length).length, fallbackRate: report.runs.length ? report.runs.filter(r=>r.fallbacks.length).length/report.runs.length : null, firstAnswerMs: timing('firstAnswerMs'), finalMs: timing('finalMs'), settlementMs: (()=>{const v=report.runs.flatMap(r=>r.settlementMs);return {n:v.length,p50:pct(v,.5),p95:pct(v,.95)}})() }
  writeFileSync(`docs/evidence/live-reliability-${phase}.json`, JSON.stringify(report,null,2)+'\n')
}
globalThis.fetch = async (url,init) => {
  const target = String(url)
  const provider = target.includes('api.deepseek.com') ? 'deepseek' : target.includes('api.openai.com') ? 'openai' : target.includes('/ai/run/') ? 'cloudflare' : null
  if (!provider) return realFetch(url,init)
  if (report.stopReason) throw new Error('Live experiment stopped')
  const body = String(init?.body ?? '')
  const charge = provider === 'deepseek' ? (Buffer.byteLength(body)*.3+3000*1.2)/1e6 : provider === 'openai' ? Buffer.byteLength(body)*.1/1e6 : .0002
  const pending = report.calls.filter(c => c.run === activeRun).reduce((n,c)=>n+c.reservedUsd,0)
  if (settledCost(report) + pending + charge > cap) { report.stopReason='model-budget-cap'; throw new Error('Live experiment budget cap') }
  reservedUsd += charge
  const call = { provider, run: activeRun, status: null, ms: null, reservedUsd: charge }
  report.calls.push(call)
  const started = performance.now()
  try {
    const response = await realFetch(url,init)
    call.status=response.status
    if ([402,429].includes(response.status)) {
      const body = await response.clone().text()
      if (response.status===402 || /quota|exhaust|allocation|insufficient_quota|2014/i.test(body)) report.stopReason=`${provider}-quota-exhausted`
    }
    return response
  } finally { call.ms=performance.now()-started; save() }
}
const { createPublisherApp } = await import('../../publisher/routes.ts')
const { createApiApp } = await import('../../server/routes.ts')
const publisher = createPublisherApp({ rail: 'xrpl-testnet' })
await publisher.locals.writersReady
const ps = publisher.listen(9590,'127.0.0.1'); await once(ps,'listening')
const api = await createApiApp()
const server = api.app.listen(9588,'127.0.0.1'); await once(server,'listening')
const json = async (path,body) => { const r=await realFetch('http://127.0.0.1:9588'+path,{ headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body ? {method:'POST',body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`local HTTP ${r.status}`);return r.json() }
try {
  for (const [index,q] of plan.entries()) {
    if (report.stopReason) break
    activeRun=index
    await json('/api/reputation/reset',{})
    const started=performance.now()
    let run, first=null
    const row={index,id:q.id,success:false,failureClass:null,fallbacks:[],firstAnswerMs:null,finalMs:null,settlementMs:[],modelUsage:null}
    try {
      run=await json('/runs',{question:q.question,budgetMinor:200,...(q.answers ? {answers:q.answers} : {})})
      const deadline=performance.now()+360000
      while (true) {
        run=await json(`/runs/${run.runId}`)
        if (first===null && (run.answers?.length || run.events?.some(e=>e.type==='FREE_DRAFT'))) first=performance.now()-started
        if (['DONE','FAILED','STOPPED'].includes(run.phase)) break
        if (performance.now()>deadline || report.stopReason) { await json(`/runs/${run.runId}/stop`,{}); row.failureClass=report.stopReason ?? 'timeout';break }
        await pause(100)
      }
      row.runId=run.runId; row.phase=run.phase
      row.firstAnswerMs=first; row.finalMs=performance.now()-started
      row.fallbacks=detectFallbacks(run,'live','openai')
      row.fallbacks.push(...(run.events??[]).filter(e=>e.type==='MODEL_FALLBACK').map(()=> 'research: fixture substitution'))
      row.settlementMs=(run.intents??[]).flatMap(i=>i.settledAt&&i.submittingAt ? [Date.parse(i.settledAt)-Date.parse(i.submittingAt)] : [])
      row.modelUsage=(await json('/api/metrics')).modelUsageByRun.find(r=>r.runId===run.runId)??null
      row.behaviourFailures=q.id.startsWith('UC') ? checkRun(q.id,run,bible,'live','openai') : []
      row.success=run.phase==='DONE' && !row.fallbacks.length && !row.behaviourFailures.length
      if(!row.success && !row.failureClass)row.failureClass=row.fallbacks.length?'provider-substitution':run.phase!=='DONE'?'run-failed':'use-case-contract'
    } catch { row.failureClass=report.stopReason??'transport-or-admission';row.finalMs=performance.now()-started }
    report.runs.push(row);save()
    console.log(`${phase} ${index+1}/30 ${q.id}: ${row.success?'PASS':row.failureClass}`)
    if(row.failureClass==='timeout') { report.stopReason='unresolved-run-timeout'; break }
  }
} finally {
  save();server.closeAllConnections();server.close();await api.close();ps.closeAllConnections();ps.close();publisher.locals.journal.close()
}
// XRPL clients may retain sockets; process exit preserves private recovery journals.
process.exit(report.stopReason ? 1 : 0)
