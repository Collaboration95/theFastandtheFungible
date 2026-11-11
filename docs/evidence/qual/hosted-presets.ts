// Local HOSTED=1 acceptance: live DeepSeek planning/writing, fixture decisions,
// signed team content and SIMULATED settlement. No public hosted questions.
import { config } from 'dotenv'
import { once } from 'node:events'
import { request } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
config({ path: '.env', quiet: true })
const dir = mkdtempSync(join(tmpdir(), 'qual-hosted-'))
Object.assign(process.env, {
 HOSTED: '1', HOSTED_ORIGIN: 'https://demo.example', HOSTED_TRUSTED_PROXY: '127.0.0.2', HOSTED_IP_HMAC_KEY: 'qual-local-only'.padEnd(40, 'x'), HOSTED_CONTROL_PATH: join(dir, 'control.json'),
 HOSTED_RESEARCH_INPUT_USD_PER_MILLION: '0.2', HOSTED_RESEARCH_OUTPUT_USD_PER_MILLION: '0.4', HOSTED_RESEARCH_MODEL: 'deepseek-flash', LLM_PROVIDER: 'deepseek', LLM_MODEL: 'deepseek-flash', LLM_BASE_URL: 'https://api.deepseek.com', DECISION_PROVIDER: 'fixture', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0',
})
// Use only the selected provider's key. Never output credentials.
process.env.LLM_API_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? ''
writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'qual_local', expiresAt: new Date(Date.now() + 3600_000).toISOString() }))
const { createPublisherApp } = await import('../../../publisher/routes.js')
const { createApiApp } = await import('../../../server/routes.js')
const { TESTNET_QUESTIONS } = await import('../../../shared/contracts/examples.js')
const { factsSummary } = await import('../../../shared/coverage.js')
const publisher = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
await publisher.locals.ready; await publisher.locals.writersReady
const pub = publisher.listen(0, '127.0.0.1'); await once(pub, 'listening')
const api = await createApiApp({ dbPath: join(dir, 'app.db'), publisherUrl: `http://127.0.0.1:${(pub.address() as {port:number}).port}`, hostedReadiness: async () => true })
const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
const port = (server.address() as {port:number}).port
const wire = (path: string, method = 'GET', headers: Record<string,string> = {}, body?: unknown) => new Promise<{status:number; headers:import('node:http').IncomingHttpHeaders; data:any}>((resolve,reject) => { // eslint-disable-line @typescript-eslint/no-explicit-any
 const req = request({host:'127.0.0.1',port,path,method,headers:{Host:'demo.example','Content-Type':'application/json',...headers}}, res => {
  let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,data:JSON.parse(text)}))
 });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))
})
const results = []
try {
 const status=await wire('/api/demo/status')
 const visitor={Cookie:status.headers['set-cookie']![0].split(';')[0],Origin:'https://demo.example','X-CSRF-Token':status.data.csrfToken}
 for (let repetition=1;repetition<=2;repetition++) for (const q of TESTNET_QUESTIONS) {
  // Preserve the local IP rate limit, including scope admission, rather than raising it.
  if(results.length) await new Promise(r=>setTimeout(r,22000))
  const start=performance.now(),key=`qual-${q.id}-${repetition}`,headers={...visitor,'Idempotency-Key':key}
  const scoped=await wire('/api/scope','POST',headers,{question:q.text,clarify:'never'})
  if(scoped.status!==200) throw Error(`scope ${scoped.status}`)
  if(!scoped.data.label?.startsWith('DeepSeek')) throw Error(`Live planner required: ${scoped.data.label}`)
  const planMs=performance.now()-start
  const posted=await wire('/runs','POST',headers,{question:q.text,budgetMinor:200})
  if(posted.status!==201) throw Error(`run ${posted.status}`)
  const runId=posted.data.runId
  for(const deadline=Date.now()+180_000;;){
   const run=api.store!.getRun(runId)
   if(['DONE','FAILED','STOPPED'].includes(run.phase))break
   if(Date.now()>deadline)throw Error('local hosted deadline')
   await new Promise(r=>setTimeout(r,50))
  }
  const run=api.store!.getRun(runId),answer=run.answers.at(-1)
  if(results.length===0){const exported=await wire(`/runs/${runId}/receipts.json`,'GET',visitor);writeFileSync(process.argv[2].replace(/\.json$/,'.receipts.json'),JSON.stringify(exported.data,null,2)+'\n')}
  const row={id:q.id,repetition,question:q.text,phase:run.phase,planMs,askMs:performance.now()-start,scopeLabel:scoped.data.label,plan:run.checkpoint.plan,requirements:run.checkpoint.requirements,labels:run.labels,bought:run.intents.filter(i=>['VERIFIED','REFUNDED'].includes(i.status)).map(i=>i.resourceId),spentMinor:run.spentMinor,lead:answer?.lead?.map(l=>l.text),conclusion:answer?.conclusion,openGaps:answer?.openGaps,facts:factsSummary(run),fallbacks:run.events.filter(e=>e.type==='MODEL_FALLBACK').map(e=>e.data)}
  results.push(row);writeFileSync(process.argv[2],JSON.stringify(results,null,2)+'\n');console.log(q.id,repetition,row.phase,row.bought.join(','),row.spentMinor,Math.round(row.askMs))
 }
} finally {
 server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await api.close()
 pub.closeAllConnections();await new Promise<void>(r=>pub.close(()=>r()));publisher.locals.journal.close();rmSync(dir,{recursive:true,force:true})
}
