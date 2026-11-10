import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { once } from 'node:events'
import { request as http } from 'node:http'
import { createApiApp } from '../server/routes.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { resources } from './helpers/resource-scope.js'
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T12:00:00Z')) })
const cleanup: (()=>unknown)[] = []
afterEach(async()=>{ for(const f of cleanup.splice(0).reverse()) await f(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
const wire = (url:string, method='GET', headers:Record<string,string>={}, body?:unknown) => new Promise<{status:number; headers:import('node:http').IncomingHttpHeaders; text:string; json:<T=Record<string,unknown>>()=>T}>((resolve,reject)=>{
  const req=http(url,{method,headers:{Host:'demo.example','Content-Type':'application/json',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,text,json:<T>()=>JSON.parse(text) as T}))});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))
})
async function setup() {
  const dir=resources().tempDir('hg-access-')
  for(const [k,v] of Object.entries({HOSTED:'1',HOSTED_ORIGIN:'https://demo.example',HOSTED_TRUSTED_PROXY:'127.0.0.2',HOSTED_IP_HMAC_KEY:'a'.repeat(32),HOSTED_CONTROL_PATH:join(dir,'control.json'),SETTLEMENT_RAIL:'simulated',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',DEMO_PORT_OFFSET:'1500'})) vi.stubEnv(k,v)
  writeFileSync(process.env.HOSTED_CONTROL_PATH!,JSON.stringify({admissionsPaused:false,spendingPaused:false,reasonCode:'test_ready',expiresAt:'2026-11-19T16:00:00Z'}))
  const api=await createApiApp({dbPath:join(dir,'app.db'),publisherUrl:'http://127.0.0.1:1',hostedReadiness:async()=>true})
  expect(api.store).toBeDefined()
  const server=api.app.listen(0,'127.0.0.1');await once(server,'listening')
  cleanup.push(async()=>{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await api.close()})
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  const jar=async()=>{const r=await wire(url+'/api/demo/status');const cookie=r.headers['set-cookie']![0]; expect(cookie).toContain('__Host-ra_session=');for(const bit of ['Secure','HttpOnly','SameSite=Lax','Path=/','Max-Age=86400']) expect(cookie).toContain(bit);return {Cookie:cookie.split(';')[0],Origin:'https://demo.example','X-CSRF-Token':r.json<{csrfToken:string}>().csrfToken}}
  const a=await jar(),b=await jar()
  const limits=new HostedLimits(api.store,loadConfig())
  const principal=(jar:Record<string,string>)=>limits.session(jar.Cookie.split('=')[1]).principal
  const seed=(jar:Record<string,string>,key:string)=>{const p=principal(jar),h=limits.reserve(p,key,'Private question '+key,'1.2.3.4',0,'submit',{key});const r=api.store.admit({surface:'web',principal:p,question:'Private question '+key,requestedMinor:0,maxMinor:200,idempotencyKey:key}).run;limits.update(h.id,{run_id:r.runId,state:'done'});api.store.updateRun(r.runId,{phase:'DONE'});return r.runId}
  return {url,a,b,seed,store:api.store,limits,api,jar}
}
it('isolates every run, intent, SSE, export and mutation route for independent cookie jars',async()=>{
  const {url,a,b,seed,store}=await setup(),id=seed(a,'a'),other=seed(b,'b')
  for(const [method,path,body] of [
    ['GET',`/runs/${id}`],['GET',`/runs/${id}/events`],['GET',`/runs/${id}/events?lastEventId=1`],['GET',`/runs/${id}/receipts.json`],['GET',`/runs/${id}/report.json`],['GET',`/runs/${id}/report.pdf`],['GET',`/runs/${id}/report.html`],['POST',`/runs/${id}/report`,{}],['POST',`/runs/${id}/stop`,{}],['POST',`/runs/${id}/retry-delivery`,{intentId:'foreign'}],['POST',`/api/runs/${id}/pin`,{pinned:true}],['DELETE',`/api/runs/${id}`],['GET',`/runs/${id}/intents/wrong/key-reveal-proof.json`],['GET',`/runs/${other}/intents/wrong/key-reveal-proof.json`],
  ] as [string,string,unknown?][]) {
    const r=await wire(url+path,method,b,body);expect(r.status,path).toBe(404);expect(r.json()).toEqual({error:'Not found.'});expect(r.headers['cache-control']).toContain('no-store')
  }
  expect((await wire(url+'/api/runs','GET',a)).json<{runId:string}[]>().map(r=>r.runId)).toEqual([id])
  expect((await wire(url+'/api/runs','GET',b)).json<{runId:string}[]>().map(r=>r.runId)).toEqual([other])
  expect((await wire(url+`/runs/${id}`)).status).toBe(404)
  expect((await wire(url+`/runs/${id}`,'GET',{...b,Authorization:'Bearer owner','X-Principal':store.runPrincipal(id)!.principal})).status).toBe(404)
  expect((await wire(url+`/api/runs/${id}`,'DELETE',a)).status).toBe(200)
  expect((await wire(url+`/runs/${id}`,'GET',a)).status).toBe(404)
})
it('lists all own runs beyond the local four-run history default',async()=>{
  const {url,a,seed,limits}=await setup()
  for(let i=0;i<7;i++) { const id=seed(a,`history-${i}`); limits.store.hostedState(db=>db.prepare("UPDATE hosted_holds SET day='2026-11-01',ip='' WHERE run_id=?").run(id)) }
  expect((await wire(url+'/api/runs','GET',a)).json()).toHaveLength(7)
})
it('rejects CSRF, forged origins/hosts/proxy chains, oversized bodies and owner routes',async()=>{
  const {url,a,seed}=await setup(),id=seed(a,'csrf')
  for(const headers of [{...a,'X-CSRF-Token':''},{...a,Origin:''},{...a,Origin:'https://evil.example'},{...a,Host:'evil.example'},{...a,'Sec-Fetch-Site':'cross-site'},{...a,'X-Forwarded-For':'1.1.1.1'},{...a,'X-Forwarded-For':'1.1.1.1, 2.2.2.2'}]) expect((await wire(url+`/runs/${id}/stop`,'POST',headers,{})).status).toBe(403)
  for(const [method,path] of [['POST','/api/reputation/reset'],['POST','/api/settings'],['POST','/api/demo/faults'],['POST','/api/wallet/fund'],['GET','/api/wallet/status'],['GET','/api/audit/receipts'],['GET','/api/mcp/status'],['GET','/api/ledger'],['GET','/api/metrics'],['POST','/api/providers/test'],['GET','/w/__faults'],['POST','/api/verify']]) expect((await wire(url+path,method,a,method==='POST'?{}:undefined)).status,path).toBe(404)
  expect((await wire(url+'/runs','POST',a,{question:'x'.repeat(17000)})).status).toBe(413)
  expect((await wire(url+'/runs','POST',{...a,'Idempotency-Key':'long'},{question:'x'.repeat(2001),budgetMinor:0})).status).toBe(400)
})
it('fails hosted initialization closed and exposes separate process/startup health',async()=>{
  await setup();vi.stubEnv('HOSTED_ORIGIN','')
  const api=await createApiApp({dbPath:':memory:'});const server=api.app.listen(0,'127.0.0.1');await once(server,'listening');cleanup.push(()=>new Promise<void>(done=>{server.closeAllConnections();server.close(()=>done())}))
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  expect((await wire(url+'/livez')).status).toBe(200)
  expect((await wire(url+'/startupz')).status).toBe(503)
  expect((await wire(url+'/readyz')).status).toBe(503)
  expect((await wire(url+'/api/demo/status')).json().state).toBe('paused')
  expect((await wire(url+'/api/reputation/reset','POST',{},{})).status).toBe(503)
})

it('returns one durable run for submit and reconnect, and 409 for changed authorization',async()=>{
  const {url,a}=await setup()
  const headers={...a,'Idempotency-Key':'submit-once'},body={question:'What is XRPL?',budgetMinor:0}
  const first=await wire(url+'/runs','POST',headers,body)
  expect(first.status).toBe(201)
  const id=first.json().runId
  const second=await wire(url+'/runs','POST',headers,body)
  expect(second.status).toBe(200);expect(second.json().runId).toBe(id)
  expect((await wire(url+`/runs/${id}`,'GET',a)).json().runId).toBe(id)
  for(const changed of [{...body,budgetMinor:1},{...body,answers:{fact:'new constraint'}},{...body,escrow:true}]) expect((await wire(url+'/runs','POST',headers,changed)).status).toBe(409)
})
it('keeps learned reputation private even for background proof updates',async()=>{
  const {url,a,b,seed,api}=await setup(),id=seed(a,'trust')
  api.reputation.recordProof({publisherSlug:'writer',wallet:'writer-wallet',outcome:'REFUSED',runId:id})
  expect((await wire(url+'/api/reputation','GET',a)).json().publishers).toHaveLength(1)
  expect((await wire(url+'/api/reputation','GET',b)).json().publishers).toEqual([])
})

it('coalesces simultaneous submits before asynchronous readiness returns',async()=>{
  const {url,a,api}=await setup()
  const start=vi.spyOn(api.loop,'start').mockResolvedValue(undefined)
  const headers={...a,'Idempotency-Key':'concurrent'},body={question:'What is XRPL?',budgetMinor:0}
  const all=await Promise.all(Array.from({length:8},()=>wire(url+'/runs','POST',headers,body)))
  expect(new Set(all.map(r=>r.json().runId)).size).toBe(1)
  expect(all.filter(r=>r.status===201)).toHaveLength(1)
  await new Promise<void>(resolve=>setImmediate(resolve))
  expect(start).toHaveBeenCalledTimes(1)
})

it('binds nested real intent IDs and makes delivery retries durable and idempotent',async()=>{
  const {url,a,b,seed,store,api}=await setup(),id=seed(a,'retry-a'),other=seed(b,'retry-b')
  const intent=(runId:string,intentId:string)=>({runId,intentId,profileId:'writer',resourceId:'article',version:'v1',amountMinor:0,status:'DELIVERY_FAILED'})
  store.hostedState(db=>{ for(const [runId,intentId] of [[id,'intent-a'],[other,'intent-b']]) db.prepare('INSERT INTO intents VALUES (?,?,?)').run(intentId,runId,JSON.stringify(intent(runId,intentId))) })
  for(const [path,body] of [[`/runs/${id}/retry-delivery`,{intentId:'intent-b'}],[`/runs/${other}/retry-delivery`,{intentId:'intent-a'}]] as const) expect((await wire(url+path,'POST',{...a,'Idempotency-Key':'retry'},body)).status).toBe(404)
  expect((await wire(url+`/runs/${id}/intents/intent-b/key-reveal-proof.json`,'GET',a)).status).toBe(404)
  const retry=vi.spyOn(api.loop,'retryDelivery').mockResolvedValue(undefined)
  const headers={...a,'Idempotency-Key':'retry-once'}
  expect((await wire(url+`/runs/${id}/retry-delivery`,'POST',headers,{intentId:'intent-a'})).status).toBe(202)
  expect((await wire(url+`/runs/${id}/retry-delivery`,'POST',headers,{intentId:'intent-a'})).status).toBe(202)
  expect((await wire(url+`/runs/${id}/retry-delivery`,'POST',headers,{intentId:'intent-a',changed:true})).status).toBe(409)
  await new Promise<void>(resolve=>setImmediate(resolve));expect(retry).toHaveBeenCalledTimes(1)
})
