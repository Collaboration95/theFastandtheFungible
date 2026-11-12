// One local HTTP/SSE run, live DeepSeek research and compatible decisions, real corpus, zero article budget.
// Configure the main checkout's .env symlink as described in CONTENT.md. Never print credentials.
import 'dotenv/config'
import { once } from 'node:events'
import { writeFile, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import type { RunSnapshot } from '../shared/contracts/index.js'
if(!process.env.DEEPSEEK_API_KEY) throw Error('DEEPSEEK_API_KEY is required')
Object.assign(process.env,{CORPUS_PROFILE:'real',FREE_TIER:'public-docs',LEDGER_ANALYTICS:'1',SETTLEMENT_RAIL:'simulated',ANCHOR_RAIL:'off',HOSTED:'0',LLM_PROVIDER:'deepseek',LLM_MODEL:'deepseek-flash',LLM_BASE_URL:'https://api.deepseek.com',LLM_API_KEY:process.env.DEEPSEEK_API_KEY,DECISION_PROVIDER:'compatible',DECISION_MODEL:'deepseek-flash',DECISION_BASE_URL:'https://api.deepseek.com',DECISION_API_KEY:process.env.DEEPSEEK_API_KEY,LANGFUSE_ENABLED:'0',SEARCH_EMBEDDINGS:'off'})
const nativeFetch=globalThis.fetch
let reservedUsd=0,calls=0
// Input bytes conservatively bound input tokens. Reserve at $1/$3 per million,
// above the documented Flash peak rates ($0.30/$1.20). Never credit failed attempts.
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.hostname==='api.deepseek.com') {
    const body=String(init?.body ?? ''), p=JSON.parse(body) as {model:string;max_tokens:number}
    if(p.model!=='deepseek-flash'||!Number.isSafeInteger(p.max_tokens)||p.max_tokens>3000||p.max_tokens<1) throw Error('Unbounded model request refused')
    const bound=Buffer.byteLength(body)/1e6+p.max_tokens*3/1e6
    if(reservedUsd+bound>0.90) throw Error('Recording model budget exhausted')
    reservedUsd+=bound;calls++
  } else if(!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('Recording permits local HTTP and the bounded model endpoint only')
  return nativeFetch(input,init)
}
const {createPublisherApp}=await import('../publisher/routes.js')
const {createApiApp}=await import('../server/routes.js')
const question=process.env.CONTENT_RECORDING_QUESTION || 'What information does the account_info command return?'
const publisher=createPublisherApp({journal:':memory:',rail:'simulated'})
let pub:ReturnType<typeof publisher.listen>|undefined,api:Awaited<ReturnType<typeof createApiApp>>|undefined,server:ReturnType<typeof publisher.listen>|undefined
try {
  await publisher.locals.ready
  pub=publisher.listen(0,'127.0.0.1');await once(pub,'listening')
  const publisherUrl=`http://127.0.0.1:${(pub.address() as {port:number}).port}`
  api=await createApiApp({dbPath:':memory:',publisherUrl,reconcileIntervalMs:0})
  server=api.app.listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  const request=async(path:string,body?:unknown)=>{
    const r=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined)
    if(!r.ok)throw Error(`Capture HTTP ${r.status}`)
    return r.json()
  }
  const scope=await request('/api/scope',{question})
  const created=await request('/runs',{question,budgetMinor:0,plan:scope.plan})
  const response=await fetch(`${base}/runs/${created.runId}/events`,{signal:AbortSignal.timeout(180000)})
  const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='',run:RunSnapshot|undefined
  try {outer:for(;;){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end:number;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(!frame.startsWith('event: snapshot\n'))continue;run=JSON.parse(frame.slice(frame.indexOf('data: ')+6));if(run?.phase==='FAILED')throw Error(`Real-profile run failed: ${JSON.stringify(run.events.slice(-3))}`);if(run?.phase==='DONE')break outer}}} finally {await reader.cancel()}
  if(!run||run.phase!=='DONE'||!run.answers.at(-1)?.claims.length||!calls||run.candidates.some(c=>c.license.kind==='SYNTHETIC')||run.contents.some(c=>!['xrpl-docs','x402-docs','team-builder-notes','team-xrpl-explainers','ledger-analytics'].includes(c.profileId)))throw Error('Real-profile recording contract failed')
  if(run.answers.at(-1)?.provider==='fixture')throw Error('Live synthesis fell back; no live replay saved')
  const cards:Record<string,unknown>={}
  for(const slug of new Set(run.candidates.map(c=>c.publisherSlug).filter(Boolean))){const path=`/w/${slug}/.well-known/agent-publisher.json`;cards[path]=await (await fetch(publisherUrl+path)).json()}
  const recording={provenance:{source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),capturedAt:new Date().toISOString(),transport:'HTTP SSE snapshot + persisted event trace',mode:'Real public documentation · live DeepSeek research and decisions · simulated payments (zero purchases)',modelSpendUpperBoundUsd:reservedUsd,modelCalls:calls},scope,health:await request('/api/health'),reputation:await request('/api/reputation'),cards,run}
  await writeFile('demo/traces/UC-real-content.json',JSON.stringify(recording)+'\n')
  const index=JSON.parse(await readFile('demo/recording-index.json','utf8')) as {scenario:string;runId:string;question:string;testnet:boolean}[]
  await writeFile('demo/recording-index.json',JSON.stringify([...index.filter(r=>r.scenario!=='UC-real-content'),{scenario:'UC-real-content',runId:run.runId,question,testnet:false}],null,2)+'\n')
  console.log(JSON.stringify({scenario:'UC-real-content',claims:run.answers.at(-1)!.claims.length,modelCalls:calls,modelSpendUpperBoundUsd:reservedUsd,purchases:run.intents.length}))
} finally {
  await publisher.locals.ledgerAnalytics?.stop()
  globalThis.fetch=nativeFetch
  server?.close();server?.closeAllConnections();pub?.close();pub?.closeAllConnections()
  await api?.close();publisher.locals.journal.close()
}
