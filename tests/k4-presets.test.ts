import { afterAll, beforeAll, expect, it } from 'vitest'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PublisherClient } from '../server/publisher-client.js'
import { PurchaseManager } from '../server/purchases.js'
import { RunLoop } from '../server/agents/loop.js'
import { fixturePlan, freezeRequirements } from '../server/agents/scope.js'
import { TESTNET_QUESTIONS } from '../shared/contracts/examples.js'
let app: ReturnType<typeof createPublisherApp>, server: ReturnType<ReturnType<typeof createPublisherApp>['listen']>, store: Store, loop: RunLoop
beforeAll(async()=>{
 app=createPublisherApp({journal:':memory:',rail:'simulated',env:{}})
 await app.locals.ready;await app.locals.writersReady
 server=app.listen(0,'127.0.0.1');await once(server,'listening')
 store=new Store(':memory:')
 const client=new PublisherClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`})
 loop=new RunLoop(store,client,new PurchaseManager(store,client))
})
afterAll(async()=>{store?.close();if(server){server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()))}app?.locals.journal.close()})
it.each(TESTNET_QUESTIONS)('$label leads with its requested fact',async q=>{
 const run=store.createRun(q.text,200),plan=fixturePlan(q.text)
 store.updateRun(run.runId,{checkpoint:{plan,...freezeRequirements(q.text,plan)}})
 await loop.start(run.runId)
 const result=store.getRun(run.runId),answer=result.answers.at(-1)!
 expect(result.phase).toBe('DONE')
 const lead=answer.lead?.map(l=>l.text).join(' ')
 expect(lead).toMatchSnapshot(q.id)
 expect(lead?.split(/\s+/).length).toBeLessThanOrEqual(40)
 if(q.id==='XRPL1') expect(answer.lead?.[0].text).toContain('AllowTrustLineLocking')
 if(q.id==='XRPL2') expect(answer.lead?.[0].text).toMatch(/PAYMENT-REQUIRED|PAYMENT-SIGNATURE/)
 if(q.id==='XRPL3') {
  expect(result.intents.filter(i=>i.status==='VERIFIED').map(i=>i.resourceId)).toEqual(['product-writer-paid'])
  expect(result.spentMinor).toBe(40)
  expect(lead).toMatch(/publishing.*key on the XRP Ledger.*escrow/)
  expect(lead).toContain('cannot read the article unless the writer is paid')
 }
 expect(answer.openGaps.every(g=>result.checkpoint.requirements?.some(r=>r.text===g.text))).toBe(true)
})
