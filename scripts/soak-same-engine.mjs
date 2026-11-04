/** Manual, offline same-worker workload. No forced GC; RSS belongs to the entire process. */
import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { performance, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks'
import { BroadcastChannel, isMainThread, threadId, workerData } from 'node:worker_threads'
import { loadavg, cpus, platform, release } from 'node:os'
import net from 'node:net'
import { writeHeapSnapshot, getHeapStatistics } from 'node:v8'
import { syncBuiltinESMExports } from 'node:module'
import { execFileSync } from 'node:child_process'

const MiB = 1024 ** 2
export const quantile = (xs, q) => { const a = [...xs].sort((a,b)=>a-b); return a.length ? a[Math.max(0, Math.ceil(q*a.length)-1)] : null }
export async function deadline(promise, ms) {
  let timer
  try { return await Promise.race([promise, new Promise((_,reject)=> { timer=setTimeout(()=>reject(new Error('timeout')),ms) })]) }
  finally { clearTimeout(timer) }
}
export function burstPass(b) {return b.peak===4&&b.activeAfterDrain===0&&b.admitted+b.overloaded===100&&b.overloaded>0&&b.idempotentRetries===b.admitted}
export function compare(report) {
  const rows = report.asks.filter(r=>r.stage==='measured'), good = rows.filter(r=>r.ok)
  const first=good.slice(0,100), last=good.slice(-100)
  const xbar=good.reduce((s,r)=>s+r.index,0)/good.length, ybar=good.reduce((s,r)=>s+r.rss,0)/good.length
  const slope=good.reduce((s,r)=>s+(r.index-xbar)*(r.rss-ybar),0)/good.reduce((s,r)=>s+(r.index-xbar)**2,0)*100/MiB
  const warm=quantile(first.map(r=>r.rss),.5)/MiB, final=quantile(last.map(r=>r.rss),.5)/MiB
  const p95first=quantile(first.map(r=>r.ms),.95), p95last=quantile(last.map(r=>r.ms),.95)
  const samples=report.samples.filter(s=>s.stage==='measured')
  const maxRss=Math.max(...report.samples.map(s=>s.rss),...good.map(r=>r.rss))/MiB
  // Each worker interval reports its histogram p99; the worst interval is conservative.
  const loopP99=Math.max(...samples.map(s=>s.worker?.loopP99Ms??Infinity))
  const gaps=report.samples.filter(s=>s.gapMs>2500 || s.hostSleepMs>1500)
  const gates={rssSlope:{value:slope,limit:5,pass:Number.isFinite(slope)&&slope<=5}, rssMedian:{value:final-warm,limit:100,pass:final-warm<=100}, rssMax:{value:maxRss,limit:1536,pass:maxRss<=1536}, loopP99:{value:loopP99,limit:50,pass:loopP99<50}, latencyP95:{value:p95last-p95first,limit:Math.max(.2*p95first,250),pass:p95last-p95first<=Math.max(.2*p95first,250)}}
  // Explicit opt-in for short diagnostic runs; never suppress a full-run gate.
  const diagnosticSlope=report.options.diagnosticSlope===true && report.options.runs<2000
  if(diagnosticSlope)Object.assign(gates.rssSlope,{gating:false,note:'Short-window diagnostic only; full 2000-ask slope remains required'})
  const identities=new Set(report.asks.map(r=>`${r.pid}/${r.engineId}/${r.workerId}/${r.storeId}`))
  const valid=good.length===report.options.runs && good.length>=200 && identities.size===1 && !gaps.length && !report.failures.length && samples.length>=60 && samples.every(s=>s.worker) && report.restarts.length===20 && report.restarts.every(r=>r.closed) && report.auditViolations===0
  return { gates, valid, pass:valid&&Object.values(gates).every(g=>g.gating===false||g.pass)&&(!report.options.burst||report.burst?.pass===true), acceptanceEligible:!diagnosticSlope&&report.options.runs>=2000, completed:good.length, failed:rows.length-good.length, warmMedianMiB:warm, finalMedianMiB:final, firstP95Ms:p95first, lastP95Ms:p95last, sampleGaps:gaps.length, identityCount:identities.size, loopMethod:'maximum of worker one-second histogram p99s, 10 ms resolution' }
}

// Loaded with --import in both host and engine worker, before any engine module.
export async function installGuard() {
  const channel=new BroadcastChannel('same-engine-soak-'+process.env.SOAK_ID)
  const original=net.Socket.prototype.connect
  net.Socket.prototype.connect=function(...args) {
    const options=Array.isArray(args[0])?args[0][0]:args[0]
    const host=typeof options==='object'?options.host:typeof args[1]==='string'?args[1]:'localhost'
    if (!['127.0.0.1','::1','localhost'].includes(host??'localhost')) { channel.postMessage({blocked:true}); throw new Error('Non-loopback connection blocked') }
    return original.apply(this,args)
  }
  const originalFetch=globalThis.fetch
  globalThis.fetch=(input,init)=> {
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
    if (!['127.0.0.1','[::1]','localhost'].includes(url.hostname)) { channel.postMessage({blocked:true}); throw new Error('Non-loopback fetch blocked') }
    return originalFetch(input,init)
  }
  syncBuiltinESMExports()
  if (!isMainThread && workerData?.apiPort !== undefined) {
    const {register}=await import('tsx/esm/api');register()
    if(process.env.SOAK_SPANS==='1') { const {installSpans}=await import('./soak-loop-diagnostics.mjs');await installSpans(channel) }
    const {ActiveWork}=await import('../server/agents/active-work.ts')
    const acquire=ActiveWork.prototype.acquire
    let burst=false
    channel.onmessage=({data})=>{if(data.heapSnapshot && process.env.SOAK_HEAP_DIR) { mkdirSync(process.env.SOAK_HEAP_DIR,{recursive:true}); const before=process.memoryUsage(); const path=writeHeapSnapshot(join(process.env.SOAK_HEAP_DIR,`${data.heapSnapshot}.heapsnapshot`)); channel.postMessage({snapshot:data.heapSnapshot,path,before,after:process.memoryUsage()}) };if(data.burstStart) {burst=true;channel.postMessage({burstReady:true})}}
    ActiveWork.prototype.acquire=function(...args) {
      const release=acquire.apply(this,args)
      if(burst)channel.postMessage({burstActive:this.active})
      return ()=>{release();if(burst)channel.postMessage({burstActive:this.active})}
    }
    const histogram=monitorEventLoopDelay({resolution:10}); histogram.enable()
    let gc={count:0,totalPauseMs:0,maxPauseMs:0,kinds:{},pausesMs:[]}
    const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){
      gc.pausesMs.push(entry.duration);gc.count++;gc.totalPauseMs+=entry.duration;gc.maxPauseMs=Math.max(gc.maxPauseMs,entry.duration)
      const kind=String(entry.detail.kind);gc.kinds[kind]=(gc.kinds[kind]||0)+1
    }})
    observer.observe({entryTypes:['gc']})
    const engineId=randomUUID()
    let intervalStart=Date.now()
    let nextBoundary=Number(process.env.SOAK_EPOCH)+(Math.floor((Date.now()-Number(process.env.SOAK_EPOCH))/1000)+1)*1000
    const tick=()=> {if(Date.now()<nextBoundary){const t=setTimeout(tick,nextBoundary-Date.now());t.unref();return}const end=Date.now(),interval=Math.floor((end-Number(process.env.SOAK_EPOCH))/1000);channel.postMessage({interval,intervalStart,intervalEnd:end,worker:true,workerId:threadId,engineId,heap:process.memoryUsage().heapUsed,memory:process.memoryUsage(),v8:getHeapStatistics(),handles:process.getActiveResourcesInfo().length,gc,loopP99Ms:histogram.percentile(99)/1e6});histogram.reset();gc={count:0,totalPauseMs:0,maxPauseMs:0,kinds:{},pausesMs:[]};intervalStart=end;nextBoundary=Number(process.env.SOAK_EPOCH)+(interval+1)*1000;const timer=setTimeout(tick,Math.max(1,Number(process.env.SOAK_EPOCH)+(interval+1)*1000-Date.now()));timer.unref()}
    const timer=setTimeout(tick,Math.max(1,Number(process.env.SOAK_EPOCH)+(Math.floor((Date.now()-Number(process.env.SOAK_EPOCH))/1000)+1)*1000-Date.now()));timer.unref()
    channel.unref()
  } else channel.unref()
}
export function options(args) {
  const o={runs:2000,warmup:200,concurrency:1,seed:279,historyRuns:10000,eventsPerRun:60,timeoutMs:120000,burst:false}
  const names={'runs':'runs','warmup':'warmup','concurrency':'concurrency','seed':'seed','history-runs':'historyRuns','events-per-run':'eventsPerRun','data-dir':'dataDir','output':'output','timeout-ms':'timeoutMs','cpu-prof-dir':'cpuProfDir','heap-dir':'heapDir'}
  for(let i=0;i<args.length;i++){if(args[i]==='--internal')continue;if(args[i]==='--spans'){o.spans=true;continue}if(args[i]==='--diagnostic-slope'){o.diagnosticSlope=true;continue}if(args[i]==='--burst'){o.burst=true;continue}const key=names[args[i].slice(2)];if(!key||!args[i+1])throw Error('Unknown/missing flag');o[key]=['dataDir','output','cpuProfDir','heapDir'].includes(key)?args[++i]:Number(args[++i])}
  for(const key of ['runs','warmup','concurrency','seed','historyRuns','eventsPerRun','timeoutMs'])if(!Number.isSafeInteger(o[key])||o[key]<0)throw Error('Invalid '+key)
  if(!o.runs||!o.concurrency||!o.timeoutMs||!o.dataDir||!o.output)throw Error('Positive counts, --data-dir and --output required')
  if(o.diagnosticSlope&&o.runs>=2000)throw Error('Diagnostic slope is only allowed below 2000 asks; full-run gate is mandatory')
  return o
}
async function run(o) {
  const { register }=await import('tsx/esm/api'); register()
  const { Store }=await import('../server/store.ts')
  const { startEngine }=await import('../server/engine.ts')
  const { createClient }=await import('../sdk/index.ts')
  const { USE_CASES }=await import('../tests/scenarios/use-cases.ts')
  const { auditRuns }=await import('./gate-audit.ts')
  const { loadWriterCorpus }=await import('../publisher/corpus.ts')
  const corpus=await loadWriterCorpus()
  if(existsSync(o.dataDir))throw Error('Data root must be fresh')
  mkdirSync(o.dataDir,{recursive:true});mkdirSync(resolve(o.output,'..'),{recursive:true})
  const start=Date.now(), storeId=randomUUID(), dbPath=join(o.dataDir,'app.db')
  const r={schema:'same-engine-soak-v1',label:'BASELINE · SHARED HOST · SYNTHETIC fixtures / SIMULATED rail · not finals acceptance', options:o,harnessSha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),host:{platform:platform(),release:release(),cpus:cpus().length,node:process.version,load:loadavg()},startedAt:new Date().toISOString(),storeId,pid:process.pid,samples:[],intervals:[],lags:[],asks:[],restarts:[],failures:[],auditViolations:0,burst:{requested:o.burst,pass:false},seedCases:[]}
  const save=()=>writeFileSync(o.output,JSON.stringify(r,null,2)+'\n')
  const store=new Store(dbPath)
  // Store creates validated run records; historical event insertion is batched per run.
  try {
    for(let n=0;n<o.historyRuns;n++) {
      const run=store.createRun('SYNTHETIC historical completed run',0)
      store.updateRun(run.runId,{phase:'DONE'})
      store.db.exec('BEGIN')
      const insert=store.db.prepare('INSERT INTO events(run_id,json) VALUES (?,?)')
      for(let j=0;j<o.eventsPerRun;j++)insert.run(run.runId,JSON.stringify({id:n*o.eventsPerRun+j+1,runId:run.runId,at:new Date(start).toISOString(),type:'SEARCH',label:'SYNTHETIC retained history',data:{}}))
      store.db.exec('COMMIT')
    }
    for(let n=0;n<16;n++) {
      const phase=['FAILED','STOPPED','SEARCH','DONE'][n%4],run=store.createRun('SYNTHETIC recovery selector case',0),intentId=`historical-${n}`
      store.updateRun(run.runId,{phase,stopped:n%3===0,checkpoint:{intentId,...(n%2?{answeredIntentId:intentId}:{})}})
      // Synthetic selector metadata only: no signed blob, grant, receipt or money.
      store.db.prepare('INSERT INTO intents VALUES (?,?,?)').run(intentId,run.runId,JSON.stringify({intentId,runId:run.runId,profileId:'fixture',resourceId:'fixture',version:'1',amountMinor:0,status:n%2?'SKIPPED':'VERIFIED'}))
      r.seedCases.push({runId:run.runId,phase})
    }
    r.selectorsBeforeBoot={runnable:store.runnableRunIds(),recoverable:store.recoverableRunIds()}
  } finally {store.close()}
  r.seedDurationMs=Date.now()-start;save()
  const controls=new Map()
  const control=spawn(process.execPath,[fileURLToPath(new URL('./soak-idle-control.mjs',import.meta.url))],{env:{PATH:process.env.PATH},stdio:['ignore','inherit','inherit','ipc']})
  await deadline(new Promise((done,fail)=>{control.once('error',fail);control.on('message',m=>{if(m.ready)done();if(m.control)controls.set(m.interval,m)})}),o.timeoutMs)
  control.send({epoch:Number(process.env.SOAK_EPOCH)})
  let burstReady=false,burstPeak=0,burstActive=0
  const snapshots=[]
  const snapshot=async name=>{if(!o.heapDir)return;channel.postMessage({heapSnapshot:name});await deadline((async()=>{while(!snapshots.some(s=>s.snapshot===name))await new Promise(done=>setTimeout(done,10))})(),o.timeoutMs);r.snapshots=snapshots;save()}
  let worker, engine, stage='startup', completed=0, lastWall=Date.now(), lastMono=performance.now()
  const channel=new BroadcastChannel('same-engine-soak-'+process.env.SOAK_ID)
  channel.onmessage=({data})=> {if(data.lag)r.lags.push({...data,stage,completed});if(data.snapshot)snapshots.push(data);if(data.burstReady)burstReady=true;if(data.burstActive!==undefined){burstActive=data.burstActive;burstPeak=Math.max(burstPeak,burstActive)};if(data.blocked)r.failures.push('non-loopback request');if(data.worker){worker=data;r.intervals.push({interval:data.interval,engineId:data.engineId,stage,completed,start:data.intervalStart,end:data.intervalEnd,engineP99Ms:data.loopP99Ms,load:loadavg()})}}
  const bytes=path=>existsSync(path)?statSync(path).size:0
  const sample=()=>{const wall=Date.now(),mono=performance.now();r.samples.push({at:wall,elapsedMs:wall-start,stage,completed,rss:process.memoryUsage().rss,hostHeap:process.memoryUsage().heapUsed,hostMemory:process.memoryUsage(),hostHandles:process.getActiveResourcesInfo().length,worker,dbBytes:bytes(dbPath),walBytes:bytes(dbPath+'-wal'),load:loadavg(),gapMs:mono-lastMono,hostSleepMs:Math.max(0,(wall-lastWall)-(mono-lastMono))});lastWall=wall;lastMono=mono}
  const timer=setInterval(sample,1000)
  const boot=async()=>{worker=undefined;const e=await deadline(startEngine({dataDir:o.dataDir}),o.timeoutMs);const readyAt=performance.now();while(!worker){if(performance.now()-readyAt>o.timeoutMs)throw Error('timeout waiting for worker metrics');await new Promise(done=>setTimeout(done,10))};const h=await(await fetch(e.apiUrl+'/health')).json();if(!h.labels.research.includes('fixture')||!h.labels.decision.includes('fixture')||!h.labels.settlement.includes('SIMULATED'))throw Error('Unsafe engine mode');for(const url of [e.apiUrl,e.publisherUrl])if([5100,8788,8790].includes(+new URL(url).port))throw Error('Protected port');return e}
  const close=async e=>{await deadline(e.close(),o.timeoutMs);for(const url of [e.apiUrl,e.publisherUrl]){let reachable=false;try{await fetch(url+'/health',{signal:AbortSignal.timeout(1000)});reachable=true}catch{ /* expected refusal */ }if(reachable)throw Error('Listener survived close')}}
  try {
    engine=await boot();r.assertedModes={research:'fixture',decision:'fixture',rail:'simulated',embeddings:process.env.SEARCH_EMBEDDINGS,telemetry:process.env.LANGFUSE_ENABLED,network:'loopback guard in host and engine worker'}
    const sdk=createClient({baseUrl:engine.apiUrl,token:engine.apiToken})
    const ask=async(index,s)=>{const uc=['UC1','UC2','UC3','UC4'][(index+o.seed)%4],t=performance.now();const identity={pid:process.pid,engineId:worker.engineId,workerId:worker.workerId,storeId};let row
      try{const result=await sdk.ask(USE_CASES[uc].question+(uc==='UC2'?' (pricing & margins)':''),{budgetSgd:2,idempotencyKey:`soak-${s}-${index}`,signal:AbortSignal.timeout(o.timeoutMs)});const snapshot=await(await fetch(engine.apiUrl+'/api/mcp/runs/'+result.run_id,{headers:{Authorization:'Bearer '+engine.apiToken}})).json();const audit=auditRuns([snapshot],corpus);r.auditViolations+=audit.total;row={ok:result.phase==='DONE',runId:result.run_id,phase:result.phase,reservedMinor:snapshot.reservedMinor};if(snapshot.reservedMinor)r.failures.push('unexplained reservation '+result.run_id)}catch(error){row={ok:false,error:error.message};r.failures.push('ask failed '+index)}
      r.asks.push({...identity,...row,index,uc,stage:s,ms:performance.now()-t,rss:process.memoryUsage().rss});if(s==='measured')completed++;save()}
    await snapshot('early')
    for(const [s,count] of [['warmup',o.warmup],['measured',o.runs]]){stage=s;const began=Date.now();for(let i=0;i<count;i+=o.concurrency)await Promise.all(Array.from({length:Math.min(o.concurrency,count-i)},(_,j)=>ask(i+j,s)));if(s==='measured'&&Date.now()-began<61000)await new Promise(done=>setTimeout(done,61000-(Date.now()-began)))}
    await snapshot('late')
    if(o.burst) {
      stage='burst'
      channel.postMessage({burstStart:true});await deadline((async()=>{while(!burstReady)await new Promise(done=>setTimeout(done,10))})(),o.timeoutMs)
      const headers={Authorization:'Bearer '+engine.apiToken,'Content-Type':'application/json'}
      const post=(path,body,key)=>fetch(engine.apiUrl+path,{method:'POST',headers:{...headers,...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(o.timeoutMs)})
      const responses=await Promise.all(Array.from({length:100},(_,i)=>post('/runs',{question:`Admission burst ${i}?`,budgetMinor:0},`burst-${i}`)))
      const admitted=[],refused=[];let retries=0
      for(let i=0;i<responses.length;i++) {
        const response=responses[i],body=await response.json()
        if(response.status===201) {admitted.push(body.runId);const retry=await post('/runs',{question:`Admission burst ${i}?`,budgetMinor:0},`burst-${i}`);if(retry.status===200&&(await retry.json()).runId===body.runId)retries++}
        else if(response.status===503&&body.code==='overloaded'&&body.retryable===true)refused.push(i)
      }
      for(const id of admitted) {const stopped=await post(`/runs/${id}/stop`,{});if(!stopped.ok)throw Error('Burst stop failed')}
      await deadline((async()=>{while(burstActive)await new Promise(done=>setTimeout(done,10))})(),o.timeoutMs)
      r.burst={requested:true,limit:4,submitted:100,admitted:admitted.length,overloaded:refused.length,idempotentRetries:retries,peak:burstPeak,activeAfterDrain:burstActive,pass:burstPass({peak:burstPeak,activeAfterDrain:burstActive,admitted:admitted.length,overloaded:refused.length,idempotentRetries:retries})};save()
    }
    stage='restart';await close(engine);engine=undefined
    for(let i=0;i<20;i++){const t=performance.now();engine=await boot();const identity={engineId:worker.engineId,workerId:worker.workerId};await close(engine);engine=undefined;r.restarts.push({cycle:i+1,...identity,ms:performance.now()-t,closed:true});save()}
  } catch(error){r.failures.push(error.message)}
  finally{if(engine)try{await close(engine)}catch(error){r.failures.push(error.message)}clearInterval(timer);sample();channel.close();control.send({stop:true});await new Promise(done=>control.once('exit',done));for(const row of r.intervals)row.control=controls.get(row.interval)??null;for(const s of r.samples)s.control=controls.get(s.worker?.interval)??null;r.controlIntervals=[...controls.values()];r.durationMs=Date.now()-start;r.summary=compare(r);save()}
  console.log(JSON.stringify(r.summary));return r.summary.pass?0:1
}
const self=fileURLToPath(import.meta.url)
if(process.argv[1]&&resolve(process.argv[1])===self){
  const o=options(process.argv.slice(2))
  if(process.argv.includes('--internal'))process.exitCode=await run(o)
  else {
    const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
    Object.assign(env,{SOAK_ID:randomUUID(),SOAK_EPOCH:String(Date.now()),SOAK_SPANS:o.spans?'1':'0',ACTIVE_WORK_LIMIT:'4',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',SEARCH_EMBEDDINGS:'off',LANGFUSE_ENABLED:'0',RECONCILE_INTERVAL_MS:'1000',MCP_DAILY_CAP_MINOR:'100000000',WALLET_DAILY_CAP_MINOR:'100000000',NODE_OPTIONS:`--import=data:text/javascript,${encodeURIComponent(`import {installGuard} from ${JSON.stringify(pathToFileURL(self).href)};await installGuard()` )}`})
    if(o.heapDir)env.SOAK_HEAP_DIR=resolve(o.heapDir)
    const child=spawn(process.execPath,[...(o.cpuProfDir ? ['--cpu-prof', '--cpu-prof-dir='+resolve(o.cpuProfDir)] : []),self,...process.argv.slice(2),'--internal'],{env,stdio:'inherit'})
    child.on('exit',code=>{process.exitCode=code??1})
  }
}
