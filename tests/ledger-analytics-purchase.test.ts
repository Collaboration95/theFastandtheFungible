import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { payPath } from './fixtures/pay-path.js'
import { ledgerCorpus } from '../publisher/writers/ledger-analytics/catalogue.js'
import { computeReport } from '../publisher/writers/ledger-analytics/reports.js'
import { challenge } from '../server/challenges.js'
const fake=vi.hoisted(()=>({tip:100}))
vi.mock('../publisher/writers/ledger-analytics/read-only.js',async original=>({
  ...await original<typeof import('../publisher/writers/ledger-analytics/read-only.js')>(),
  publicLedger:()=>async(command:string,p:Record<string,unknown>)=>({validated:true,ledger_index:p.ledger_index==='validated'?fake.tip:p.ledger_index,ledger_hash:'A'.repeat(64),ledger:{close_time_iso:'2026-11-12T08:59:59Z'},...(command==='amm_info'?{amm:{account:'rAMM',amount:'1000000',amount2:{value:'12'},trading_fee:100}}:{})}),
}))
vi.mock('../publisher/writers/ledger-analytics/catalogue.js',async original=>({...await original<typeof import('../publisher/writers/ledger-analytics/catalogue.js')>(),refreshReport:async()=>undefined}))
async function setup(stale:boolean) {
  fake.tip=100
  const report=await computeReport('amm',{now:()=>new Date('2026-11-12T09:00:00Z')})
  fake.tip=stale?300:100
  const h=await payPath({writers:{...ledgerCorpus(),articles:[report.article]}})
  return {...h,article:report.article}
}
describe.each(['default','real'])('ledger purchase under %s profile', profile=>{
  beforeEach(()=>vi.stubEnv('CORPUS_PROFILE',profile))
  afterEach(()=>vi.unstubAllEnvs())
it('keeps premium report bytes behind payment and charges one intent once',async()=>{
  const h=await setup(false)
  try {
    const response=await fetch(`${h.base}/w/ledger-analytics/articles/${h.article.articleId}`)
    expect(response.status).toBe(402)
    expect(await response.text()).not.toContain('Computed ledger measurements')
    const candidate=await h.candidate(h.article),run=h.store.createRun('AMM statistics',200)
    const [one,two]=await Promise.all([h.manager.purchase({runId:run.runId,candidate,intentId:'same-report'}),h.manager.purchase({runId:run.runId,candidate,intentId:'same-report'})])
    expect(one.status).toBe('VERIFIED');expect(two.status).toBe('VERIFIED')
    expect(h.store.getRun(run.runId).receipts).toHaveLength(1)
    expect(h.store.getRun(run.runId).contents[0].body).toContain('As of validated ledger 100')
  } finally {await h.close()}
})
it('quarantines a stale signed report and refunds the failed freshness promise',async()=>{
  const h=await setup(true)
  try {
    const run=h.store.createRun('AMM statistics',200),candidate=await h.candidate(h.article)
    const intent=await h.manager.purchase({runId:run.runId,candidate,intentId:'stale-report'})
    expect(intent.status).toBe('CLAIM_FAILED')
    expect(intent.failedClaimIds).toContain('p1:dated-figure')
    expect(h.store.getRun(run.runId).contents).toEqual([])
    expect((await challenge(h.manager,'stale-report')).status).toBe('REFUNDED')
    expect(h.store.getRun(run.runId).contents).toEqual([])
  } finally {await h.close()}
})
it('does not turn a report into budget authorization',async()=>{
  const h=await setup(false)
  try {
    const run=h.store.createRun('AMM statistics',0),candidate=await h.candidate(h.article)
    expect((await h.manager.purchase({runId:run.runId,candidate,intentId:'no-budget'})).status).toBe('SKIPPED')
    expect(h.store.getRun(run.runId).receipts).toEqual([])
  } finally {await h.close()}
})

})
