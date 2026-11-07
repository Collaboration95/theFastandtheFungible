import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { declineSummary } from '../shared/decline'
import { leadFinding } from '../shared/lead-finding'
import { offlineZeroBudgetRun } from '../src/fixtures/run'
import Answer from '../src/components/Answer'
import RunActivity from '../src/components/RunActivity'
it('ranks an exact header answer above provenance and incidental numeric prose', () => {
 const claim = { id:'paid', stance:'UNCERTAIN' as const, citations:[{resourceId:'team-x402',version:'v2',spanId:'p1'}], text:'The implementation record explains x402 headers in 2026. PAYMENT-REQUIRED carries the x402 challenge; PAYMENT-SIGNATURE carries the payment proof; PAYMENT-RESPONSE carries settlement information.' }
 expect(leadFinding('What x402 headers does an XRPL buyer send?', [claim])[0].text).toContain('PAYMENT-REQUIRED')
})
it('shows three decision reasons and distinguishes declined candidates from no match', () => {
 const candidate = offlineZeroBudgetRun.candidates[0]
 const rows = [1,2,3].map(n => ({...offlineZeroBudgetRun.decisions[0].rows[0],candidate:{...candidate,tier:'PAID' as const,resourceId:`tickets-${n}`},value:0.159,verdict:'SKIP_LOW_VALUE' as const,reason:`Ticket reason ${n}`}))
 const run = {...offlineZeroBudgetRun,phase:'DONE' as const,answers:[],candidates:rows.map(r=>r.candidate),decisions:[{...offlineZeroBudgetRun.decisions[0],threshold:0.2,rows}]}
 expect(declineSummary(run)).toBe('Found 3 paid articles; none cleared the value threshold (best 0.16 vs 0.20)')
 const html=renderToStaticMarkup(<Answer run={run} view="latest" onView={()=>{}} compare={false} onCompare={()=>{}} />)
 for(const n of [1,2,3]) expect(html).toContain(`Ticket reason ${n}`)
 expect(html).not.toContain('No listed writer')
 expect(declineSummary({...run,candidates:[]})).toContain('No listed writer')
})
it('includes pre-draft elapsed time instead of displaying zero seconds', () => {
 const run={...offlineZeroBudgetRun,phase:'DONE' as const,events:[{id:1,runId:'elapsed',type:'FREE_DRAFT',label:'draft',at:'2026-11-07T00:00:03Z',data:{elapsedMs:3000}},{id:2,runId:'elapsed',type:'DONE',label:'done',at:'2026-11-07T00:00:05Z'}]}
 expect(renderToStaticMarkup(<RunActivity run={run} onStop={()=>{}} stopping={false} onShowWork={()=>{}} />)).toContain('5.0 s')
})
