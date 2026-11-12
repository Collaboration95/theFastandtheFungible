import {afterEach,expect,it,vi} from 'vitest'
import ofacSnapshot from '../publisher/publishing/ofac-xrp.json'
import compiledOfacSnapshot from '../publisher/publishing/ofac-xrp.js'
import {screenPayee,screenSanctions} from '../server/payee-screening.js'
import {regulatedWriterRefusal,regulatedBuyerRefusal} from '../publisher/publishing/regulated.js'
import {simulatedKeys} from '../publisher/registry.js'
import {signManifest} from '../shared/manifest.js'
import {Store} from '../server/store.js'
import {PurchaseManager} from '../server/purchases.js'
import {PublisherClient} from '../server/publisher-client.js'
import type {PublicCandidate} from '../shared/contracts/index.js'
import type {WriterVerification} from '../shared/writer-verification.js'
const keys=simulatedKeys('credential-property'),domain='A'.repeat(64)
const manifest=signManifest({schemaVersion:2,publisherSlug:'credential-property',articleId:'note',version:'1',wallet:keys.wallet,pubKey:keys.publicKey,priceMinor:10,root:'B'.repeat(64),leaves:['B'.repeat(64)],claims:[],wordCount:200,publishedAt:new Date().toISOString(),relevance:0.8},keys.privateKey)
const verified:WriterVerification={status:'verified',issuerLabel:'Operator',issuer:keys.wallet,credentialType:'AA',domainId:domain,credentialId:'C'.repeat(64),ledgerIndex:1,checkedAt:new Date().toISOString()}
afterEach(()=>vi.unstubAllEnvs())
it('authenticates the pinned OFAC source projection and fails closed on every malformed form',()=>{
 expect(compiledOfacSnapshot).toEqual(ofacSnapshot)
 expect(screenSanctions('rnXyVQzgxZe7TR1EPzTkGj2jxH4LMJYh66')?.list).toBe('ofac-sdn-xrp')
 expect(screenSanctions(keys.wallet)).toBeUndefined()
 for(const value of [null,[],{}, {addresses:[]},{addresses:[keys.wallet]},'not JSON',{...ofacSnapshot,listDate:'tampered'},{...ofacSnapshot,addresses:[keys.wallet]},{...ofacSnapshot,addresses:[ofacSnapshot.addresses[0].slice(0,-1)+'a']}])expect(screenSanctions(keys.wallet,value)?.refusal).toContain('invalid')
 vi.stubEnv('REGULATED_MODE','on');expect(screenPayee('rnXyVQzgxZe7TR1EPzTkGj2jxH4LMJYh66')?.list).toBe('ofac-sdn-xrp')
})
it('accepts only the actual signed wallet and configured domain, never advisory, pending or failed badges',async()=>{
 const env={REGULATED_MODE:'on',WRITER_CREDENTIAL_DOMAIN:domain}
 for(const status of ['unverified','check_pending','check_failed']as const)expect(await regulatedWriterRefusal(manifest,env,async()=>({status}))).toContain('nothing was charged')
 expect(await regulatedWriterRefusal(manifest,env,async()=>verified)).toBeUndefined()
 expect(await regulatedWriterRefusal({...manifest,wallet:simulatedKeys('other').wallet},env,async()=>verified)).toContain('credential')
 expect(await regulatedWriterRefusal(manifest,{...env,WRITER_CREDENTIAL_DOMAIN:'D'.repeat(64)},async()=>verified)).toContain('credential')
 expect(await regulatedWriterRefusal(manifest,env,async()=>{throw Error('unavailable')})).toContain('credential')
 expect(await regulatedBuyerRefusal(keys.wallet,{PUBLISHER_REGULATED_MODE:'on',WRITER_CREDENTIAL_DOMAIN:domain},async()=>({status:'unverified'}))).toContain('Buyer')
})
it('property: regulated admission is a subset of baseline admission across prices, budgets and credential failures',async()=>{
 let seed=1100,acceptedCases=0,refusedCases=0
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed>>>8}
 for(let n=0;n<256;n++){
   const price=random()%501,budget=random()%501,paused=(random()%5)===0,accepted=(random()%4)===0
   const baseline=!paused&&price>0&&price<=budget
   const varied=signManifest({...manifest,priceMinor:price},keys.privateKey)
   const refusal=await regulatedWriterRefusal(varied,{REGULATED_MODE:'on',WRITER_CREDENTIAL_DOMAIN:domain},async()=>accepted?verified:{status:'unverified'})
   if(accepted){acceptedCases++;expect(refusal).toBeUndefined()}else{refusedCases++;expect(refusal).toBeDefined()}
   const regulated=baseline&&!refusal
   expect(Number(regulated)).toBeLessThanOrEqual(Number(baseline))
   expect(regulated?price:0).toBeLessThanOrEqual(baseline?price:0)
 }
 expect(acceptedCases).toBeGreaterThan(0);expect(refusedCases).toBeGreaterThan(0)
})
it('refuses before quote, reservation or signer access and writes a refusal audit event',async()=>{
 vi.stubEnv('REGULATED_MODE','on');vi.stubEnv('WRITER_CREDENTIAL_DOMAIN','')
 const store=new Store(':memory:')
 try{const run=store.createRun('A credential check',100),client=new PublisherClient();const fetch=vi.spyOn(client,'paidGet').mockRejectedValue(Error('must not fetch'))
 const manager=new PurchaseManager(store,client)
 const candidate={profileId:'credential-property',resourceId:'note',version:'1',tier:'PAID',wallet:keys.wallet,price:{amountMinor:10,currency:'SGD'},manifest}as PublicCandidate
 const result=await manager.purchase({runId:run.runId,candidate,intentId:'refused'})
 expect(result.status).toBe('SKIPPED');expect(fetch).not.toHaveBeenCalled();expect(store.getRun(run.runId).spentMinor).toBe(0);expect(store.getRun(run.runId).grants).toHaveLength(0)
 expect(store.auditEntries().some(e=>e.kind==='refusal'&&e.data.reason===result.error)).toBe(true)
 }finally{store.close()}
})

it('property: the real purchase manager spends no more with regulation across generated budgets, pauses and credential states',async()=>{
  const {createPublisherApp}=await import('../publisher/routes.js'), {markdownCorpus}=await import('../publisher/publishing/markdown.js'), {retrieve}=await import('../server/agents/research.js'), credentials=await import('../server/writer-credentials.js')
  const corpus=await markdownCorpus('examples/writer-starter','property-writer','Property writer'),app=createPublisherApp({writers:corpus,journal:':memory:',rail:'simulated',env:{}})
  await app.locals.ready;const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.listening?r():server.once('listening',r))
  const client=new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address()as {port:number}).port}`})
  const candidate=(await retrieve(client,'Malaysia colocation firm solar electricity')).candidates.find(c=>c.tier==='PAID')!
  expect(candidate).toBeDefined()
  const credentialSpy=vi.spyOn(credentials,'acceptedCredential')
  try{
    let seed=1100,baselineSales=0,regulatedSales=0
    for(let n=0;n<32;n++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0
      const budget=[0,5,10,50,100][seed%5],accepted=(seed%3)===0,paused=(seed%7)===0
      const spent:number[]=[],grants:number[]=[]
      for(const regulated of [false,true]){
        vi.stubEnv('REGULATED_MODE',regulated?'on':'off');vi.stubEnv('WRITER_CREDENTIAL_DOMAIN',domain);vi.stubEnv('SPENDING_PAUSED',paused?'1':'0')
        credentialSpy.mockResolvedValue(accepted?verified:{status:'unverified'})
        const store=new Store(':memory:');try{
          const run=store.createRun('Generated budget probe',budget),manager=new PurchaseManager(store,client)
          const input={runId:run.runId,candidate,intentId:`generated-${n}-${regulated}`}
          await manager.purchase(input);await manager.purchase(input)
          expect(store.getRun(run.runId).receipts.length).toBeLessThanOrEqual(1)
          spent.push(store.getRun(run.runId).spentMinor);grants.push(store.getRun(run.runId).grants.length)
          if(!accepted&&regulated){expect(store.auditEntries().some(e=>e.kind==='refusal')).toBe(true);expect(store.getRun(run.runId).intents[0].status).toBe('SKIPPED')}
        }finally{store.close()}
      }
      if(spent[0]>0)baselineSales++;if(spent[1]>0)regulatedSales++
      expect(spent[1]).toBeLessThanOrEqual(spent[0]);expect(grants[1]).toBeLessThanOrEqual(grants[0]);expect(spent[1]).toBeLessThanOrEqual(budget)
      if(!accepted)expect(spent[1]).toBe(0)
    }
    expect(baselineSales).toBeGreaterThan(0);expect(regulatedSales).toBeGreaterThan(0)
  }finally{credentialSpy.mockRestore();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));app.locals.journal.close();await app.locals.closePublishing()}
})

it('publisher refuses an uncredentialed buyer on quote, paid GET and both facilitator routes, with an audit event each',async()=>{
 const {createPublisherApp}=await import('../publisher/routes.js'),{miniCorpus}=await import('./fixtures/corpus-mini/index.js'),{required,signFor}=await import('./fixtures/x402-payer.js'),{decodeHeader}=await import('../shared/x402.js'),credentials=await import('../server/writer-credentials.js')
 const credentialSpy=vi.spyOn(credentials,'acceptedCredential').mockResolvedValue({status:'unverified'})
 const app=createPublisherApp({writers:miniCorpus,journal:':memory:',rail:'simulated',env:{PUBLISHER_REGULATED_MODE:'on',WRITER_CREDENTIAL_DOMAIN:domain}});await app.locals.ready
 const refusal=vi.spyOn(app.locals.journal,'refusal')
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.listening?r():server.once('listening',r));const base=`http://127.0.0.1:${(server.address()as {port:number}).port}`
 try{
  const article=miniCorpus.articles.find(a=>a.tier==='PAID')!,path=`/w/${article.publisherSlug}/articles/${article.articleId}`
  const quote=required(await fetch(base+path)),signed=signFor(quote.accepts[0]),signature=decodeHeader('PAYMENT-SIGNATURE',signed.header)
  const paid=await fetch(base+path,{headers:{'PAYMENT-SIGNATURE':signed.header}});expect(paid.status).toBe(403);expect(await paid.text()).toContain('nothing was charged')
  for(const action of ['verify','settle'])expect((await fetch(`${base}/w/${article.publisherSlug}/facilitator/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentPayload:signature})})).status).toBe(403)
  expect((await fetch(base+path+'/escrow-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payer:keys.wallet})})).status).toBe(403)
  expect(refusal).toHaveBeenCalledTimes(4);expect(app.locals.journal.settlementByTx(signed.hash)).toBeUndefined()
  credentialSpy.mockResolvedValue(verified)
  const allowed=await fetch(base+path,{headers:{'PAYMENT-SIGNATURE':signed.header}});expect(allowed.status).toBe(200)
  const settlement=app.locals.journal.settlementByTx(signed.hash);expect(settlement).toBeDefined()
  credentialSpy.mockResolvedValue({status:'unverified'})
  expect((await fetch(base+path,{headers:{'PAYMENT-SIGNATURE':signed.header}})).status).toBe(200)
  expect(app.locals.journal.settlementByTx(signed.hash)).toEqual(settlement);expect(refusal).toHaveBeenCalledTimes(4)
 }finally{credentialSpy.mockRestore();refusal.mockRestore();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));app.locals.journal.close();await app.locals.closePublishing()}
})

it.each(['expiry','domain'])('refuses before durable broadcast if admission changes after reservation: %s',kind=>{
 vi.stubEnv('REGULATED_MODE','on');vi.stubEnv('WRITER_CREDENTIAL_DOMAIN',domain)
 const store=new Store(':memory:');let clock:ReturnType<typeof vi.spyOn>|undefined
 try{
  const run=store.createRun('Pre-broadcast fixture',100),intentId='admission-boundary'
  const identity={runId:run.runId,intentId,profileId:manifest.publisherSlug,resourceId:'note',version:'1',amountMinor:10}
  store.reserveIntent({...identity,status:'QUOTED',quote:{...identity,quoteId:intentId,quoteHash:'D'.repeat(64),currency:'SGD',expiresAt:new Date(Date.now()+60000).toISOString(),contentDigest:manifest.root,payment:{rail:'simulated',network:'xrpl:1',asset:'XRP',payTo:keys.wallet,amountDrops:'10000',invoiceId:'D'.repeat(64)}}})
  store.acceptCredentialForIntent(intentId,keys.wallet);expect(store.claimSubmitting(intentId)).toBe(true)
  if(kind==='expiry'){const now=Date.now();clock=vi.spyOn(Date,'now').mockReturnValue(now+11000)}else vi.stubEnv('WRITER_CREDENTIAL_DOMAIN','E'.repeat(64))
  expect(()=>store.recordSubmission(intentId,{txHash:'F'.repeat(64),txBlob:'never-broadcast-fixture',lastLedgerSequence:200})).toThrow('fresh accepted credential')
  expect(store.getSubmission(intentId)).toBeUndefined();expect(store.getRun(run.runId).spentMinor).toBe(0)
  expect(store.auditEntries().some(e=>e.kind==='refusal'&&e.data.stage==='pre-broadcast')).toBe(true);expect(store.auditVerify().ok).toBe(true)
 }finally{clock?.mockRestore();store.close()}
})

it('rejects misspelled regulated configuration instead of normalizing a payment bypass',async()=>{
 const {loadConfig}=await import('../server/config.js')
 for(const name of ['REGULATED_MODE','PUBLISHER_REGULATED_MODE']){
  for(const value of ['ON',' on ','true'])expect(()=>loadConfig({[name]:value})).toThrow(`Invalid configuration: ${name}`)
  for(const value of ['','off','on'])expect(loadConfig({[name]:value})[name]).toBe(value)
 }
})
