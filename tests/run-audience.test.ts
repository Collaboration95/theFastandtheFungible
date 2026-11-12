import { afterEach, expect, it, vi } from 'vitest'
import express from 'express'
import { once } from 'node:events'
import { Store } from '../server/store.js'
import { aggregateSandbox } from '../server/hosted/stats.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { audienceMiddleware, operatorSessionRouter, runAudience } from '../server/hosted/audience.js'
import { maskSecrets } from '../server/telemetry.js'
import { loadConfig } from '../server/config.js'
import { seedSandbox } from './helpers/sandbox-seed.js'
import { resources } from './helpers/resource-scope.js'
import { join } from 'node:path'
const closers:(()=>unknown)[]=[]
afterEach(async()=>{for(const close of closers.splice(0).reverse())await close();vi.unstubAllEnvs()})
function setup(){const store=new Store(join(resources().tempDir('audience-'),'app.db'));closers.push(()=>store.close());new HostedLimits(store,loadConfig({HOSTED:'1',HOSTED_IP_HMAC_KEY:'fixture-key-'.repeat(5)}));return store}
it('keeps old runs unclassified, separates external totals, and retains every audit counter',()=>{
 const store=setup();seedSandbox(store)
 expect(aggregateSandbox(store)).toMatchObject({all:{questions:4},external:{questions:0},unclassified:4})
 store.hostedState(db=>{db.prepare('INSERT INTO run_audience VALUES (?,?)').run('synthetic-0','external');db.prepare('INSERT INTO run_audience VALUES (?,?)').run('synthetic-1','internal')})
 const stats=aggregateSandbox(store)
 expect(stats).toMatchObject({questions:4,all:{questions:4,purchasesSettled:2},external:{questions:1,purchasesSettled:1},unclassified:2})
 for(const population of [stats.all,stats.external]){expect(Object.keys(population.audit)).toHaveLength(8);expect(population.stoppedBeforeAnswer).toBe(0)}
})
it('defaults local scripts to internal and persists explicit browser context across restart',()=>{
 const store=setup();const local=store.createRun('private',0), external=runAudience.run('external',()=>store.createRun('private2',0))
 const reopened=new Store(store.path);try{reopened.hostedState(db=>{expect(db.prepare('SELECT audience FROM run_audience WHERE run_id=?').get(local.runId)?.audience).toBe('internal');expect(db.prepare('SELECT audience FROM run_audience WHERE run_id=?').get(external.runId)?.audience).toBe('external')})}finally{reopened.close()}
})
it('authenticates operator cookies and direct tokens without exposing the token or trusting spoofed headers',async()=>{
 const config=loadConfig({HOSTED:'1',AUDIENCE_COUNTS:'1',HOSTED_ORIGIN:'https://demo.example',OPERATOR_TOKEN:'fixture-operator-only-token'}), app=express()
 expect(maskSecrets('error '+config.OPERATOR_TOKEN,config)).not.toContain(config.OPERATOR_TOKEN)
 app.use(operatorSessionRouter(config));app.use(audienceMiddleware(config));app.post('/classify',(_req,res)=>res.json({audience:runAudience.getStore()}))
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`, headers={Origin:'https://demo.example','Sec-Fetch-Site':'same-origin'}
 expect(await (await fetch(url+'/classify',{method:'POST',headers})).json()).toEqual({audience:'external'})
 expect(await (await fetch(url+'/classify',{method:'POST',headers:{...headers,'X-Internal':'true'}})).json()).toEqual({audience:'external'})
 expect((await fetch(url+'/api/operator/session',{method:'POST',headers})).status).toBe(401)
 expect((await fetch(url+'/api/operator/session',{method:'POST',headers:{Origin:'https://other.example',Authorization:'Bearer '+config.OPERATOR_TOKEN}})).status).toBe(403)
 const response=await fetch(url+'/api/operator/session',{method:'POST',headers:{...headers,Authorization:'Bearer '+config.OPERATOR_TOKEN}})
 expect(response.status).toBe(200);expect(await response.text()).not.toContain(config.OPERATOR_TOKEN)
 const cookie=response.headers.get('set-cookie')!;expect(cookie).toContain('HttpOnly');expect(cookie).toContain('Secure');expect(cookie).not.toContain(config.OPERATOR_TOKEN)
 expect(await (await fetch(url+'/classify',{method:'POST',headers:{...headers,Cookie:cookie.split(';')[0]}})).json()).toEqual({audience:'internal'})
 expect(await (await fetch(url+'/classify',{method:'POST',headers:{...headers,Authorization:'Bearer '+config.OPERATOR_TOKEN}})).json()).toEqual({audience:'internal'})
 expect(await (await fetch(url+'/classify',{method:'POST',headers:{...headers,Cookie:cookie.split(';')[0]+'tampered'}})).json()).toEqual({audience:'external'})
})
it('keeps hosted visitors unclassified until audience attribution is enabled',async()=>{
 const store=setup(), app=express(), config=loadConfig({HOSTED:'1',AUDIENCE_COUNTS:'0'})
 app.use(audienceMiddleware(config));app.post('/classify',(_req,res)=>{
  const run=store.createRun('private visitor question',0)
  store.hostedState(db=>res.json({classified:!!db.prepare('SELECT audience FROM run_audience WHERE run_id=?').get(run.runId)}))
 })
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`
 expect(await (await fetch(url+'/classify',{method:'POST',headers:{Origin:'https://demo.example'}})).json()).toEqual({classified:false})
})
