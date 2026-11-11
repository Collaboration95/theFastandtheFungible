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
async function setup(cap = '200', publisherUrl = 'http://127.0.0.1:1') {
  vi.stubEnv('HOSTED_QUESTION_CAP_MINOR',cap)
  const dir=resources().tempDir('hg-access-')
  for(const [k,v] of Object.entries({HOSTED:'1',HOSTED_ORIGIN:'https://demo.example',HOSTED_TRUSTED_PROXY:'127.0.0.2',HOSTED_IP_HMAC_KEY:'a'.repeat(32),HOSTED_CONTROL_PATH:join(dir,'control.json'),SETTLEMENT_RAIL:'simulated',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',DEMO_PORT_OFFSET:'2600'})) vi.stubEnv(k,v)
  writeFileSync(process.env.HOSTED_CONTROL_PATH!,JSON.stringify({admissionsPaused:false,spendingPaused:false,reasonCode:'test_ready',expiresAt:'2026-11-19T16:00:00Z'}))
  const api=await createApiApp({dbPath:join(dir,'app.db'),publisherUrl,hostedReadiness:async()=>true})
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
  for(let i=0;i<7;i++) { const id=seed(a,`history-${i}`); limits.store.hostedState(db=>db.prepare("UPDATE hosted_holds SET day='2026-11-01',started_day='2026-11-01',ip='' WHERE run_id=?").run(id)) }
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

it('exposes and reserves a configured cap below 200 for scope and submit',async()=>{
  const {url,a,b,limits}=await setup('100')
  expect((await wire(url+'/api/demo/status','GET',a)).json().questionCapMinor).toBe(100)
  const headers={...a,'Idempotency-Key':'small-cap'}
  const scoped=await wire(url+'/api/scope','POST',headers,{question:'What is XRPL?'})
  expect(scoped.status).toBe(200)
  const principal=limits.session(a.Cookie.split('=')[1]).principal
  expect(limits.existing(principal,'small-cap','scope',{question:'What is XRPL?'})?.minor).toBe(100)
  expect((await wire(url+'/runs','POST',{...b,'Idempotency-Key':'over-cap'},{question:'What is XRPL?',budgetMinor:200})).status).toBe(400)
  expect((await wire(url+'/runs','POST',headers,{question:'What is XRPL?',budgetMinor:200})).status).toBe(409)
  expect((await wire(url+'/runs','POST',headers,{question:'What is XRPL?',budgetMinor:100})).status).toBe(201)
})
it('keeps zero cap authoritative',async()=>{
  const {url,a}=await setup('0')
  expect((await wire(url+'/api/demo/status','GET',a)).json().questionCapMinor).toBe(0)
  expect((await wire(url+'/api/scope','POST',{...a,'Idempotency-Key':'zero'},{question:'What is XRPL?'})).status).toBe(200)
})
it('writer reads cannot tunnel to private data, purchases or state changes and are rate limited',async()=>{
  const {url,a,b,seed}=await setup(), id=seed(a,'writer-path')
  for(const path of [`/w/team-builder-notes/runs/${id}`, '/w/team-builder-notes/articles/secret','/w/team-builder-notes/search','/w/team-builder-notes/facilitator/supported','/w/__faults','/w/team-builder-notes/about?run='+id,'/w/team-builder-notes/%2e%2e/api/runs']) expect((await wire(url+path,'GET',b)).status,path).toBe(404)
  expect((await wire(url+'/w/team-builder-notes','POST',b,{})).status).toBe(404)
  for(let i=0;i<120;i++) expect((await wire(url+'/api/writers/earnings','GET',b)).status).toBe(200)
  expect((await wire(url+'/api/writers/earnings','GET',b)).status).toBe(429)
})
it('earnings expose only confirmed sales and trust from the caller, without raw intent or premium data',async()=>{
  const {url,a,b,seed,store}=await setup(), id=seed(a,'earnings')
  const corpus=await import('../publisher/corpus.js').then(m=>m.loadWriterCorpus())
  const article=corpus.articles.find(a=>a.tier==='PAID')!
  store.updateRun(id,{labels:{...store.getRun(id).labels,settlement:'XRPL TESTNET · no real value'}})
  const hash='A'.repeat(64)
  const intent={runId:id,intentId:'private-intent',profileId:article.publisherSlug,resourceId:article.articleId,version:article.version,amountMinor:article.priceMinor,status:'VERIFIED',escrow:{scheme:'escrow-v1',policy:'escrow-policy-v1',owner:'rOwner',cancelAfter:1,finishHash:hash,revealLedger:123,state:'RELEASED'},refund:{txHash:'B'.repeat(64),amountMinor:article.priceMinor}}
  store.hostedState(db=>db.prepare('INSERT INTO intents VALUES (?,?,?)').run(intent.intentId,id,JSON.stringify(intent)))
  const mine=await wire(url+'/api/writers/earnings','GET',a),foreign=await wire(url+'/api/writers/earnings','GET',b)
  expect(mine.text).toContain(hash);expect(foreign.text).not.toContain(hash)
  expect(mine.text).not.toContain('private-intent');expect(mine.text).not.toContain(article.body);expect(mine.text).not.toContain('Private question')
  expect(foreign.text).not.toContain(article.body)
  // R9-C (H9-15): every visitor sees the demo-wide count of confirmed sales, as a number only; another visitor's sale
  // stays out of their own purchases and its hash, intent and question never leak.
  const card=(text:string)=>(JSON.parse(text) as {writers:{publisherSlug:string;demoSales?:number;sales:unknown[]}[]}).writers.find(w=>w.publisherSlug===article.publisherSlug)!
  expect(card(foreign.text)).toMatchObject({demoSales:1,sales:[]});expect(card(mine.text)).toMatchObject({demoSales:1})
  expect(foreign.text).not.toContain('private-intent');expect(foreign.text).not.toContain('Private question')
})
it('serves public writer HTML and metadata without premium bytes through the real hosted gateway',async()=>{
  const {serve}=await import('./site-serve.js')
  const {miniCorpus}=await import('./fixtures/corpus-mini/index.js')
  const publisherUrl=await serve(miniCorpus)
  const {url,b}=await setup('200',publisherUrl)
  const paid=miniCorpus.articles.find(a=>a.tier==='PAID')!
  for(const path of [`/w/${paid.publisherSlug}`,`/w/${paid.publisherSlug}/about`,`/w/${paid.publisherSlug}/blog/${paid.articleId}`,`/w/${paid.publisherSlug}/.well-known/agent-publisher.json`]) {
    const response=await wire(url+path,'GET',b)
    expect(response.status,path).toBe(200)
    expect(response.text).not.toContain(paid.body)
    for(const passage of paid.passages) expect(response.text).not.toContain(passage.text)
    expect(response.text).not.toContain('privateKey');expect(response.text).not.toContain('secret')
  }
})

it('H5: a settled run answers 204, a visitor’s newest stream replaces the oldest, and status names the fixture buyer and fills public links',async()=>{
  const {url,a,seed,store}=await setup()
  /** Opens an SSE request and reports its status and whether the server ended it. */
  const open=(id:string)=>new Promise<{status:number; ended:Promise<void>; req:import('node:http').ClientRequest}>((resolve,reject)=>{
    const req=http(`${url}/runs/${id}/events`,{headers:{Host:'demo.example',Cookie:a.Cookie}},res=>{const ended=new Promise<void>(done=>{res.on('end',done);res.on('close',done)});res.resume();resolve({status:res.statusCode!,ended,req})})
    req.on('error',reject);req.end();cleanup.push(()=>req.destroy())
  })
  // Live: an unanchored run still has a ledger record coming, so it streams.
  const live=seed(a,'live')
  const first=await open(live), second=await open(live), third=await open(live)
  expect([first.status,second.status,third.status]).toEqual([200,200,200])
  await first.ended // closed tabs behind the proxies used to hold this slot, so the third stream got 429 stream_limit
  // Settled: payments final and the anchor recorded. EventSource stops on 204 and the client reads the run once.
  const settled=seed(a,'settled')
  store.updateRun(settled,{ledgerAnchor:{version:'anchor-v1',network:'xrpl:1',head:'a'.repeat(64),runIdHash:'b'.repeat(64),account:'rNY14qvMuBi6CqU4wPbWaS5nztPLCxJTFn',txHash:'C'.repeat(64),ledgerIndex:1,feeDrops:'12'}})
  expect((await wire(`${url}/runs/${settled}/events`,'GET',{Cookie:a.Cookie})).status).toBe(204)
  const status=(await wire(url+'/api/demo/status','GET',{Cookie:a.Cookie})).json<{labels:{models:string};links:Record<string,string>}>()
  expect(status.labels.models).toBe('fixture models')
  expect(status.links).toMatchObject({deck:expect.stringMatching(/^https:\/\/github\.com\/.+deck\.pdf$/),progress:expect.stringMatching(/\/progress\/$/),replay:expect.stringMatching(/\/demo\/$/)})
})

it('keeps all five questions after planning or cancelling, and uses exactly one when Start creates a run', async () => {
  const { url, a } = await setup(), headers = { ...a, 'Idempotency-Key': 'cancel-then-start' }
  const question = 'How does XRP Ledger escrow work?'
  expect((await wire(url + '/api/scope', 'POST', headers, { question, clarify: 'never' })).status).toBe(200)
  // Closing the 5 s modal makes no Start call. Reopening a cached plan is also free.
  expect((await wire(url + '/api/demo/status', 'GET', a)).json<{ remaining: { questions: number } }>().remaining.questions).toBe(5)
  expect((await wire(url + '/api/scope', 'POST', headers, { question, clarify: 'never' })).status).toBe(200)
  const body = { question, budgetMinor: 0 }
  const first = await wire(url + '/runs', 'POST', headers, body)
  expect(first.status).toBe(201)
  expect((await wire(url + '/api/demo/status', 'GET', a)).json<{ remaining: { questions: number } }>().remaining.questions).toBe(4)
  const retry = await wire(url + '/runs', 'POST', headers, body)
  expect(retry.json().runId).toBe(first.json().runId)
  expect((await wire(url + '/api/demo/status', 'GET', a)).json<{ remaining: { questions: number } }>().remaining.questions).toBe(4)
})

it('does not use a daily question when admission fails before creating a run', async () => {
  const { url, a, store } = await setup(), headers = { ...a, 'Idempotency-Key': 'failed-admission' }, body = { question: 'How does XRPL escrow work?', budgetMinor: 0 }
  const admit = vi.spyOn(store, 'admit').mockImplementationOnce(() => { throw new Error('test admission failure') })
  expect((await wire(url + '/runs', 'POST', headers, body)).status).toBe(500)
  expect((await wire(url + '/api/demo/status', 'GET', a)).json<{ remaining: { questions: number } }>().remaining.questions).toBe(5)
  admit.mockRestore()
  expect((await wire(url + '/runs', 'POST', headers, body)).status).toBe(201)
  expect((await wire(url + '/api/demo/status', 'GET', a)).json<{ remaining: { questions: number } }>().remaining.questions).toBe(4)
})

it('a fresh hosted visitor sees three team identities from the credential cache, without a run', async () => {
  const { createPublisherApp } = await import('../publisher/routes.js')
  const credentials = await import('../server/writer-credentials.js')
  const publisher = createPublisherApp({journal:':memory:',rail:'simulated',env:{}})
  await publisher.locals.writersReady
  const server = publisher.listen(0,'127.0.0.1'); await once(server,'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); publisher.locals.journal.close() })
  vi.stubEnv('WRITER_CREDENTIAL_DOMAIN','D0B5DB2A87E03E375B3CF519B2323971C9E4D0300D31F93F8EAA927F0680B998')
  const check = vi.spyOn(credentials,'writerVerification').mockResolvedValue({status:'verified',issuerLabel:'ResearchAgent operator',issuer:'rnFqpNSS2rcDoFe72cwneSzwZAhoxqduqr',credentialType:'AB',credentialId:'A'.repeat(64),ledgerIndex:123,checkedAt:new Date().toISOString()})
  const {url,a} = await setup('200',`http://127.0.0.1:${(server.address() as {port:number}).port}`)
  expect((await wire(url+'/api/runs','GET',a)).json()).toEqual([])
  const body = (await wire(url+'/api/writers/earnings','GET',a)).json<{writers:{publisherSlug:string;authorship:string;synthetic:boolean;verification:{status:string};sales:unknown[];trust:unknown[]}[]}>()
  const team = body.writers.filter(w => w.authorship === 'Team-authored')
  expect(team.map(w=>w.publisherSlug)).toEqual(['open-records','team-builder-notes','team-xrpl-explainers'])
  expect(team.every(w=>w.verification.status==='verified' && !w.sales.length && !w.trust.length)).toBe(true)
  expect(team.find(w=>w.publisherSlug==='open-records')?.synthetic).toBe(true)
  expect(body.writers.filter(w=>w.authorship==='Fictional writer').every(w=>w.verification.status==='unverified')).toBe(true)
  expect(check).toHaveBeenCalledTimes(3)
  expect(JSON.stringify(body)).not.toMatch(/"body"|"passages"|"identityManifest"|"sig"/)
  const status = (await wire(url+'/api/writers/status','GET',a)).json<{publishers:{credential:{status:string}}[]}>()
  expect(status.publishers.filter(p=>p.credential.status==='verified')).toHaveLength(3)
})
