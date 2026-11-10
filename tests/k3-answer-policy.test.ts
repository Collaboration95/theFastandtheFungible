import { afterEach, expect, it, vi } from 'vitest'
import { Store } from '../server/store.js'
import { decide, FixtureDecisionProvider, type DecideInput } from '../server/agents/decision.js'
import { writeAnswer } from '../server/agents/research.js'
import { summarizeAnswer } from '../shared/answer-summary.js'
import { exampleAnswer, exampleCandidate, exampleContent } from '../shared/contracts/examples.js'
import type { PublicCandidate, ContentEnvelope } from '../shared/contracts/index.js'
import { receiptView } from '../shared/presentation.js'
vi.mock('../server/agents/llm.js', () => ({ isLlmConfigured: () => false }))
afterEach(() => vi.unstubAllEnvs())
const candidate: PublicCandidate = { ...exampleCandidate, resourceId: 'tickets', title: 'Tickets for parallel payments', facets: ['Tickets', 'TicketCreate', 'TicketSequence', 'The problem', 'Cost'], wallet: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', tier: 'PAID', relevance: 0.42, price: { amountMinor: 30, currency: 'SGD' } }
const question = 'How can Tickets submit parallel payments without sequence numbers?'
const text = 'TicketCreate reserves sequence numbers so Tickets can submit parallel payments.'
const content: ContentEnvelope = { ...exampleContent, resourceId: candidate.resourceId, title: candidate.title, body: text, spans: [{ id: 'p1', text }] }
const provider = new FixtureDecisionProvider()
provider.judgeCandidate = async () => ({ addressesGap: 0.25, originality: {original: 0.9, rewrite: 0.03, overlap: 0.07}, credibility: 1 })
const input = (extra: Partial<DecideInput> = {}): DecideInput => ({ question, gap: 'Tickets for parallel payments', conclusion: '', candidates: [candidate], readSources: [], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, provider, probeWallets: ['rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'], ...extra })
it('extracts a cited answer <=40 words from a delivered purchased span, with <=120 word conclusion', () => {
 const answer = summarizeAnswer('Which transaction reserves sequence numbers for Tickets?', exampleAnswer, [content], [candidate])
 expect(answer.lead?.[0].text).toBe(text)
 expect(answer.lead?.[0].claim.citations[0]).toMatchObject({resourceId: 'tickets', spanId: 'p1'})
 expect(answer.lead!.map(l => l.text).join(' ').split(/\s+/).length).toBeLessThanOrEqual(40)
 expect(answer.conclusion.split(/\s+/).length).toBeLessThanOrEqual(120)
})
it('prioritizes the first frozen requirement in a multipart question', () => {
 const spans=[{id:'create',text:'TicketCreate creates Tickets for parallel transactions.'},{id:'cancel',text:'OfferCancel cancels offers for an account.'}]
 const delivered={...content,body:spans.map(s=>s.text).join(' '),spans}
 const answer=summarizeAnswer('Which transaction creates Tickets and which transaction cancels offers?',exampleAnswer,[delivered],[candidate],'OfferCancel cancels offers')
 expect(answer.lead?.[0].text).toBe(spans[1].text)
})
it('filters unrelated corpus clusters before composition and does not echo note headings as gaps', async () => {
 const unrelated = { ...exampleContent, resourceId: 'cooling', title: 'Johor data centre', body: 'Data-centre cooling in Johor requires 600 MW.', spans: [{id: 'p1', text: 'Data-centre cooling in Johor requires 600 MW.'}] }
 const result = await writeAnswer({ question, contents: [content, unrelated], candidates: [candidate, {...exampleCandidate, resourceId: 'cooling'}], version: 1 })
 expect(JSON.stringify(result.answer)).not.toMatch(/Johor|cooling|The problem|Cost/)
 expect(result.answer.lead?.[0].text).toBe(text)
})
it('answers permission and scheme questions with their named type, preserving negation and whole identifiers', () => {
 const passages = ['The XRPL escrow fee formula scales as base_fee times fulfillment bytes.', 'The RLUSD issuer must enable AllowTrustLineLocking before issued tokens can be escrowed.', 'The x402 payment scheme is exact for a fixed-amount transfer.', 'AccountSet does not enable issuer escrow without AllowTrustLineLocking.']
 const delivered = {...content,body:passages.join(' '),spans:passages.map((text,i)=>({id:`p${i}`,text}))}
 expect(summarizeAnswer('Can XRPL escrow hold RLUSD, and what must its issuer enable?',exampleAnswer,[delivered],[candidate]).lead?.[0].text).toContain('AllowTrustLineLocking')
 expect(summarizeAnswer('What is the x402 payment scheme for a fixed-amount transfer?',exampleAnswer,[delivered],[candidate]).lead?.[0].text).toContain('scheme is exact')
 const negative = {...delivered,body:passages[3],spans:[{id:'p3',text:passages[3]}]}
 expect(summarizeAnswer('Does AccountSet enable issuer escrow without AllowTrustLineLocking?',exampleAnswer,[negative],[candidate]).lead?.[0].text).toBe(passages[3])
})
it('does not cut a long conditional sentence or promote an invented reversal into the bound summary', async () => {
 const {validateAnswer} = await import('../server/agents/citations.js')
 const text = `If issuer escrow is disabled, ${'the issuing account remains subject to explicit restrictions '.repeat(8)}it does not permit TicketCreate.`
 const delivered = {...content,body:text,spans:[{id:'p1',text}]}
 const forged = {...exampleAnswer,claims:[{id:'wrong',text:'The issuer permits TicketCreate.',stance:'SUPPORTS' as const,citations:[{resourceId:content.resourceId,version:content.version,spanId:'p1'}]}]}
 const bound = validateAnswer(forged,[delivered])
 expect(bound.conclusion).toBe(text)
 const result = summarizeAnswer('Does the issuer permit TicketCreate?',bound,[delivered],[candidate])
 expect(result.lead).toEqual([])
 expect(result.conclusion).not.toBe(forged.claims[0].text)
 expect(result.conclusion.split(/\s+/).length).toBeLessThanOrEqual(120)
})
it('caps eight long bound claims and ranks an identifier-only requested fact without a numeral', async () => {
 const {validateAnswer} = await import('../server/agents/citations.js')
 const {requestedPassageScores} = await import('../server/agents/fact-selection.js')
 const spans=Array.from({length:8},(_,i)=>({id:`p${i}`,text:`Tickets ${'can reserve sequence numbers '.repeat(18)}for account ${i}.`}))
 const delivered={...content,body:spans.map(s=>s.text).join(' '),spans}
 const bound=validateAnswer({...exampleAnswer,claims:spans.map(s=>({id:s.id,text:s.text,stance:'UNCERTAIN',citations:[{resourceId:content.resourceId,version:content.version,spanId:s.id}]}))},[delivered])
 expect(bound.conclusion.split(/\s+/).length).toBeLessThanOrEqual(120)
 expect(requestedPassageScores('Which transaction creates Tickets?', ['TicketCreate creates Tickets.'])[0]).toBeGreaterThan(0)
})
it('prefers the title/facets naming the entity over cheaper adjacent evidence', async () => {
 const direct = {...candidate, relevance: 1, price: {amountMinor: 40, currency: 'SGD' as const}}
 const generic = {...candidate, resourceId: 'general', title: 'General parallel payments', facets: ['payments'], relevance: 1, price: {amountMinor: 20, currency: 'SGD' as const}}
 const result = await decide(input({candidates: [generic, direct], provider: new FixtureDecisionProvider()}))
 expect(result.selectedResourceId).toBe('tickets')
})
it('skips subsequent purchases when a delivered sentence already covers the gap', async () => {
 const result = await decide(input({gap: 'Tickets submit parallel payments', accessibleEvidence: [content]}))
 expect(result.selectedResourceId).toBeUndefined()
 expect(result.rows[0].reason).toContain('already covers')
})
it('labels the bounded newcomer exception and enforces each condition independently', async () => {
 const result = await decide(input())
 expect(result.rows[0]).toMatchObject({verdict: 'BUY', probe: true, reason: 'probe purchase · new writer'})
 expect(result.rows[0].value).toBeLessThan(result.threshold)
 for (const extra of [ {probeWallets: []}, {budgetMinor: 0}, {perSourceCapMinor: 20}, {spentMinor: 180}, {candidates: [{...candidate, relevance: 0.39}]}, {candidates: [{...candidate, price: {amountMinor:31,currency:'SGD' as const}}]}, {candidates: [{...candidate, facets:['Cost']}]}, {candidates: [{...candidate, resourceId:'other', facets:['Cost']}, candidate]} ]) {
  expect((await decide(input(extra))).rows.some(r => r.probe)).toBe(false)
 }
})
it('reserves a probe once per wallet across concurrent runs and database reopen', async () => {
 const { ResourceScope } = await import('../shared/resource-scope.js'); const { join } = await import('node:path')
 const scope = new ResourceScope(); const dir = scope.tempDir('k3-probe-'); const path = join(dir,'app.db'); let store = new Store(path)
 try {
  const reserve = async (id: string) => {
   const run = store.createRun(question,200)
   store.updateRun(run.runId,{candidates:[candidate]})
   store.addDecision(run.runId,await decide(input()))
   return store.reserveIntent({intentId:id,runId:run.runId,profileId:candidate.profileId,resourceId:candidate.resourceId,version:candidate.version,amountMinor:30,status:'QUOTED',quote:{quoteId:id,quoteHash:id,runId:run.runId,intentId:id,profileId:candidate.profileId,resourceId:candidate.resourceId,version:candidate.version,amountMinor:30,currency:'SGD',expiresAt:new Date(Date.now()+60000).toISOString(),contentDigest:'digest',payment:{rail:'simulated',network:'xrpl:1',asset:'XRP',payTo:candidate.wallet!,amountDrops:'300000',invoiceId:'AB'.repeat(32)}}})
  }
  const both = await Promise.all([reserve('one'),reserve('two')])
  expect(both.map(i=>i.status).sort()).toEqual(['RESERVED','SKIPPED'])
  expect(receiptView(both[0],undefined,candidate,'SIMULATED SGD · no real funds').purchaseKind).toBe('probe purchase · new writer')
  expect(both[1].purchaseKind).toBeUndefined()
  store.close(); store=new Store(path)
  expect(store.probeAvailable(candidate.wallet!)).toBe(false)
 } finally {store.close();await scope.close()}
})

it('puts the cited lead before contribution details and keeps paid stance out of the lead', async () => {
 const { presentRun } = await import('../sdk/present.js')
 const { exampleRun } = await import('../shared/contracts/examples.js')
 const { renderToStaticMarkup } = await import('react-dom/server')
 const { createElement } = await import('react')
 const { default: AnswerCard } = await import('../src/components/Answer.js')
 const run = structuredClone(exampleRun)
 run.question = question; run.phase = 'DONE'; run.candidates = [candidate]; run.contents = [content]
 run.intents = [{intentId:'verified',runId:run.runId,profileId:content.profileId,resourceId:content.resourceId,version:content.version,amountMinor:30,status:'VERIFIED'}]
 run.grants = [{intentId:'verified',runId:run.runId,resourceId:content.resourceId,version:content.version,contentDigest:'verified',grantedAt:'2026-11-10'}]
 run.answers = [summarizeAnswer(question, {...exampleAnswer, claims: [{id:'c',text,stance:'UNCERTAIN',citations:[{resourceId:content.resourceId,version:content.version,spanId:'p1'}]}]}, [content], [candidate])]
 const result = presentRun(run, 'http://127.0.0.1')
 const json = JSON.stringify(result)
 expect(json.indexOf('"answer"')).toBeLessThan(json.indexOf('"contributions"'))
 expect(json.indexOf('"lead"')).toBeLessThan(json.indexOf('"claims"'))
 const html = renderToStaticMarkup(createElement(AnswerCard, {run,view:'latest',onView:()=>{},compare:false,onCompare:()=>{}}))
 expect(html.slice(0, html.indexOf('<details'))).not.toContain('Unclear')
 expect(html).toContain('<summary>Claims and gaps</summary>')
 expect(html).not.toContain('<details class="ra-answer-work" open')
 const freeText = 'Tickets allow parallel submission with preallocated sequence numbers.'
 const free = {...content, resourceId:'free', body:freeText, spans:[{id:'p1',text:freeText}]}
 const freeCandidate = {...candidate, resourceId:'free',tier:'FREE' as const}
 const freeClaim = {id:'free',text:freeText,stance:'SUPPORTS' as const,citations:[{resourceId:'free',version:free.version,spanId:'p1'}]}
 const baseline = summarizeAnswer(question,{...exampleAnswer,claims:[freeClaim]},[free],[freeCandidate])
 run.contents.push(free);run.candidates.push(freeCandidate);run.answers.unshift(baseline)
 const before = renderToStaticMarkup(createElement(AnswerCard,{run,view:'baseline',onView:()=>{},compare:false,onCompare:()=>{}}))
 expect(before.slice(0,before.indexOf('<details'))).toContain(freeText)
 expect(before.slice(0,before.indexOf('<details'))).not.toContain(text)
})
