import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import express from 'express'
import { XRPL_LABEL, SIMULATED_LABEL } from '../shared/contracts/index.js'
import { Store } from '../server/store.js'
import { feedSnapshot, publicFeedRouter } from '../server/api/feed.js'
import { resources } from './helpers/resource-scope.js'
import { join } from 'node:path'
const closers: (()=>unknown)[]=[]
afterEach(async()=>{ for(const close of closers.splice(0).reverse()) await close(); vi.restoreAllMocks() })
function seed(validated = true) {
  const store=new Store(join(resources().tempDir('feed-'),'app.db')); closers.push(()=>store.close())
  const run=store.createRun('PRIVATE_QUESTION',100)
  store.hostedState(db=>{
    db.prepare("UPDATE runs SET json=json_set(json,'$.labels.settlement',?,'$.candidates',json(?)) WHERE id=?").run(XRPL_LABEL,JSON.stringify([{resourceId:'article',profileId:'writer',title:'Public title',publisher:'Public writer',facets:['XRPL']}]),run.runId)
    db.prepare('INSERT INTO intents VALUES (?,?,?)').run('intent',run.runId,JSON.stringify({resourceId:'article',profileId:'writer',amountMinor:40,escrow:{mode:'key-reveal',state:'LOCKED',createHash:'A'.repeat(64)}}))
  })
  if (validated) store.recordAudit({runId:run.runId,intentId:'intent',kind:'ESCROW_CREATE',at:'2026-11-12T10:00:00.000Z',data:{txHash:'A'.repeat(64),ledgerIndex:123}})
  return {store,run}
}
it('projects creation, completion, key mismatches and unavailable legacy checks without claiming an unchecked pass',()=>{
  const {store}=seed()
  expect(feedSnapshot(store).rows[0]).toMatchObject({resourceTitle:'Public title',writer:'Public writer',topic:'Agent payments',priceMinor:40,keyCheck:'pending',gate:'pending',createLedger:123,finishHash:null})
  store.recordAudit({intentId:'intent',kind:'ESCROW_FINISH',at:'2026-11-12T10:00:04.000Z',data:{txHash:'B'.repeat(64)}})
  const update=(escrow:object)=>store.hostedState(db=>db.prepare("UPDATE intents SET json=json_set(json,'$.escrow',json(?))").run(JSON.stringify({mode:'key-reveal',state:'RELEASED',createHash:'A'.repeat(64),finishHash:'B'.repeat(64),proofOk:true,keyVerified:true,decryptVerified:true,...escrow})))
  update({});expect(feedSnapshot(store).rows[0]).toMatchObject({state:'finished',keyCheck:'match',gate:'verified',settlementSeconds:4,finishHash:'B'.repeat(64)})
  update({decryptVerified:false});expect(feedSnapshot(store).rows[0]).toMatchObject({keyCheck:'match',gate:'failed'})
  update({keyVerified:false});expect(feedSnapshot(store).rows[0]).toMatchObject({keyCheck:'mismatch',gate:'failed'})
  update({mode:'payment'});expect(feedSnapshot(store).rows[0]).toMatchObject({keyCheck:'unavailable',gate:'unavailable'})
})
const privateFields=['question','questionText','body','spans','contents','premiumBytes','seed','walletSeed','secret','privateKey','apiKey','token','deliveryToken','ip','ipAddress','principal','reveal','txBlob','salt']
it.each(privateFields)('never publishes private field %s from any retained record',field=>{
  const {store}=seed(), sentinel=`PRIVATE_${field}_SENTINEL`
  store.hostedState(db=>{
    for(const table of ['runs','intents']) db.prepare(`UPDATE ${table} SET json=json_set(json,?,?)`).run(`$.${field}`,sentinel)
    db.prepare("INSERT INTO audit_log(at,prev_hash,hash,run_id,intent_id,surface,principal,kind,data) VALUES (?,?,?,?,?,?,?,?,?)").run('2026-11-12T10:00:00.000Z','',sentinel,null,'intent','web','private','ESCROW_CREATE',JSON.stringify({txHash:'A'.repeat(64),ledgerIndex:123,[field]:sentinel}))
    db.prepare("UPDATE intents SET json=json_set(json,?,?)").run(`$.escrow.${field}`,sentinel)
  })
  const serialized=JSON.stringify(feedSnapshot(store));expect(serialized).not.toContain(sentinel);expect(serialized).not.toContain('PRIVATE_QUESTION')
})
it('rejects signed-only escrows and caps the requested snapshot',()=>{
  const {store}=seed();expect(feedSnapshot(store,10000).rows).toHaveLength(1)
  const unsigned=seed(false);expect(feedSnapshot(unsigned.store).rows).toEqual([])
})
async function server() {
  const {store}=seed(), now=vi.fn(()=>1000), feed=publicFeedRouter(store,now), app=express();app.use(feed.router)
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>{feed.close();server.close(()=>r())}))
  return {store,now,url:`http://127.0.0.1:${(server.address() as {port:number}).port}`}
}
it('caches JSON across callers, rejects excess fields and rate limits SSE admission',async()=>{
  const {store,now,url}=await server(), spy=vi.spyOn(store,'hostedState')
  const first=await fetch(url+'/api/feed');expect(first.headers.get('cache-control')).toBe('public, max-age=2');expect(first.headers.get('set-cookie')).toBeNull();expect(first.headers.get('vary')).toContain('Accept')
  await fetch(url+'/api/feed');expect(spy).toHaveBeenCalledTimes(1)
  now.mockReturnValue(3001);await fetch(url+'/api/feed');expect(spy).toHaveBeenCalledTimes(2)
  expect((await fetch(url+'/api/feed?question=private')).status).toBe(400)
  for(let n=0;n<57;n++)await fetch(url+'/api/feed')
  expect((await fetch(url+'/api/feed',{headers:{Accept:'text/event-stream'}})).status).toBe(429)
})
it('streams public snapshots uncached and closes connections on shutdown',async()=>{
  const {url}=await server(), controller=new AbortController()
  const response=await fetch(url+'/api/feed',{headers:{Accept:'text/event-stream'},signal:controller.signal})
  expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('content-type')).toContain('text/event-stream')
  const reader=response.body!.getReader(), first=await reader.read(), text=new TextDecoder().decode(first.value)
  expect(text).toContain('event: snapshot');expect(text).not.toContain('PRIVATE_QUESTION');controller.abort();await reader.cancel().catch(()=>{})
})
it('loads only strict public exports and rejects a raw/private receipt payload',async()=>{
  const { PublicFeedExportSchema }=await import('../shared/public-feed.js')
  const { readFileSync }=await import('node:fs')
  const fixture=JSON.parse(readFileSync('tests/fixtures/public-feed.json','utf8'))
  expect(PublicFeedExportSchema.parse(fixture).rows).toHaveLength(1)
  for(const field of privateFields) expect(PublicFeedExportSchema.safeParse({...fixture,rows:[{...fixture.rows[0],[field]:'PRIVATE'}]}).success).toBe(false)
  expect(PublicFeedExportSchema.safeParse({receipts:[{question:'private'}]}).success).toBe(false)
})
it('publishes no session or admission through the opt-in hosted route',async()=>{
  const { createApiApp }=await import('../server/routes.js'), { seedSandbox }=await import('./helpers/sandbox-seed.js')
  const dir=resources().tempDir('feed-hosted-')
  const env={PUBLIC_FEED:'1',HOSTED:'1',HOSTED_ORIGIN:'https://demo.example',HOSTED_TRUSTED_PROXY:'127.0.0.1',HOSTED_IP_HMAC_KEY:'fixture-key-'.repeat(5),SETTLEMENT_RAIL:'simulated',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off'}
  for(const [key,value] of Object.entries(env))vi.stubEnv(key,value)
  closers.push(()=>vi.unstubAllEnvs())
  const backend=await createApiApp({dbPath:join(dir,'app.db'),publisherUrl:'http://127.0.0.1:1',hostedReadiness:async()=>false});closers.push(()=>backend.close())
  seedSandbox(backend.store!)
  const server=backend.app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
  const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/feed`)
  expect(response.status).toBe(200);expect(response.headers.get('set-cookie')).toBeNull()
  backend.store!.hostedState(db=>{expect(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get()!.n).toBe(0);expect(db.prepare('SELECT count(*) AS n FROM admissions').get()!.n).toBe(0)})
})
it('updates an open stream from created escrow to finished payment with a matching key',async()=>{
  const {store,now,url}=await server(), controller=new AbortController()
  const response=await fetch(url+'/api/feed',{headers:{Accept:'text/event-stream'},signal:controller.signal}), reader=response.body!.getReader()
  try {
    const initial=new TextDecoder().decode((await reader.read()).value);expect(initial).toContain('"state":"locked"');expect(initial).toContain('"keyCheck":"pending"')
    store.recordAudit({intentId:'intent',kind:'ESCROW_FINISH',at:'2026-11-12T10:00:04.000Z',data:{txHash:'B'.repeat(64)}})
    store.hostedState(db=>db.prepare("UPDATE intents SET json=json_set(json,'$.escrow.state','RELEASED','$.escrow.finishHash',?,'$.escrow.keyVerified',json('true'),'$.escrow.decryptVerified',json('true'),'$.escrow.proofOk',json('true'))").run('B'.repeat(64)))
    now.mockReturnValue(3001)
    const updated=new TextDecoder().decode((await reader.read()).value);expect(updated).toContain('"state":"finished"');expect(updated).toContain('"keyCheck":"match"');expect(updated).toContain('"settlementSeconds":4');expect(updated).not.toContain('PRIVATE_QUESTION')
  } finally {controller.abort();await reader.cancel().catch(()=>{})}
})

it('does not promote a signed finish hash without a matching terminal audit observation',()=>{
  const {store}=seed()
  store.hostedState(db=>db.prepare("UPDATE intents SET json=json_set(json,'$.escrow.state','RELEASED','$.escrow.finishHash',?,'$.escrow.keyVerified',json('true'),'$.escrow.decryptVerified',json('true'),'$.escrow.proofOk',json('true'))").run('B'.repeat(64)))
  expect(feedSnapshot(store).rows[0]).toMatchObject({state:'locked',finishHash:null,settlementSeconds:null,gate:'pending'})
})

it('publishes only the saved whole-run rating on purchase rows',()=>{
  const {store,run}=seed()
  store.hostedState(db=>db.prepare('INSERT INTO answer_ratings VALUES (?,?,?)').run(run.runId,1,new Date().toISOString()))
  expect(feedSnapshot(store).rows[0].rating).toBe(true)
})

it('does not let signed-only attempts evict validated purchases from a bounded snapshot',()=>{
  const {store,run}=seed()
  store.hostedState(db=>{for(let n=0;n<101;n++)db.prepare('INSERT INTO intents VALUES (?,?,?)').run('signed-'+n,run.runId,JSON.stringify({resourceId:'article',profileId:'writer',amountMinor:40,escrow:{mode:'key-reveal',state:'SIGNED',createHash:'B'.repeat(64)}}))})
  expect(feedSnapshot(store,1).rows).toHaveLength(1)
  expect(feedSnapshot(store,1).rows[0].createHash).toBe('A'.repeat(64))
})

it('keeps colliding publisher-local article metadata bound to the recorded source',()=>{
 const {store,run}=seed()
 const source=(origin:string)=>({schemaVersion:1,origin,sellerKey:origin,profileId:'writer',resourceId:'article',version:'v1'})
 const first={resourceId:'article',profileId:'writer',version:'v1',title:'Wrong public article',publisher:'Wrong writer',source:source('https://first.example')}
 const second={...first,title:'Correct public article',publisher:'Correct writer',source:source('https://second.example')}
 store.hostedState(db=>{
  db.prepare("UPDATE runs SET json=json_set(json,'$.candidates',json(?)) WHERE id=?").run(JSON.stringify([first,second]),run.runId)
  db.prepare("UPDATE intents SET json=json_set(json,'$.source',json(?),'$.version','v1')").run(JSON.stringify(second.source))
 })
 expect(feedSnapshot(store).rows[0]).toMatchObject({resourceTitle:'Correct public article',writer:'Correct writer'})
 store.hostedState(db=>db.prepare("UPDATE intents SET json=json_remove(json,'$.source')").run())
 expect(feedSnapshot(store).rows[0]).toMatchObject({resourceTitle:'Article title unavailable',writer:'Writer unavailable'})
})

it('excludes simulated and unlabelled runs from the Testnet feed',()=>{
 const {store}=seed();expect(feedSnapshot(store).rows).toHaveLength(1)
 store.hostedState(db=>db.prepare("UPDATE runs SET json=json_set(json,'$.labels.settlement',?)").run(SIMULATED_LABEL))
 expect(feedSnapshot(store).rows).toEqual([])
 store.hostedState(db=>db.prepare("UPDATE runs SET json=json_remove(json,'$.labels.settlement')").run())
 expect(feedSnapshot(store).rows).toEqual([])
})
