import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { request } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Store } from '../server/store.js'
import { createApiApp } from '../server/routes.js'
import { loadConfig } from '../server/config.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { aggregateSandbox, sandboxStatsRouter, SCOREBOARD_LABEL } from '../server/hosted/stats.js'
import { resources } from './helpers/resource-scope.js'
import { seedSandbox } from './helpers/sandbox-seed.js'
import { sourceKey } from '../shared/source-identity.js'
import express from 'express'
const closers: (() => unknown)[] = []
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
function seeded(count = 4) {
  const store = new Store(join(resources().tempDir('p4-'),'store.db'))
  new HostedLimits(store,loadConfig({HOSTED:'1',HOSTED_IP_HMAC_KEY:'test-only-'.repeat(5)}))
  closers.push(() => store.close()); seedSandbox(store,count); return store
}
it('returns exact aggregate values, no questions, identifiers, tokens or private hashes', () => {
  const stats = aggregateSandbox(seeded())
  expect(stats).toMatchObject({label:SCOREBOARD_LABEL,questions:4,purchaseRuns:2,purchasesSettled:2,refunds:1,anchored:4,completed:4,inProgress:0,medianSpendMinor:50,medianModelUsd:.005,timing:{samples:4,medianMs:25000,p90Ms:40000}})
  expect(Object.values(stats.audit).slice(2)).toEqual([0,0,0,0,0,0])
  const payload=JSON.stringify(stats)
  for (const secret of ['PRIVATE_QUESTION_SENTINEL','PRIVATE_HASH_SENTINEL','PRIVATE_IP_SENTINEL','PRIVATE_TOKEN_SENTINEL','synthetic-','intent-','receipt-']) expect(payload).not.toContain(secret)
})
it('detects one synthetic violation of every kind, including an orphan receipt hidden by normal snapshot hydration', () => {
  const store = seeded()
  store.hostedState(db => {
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='GRANT'`).run()
    db.prepare(`DELETE FROM decisions WHERE run_id='synthetic-1'`).run()
    db.prepare(`UPDATE runs SET json=json_set(json,'$.budgetMinor',1) WHERE id='synthetic-0'`).run()
    const i = db.prepare(`SELECT json FROM intents WHERE id='intent-0'`).get()!.json
    db.prepare('INSERT INTO intents VALUES (?,?,?)').run('corrupt-duplicate','synthetic-0',String(i))
    db.prepare('INSERT INTO receipts VALUES (?,?,?)').run('corrupt-duplicate',JSON.stringify({intentId:'orphan',runId:'synthetic-2',amountMinor:1}),'private')
    db.prepare(`UPDATE runs SET json=json_remove(json,'$.ledgerAnchor') WHERE id='synthetic-3'`).run()
  })
  const stats=aggregateSandbox(store)
  for (const value of Object.values(stats.audit).slice(2)) expect(value).toBeGreaterThan(0)
})
it('keeps in-progress, pruned traces, cancelled escrow, excluded simulations and old holds honest', () => {
  const store=seeded()
  store.hostedState(db => {
    db.prepare(`UPDATE runs SET json=json_set(json,'$.phase','SEARCH') WHERE id='synthetic-3'`).run()
  })
  // Separate statements avoid accidentally changing a JSON value twice in one UPDATE.
  store.hostedState(db => {
    db.prepare(`UPDATE runs SET json=json_remove(json,'$.ledgerAnchor') WHERE id='synthetic-3'`).run()
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-2'`).run()
    db.prepare(`UPDATE intents SET json=json_set(json,'$.escrow.state','CANCELLED','$.status','FAILED_NOT_SETTLED') WHERE id='intent-1'`).run()
    db.prepare(`UPDATE runs SET json=json_set(json,'$.labels.settlement','SIMULATED SGD · no real funds') WHERE id='synthetic-0'`).run()
  })
  expect(aggregateSandbox(store)).toMatchObject({questions:3,purchaseRuns:0,purchasesSettled:0,excludedSimulated:1,inProgress:1,anchorPending:1,audit:{unavailable:1,unanchored:0}})
  store.hostedState(db => db.prepare("UPDATE hosted_holds SET created=0,day='2026-11-10'").run())
  expect(aggregateSandbox(store)).toMatchObject({questions:0,medianSpendMinor:null,medianModelUsd:null,timing:{samples:0,medianMs:null,p90Ms:null}})
})
const get = (url: string, method = 'GET') => new Promise<{status:number;headers:Record<string,unknown>;body:string}>(resolve => {
  request(url,{method,headers:{Host:'demo.example'}},res => { let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body})) }).end()
})
it('uses a 60 s cache even across callers and refreshes at expiry', async () => {
  const store=seeded(), now=vi.fn(()=>100000), aggregate=vi.spyOn(store,'hostedState')
  const app=express(); app.use(sandboxStatsRouter(store,now))
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening'); closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/demo/stats`
  const first=await get(url); expect(first.status).toBe(200); expect(first.headers['set-cookie']).toBeUndefined(); expect(first.headers['cache-control']).toBe('public, max-age=60')
  await get(url); now.mockReturnValue(159999); await get(url); expect(aggregate).toHaveBeenCalledTimes(1)
  now.mockReturnValue(160000); await get(url); expect(aggregate).toHaveBeenCalledTimes(2)
  expect((await get(url+'?question=private')).status).toBe(404)
})
it('mints no session or admission through the actual HOSTED=1 app, even while paused', async () => {
  const dir=resources().tempDir('p4-app-'),control=join(dir,'control.json')
  writeFileSync(control,JSON.stringify({admissionsPaused:true,spendingPaused:true,reasonCode:'test',expiresAt:'2026-11-19T16:00:00Z'}))
  const env={HOSTED:'1',HOSTED_ORIGIN:'https://demo.example',HOSTED_TRUSTED_PROXY:'127.0.0.1',HOSTED_IP_HMAC_KEY:'test-only-'.repeat(5),HOSTED_CONTROL_PATH:control,APP_DB:join(dir,'store.db'),SETTLEMENT_RAIL:'simulated',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off'}
  for (const [key,value] of Object.entries(env)) vi.stubEnv(key,value)
  const backend=await createApiApp({dbPath:join(dir,'store.db'),publisherUrl:'http://127.0.0.1:1',hostedReadiness:async()=>false})
  closers.push(()=>backend.close())
  const server=backend.app.listen(0,'127.0.0.1'); await once(server,'listening'); closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/demo/stats`
  seedSandbox(backend.store!)
  for (let n=0;n<3;n++) { const response=await get(url); expect(response.status).toBe(200); expect(response.headers['set-cookie']).toBeUndefined(); expect(JSON.parse(response.body).questions).toBe(4); for (const secret of ['PRIVATE_QUESTION_SENTINEL','PRIVATE_TOKEN_SENTINEL','synthetic-principal']) expect(response.body).not.toContain(secret) }
  const head=await get(url,'HEAD');expect(head.status).toBe(200);expect(head.body).toBe('');expect(head.headers['set-cookie']).toBeUndefined()
  for (const method of ['POST','OPTIONS','PUT','DELETE']) { const response=await get(url,method);expect(response.status).toBe(405);expect(response.headers['set-cookie']).toBeUndefined();expect(response.headers.allow).toBe('GET, HEAD') }
  backend.store!.hostedState(db => { for (const table of ['hosted_sessions','hosted_session_mints','admissions']) expect(Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n)).toBe(0) })
})

it('uses the Start/queue event, not an earlier scope hold, for timing and rejects a BUY with no preceding DECIDE', () => {
  const store=seeded()
  store.hostedState(db => {
    db.prepare('UPDATE hosted_holds SET created=created-120000').run()
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='DECIDE'`).run()
  })
  expect(aggregateSandbox(store)).toMatchObject({timing:{medianMs:25000,p90Ms:40000},audit:{buyWithoutPolicy:1}})
})

it('reads the key-reveal escrow trace and treats an anchor still being written as pending', () => {
  const store=seeded()
  store.hostedState(db => {
    db.prepare(`UPDATE events SET json=json_set(json,'$.type','ESCROW_CREATE') WHERE json_extract(json,'$.type')='PURCHASE'`).run()
    db.prepare(`UPDATE runs SET json=json_remove(json,'$.ledgerAnchor') WHERE id='synthetic-0'`).run()
    db.prepare(`UPDATE hosted_holds SET state='active' WHERE run_id='synthetic-0'`).run()
  })
  expect(aggregateSandbox(store)).toMatchObject({anchorPending:1,audit:{readBeforeGrant:0,buyWithoutPolicy:0,unanchored:0}})
})

it('counts repeated BUY identities once, but permits a same-intent reconciliation observation', () => {
  const store=seeded()
  store.hostedState(db => {
    const add=db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)')
    const e={type:'PURCHASE',at:'2026-11-11T02:00:00Z',data:{intentId:'intent-0'}}
    add.run('synthetic-0',JSON.stringify(e))
  })
  expect(aggregateSandbox(store).audit.duplicateIntent).toBe(0)
  store.hostedState(db => {
    const add=db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)')
    const e={type:'BUY',at:'2026-11-11T02:00:00Z',data:{intentId:'intent-0'}}
    add.run('synthetic-0',JSON.stringify(e)); add.run('synthetic-0',JSON.stringify(e))
  })
  expect(aggregateSandbox(store).audit.duplicateIntent).toBe(1)
})
it('detects a late GRANT even when the final trace contains that grant', () => {
  const store=seeded()
  store.hostedState(db => {
    const row=db.prepare(`SELECT id,json FROM events WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='GRANT'`).get()!
    db.prepare('DELETE FROM events WHERE id=?').run(row.id)
    db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)').run('synthetic-0',String(row.json))
  })
  expect(aggregateSandbox(store).audit.readBeforeGrant).toBe(1)
})
it('rejects a later-round policy pick as authority for an earlier BUY', () => {
  const store=seeded()
  store.hostedState(db => db.prepare(`UPDATE decisions SET json=json_set(json,'$.round',2) WHERE run_id='synthetic-0'`).run())
  expect(aggregateSandbox(store).audit.buyWithoutPolicy).toBe(1)
  store.hostedState(db => {
    db.prepare(`UPDATE decisions SET json=json_set(json,'$.round',1) WHERE run_id='synthetic-0'`).run()
    db.prepare(`INSERT INTO decisions SELECT run_id,0,json_set(json,'$.round',0) FROM decisions WHERE run_id='synthetic-0' AND round=1`).run()
    db.prepare(`UPDATE events SET json=json_set(json,'$.data.round',0) WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='BUY'`).run()
  })
  expect(aggregateSandbox(store).audit.buyWithoutPolicy).toBe(1)
})

it('returns a fixed unavailable response if the store cannot be audited, without exposing exception text', async () => {
  const store=seeded()
  vi.spyOn(store,'hostedState').mockImplementation(()=>{throw new Error('PRIVATE_QUESTION_SENTINEL')})
  const app=express();app.use(sandboxStatsRouter(store))
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');closers.push(()=>new Promise<void>(r=>server.close(()=>r())))
  const reply=await get(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/demo/stats`)
  expect(reply.status).toBe(503);expect(reply.body).not.toContain('PRIVATE_QUESTION_SENTINEL');expect(JSON.parse(reply.body)).toEqual({error:'Sandbox numbers are unavailable.'})
})

it('does not mistake a purchase observation without any BUY trace for policy authority', () => {
  const store=seeded()
  store.hostedState(db => db.prepare(`DELETE FROM events WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='BUY'`).run())
  expect(aggregateSandbox(store).audit.buyWithoutPolicy).toBe(1)
})

it('binds policy authority to the selected writer even when article IDs and versions collide', () => {
  const store=seeded()
  const source={schemaVersion:1 as const,origin:'https://writer-a.invalid',sellerKey:'synthetic-seller-a',profileId:'synthetic',resourceId:'article',version:'1'}
  const select=(chosen:typeof source) => store.hostedState(db => {
    const row=db.prepare("SELECT json FROM decisions WHERE run_id='synthetic-0'").get()!
    const decision=JSON.parse(String(row.json))
    decision.rows[0].candidate={...decision.rows[0].candidate,profileId:chosen.profileId,source:chosen}
    decision.selectedSourceKey=sourceKey(decision.rows[0].candidate)
    db.prepare("UPDATE decisions SET json=? WHERE run_id='synthetic-0'").run(JSON.stringify(decision))
  })
  store.hostedState(db => db.prepare("UPDATE intents SET json=json_set(json,'$.source',json(?)) WHERE id='intent-0'").run(JSON.stringify(source)))
  select(source)
  expect(aggregateSandbox(store).audit.buyWithoutPolicy).toBe(0)
  select({...source,origin:'https://writer-b.invalid',sellerKey:'synthetic-seller-b',profileId:'other-writer'})
  expect(aggregateSandbox(store).audit).toMatchObject({buyWithoutPolicy:1,readBeforeGrant:0,overBudget:0,duplicateIntent:0,receiptWithoutIntent:0,unanchored:0})
})

// Anchors attest delivered answers and settled money, not abandoned empty runs.
it.each(['STOPPED', 'FAILED'])('separates %s before an answer from missing answer or money anchors', phase => {
  const store = seeded()
  store.hostedState(db => {
    db.prepare(`UPDATE runs SET json=json_remove(json_set(json,'$.phase',?),'$.ledgerAnchor') WHERE id='synthetic-2'`).run(phase)
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-2' AND json_extract(json,'$.type')='DONE'`).run()
  })
  expect(aggregateSandbox(store)).toMatchObject({ stoppedBeforeAnswer: 1, anchorPending: 0, audit: { unanchored: 0 } })
  // A stopped run that already paid still needs an anchor.
  store.hostedState(db => {
    db.prepare(`UPDATE runs SET json=json_remove(json_set(json,'$.phase',?),'$.ledgerAnchor') WHERE id='synthetic-0'`).run(phase)
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='DONE'`).run()
  })
  expect(aggregateSandbox(store)).toMatchObject({ stoppedBeforeAnswer: 1, purchasesSettled: 2, audit: { unanchored: 1 } })
  // Even a free DONE answer needs an anchor.
  store.hostedState(db => db.prepare(`UPDATE runs SET json=json_remove(json,'$.ledgerAnchor') WHERE id='synthetic-3'`).run())
  expect(aggregateSandbox(store)).toMatchObject({ stoppedBeforeAnswer: 1, audit: { unanchored: 2 } })
  // A prior DONE cannot be erased by a subsequent stop/failure.
  store.hostedState(db => db.prepare(`UPDATE runs SET json=json_set(json,'$.phase',?) WHERE id='synthetic-3'`).run(phase))
  expect(aggregateSandbox(store)).toMatchObject({ stoppedBeforeAnswer: 1, audit: { unanchored: 2 } })
})
it('never exempts a stopped run with an orphan receipt from a missing money anchor', () => {
  const store = seeded()
  store.hostedState(db => {
    db.prepare(`UPDATE runs SET json=json_remove(json_set(json,'$.phase','STOPPED'),'$.ledgerAnchor') WHERE id='synthetic-2'`).run()
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-2' AND json_extract(json,'$.type')='DONE'`).run()
    db.prepare('UPDATE receipts SET json=? WHERE intent_id=?').run(JSON.stringify({ runId: 'synthetic-2', intentId: 'orphan', amountMinor: 40 }), 'intent-0')
  })
  expect(aggregateSandbox(store)).toMatchObject({ stoppedBeforeAnswer: 0, audit: { unanchored: 1, receiptWithoutIntent: 1 } })
})

it('does not count a cancelled escrow receipt as a settled purchase on a stopped run', () => {
  const store = seeded()
  store.hostedState(db => {
    db.prepare(`UPDATE runs SET json=json_remove(json_set(json,'$.phase','STOPPED'),'$.ledgerAnchor') WHERE id='synthetic-0'`).run()
    db.prepare(`DELETE FROM events WHERE run_id='synthetic-0' AND json_extract(json,'$.type')='DONE'`).run()
    db.prepare(`UPDATE intents SET json=json_set(json,'$.escrow.state','CANCELLED','$.status','FAILED_NOT_SETTLED') WHERE id='intent-0'`).run()
  })
  expect(aggregateSandbox(store)).toMatchObject({ stoppedBeforeAnswer: 1, purchasesSettled: 1, audit: { unanchored: 0 } })
})
