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

it('extracts the lead from the delivered passage even when a model paraphrases its claim', async () => {
 const {exampleContent}=await import('../shared/contracts/examples')
 const text='The x402 headers include PAYMENT-REQUIRED for the challenge and PAYMENT-SIGNATURE for payment proof.'
 const content={...exampleContent,resourceId:'team-x402',version:'v2',body:text,spans:[{id:'p1',text}]}
 const claim={id:'paraphrase',text:'A model says the implementation record explains x402.',stance:'UNCERTAIN' as const,citations:[{resourceId:'team-x402',version:'v2',spanId:'p1'}]}
 const selected=leadFinding('Which x402 headers are used?', [claim], [content])
 expect(selected[0].text).toBe(text)
 expect(selected[0].claim.citations).toEqual(claim.citations)
 expect(leadFinding('Which x402 headers are used?', [claim], [])).toEqual([])
})

it('selects a lone Unclear sentence once and retains its stance on the lead', async () => {
 const { remainingClaims } = await import('../shared/lead-finding')
 const claim = { id:'only', stance:'UNCERTAIN' as const, text:'The x402 headers carry the challenge and payment proof.', citations:[{resourceId:'headers',version:'v1',spanId:'p1'}] }
 const lead = leadFinding('Which x402 headers carry payment proof?', [claim])
 expect(lead).toHaveLength(1)
 expect(lead[0].claim.stance).toBe('UNCERTAIN')
 expect(remainingClaims('Which x402 headers carry payment proof?', [claim], lead)).toEqual([])
 expect(remainingClaims('Which x402 headers carry payment proof?', [claim], [])).toEqual([claim])
 const { exampleRun } = await import('../shared/contracts/examples')
 const run = structuredClone(exampleRun)
 run.question = 'Which x402 headers carry payment proof?'
 const content = run.contents[0]
 content.body = claim.text
 content.spans = [{ id: 'p1', text: claim.text }]
 run.answers = [{ ...run.answers[0], claims: [{ ...claim, citations: [{ resourceId: content.resourceId, version: content.version, spanId: 'p1' }] }] }]
 const html = renderToStaticMarkup(<Answer run={run} view="latest" onView={()=>{}} compare={false} onCompare={()=>{}} />)
 expect(html).toContain('Unclear')
 expect(html.split(claim.text)).toHaveLength(2)
})
