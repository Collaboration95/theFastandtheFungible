import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { leadFinding } from '../shared/lead-finding.js'
import { summarizeAnswer, sentenceStart } from '../shared/answer-summary.js'
import { openGapsAfterLead } from '../shared/open-gaps.js'
import { factsSummary } from '../shared/coverage.js'
import type { Answer, Claim, ContentEnvelope } from '../shared/contracts/index.js'
import { runLiveShaped, liveQuestion, type LiveQuestion, type LiveShapedResult } from './fixtures/r9-live-shaped.js'

// Recorded local live plans; fixture research/decisions, SIMULATED payments. Used regression data only.
const plans: LiveQuestion[] = JSON.parse(readFileSync('tests/fixtures/r10-live-plans.json', 'utf8')).questions
const doc = (text: string) => {
  const content: ContentEnvelope = { profileId: 'test', resourceId: 'test', version: 'v1', title: 'XRPL escrow and payments', publisher: 'test', body: text, spans: [{ id: 'p1', text }] }
  const claim: Claim = { id: 'c1', text, stance: 'UNCERTAIN', citations: [{ resourceId: 'test', version: 'v1', spanId: 'p1' }] }
  return { content, claim }
}
const answerWith = (text: string): Answer => ({ version: 1, conclusion: text, claims: [], openGaps: [], provider: 'fixture', model: 'test' })

it.each(['Which transaction creates Tickets and which transaction cancels offers?', 'What transaction creates Tickets, and which one cancels offers?', 'Which transaction creates Tickets; what transaction cancels offers?'])('preserves the frozen first fact before question-clause order: %s', question => {
  const { content, claim } = doc('TicketCreate creates Tickets for parallel transactions. OfferCancel cancels offers for an account.')
  const lead = leadFinding(question, [claim], [content], 'OfferCancel cancels offers')
  expect(lead[0]?.text).toBe('OfferCancel cancels offers for an account.')
})

it.each([
  'What does an x402 402 response contain, and can my agent pay it with XRP on Testnet?',
  'What does an x402 response contain; can my agent pay with XRP on Testnet?',
  'Which payment terms does an x402 response contain, and can an agent pay with XRP on Testnet?',
])('a frozen fact repeating the first clause keeps the contents first: %s', question => {
  const { content, claim } = doc('An agent can pay a 402 in XRP on Testnet, network xrpl:1. An HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client authorizes payment and retries with PAYMENT-SIGNATURE.')
  const lead = leadFinding(question, [claim], [content], question.split(/[,;]\s*/)[0])
  expect(lead[0]?.text).toContain('PAYMENT-REQUIRED')
  expect(lead[1]?.text).toContain('XRP on Testnet')
})

describe('QUAL: recorded live preset plans', () => {
  let results: LiveShapedResult[]
  beforeAll(async () => { vi.stubEnv('SEARCH_EMBEDDINGS', 'off'); results = await runLiveShaped(plans) }, 120_000)
  afterAll(() => vi.unstubAllEnvs())
  it('x402 leads with PAYMENT-REQUIRED, answers Testnet and buys once', () => {
    for (const r of results.filter(r => r.id.startsWith('XRPL2'))) {
      expect(r.phase).toBe('DONE'); expect(r.bought).toEqual(['product-x402-response'])
      expect(r.lead[0]).toContain('PAYMENT-REQUIRED')
      expect(r.conclusion).toMatch(/^An HTTP/)
      expect(r.lead.join(' ')).toContain('Testnet')
      expect(r.conclusion).not.toMatch(/(?:^|\. )Each option/)
      expect(r.facts?.answered).toBeGreaterThanOrEqual(2)
    }
  })
  it('RLUSD answers the issuer flag and amendment without opening on build notes', () => {
    for (const r of results.filter(r => r.id.startsWith('XRPL1'))) {
      expect(r.bought).toEqual(['team-rlusd']); expect(r.spentMinor).toBe(40)
      expect(r.lead[0]).toMatch(/^Not today:.*AllowTrustLineLocking/)
      expect(r.conclusion.split(/(?<=\.) /).slice(0, 2).join(' ')).toContain('TokenEscrow')
      expect(r.conclusion.split(/(?<=\.) /).slice(0, 2).join(' ')).not.toMatch(/TEST-SGD|Policy rejects|The team documented/)
      expect(r.facts?.answered).toBeGreaterThanOrEqual(2)
    }
  })
  it('reserves remains answerable from its historical XRPL3 plans, with both figures and one purchase', () => {
    for (const r of results.filter(r => r.id.startsWith('XRPL3'))) {
      expect(r.bought).toEqual(['xrpl-reserves']); expect(r.spentMinor).toBe(40)
      expect(r.lead.join(' ')).toMatch(/1 XRP.*0\.2 XRP/)
      expect(r.facts?.answered).toBeGreaterThanOrEqual(3)
    }
  })
  it('A5 includes who may submit, on both recorded wordings', async () => {
    for (const wording of ['modal', 'run'] as const) {
      const [r] = await runLiveShaped([liveQuestion('A5')], wording)
      expect(r.bought.length).toBeLessThanOrEqual(2)
      expect(r.lead.join(' ')).toMatch(/Any account may submit/)
      expect(r.openGaps).not.toContain('Explain the difference between EscrowFinish and EscrowCancel')
    }
  })
  it('the channel explainer leads with its trade-off or yes/no', async () => {
    const question = 'Can an agent pay for many small x402 requests over an XRPL payment channel instead of one escrow per article?'
    const plan = { restatement: question, subqueries: [question], requirements: [question] }
    const [r] = await runLiveShaped([{ id: 'channel', question, budgetMinor: 200, modal: plan, run: plan, observed: { bought: [], spentMinor: 0, lead: [] } }])
    expect(r.bought[0]).toBe('product-channel-vs-escrow')
    expect(r.lead[0]).toMatch(/^Yes,|trade-off/)
  })
  it('the used ticket-limit regression keeps its cited maximum through the engine', async () => {
    const question = 'What is the maximum number of tickets one XRPL account can hold at the same time?'
    const plan = { restatement: question, subqueries: [question], requirements: [] }
    const [r] = await runLiveShaped([{ id: 'ticket-limit', question, budgetMinor: 200, modal: plan, run: plan, observed: { bought: [], spentMinor: 0, lead: [] } }])
    expect(r.phase).toBe('DONE'); expect(r.spentMinor).toBe(40)
    expect(r.bought).toEqual(['c5-xrpl-ticket-limit'])
    expect(r.lead.join(' ')).toContain('250 Tickets')
  })
})

it.each(['Each option', 'Either option', 'Neither option', 'This', 'It', 'These', 'They', 'Such options'])('an unbound %s never leads', subject => {
  const { content, claim } = doc(`${subject} contains payment requirements in PAYMENT-REQUIRED. An HTTP 402 response contains payment requirements in PAYMENT-REQUIRED.`)
  expect(leadFinding('What does an x402 402 response contain?', [claim], [content])[0]?.text).toMatch(/^An HTTP/)
})
it.each(['each option', 'either option', 'neither option', 'its response'])('stripping an attribution never exposes unbound %s as the lead', subject => {
  const { content, claim } = doc(`According to the reference, ${subject} in an x402 402 response contains payment requirements in PAYMENT-REQUIRED.`)
  expect(leadFinding('What does an x402 402 response contain?', [claim], [content])).toEqual([])
})
it.each([
  'What is the maximum number of tickets one XRPL account can hold at the same time?',
  'How many tickets can each XRPL account hold?',
  'What is the ticket limit per XRPL account?',
])('a self-contained universal answers the limit: %s', question => {
  const { content, claim } = doc('According to the XRPL documentation, each account cannot have more than 250 Tickets in the ledger at a time.')
  content.title = 'XRPL Ticket limit'
  expect(leadFinding(question, [claim], [content])[0]?.text).toContain('250 Tickets')
})
it.each([
  "What's the difference between EscrowFinish and EscrowCancel, and who can submit each one?",
  'How do EscrowFinish and EscrowCancel differ, and who may submit them?',
  'Compare EscrowFinish and EscrowCancel: who can submit each transaction?',
])('a disclaimer cannot displace a cited partial answer: %s', question => {
  const { content, claim } = doc("The EscrowCancel reference does not state who may submit EscrowFinish. EscrowCancel returns expired escrowed principal to the sender after the ledger's cancellation deadline.")
  expect(leadFinding(question, [claim], [content])[0]?.text).toMatch(/^EscrowCancel returns/)
})
it.each([
  'What mechanism or control stops the agent from reading the article and then refusing to pay',
  'Explain the mechanism that prevents an agent reading an article before payment',
  'How does payment prevent the agent from reading the article without paying',
])('long requested facts close only against the visible lead: %s', text => {
  const { claim } = doc('The agent cannot read the article before payment: escrow releases the key only when the writer is paid.')
  const a = { lead: [{ text: claim.text, claim }], openGaps: [{ text }] }
  expect(openGapsAfterLead('How does the writer get paid?', a)).toEqual([])
  expect(openGapsAfterLead('How does the writer get paid?', { ...a, openGaps: [{ text: 'The current XRP account reserve amount' }] })).toHaveLength(1)
  expect(openGapsAfterLead('How does the writer get paid?', { ...a, lead: [] })).toHaveLength(1)
})
it('the display preserves the stored coverage judgment, including conflicts', () => {
  const { claim } = doc('The base reserve is 1 XRP and each escrow adds 0.2 XRP of owner reserve.')
  const run = { question: 'How much XRP reserve is needed?', spentMinor: 40, decisions: [], answers: [{ ...answerWith(claim.text), lead: [{ text: claim.text, claim }] }], checkpoint: { requirements: [{ id: 'r1', text: 'The base XRP reserve amount' }, { id: 'r2', text: 'The base XRP reserve amount' }], coverage: [{ answerVersion: 1, judge: 'fixture', entries: [{ requirementId: 'r1', status: 'missing' as const, claimIds: [] }, { requirementId: 'r2', status: 'conflicting' as const, claimIds: [] }] }] } }
  const before = JSON.stringify(run.checkpoint)
  expect(factsSummary(run)?.facts.map(f => f.status)).toEqual(['missing', 'conflicting'])
  expect(JSON.stringify(run.checkpoint)).toBe(before)
})
it('capitalisation leaves protocol identifiers intact and places the answer before its caution', () => {
  expect(sentenceStart('an HTTP response.')).toBe('An HTTP response.')
  for (const text of ['x402 is a protocol.', 'tesSUCCESS is a result.', 'npm install']) expect(sentenceStart(text)).toBe(text)
  const { content, claim } = doc('A 402 challenge does not itself authorize spending. According to the X402 v2 specification, an HTTP 402 response contains payment requirements in PAYMENT-REQUIRED.')
  const summary = summarizeAnswer('What does an x402 402 response contain?', { ...answerWith(''), claims: [claim] }, [content], [{ profileId: content.profileId, resourceId: content.resourceId, version: content.version, title: content.title, publisher: content.publisher, publisherSlug: 'test', tier: 'FREE', facets: [], preview: content.body, price: { amountMinor: 0, currency: 'SGD' }, family: 'test', authority: 1, license: { kind: 'test', attribution: 'test' } }])
  expect(summary.conclusion).toMatch(/^An HTTP/)
  expect(summary.lead?.[0].text).toMatch(/^an HTTP/)
})
