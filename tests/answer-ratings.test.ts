import { afterEach, expect, it, vi } from 'vitest'
import { Store } from '../server/store.js'
import { aggregateSandbox } from '../server/hosted/stats.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { seedSandbox } from './helpers/sandbox-seed.js'
import { resources } from './helpers/resource-scope.js'
import { join } from 'node:path'
import express from 'express'
import { once } from 'node:events'
import { answerRatingsRouter } from '../server/api/answer-ratings.js'
const closers:(()=>unknown)[]=[]
afterEach(async()=>{for(const close of closers.splice(0).reverse())await close();vi.unstubAllEnvs()})
function setup(){const store=new Store(join(resources().tempDir('rating-'),'app.db'));closers.push(()=>store.close());new HostedLimits(store,loadConfig({HOSTED:'1',HOSTED_IP_HMAC_KEY:'fixture-key-'.repeat(5)}));seedSandbox(store);store.hostedState(db=>{for(const n of [0,1,2])db.prepare('INSERT INTO answers VALUES (?,?,?)').run('synthetic-'+n,1,JSON.stringify({claims:[{}]}))});return store}
it('stores one durable vote per paid answer, rejects free/unfinished answers and aggregates by population',()=>{
 const store=setup();expect(store.canRateAnswer('synthetic-2')).toBe(false);expect(()=>store.rateAnswer('synthetic-2',true)).toThrow()
 expect(store.rateAnswer('synthetic-0',true)).toBe(true);expect(store.rateAnswer('synthetic-0',false)).toBe(true)
 expect(store.rateAnswer('synthetic-1',false)).toBe(false)
 store.hostedState(db=>db.prepare('INSERT INTO run_audience VALUES (?,?)').run('synthetic-0','external'))
 expect(aggregateSandbox(store)).toMatchObject({rating:{rated:2,yes:1,yesPercent:50},external:{rating:{rated:1,yes:1,yesPercent:100}}})
 store.hostedState(db=>db.prepare("UPDATE runs SET json=json_set(json,'$.phase','SEARCH') WHERE id='synthetic-1'").run());expect(store.canRateAnswer('synthetic-1')).toBe(false)
})
it('keeps votes after closing and reopening the database',()=>{
 const store=setup(), path=store.path;store.rateAnswer('synthetic-0',false)
 const reopened=new Store(path);try{expect(reopened.answerRating('synthetic-0')).toBe(false)}finally{reopened.close()}
})
it('validates votes, keeps the first vote on conflicts, and rate limits requests',async()=>{
 const store=setup(), app=express();app.use(express.json());app.use(answerRatingsRouter(store))
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/runs/synthetic-0/rating`, post=(body:unknown)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 expect((await post({yes:'yes'})).status).toBe(400);expect((await post({yes:true,question:'private'})).status).toBe(400)
 expect((await post({yes:true})).status).toBe(200);expect((await post({yes:false})).status).toBe(409)
 for(let n=0;n<26;n++)await fetch(url)
 expect((await post({yes:true})).status).toBe(429)
})
it('keeps another visitor out of both rating reads and writes using the hosted run guard',async()=>{
 const { accessGuard }=await import('../server/hosted/session.js')
 const store=setup(), limits=new HostedLimits(store,loadConfig({HOSTED:'1',HOSTED_IP_HMAC_KEY:'fixture-key-'.repeat(5)})), app=express()
 store.hostedState(db=>{db.prepare("UPDATE hosted_holds SET created=? WHERE run_id='synthetic-0'").run(Date.now());db.prepare('INSERT INTO admissions VALUES (?,?,?,?,?,?,?,?)').run('rating-test','web','synthetic-principal','synthetic-0',200,200,'2026-11-12','fixture')})
 app.use((req,res,next)=>{res.locals.hostedSession={principal:req.get('X-Test-Visitor')??'another-visitor'};next()});app.use(express.json());app.use(accessGuard(limits));app.use(answerRatingsRouter(store))
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/runs/synthetic-0/rating`
 expect((await fetch(url)).status).toBe(404);expect((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({yes:true})})).status).toBe(404);expect(store.answerRating('synthetic-0')).toBeNull()
 expect((await fetch(url,{headers:{'X-Test-Visitor':'synthetic-principal'}})).status).toBe(200)
 expect((await fetch(url,{method:'POST',headers:{'X-Test-Visitor':'synthetic-principal','Content-Type':'application/json'},body:JSON.stringify({yes:true})})).status).toBe(200)
 expect(store.answerRating('synthetic-0')).toBe(true)
})

it.each(['0','1'])('advertises rating capability through the existing health endpoint only when enabled=%s',async(enabled)=>{
 for(const [key,value] of Object.entries({HOSTED:'0',SETTLEMENT_RAIL:'simulated',ANSWER_RATINGS:enabled,ANCHOR_RAIL:'off',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off'}))vi.stubEnv(key,value)
 const {createApiApp}=await import('../server/routes.js')
 const backend=await createApiApp({dbPath:join(resources().tempDir('rating-health-'),'app.db'),publisherUrl:'http://127.0.0.1:1'});closers.push(()=>backend.close())
 const server=backend.app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
 const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/health`)
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({answerRatings:enabled==='1'})
})
