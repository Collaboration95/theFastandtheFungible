// Reproducible local-only acceptance. Run after npm run build:
// node --import tsx tests/p4-proof.ts load|visual
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { ResourceScope } from '../shared/resource-scope.js'
import { seedSandbox } from './helpers/sandbox-seed.js'
import type { SandboxStats } from '../server/hosted/stats.js'

const scope = new ResourceScope(), dir = scope.tempDir('p4-proof-'), output = 'docs/evidence/p4-scoreboard'
mkdirSync(output,{recursive:true})
for (const key of Object.keys(process.env)) if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(key)) delete process.env[key]
Object.assign(process.env,{HOSTED:'1',HOSTED_ORIGIN:'https://demo.example',HOSTED_TRUSTED_PROXY:'127.0.0.1',HOSTED_IP_HMAC_KEY:'synthetic-p4-only-'.repeat(3),HOSTED_CONTROL_PATH:join(dir,'control.json'),LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off',SETTLEMENT_RAIL:'simulated',LANGFUSE_ENABLED:'0',DOTENV_CONFIG_PATH:'.playwright/no-env'})
writeFileSync(process.env.HOSTED_CONTROL_PATH!,JSON.stringify({admissionsPaused:true,spendingPaused:true,reasonCode:'test',expiresAt:'2026-11-19T16:00:00Z'}))
try {
  if (process.argv[2] === 'load') {
    const { createApiApp } = await import('../server/routes.js')
    const api=await createApiApp({dbPath:join(dir,'store.db'),publisherUrl:'http://127.0.0.1:1',hostedReadiness:async()=>false})
    const server=api.app.listen(0,'127.0.0.1'); await once(server,'listening')
    try {
      seedSandbox(api.store!,5000)
      const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/demo/stats`
      const latencies:number[]=[], failures:number[]=[], start=performance.now()
      const first=await fetch(url), stats=await first.json() as SandboxStats, coldMs=performance.now()-start
      assert.equal(first.status,200); assert.equal(stats.questions,5000); assert.equal(first.headers.get('set-cookie'),null)
      const requests=1000,concurrency=8
      let next=0
      await Promise.all(Array.from({length:concurrency},async()=>{
        while(next++ < requests) {
          const at=performance.now(), response=await fetch(url)
          const body=await response.json() as SandboxStats
          latencies.push(performance.now()-at)
          if(!response.ok || body.questions!==5000 || response.headers.has('set-cookie')) failures.push(response.status)
        }
      }))
      latencies.sort((a,b)=>a-b)
      const includingCold=[coldMs,...latencies].sort((a,b)=>a-b)
      const tables=api.store!.hostedState(db=>Object.fromEntries(['hosted_sessions','hosted_session_mints','admissions'].map(table=>[table,Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n)])))
      const result={node:process.version,scope:'Local HOSTED=1 loopback; 5,000 synthetic metadata runs, no ledger or model calls. One cold refresh reported separately; timed requests use the real 60 s cache. The target is also asserted across all requests including the cold refresh.',requests,totalRequests:requests+1,concurrency,coldMs,p50Ms:latencies[499],p95Ms:latencies[949],p95IncludingColdMs:includingCold[Math.ceil(includingCold.length*.95)-1],p99Ms:latencies[989],maxMs:latencies[999],failures,tables,stats}
      writeFileSync(join(output,'load.json'),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result))
      assert.equal(failures.length,0); assert(result.p95Ms<50); assert(result.p95IncludingColdMs<50); assert(Object.values(tables).every(n=>n===0))
    } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); await api.close() }
  } else if(process.argv[2] === 'visual') {
    const { allocateDemoPorts }=await import('../scripts/demo-ports.mjs')
    const ports=await allocateDemoPorts(), stackDir=join(dir,'hosted')
    const child=scope.spawn(process.execPath,['--import','tsx','tests/helpers/hosted-stack.ts'],{env:{...process.env,HOSTED_WEB_PORT:String(ports.web),HOSTED_API_PORT:String(ports.api),HOSTED_PUBLISHER_PORT:String(ports.pub),HOSTED_STACK_DIR:stackDir}})
    let outputText=''; child.stdout.on('data',c=>outputText+=String(c));child.stderr.on('data',c=>outputText+=String(c))
    const browser=await chromium.launch({headless:true})
    try {
      const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage()
      const origin=`https://localhost:${ports.web}`
      // The existing shared-payer card reads public nodes on home. Keep this synthetic proof entirely local.
      await context.routeWebSocket(/.*/,socket=>socket.close())
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin ? route.continue() : route.abort())
      for(let i=0;i<100;i++) { try{if((await context.request.get(origin+'/livez')).ok())break}catch{/* booting */} await new Promise(r=>setTimeout(r,200)) }
      const { Store }=await import('../server/store.js'),store=new Store(join(stackDir,'app.db'))
      try{seedSandbox(store)}finally{store.close()}
      const evidence=[]
      for(const width of [1280,390]) {
        await page.setViewportSize({width,height:width===390?844:900}); await page.goto(origin)
        await page.getByText('Check our work · recorded run and ledger',{exact:true}).click()
        await page.getByText('Sandbox scoreboard',{exact:true}).click()
        const panel=page.getByRole('region',{name:'Sandbox scoreboard'})
        await panel.getByText('XRPL Testnet · test funds · includes our own test runs since 11 Nov',{exact:true}).waitFor()
        // Visible provenance for synthetic acceptance data; test harness only, never product source.
        await panel.evaluate(node=>{const p=document.createElement('p');p.textContent='LOCAL SYNTHETIC STORE · metadata only · no live ledger or model calls';p.style.fontWeight='600';node.prepend(p)})
        await panel.scrollIntoViewIfNeeded()
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
        const axe=(await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))
        const response=await context.request.get(origin+'/api/demo/stats'),stats=await response.json()
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
        await page.screenshot({path:join(output,`scoreboard-${width}.png`),fullPage:true})
        evidence.push({width,overflow,seriousCritical:axe.map(v=>v.id),stats})
        assert.equal(overflow,false);assert.deepEqual(axe,[])
      }
      writeFileSync(join(output,'layout.json'),JSON.stringify({node:process.version,scope:'Local HOSTED=1 production build; Chromium emulation; synthetic metadata/anchors only; external HTTP/WebSocket reads blocked; no live questions.',evidence},null,2)+'\n')
      console.log(JSON.stringify(evidence.map(({width,overflow,seriousCritical})=>({width,overflow,seriousCritical}))))
      await context.close()
    } catch(error) { console.error(outputText);throw error } finally {await browser.close()}
  } else throw new Error('Expected load or visual')
} finally {await scope.close()}
