import { readdirSync } from 'node:fs'
import { once } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { ledgerCorpus } from '../publisher/writers/ledger-analytics/catalogue.js'
import { startLedgerAnalytics, type LedgerAnalyticsService } from '../publisher/writers/ledger-analytics/background.js'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { retrieve } from '../server/agents/research.js'
import { buildRegistry } from '../publisher/registry.js'
import type { ReadLedger } from '../publisher/writers/ledger-analytics/read-only.js'
import { ResourceScope } from '../shared/resource-scope.js'
import { LEDGER_REPORT_POLICY } from '../shared/ledger-report.js'
import { generateSeed } from 'ripple-keypairs'

afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers()})
async function fixture(http=true) {
  const scope=new ResourceScope(),directory=scope.tempDir('ledger-background-')
  vi.stubEnv('LEDGER_REPORT_DIR',directory)
  const state={tip:100,now:Date.parse('2026-11-12T12:00:00Z'),calls:0,failPage:false,gate:undefined as Promise<void>|undefined}
  const read:ReadLedger=async(command,params)=>{
    state.calls++
    const header={validated:true,ledger_index:params?.ledger_index==='validated'?state.tip:params?.ledger_index,ledger_hash:'A'.repeat(64),ledger:{close_time_iso:new Date(state.now-1000).toISOString()}}
    if(command==='account_lines') {await state.gate;if(state.failPage) throw Error('Incomplete fixture scan');return {...header,lines:[]}}
    if(command==='amm_info') return {...header,amm:{account:'rAMM',amount:'1000000',amount2:{value:'12'},trading_fee:100}}
    if(command==='account_info') return {...header,account_data:{Balance:'1000000',Sequence:4,OwnerCount:2}}
    return header
  }
  const options={directory,read:()=>read,accounts:['rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'],now:()=>state.now,staggerMs:0}
  if(!http) {
    const entry=(await buildRegistry(ledgerCorpus(),{rail:'simulated'})).get('ledger-analytics')!
    const service=await startLedgerAnalytics(entry,options)
    return {entry,service,state,directory,close:async()=>{await service.stop();await scope.close()}}
  }
  const app=createPublisherApp({writers:ledgerCorpus(),journal:':memory:',rail:'simulated',env:{},ledgerAnalytics:options})
  await app.locals.ready
  const server=app.listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  return {client:new PublisherClient({baseUrl:base}),base,service:app.locals.ledgerAnalytics as LedgerAnalyticsService,state,directory,close:async()=>{
    await app.locals.ledgerAnalytics.stop();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));app.locals.journal.close();await scope.close()
  }}
}

it('prewarms before the first question, signs topic-specific K and never computes in search',async()=>{
  const h=await fixture()
  try {
    await h.service.prewarmed
    const before=h.state.calls
    const hits=await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)
    expect(hits.some(hit=>hit.family==='ledger-rlusd')).toBe(true)
    expect(hits.find(hit=>hit.family==='ledger-rlusd')!.manifest!.ledgerFreshness?.maxLedgerLag).toBe(256)
    expect(h.state.calls).toBe(before)
    expect(JSON.stringify(hits)).not.toContain('Computed ledger measurements')
    expect(hits.every(hit=>hit.family!=='ledger-escrows')).toBe(true)
    h.state.now+=10_001
    expect(await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).toEqual([])
  } finally {await h.close()}
})

it('omits a topic until complete and retains the last complete snapshot during refresh',async()=>{
  const h=await fixture()
  let release!:()=>void
  h.state.gate=new Promise<void>(resolve=>{release=resolve})
  try {
    const empty=await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)
    expect(empty.filter(hit=>hit.family==='ledger-rlusd')).toEqual([])
    expect((await retrieve(h.client!,'RLUSD supply holders')).unavailable).toEqual([])
    release();await h.service.prewarmed
    const first=(await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).find(hit=>hit.family==='ledger-rlusd')!
    h.state.now+=1000;h.state.tip++
    h.state.gate=new Promise<void>(resolve=>{release=resolve})
    const refreshing=h.service.refresh('rlusd')
    const during=(await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).find(hit=>hit.family==='ledger-rlusd')!
    expect(during.articleId).toBe(first.articleId)
    expect(readdirSync(h.directory)).toHaveLength(3)
    const paywall=await fetch(h.base!+first.url)
    expect(paywall.status).toBe(402)
    expect(await paywall.text()).not.toContain('Computed ledger measurements')
    release();await refreshing
    const after=(await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).find(hit=>hit.family==='ledger-rlusd')!
    expect(after.articleId).not.toBe(first.articleId)
    expect(readdirSync(h.directory).some(name=>name.endsWith('.tmp'))).toBe(false)
    const files=readdirSync(h.directory)
    h.state.failPage=true
    await expect(h.service.refresh('rlusd')).rejects.toThrow('Incomplete fixture scan')
    expect(readdirSync(h.directory)).toEqual(files)
    expect((await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).find(hit=>hit.family==='ledger-rlusd')!.articleId).toBe(after.articleId)
  } finally {release();await h.close()}
})

it('withdraws snapshots beyond K from search and new purchase quotes until refreshed',async()=>{
  const h=await fixture()
  try {
    await h.service.prewarmed
    const first=(await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).find(hit=>hit.family==='ledger-rlusd')!
    h.state.tip+=LEDGER_REPORT_POLICY.rlusd.maxLedgerLag+1
    await h.service.poll()
    expect(await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).toEqual([])
    expect((await fetch(h.base!+first.url)).status).toBe(404)
    h.state.now+=1000;await h.service.refresh('rlusd')
    expect((await h.client!.searchPublisher('ledger-analytics','RLUSD supply holders',5)).some(hit=>hit.family==='ledger-rlusd')).toBe(true)
  } finally {await h.close()}
})

it('keeps concurrent topics searchable and refreshes on the configured periodic schedule',async()=>{
  vi.useFakeTimers()
  const h=await fixture(false)
  try {
    await vi.advanceTimersByTimeAsync(0);await h.service.prewarmed
    expect(h.entry!.index.terms?.size).toBe(3)
    h.state.now+=1000;h.state.tip++
    await Promise.all([h.service.refresh('amm'),h.service.refresh('rlusd')])
    expect(h.entry!.index.terms?.size).toBe(3)
    expect([...h.entry!.index.terms!.keys()].some(id=>id.startsWith('ledger-project-activity-'))).toBe(true)
    const initial=readdirSync(h.directory).length
    h.state.now+=1000;h.state.tip++
    await vi.advanceTimersByTimeAsync(120_000)
    expect(readdirSync(h.directory).length).toBe(initial+2)
    h.state.now+=1000;h.state.tip++
    await vi.advanceTimersByTimeAsync(480_000)
    expect(h.entry!.index.terms?.size).toBe(3)
    expect(readdirSync(h.directory).some(name=>name.startsWith('ledger-escrows-'))).toBe(false)
  } finally {await h.close()}
})

it('prewarms the configured writer account even when its key is not in process.env',async()=>{
  const scope=new ResourceScope(),directory=scope.tempDir('ledger-local-key-')
  vi.stubEnv('LEDGER_REPORT_DIR',directory);vi.stubEnv('LEDGER_PROJECT_ACCOUNTS',undefined)
  const entry=(await buildRegistry(ledgerCorpus(),{rail:'xrpl-testnet',env:{XRPL_PUBLISHER_LEDGER_ANALYTICS_SEED:generateSeed({algorithm:'ed25519'})}})).get('ledger-analytics')!
  const seen:string[]=[]
  const read:ReadLedger=async(command,params)=>{
    const header={validated:true,ledger_index:100,ledger_hash:'A'.repeat(64)}
    if(command==='account_info') {seen.push(String(params?.account));return {...header,account_data:{Balance:'1000000',Sequence:1,OwnerCount:0}}}
    if(command==='account_lines') return {...header,lines:[]}
    if(command==='amm_info') return {...header,amm:{account:'rAMM',amount:'1000000',amount2:{value:'12'},trading_fee:100}}
    return header
  }
  const service=await startLedgerAnalytics(entry,{directory,read:()=>read,staggerMs:0})
  try {
    await service.prewarmed
    expect(seen).toContain(entry.keys!.wallet)
    expect(entry.index.terms?.size).toBe(3)
  } finally {await service.stop();await scope.close()}
})
