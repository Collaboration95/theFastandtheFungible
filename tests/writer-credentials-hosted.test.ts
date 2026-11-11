import { once } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { writerVerification } from '../server/writer-credentials.js'
import { TESTNET_QUESTIONS } from '../shared/contracts/examples.js'

// Local HOSTED=1 search path, simulated writer signatures and controlled RPC latency.
// No model calls, admission, paid delivery, real Testnet traffic or cloud access.
it('keeps all three hosted preset searches below 300 ms across forced expiry', async () => {
 vi.stubEnv('HOSTED','1')
 vi.stubEnv('WRITER_CREDENTIAL_ISSUERS','')
 const app=createPublisherApp({journal:':memory:',rail:'simulated',env:{SEARCH_EMBEDDINGS:'off'}})
 await app.locals.ready; await app.locals.writersReady
 const server=app.listen(0,'127.0.0.1'); await once(server,'listening')
 const baseUrl=`http://127.0.0.1:${(server.address() as {port:number}).port}`
 const client=new PublisherClient({baseUrl})
 const transport=globalThis.fetch, realNow=Date.now.bind(Date)
 let clockOffset=0, delay=0, domain=''
 const issuer='rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', hash='A'.repeat(64)
 vi.spyOn(Date,'now').mockImplementation(()=>realNow()+clockOffset)
 vi.spyOn(globalThis,'fetch').mockImplementation(async (url,init) => {
  if (String(url).startsWith(baseUrl)) return transport(url,init)
  if (delay) await new Promise(resolve=>setTimeout(resolve,delay))
  const {method,params:[p]}=JSON.parse(String(init?.body))
  const result=method==='server_info' ? {info:{network_id:1}} : method==='ledger' ? {validated:true,ledger_index:123,ledger_hash:hash,ledger:{close_time:Math.floor(Date.now()/1000)-946684800}}
   : p.index ? {validated:true,ledger_hash:hash,index:domain,node:{LedgerEntryType:'PermissionedDomain',AcceptedCredentials:[{Credential:{Issuer:issuer,CredentialType:'AB'}}]}}
   : {validated:true,ledger_hash:hash,index:hash,node:{LedgerEntryType:'Credential',Subject:p.credential.subject,Issuer:issuer,CredentialType:'AB',Flags:65536}}
  return new Response(JSON.stringify({result}))
 })
 try {
  const roster=(await client.registry()).filter(p=>['team-xrpl-explainers','team-builder-notes'].includes(p.slug))
  const results=[]
  for (const [index,preset] of TESTNET_QUESTIONS.entries()) {
   domain=String(index+1).repeat(64); vi.stubEnv('WRITER_CREDENTIAL_DOMAIN',domain)
   delay=0
   const search=async()=> (await Promise.all(roster.map(p=>client.searchPublisher(p.slug,preset.text,5)))).flat()
   const warm=await search()
   expect(warm.some(h=>h.verification?.status==='verified')).toBe(true)
   // Force expiry without accelerating HTTP/RPC deadlines or changing production TTL.
   delay=750; clockOffset+=300_001
   const samples=[]
   for(let n=0;n<5;n++) {
    const start=performance.now(), hits=await search()
    samples.push(performance.now()-start)
    expect(hits.filter(h=>h.tier==='PAID').every(h=>h.verification?.status==='verified')).toBe(true)
   }
   samples.sort((a,b)=>a-b)
   results.push({preset:preset.id,p95Ms:Number(samples[Math.ceil(samples.length*.95)-1].toFixed(2)),maxMs:Number(samples.at(-1)!.toFixed(2)),samples:5})
   await new Promise(resolve=>setTimeout(resolve,3500)) // drain background work before changing the mock/config
  }
  console.log('X2b local HOSTED=1, synthetic 750 ms/RPC, search-only:',JSON.stringify(results))
  expect(results.every(r=>r.maxMs<300)).toBe(true)
 } finally {
  vi.stubEnv('WRITER_CREDENTIAL_DOMAIN',''); await writerVerification(issuer) // dispose the configured refresh timers
  vi.restoreAllMocks(); vi.unstubAllEnvs(); server.closeAllConnections()
  await new Promise<void>(resolve=>server.close(()=>resolve())); app.locals.journal.close()
 }
}, 60_000)
