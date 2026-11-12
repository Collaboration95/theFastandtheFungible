import { afterEach, expect, it, vi } from 'vitest'
import { PublisherClient } from '../server/publisher-client.js'
import { once } from 'node:events'
import { resources as testResources } from './helpers/resource-scope.js'
import { join } from 'node:path'
import { Wallet } from 'xrpl'
import { entropyToMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { webPublishing, noteCorpus, precheck, NoteInput as NoteSchema, type NoteInput } from '../publisher/publishing/web.js'
import { createPublisherApp } from '../publisher/routes.js'
import { verifyManifestSignature } from '../shared/manifest.js'
import express from 'express'
import { publishingGateway } from '../publisher/publishing/gateway.js'
import { Store } from '../server/store.js'
const resources: (()=>Promise<void>)[]=[]
afterEach(async()=>{for(const close of resources.splice(0).reverse())await close();vi.unstubAllEnvs()})
export const note:NoteInput={ title:'Ledger reserve checklist',body:[
  'A ledger account needs enough balance for its base reserve and every owned object. Before creating an escrow, inspect the validated account information and calculate the reserve using the server reported parameters. Keep a fee allowance separate from the intended payment amount. Never assume that the entire displayed balance is available for a purchase.',
  'An outstanding escrow temporarily locks funds while the buyer checks delivery. Record the owner address and offer sequence together because those fields identify the ledger object. Compare the destination, amount, condition and cancellation time against the quote before signing anything. If any field differs, refuse the purchase and preserve the original evidence.',
  'After submission, a provisional response does not establish settlement. Look up the transaction in a validated ledger and check its metadata result. A lost connection can leave the result uncertain. Retry the same signed transaction instead of creating another intent, since a second signature might produce an additional charge for the same requested article.',
  'When the delivery key appears, verify its condition and the content hash before releasing the decrypted passages to the writer model. Save the finish transaction hash with the receipt so another reader can inspect the evidence. If the publisher never reveals the key, the cancellation path can return the locked principal after the agreed deadline.'
].join('\n\n'),priceMinor:10,topics:['reserve','escrow'],payout:'create'}
async function start(){const root=await testResources().tempDir('ra-web-');const entries=new Map();const env={WEB_PUBLISHING:'on',SETTLEMENT_RAIL:'xrpl-testnet',OPERATOR_TOKEN:'a'.repeat(32)};const publishing=webPublishing({env,file:join(root,'queue.db'),install:e=>entries.set(e.publisher.slug,e),fund:async()=>{}});await publishing.ready;const app=express();app.use(publishing.router);const server=app.listen(0,'127.0.0.1');await once(server,'listening');resources.push(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await publishing.close()});const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;return {base,entries,env,root,publishing}}
const post=(base:string,path:string,body:unknown,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
it('prechecks premium leak, spam, secrets, personal data and length before provisioning',()=>{
  expect(()=>noteCorpus({...note,body:'short'},'community-test',new Date().toISOString())).toThrow('body:')
  for(const body of ['secret: private-value','contact me at writer@example.com','buy now casino','0'.repeat(64)])expect(()=>precheck({...note,body})).toThrow()
  expect(NoteSchema.safeParse({...note,priceMinor:101}).success).toBe(false)
  const secret=Wallet.generate().seed!;expect(()=>precheck({...note,body:note.body+' '+secret})).toThrow('secrets')
  // Generated, unfunded recovery fixtures; never associated with a real wallet.
  for (const bytes of [16,20,24,28,32]) {
    const phrase=entropyToMnemonic(Uint8Array.from({length:bytes},(_,i)=>i),wordlist)
    expect(()=>precheck({...note,body:note.body+'\n\n'+phrase})).toThrow('seed phrases')
    expect(()=>precheck({...note,body:note.body+'\n\n'+phrase.toUpperCase().replaceAll(' ','\n')})).toThrow('seed phrases')
  }
  expect(()=>precheck(note)).not.toThrow()

})
it('persists pending, authenticates operator and status, rejects duplicates, installs a signed searchable entry once',async()=>{
  const {base,entries}=await start();let r=await post(base,'/api/publishing/notes',note);expect(r.status).toBe(202);const n=await r.json();expect(n.state).toBe('pending');expect(JSON.stringify(n)).not.toContain(note.body)
  expect((await fetch(base+`/api/publishing/notes/${n.id}`)).status).toBe(404)
  expect((await post(base,`/api/publishing/operator/${n.id}/approve`,{})).status).toBe(401);expect(entries.size).toBe(0)
  expect((await post(base,'/api/publishing/notes',note)).status).toBe(409)
  r=await post(base,`/api/publishing/operator/${n.id}/approve`,{}, {'X-Operator-Token':'a'.repeat(32)});expect((await r.json()).state).toBe('live');expect(entries.size).toBe(1)
  await post(base,`/api/publishing/operator/${n.id}/approve`,{}, {'X-Operator-Token':'a'.repeat(32)});expect(entries.size).toBe(1)
  const status=await (await fetch(base+`/api/publishing/notes/${n.id}`,{headers:{'X-Publishing-Key':n.key}})).json();expect(status.state).toBe('live');expect(JSON.stringify(status)).not.toMatch(/seed|privateKey|body/)
  const rejected=await(await post(base,'/api/publishing/notes',{...note,body:note.body+' Keep a private offline backup of the original signed receipt.'})).json()
  await post(base,`/api/publishing/operator/${rejected.id}/reject`,{}, {'X-Operator-Token':'a'.repeat(32)})
  expect((await(await fetch(base+'/api/publishing/operator/queue',{headers:{'X-Operator-Token':'a'.repeat(32)}})).json()).notes).toHaveLength(0)
  expect((await(await fetch(base+`/api/publishing/notes/${rejected.id}`,{headers:{'X-Publishing-Key':rejected.key}})).json()).state).toBe('rejected')
})
it('real publisher exposes approved metadata and verified manifest but keeps paid bytes behind 402',async()=>{
  const root=await testResources().tempDir('ra-web-app-')
  const wallet=Wallet.generate(), id='b'.repeat(32),slug=`community-${id}`
  const corpus=noteCorpus({...note,payout:wallet.classicAddress},slug,new Date().toISOString())
  const app=createPublisherApp({writers:corpus,journal:join(root,'publisher.db'),rail:'xrpl-testnet',env:{[`XRPL_PUBLISHER_${slug.toUpperCase().replace(/-/g,'_')}_SEED`]:wallet.seed}});await app.locals.ready
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');resources.push(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await app.locals.closePublishing();app.locals.journal.close();await app.locals.ledger.close?.()})
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  const registry=await (await fetch(base+'/registry')).json();expect(registry.publishers.find((p:{slug:string})=>p.slug===slug)).toMatchObject({synthetic:false})
  vi.stubEnv('CORPUS_PROFILE','real');expect((await new PublisherClient({baseUrl:base}).registry()).find(p=>p.slug===slug)?.synthetic).toBe(false)
  const search=await (await fetch(`${base}/w/${slug}/search?q=reserve&k=5`)).json();expect(search.length).toBe(1);expect(verifyManifestSignature(search[0].manifest)).toBe(true);expect(JSON.stringify(search)).not.toContain(note.body.slice(0,90))
  const paid=await fetch(base+search[0].url);expect(paid.status).toBe(402);expect(await paid.text()).not.toContain(note.body.slice(0,90))
})

it('restores approved entries after restart without creating or funding another account',async()=>{
  const first=await start();const n=await (await post(first.base,'/api/publishing/notes',note)).json()
  await post(first.base,`/api/publishing/operator/${n.id}/approve`,{}, {'X-Operator-Token':'a'.repeat(32)})
  const restored=new Map();let funds=0
  const second=webPublishing({env:first.env,file:join(first.root,'queue.db'),install:e=>restored.set(e.publisher.slug,e),fund:async()=>{funds++}})
  await second.ready;expect(restored.size).toBe(1);expect(funds).toBe(0);await second.close()
})

it('forwards an authenticated moderation queue larger than a status response without opening arbitrary proxy paths',async()=>{
 const target=express(),secret='operator-test-token',notes=Array.from({length:20},(_,id)=>({id,note:{body:'x'.repeat(24000)}}))
 target.get('/api/publishing/operator/queue',(req,res)=>req.get('X-Operator-Token')===secret?res.json({notes}):res.status(401).json({error:'Operator access required.'}))
 async function serve(app:express.Express){const server=app.listen(0,'127.0.0.1');await once(server,'listening');resources.push(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))});return `http://127.0.0.1:${(server.address()as {port:number}).port}`}
 const upstream=await serve(target),store=new Store(':memory:');resources.push(async()=>store.close())
 const app=express();app.use(publishingGateway({WEB_PUBLISHING:'on',PUBLISHER_URL:upstream},store));const base=await serve(app)
 expect((await fetch(base+'/api/publishing/operator/queue')).status).toBe(401)
 const allowed=await fetch(base+'/api/publishing/operator/queue',{headers:{'X-Operator-Token':secret}})
 expect(allowed.status).toBe(200);expect((await allowed.json()).notes).toHaveLength(20)
 expect((await fetch(base+'/api/publishing/arbitrary')).status).toBe(404)
})

it('counts only Testnet receipts paid to this note payout account and subtracts refunds',async()=>{
 const target=express(),wallet=Wallet.generate().classicAddress,slug='community-'+ 'a'.repeat(32),articleId=slug+'-note'
 target.get('/api/publishing/notes/:id',(_req,res)=>res.json({slug,articleId,address:wallet,state:'live'}))
 async function serve(app:express.Express){const server=app.listen(0,'127.0.0.1');await once(server,'listening');resources.push(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))});return `http://127.0.0.1:${(server.address()as {port:number}).port}`}
 const upstream=await serve(target),store=new Store(':memory:');resources.push(async()=>store.close())
 const fixture={profileId:slug,resourceId:articleId,status:'VERIFIED',receiptId:'fixture',settledAt:new Date().toISOString(),amountMinor:10,txHash:'A'.repeat(64),quote:{payment:{rail:'xrpl-testnet',payTo:wallet}}}
 const rows=[{...fixture,refund:{amountMinor:3,txHash:'B'.repeat(64)}},{...fixture,quote:{payment:{rail:'xrpl-testnet',payTo:Wallet.generate().classicAddress}}},{...fixture,quote:{payment:{rail:'simulated',payTo:wallet}}}]
 vi.spyOn(store,'listIntents').mockReturnValue(rows as unknown as ReturnType<Store['listIntents']>)
 const app=express();app.use(publishingGateway({WEB_PUBLISHING:'on',PUBLISHER_URL:upstream},store));const base=await serve(app)
 const status=await(await fetch(base+'/api/publishing/notes/'+ 'a'.repeat(32))).json()
 expect(status).toMatchObject({bought:1,earnedMinor:7,ledger:['A'.repeat(64),'B'.repeat(64)]})
})
