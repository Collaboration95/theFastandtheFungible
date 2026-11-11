import { CredentialIssuerSchema } from '../shared/writer-verification.js'
import { once } from 'node:events'
import { describe, it, expect, vi } from 'vitest'
import { WriterCredentials } from '../server/writer-credentials.js'
import { WriterVerificationSchema } from '../shared/writer-verification.js'
import { publicCandidate } from '../server/agents/decision.js'
const subject = 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf'
const issuer = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
const trusted = [{ issuer, credentialType: 'AB', label: 'Trusted operator' }]
const hash = 'A'.repeat(64)
const node = {LedgerEntryType:'Credential',Subject:subject,Issuer:issuer,CredentialType:'AB',Flags:65536}
function rpc(change: Record<string, unknown> = {}, mode = '') {
 return vi.fn(async (req: Record<string, unknown>) => {
  if(mode === 'timeout') await new Promise(r=>setTimeout(r,30))
  if(mode === 'oversized') return {result:{junk:'a'.repeat(17000)}}
  if(req.command==='server_info') return {result:{info:{network_id:mode==='network'?0:1}}}
  if(req.command==='ledger') return {result:{validated:true,ledger_index:123,ledger_hash:hash,ledger:{close_time:Math.floor(Date.now()/1000)-946684800}}}
  if(mode === 'missing') return {result:{error:'entryNotFound'}}
  return {result:{validated:true,ledger_hash:hash,index:hash,node:{...node,...change}}}
 })
}
describe('XRPL writer credentials',()=>{
 it('accepts only a trusted, accepted, bound credential',async()=>{
  const v=await new WriterCredentials(trusted,rpc()).check(subject)
  expect(v).toMatchObject({status:'verified',issuerLabel:'Trusted operator',ledgerIndex:123})
 })
 for(const [name,change,mode] of [
  ['missing',{},'missing'],['unaccepted',{Flags:0},''],['expired',{Expiration:1},''],
  ['wrong issuer',{Issuer:subject},''],['wrong type',{CredentialType:'AC'},''],['wrong subject',{Subject:issuer},''],
  ['wrong network',{},'network'],['timeout',{},'timeout'],['malformed',{Flags:'65536'},''],['oversized',{},'oversized'],
  ['impersonated label',{Issuer:subject,label:'Trusted operator'},''],
 ] as [string,Record<string,unknown>,string][]) it(name,async()=>{
  expect((await new WriterCredentials(trusted,rpc(change,mode),5).check(subject)).status).not.toBe('verified')
 })
 it('makes no RPC with no trusted issuers and maps historical labels',async()=>{
  const request=rpc();expect(await new WriterCredentials([],request).check(subject)).toEqual({status:'unverified'});expect(request).not.toHaveBeenCalled()
  expect(WriterVerificationSchema.parse('unverified writer')).toEqual({status:'unverified'})
 })
 it('shares wallet observations across origins and caches checks',async()=>{
  const request=rpc(), verifier=new WriterCredentials(trusted,request)
  const origins=['http://127.0.0.1:1234','http://127.0.0.1:2345']
  const values=await Promise.all(origins.map(async origin=>({origin,verification:await verifier.check(subject)})))
  expect(values[0].verification).toEqual(values[1].verification);expect(request).toHaveBeenCalledTimes(3)
  expect(request.mock.calls.map(c=>c[0].command)).toEqual(['server_info','ledger','ledger_entry'])
 })
 it('strips identity observations before decision models and policy inputs',async()=>{
  const c={profileId:'p',resourceId:'a',version:'v1',title:'T',publisher:'P',preview:'preview',price:{amountMinor:10,currency:'SGD'},family:'f',facets:[],authority:1,tier:'PAID',license:{kind:'SYNTHETIC',attribution:'P'}}
  const v=await new WriterCredentials(trusted,rpc()).check(subject)
  expect(publicCandidate({...c,verification:v})).toEqual(publicCandidate(c))
 })
})
it('bounds parallel ledger work to two requests',async()=>{
 let active=0,maximum=0
 const base=rpc()
 const request=async (req:Record<string,unknown>)=>{active++;maximum=Math.max(maximum,active);try{await new Promise(r=>setTimeout(r,2));return await base(req)}finally{active--}}
 const verifiers=Array.from({length:6},()=>new WriterCredentials(trusted,request))
 const results=await Promise.all(verifiers.map(v=>v.check(subject)))
 expect(results.every(v=>v.status==='verified')).toBe(true);expect(maximum).toBe(2)
})
it('shows identical verification for a real signer on two publisher origins',async()=>{
 const {createPublisherApp}=await import('../publisher/routes.js')
 const {PublisherClient}=await import('../server/publisher-client.js')
 const {alphaLeakCorpus}=await import('./fixtures/corpus-mini/index.js')
 const app=createPublisherApp({writers:alphaLeakCorpus,journal:':memory:',rail:'simulated',env:{}})
 await app.locals.ready;await app.locals.writersReady
 const servers=[app.listen(0,'127.0.0.1'),app.listen(0,'127.0.0.1')]
 await Promise.all(servers.map(s=>once(s,'listening')))
 const transport=globalThis.fetch
 vi.stubEnv('WRITER_CREDENTIAL_ISSUERS',JSON.stringify(trusted))
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
  if(String(url).startsWith('http://127.0.0.1:')) return transport(url,init)
  const req=JSON.parse(String(init?.body));const params=req.params[0]
  const request=rpc(params.credential?{Subject:params.credential.subject}:{})
  return new Response(JSON.stringify(await request({command:req.method})))
 })
 try {
  const results=[]
  for(const s of servers) {
   const client=new PublisherClient({baseUrl:`http://127.0.0.1:${(s.address() as {port:number}).port}`,federated:true})
   const registry=await client.registry();const p=registry.find(p=>p.slug==='alphaleak')!
   expect(registry.every(p=>p.verification?.status==='unverified')).toBe(true)
   const freePublisher=alphaLeakCorpus.articles.find(a=>a.tier==='FREE')!.publisherSlug
   const free=(await client.searchPublisher(freePublisher,'Kestrel',5)).find(h=>h.tier==='FREE')
   expect(free).toBeDefined()
   expect(free!.verification?.status).toBe('unverified')
   await client.readFree(free!,freePublisher)
   expect(free!.verification?.status).toBe('verified')
   const hits=await client.searchPublisher(p.slug,'Kestrel lead times',5)
   expect(hits.length).toBeGreaterThan(0);results.push(hits[0])
  }
  expect(results[0].source?.origin).not.toBe(results[1].source?.origin)
  expect(results[0].verification?.status).toBe('verified')
  expect(results[0].verification).toEqual(results[1].verification)
 } finally {
  vi.restoreAllMocks();vi.unstubAllEnvs()
  await Promise.all(servers.map(s=>new Promise<void>(r=>s.close(()=>r()))));app.locals.journal.close()
 }
})

it('normalizes public text issuer types and rejects conflicting or oversized types', () => {
 const text = 'ResearchAgent-writer-2026-11-03'
 const wire = Buffer.from(text, 'utf8').toString('hex').toUpperCase()
 expect(CredentialIssuerSchema.parse({issuer, label:'Trusted', credentialTypeText:text}).credentialType).toBe(wire)
 expect(CredentialIssuerSchema.parse({issuer, label:'Trusted', credentialType:wire.toLowerCase()}).credentialType).toBe(wire)
 expect(CredentialIssuerSchema.safeParse({issuer, label:'Trusted', credentialType:'AB', credentialTypeText:text}).success).toBe(false)
 expect(CredentialIssuerSchema.safeParse({issuer, label:'Trusted', credentialTypeText:'x'.repeat(65)}).success).toBe(false)
})

const domainId = 'D'.repeat(64)
const domainNode = { LedgerEntryType: 'PermissionedDomain', AcceptedCredentials: [{ Credential: { Issuer: issuer, CredentialType: 'AB' } }] }
function domainRpc(domain: unknown = domainNode, change: Record<string, unknown> = {}) {
 const base = rpc(change)
 return vi.fn(async (req: Record<string, unknown>) => req.index ? { result: { validated: true, ledger_hash: hash, index: domainId, node: domain } } : base(req))
}
describe('Permissioned Domain writer identity', () => {
 it('pins domain and credential to the same validated ledger and exposes public links', async () => {
  const request = domainRpc(domainNode, { PreviousTxnID: 'B'.repeat(64) })
  const value = await new WriterCredentials([], request, 1200, 300_000, domainId).check(subject)
  expect(value).toMatchObject({ status: 'verified', issuerLabel: 'ResearchAgent operator', domainId, credentialTxHash: 'B'.repeat(64) })
  expect(request.mock.calls.filter(([r]) => r.command === 'ledger_entry').every(([r]) => r.ledger_hash === hash)).toBe(true)
 })
 for (const malformed of [null, {}, { ...domainNode, LedgerEntryType: 'AccountRoot' }, { ...domainNode, AcceptedCredentials: [] },
  { ...domainNode, AcceptedCredentials: [{ Credential: { Issuer: 'bad', CredentialType: 'AB' } }] },
  { ...domainNode, AcceptedCredentials: [{ Credential: { Issuer: issuer, CredentialType: 'not-hex' } }] },
  { ...domainNode, AcceptedCredentials: Array(5).fill(domainNode.AcceptedCredentials[0]) },
  { ...domainNode, AcceptedCredentials: Array(2).fill(domainNode.AcceptedCredentials[0]) },
 ]) it(`fails closed for malformed domain ${JSON.stringify(malformed)}`, async () => {
  const request = domainRpc(malformed)
  expect(await new WriterCredentials(trusted, request, 1200, 300_000, domainId).check(subject)).toEqual({ status: 'unverified' })
  expect(request.mock.calls.some(([r]) => r.credential)).toBe(false)
 })
 for (const change of [{ Issuer: subject }, { Flags: 0 }, { Expiration: 1 }, { Flags: '65536' }]) it(`rejects domain credential ${JSON.stringify(change)}`, async () => {
  expect(await new WriterCredentials([], domainRpc(domainNode, change), 1200, 300_000, domainId).check(subject)).toEqual({ status: 'unverified' })
 })
 it('rejects an unvalidated or differently pinned domain response', async () => {
  for (const patch of [{validated:false}, {ledger_hash:'B'.repeat(64)}, {index:hash}]) {
   const base = domainRpc()
   const request = async (req:Record<string, unknown>) => { const r = await base(req); return req.index ? {result:{...r.result,...patch}} : r }
   expect(await new WriterCredentials([], request, 1200, 300_000, domainId).check(subject)).toEqual({status:'unverified'})
  }
 })
 it('shares the domain snapshot across wallets and refreshes one minute before expiry', async () => {
  vi.useFakeTimers()
  try {
   const request = domainRpc(), verifier = new WriterCredentials([], request, 1200, 300_000, domainId)
   expect((await verifier.check(subject)).status).toBe('verified')
   await vi.advanceTimersByTimeAsync(239_000)
   await verifier.check(issuer)
   expect(request.mock.calls.filter(([r]) => r.index)).toHaveLength(1)
   await vi.advanceTimersByTimeAsync(1001)
   await verifier.check(issuer)
   expect(request.mock.calls.filter(([r]) => r.index)).toHaveLength(2)
  } finally { vi.useRealTimers() }
 })
 it('renders exact identity label, credential transaction and domain, and check unavailable', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const { WriterVerification } = await import('../src/components/WriterVerification.js')
  const value = await new WriterCredentials([], domainRpc(domainNode, {PreviousTxnID:'B'.repeat(64)}), 1200, 300_000, domainId).check(subject)
  const html = renderToStaticMarkup(createElement(WriterVerification, {value}))
  expect(html).toContain('XRPL Credential · issued by ResearchAgent operator (Testnet, identity only, not KYC)')
  expect(html).toContain('title="Identity, not quality"')
  expect(html).toContain(`/transactions/${'B'.repeat(64)}`)
  expect(html).toContain(`/ledger_entry/${domainId}`)
  expect(renderToStaticMarkup(createElement(WriterVerification, {value:{status:'check_failed'}}))).toContain('check unavailable')
 })
})

it.each(['issuers only', 'domain only', 'both', 'neither'])('PublisherClient checks identity with %s', async setting => {
 const {createPublisherApp} = await import('../publisher/routes.js')
 const {PublisherClient} = await import('../server/publisher-client.js')
 const app = createPublisherApp({journal:':memory:', rail:'simulated', env:{}})
 await app.locals.ready; await app.locals.writersReady
 const server = app.listen(0, '127.0.0.1'); await once(server,'listening')
 const transport = globalThis.fetch
 vi.stubEnv('WRITER_CREDENTIAL_ISSUERS', setting === 'issuers only' || setting === 'both' ? JSON.stringify(trusted) : '')
 vi.stubEnv('WRITER_CREDENTIAL_DOMAIN', setting === 'domain only' || setting === 'both' ? domainId : '')
 let reads = 0
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init) => {
  if(String(url).startsWith('http://127.0.0.1:')) return transport(url,init)
  reads++
  const req = JSON.parse(String(init?.body)), params = req.params[0]
  if (params.index) return new Response(JSON.stringify({result:{validated:true,ledger_hash:hash,index:domainId,node:domainNode}}))
  return new Response(JSON.stringify(await rpc(params.credential ? {Subject:params.credential.subject} : {})({command:req.method})))
 })
 try {
  const client = new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
  await client.registry()
  const paid = await client.searchPublisher('team-builder-notes','x402',5)
  expect(paid.some(h=>h.tier==='PAID')).toBe(true)
  expect(paid.find(h=>h.tier==='PAID')!.verification?.status).toBe(setting === 'neither' ? 'unverified' : 'verified')
  const free = (await client.searchPublisher('open-records','Kestrel',5)).find(h=>h.tier==='FREE')!
  expect(free).toBeDefined()
  await client.readFree(free,'Open Records')
  expect(free.verification?.status).toBe(setting === 'neither' ? 'unverified' : 'verified')
  expect(reads > 0).toBe(setting !== 'neither')
 } finally {
  vi.restoreAllMocks();vi.unstubAllEnvs();server.closeAllConnections()
  await new Promise<void>(r=>server.close(()=>r()));app.locals.journal.close()
 }
})

it('keeps the operator’s Open Records alongside the other team writers', async () => {
 const { orderWriters } = await import('../src/components/WriterEarnings.js')
 const roster = [
  {name:'Open Records',publisherSlug:'open-records',authorship:'Team-authored',sales:[]},
  {name:'AlphaLeak',publisherSlug:'alphaleak',authorship:'Fictional writer',sales:[]},
  {name:'Build notes',publisherSlug:'team-builder-notes',authorship:'Team-authored',sales:[]},
 ]
 const result=orderWriters(roster,true)
 expect(result.shown.map(w=>w.publisherSlug)).toEqual(['open-records','team-builder-notes'])
 expect(result.demo.map(w=>w.publisherSlug)).toEqual(['alphaleak'])
})
