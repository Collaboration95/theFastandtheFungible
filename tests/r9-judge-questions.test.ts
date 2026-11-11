import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { once } from 'node:events'
import { request as http } from 'node:http'
import { measureRank, titlesNameQuestion } from '../server/agents/decision.js'
import { requirementsKey } from '../server/agents/requirements.js'
import { confirmedPlan, scopeWithPlanner } from '../server/hosted/routes.js'
import { createApiApp } from '../server/routes.js'
import { leadFinding } from '../shared/lead-finding.js'
import { TESTNET_QUESTIONS } from '../shared/contracts/examples.js'
import type { Claim, ContentEnvelope } from '../shared/contracts/index.js'
import { resources } from './helpers/resource-scope.js'
import { liveQuestion, runLiveShaped, type LiveShapedResult } from './fixtures/r9-live-shaped.js'

// Round-9 mock judges (notes/review-nov10/13-mock-judges-r9.md, 11 Nov). The hosted demo plans with the live model and
// decides with the fixture model; earlier lanes measured presets only with the fixture planner, so the live wording was
// never tested. These tests replay the live plans the judges recorded (tests/fixtures/r9-live-plans.json: the modal plan
// the visitor confirmed and the plan the run re-planned) with fixture decisions and SIMULATED payments. Regression data
// on questions already seen, never a held-out result.

const RLUSD = liveQuestion('A1').question
const AMM = liveQuestion('E3').question
const WRITER_NO_SHOW = liveQuestion('D4').question
const FEES = liveQuestion('A3').question

describe('H9-01 stop rule: the bought titles name every clause of the question', () => {
  it('stops after the RLUSD article for the RLUSD preset, whatever the planner called its facts', () => {
    expect(titlesNameQuestion(RLUSD, ['RLUSD escrow today: AllowTrustLineLocking issuer permission and TEST-SGD'])).toBe(true)
    expect(titlesNameQuestion(RLUSD, ['What does the TokenEscrow amendment (XLS-85) let an XRPL escrow hold?'])).toBe(false)
    expect(titlesNameQuestion(RLUSD, ['What does EscrowCreate do on XRPL?'])).toBe(false)
  })
  it('lets the AMMVote reference follow AMMCreate, then stops', () => {
    expect(titlesNameQuestion(AMM, ['What do AMMCreate and AMMDeposit do on XRPL, and what is the maximum AMM trading fee?'])).toBe(false)
    expect(titlesNameQuestion(AMM, ['What do AMMCreate and AMMDeposit do on XRPL, and what is the maximum AMM trading fee?', 'What does AMMVote do on XRPL?'])).toBe(true)
  })
  it('skips a clause with no subject word and needs half of each other clause', () => {
    expect(titlesNameQuestion(WRITER_NO_SHOW, ['What does key-reveal escrow guarantee, and who must refund a bad article?'])).toBe(false)
    expect(titlesNameQuestion(WRITER_NO_SHOW, ['How do I recover funds when a writer never reveals the escrow key?'])).toBe(true)
    expect(titlesNameQuestion(FEES, ['Key reveal: paid research delivery, manifest signatures and content hashes'])).toBe(false)
    expect(titlesNameQuestion(RLUSD, [])).toBe(false)
  })
  it('leaves a question that asks for a named thing to the per-purchase rule', () => {
    expect(titlesNameQuestion('Which transaction type creates or modifies a permissioned domain on the XRP Ledger?', ['What does PermissionedDomainDelete do on XRPL?'])).toBe(false)
    expect(titlesNameQuestion('Which XRPL transaction publishes or updates a decentralized identifier for an account?', ['What is an XRPL decentralized identifier (DID)?'])).toBe(false)
  })
})

describe('H9-06 a "how much" question prefers the title naming its measure and unit', () => {
  it('ranks the fee note with XRP drops above the fee guide and the key-reveal delivery note', () => {
    expect(measureRank(FEES, 'EscrowFinish fulfillment fees: XRP drops and SGD prices in the app')).toBe(2)
    expect(measureRank(FEES, 'How do XRPL transaction fees and fee escalation work?')).toBe(1)
    expect(measureRank(FEES, 'Key reveal: paid research delivery, manifest signatures and content hashes')).toBe(0)
    expect(measureRank('How much XRP reserve does an agent wallet need?', 'What XRP account reserves does an agent wallet need?')).toBe(2)
  })
  it('answers a "cost" question with the fee note (dev bank v1 J01)', () => {
    const cost = 'How much does EscrowFinish with a fulfillment cost on XRPL Testnet?'
    expect(measureRank(cost, 'EscrowFinish fulfillment fees: XRP drops and SGD prices in the app')).toBe(2)
    expect(measureRank(cost, 'What does EscrowFinish do on XRPL?')).toBe(0)
  })
  it('changes nothing for a question that asks for no amount', () => {
    expect(measureRank(RLUSD, 'EscrowFinish fulfillment fees: XRP drops and SGD prices in the app')).toBe(0)
  })
})

describe('H9-13 a contents question leads with what the thing carries, not a caution about it', () => {
  it('leads the x402 402 question with the PAYMENT-REQUIRED sentence', () => {
    const body = 'A 402 challenge is an offer to pay; it does not itself authorize spending. According to the X402 v2 specification, an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE.'
    const spans = [{ id: 'p1', text: 'A 402 challenge is an offer to pay; it does not itself authorize spending.' }, { id: 'p2', text: 'According to the X402 v2 specification, an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE.' }]
    const content: ContentEnvelope = { profileId: 'team-xrpl-explainers', resourceId: 'product-x402-response', version: 'v1', title: 'What does an x402 402 Payment Required response contain?', publisher: 'XRPL explainers', body, spans }
    const claims: Claim[] = spans.map(s => ({ id: s.id, text: s.text, stance: 'UNCERTAIN', citations: [{ resourceId: content.resourceId, version: 'v1', spanId: s.id }] }))
    const lead = leadFinding(TESTNET_QUESTIONS[0].text, claims, [content], 'What does an x402 402 response contain')
    expect(lead[0].text).toContain('PAYMENT-REQUIRED')
  })
})

describe('the x402 402 question is the first preset and RLUSD the second', () => {
  it('orders the hosted presets', () => {
    expect(TESTNET_QUESTIONS.map(q => q.label)).toEqual(['x402 payment', 'RLUSD escrow', 'Account reserves'])
    expect(TESTNET_QUESTIONS[0].text).toBe(liveQuestion('A2').question)
    expect(TESTNET_QUESTIONS[1].text).toBe(RLUSD)
  })
})

describe('round-9 judge questions with the live planner\'s recorded plans (fixture decisions, SIMULATED payments)', () => {
  const ids = ['A1', 'E1', 'A2', 'F2', 'A3', 'A4', 'A5', 'B1', 'D1', 'D3', 'D4', 'E3', 'E5']
  let results: LiveShapedResult[] = []
  const result = (id: string, wording: 'modal' | 'run') => results.find(r => r.id === id && r.wording === wording)!
  beforeAll(async () => {
    vi.stubEnv('SEARCH_EMBEDDINGS', 'off')
    const questions = ids.map(liveQuestion)
    results = [...await runLiveShaped(questions, 'modal'), ...await runLiveShaped(questions, 'run')]
  }, 240_000)
  afterAll(() => { vi.unstubAllEnvs() })
  for (const wording of ['modal', 'run'] as const) {
    it(`${wording} plan: the RLUSD preset buys one article and leads with AllowTrustLineLocking (H9-01)`, () => {
      for (const id of ['A1', 'E1']) {
        expect(result(id, wording).bought, id).toEqual(['team-rlusd'])
        expect(result(id, wording).lead[0], id).toContain('AllowTrustLineLocking')
      }
    })
    it(`${wording} plan: the fee question buys the fee note first and leads with drops (H9-06)`, () => {
      expect(result('A3', wording).bought[0]).toBe('team-fees')
      expect(result('A3', wording).lead[0]).toMatch(/\d+ drops/)
    })
    it(`${wording} plan: the unanswerable validators question buys nothing (H9-08)`, () => {
      expect(result('E5', wording).bought).toEqual([])
      expect(result('E5', wording).spentMinor).toBe(0)
    })
    it(`${wording} plan: the AMM question buys AMMCreate, then AMMVote for "who can vote to change it", and stops`, () => {
      expect(result('E3', wording).bought).toEqual(['c5-xrpl-amm-create-deposit', 'xrpl-tx-ammvote'])
    })
    it(`${wording} plan: x402, token escrow and travel rule keep their purchases`, () => {
      for (const id of ['A2', 'F2']) expect(result(id, wording).bought, id).toEqual(['product-x402-response'])
      expect(result('A4', wording).bought).toEqual(['c5-xrpl-token-escrow-xls85'])
      expect(result('A4', wording).lead[0]).toContain('TokenEscrow')
      expect(result('D1', wording).bought).toEqual(['c5-fatf-recommendation-16-travel-rule', 'xrpl-compliance-fatf-travel-rule'])
      expect(result('D3', wording).bought).toEqual(['c5-mas-licence-paying-suppliers-rlusd'])
    })
    it(`${wording} plan: no question buys more than before or three articles`, () => {
      // The run wording is what the hosted demo ran in round 9 (observed); the modal wording never ran there, and on main
      // it bought at most 2 for every question here except A1, E1, D4 and E5, which bought 3.
      for (const r of results.filter(x => x.wording === wording)) {
        expect(r.bought.length, r.id).toBeLessThanOrEqual(wording === 'run' ? liveQuestion(r.id).observed.bought.length : 2)
        expect(r.bought.length, r.id).toBeLessThan(3)
        expect(r.phase, r.id).toBe('DONE')
      }
    })
  }
  it('the writer no-show question buys only the no-show article, whose title names the whole question (H9-05)', () => {
    // Round 9 bought the key-reveal trust explainer (run) or three articles (modal). Both wordings now buy one article.
    // With the run wording its lead slot stays empty: topicMatches rejects "Whether a payment … is final or reversible"
    // against that article (the product-question topicMatches issue handed to R9-C). The hosted run now uses the modal plan.
    expect(result('D4', 'modal').bought).toEqual(['product-escrow-no-show'])
    expect(result('D4', 'modal').lead[0]).toMatch(/EscrowCancel/)
    expect(result('D4', 'run').bought).toEqual(['product-escrow-no-show'])
  })
  it('a planned run never lists, as still unanswered, the fact its lead answers (H9-10 on the loop path, R9-B open-gaps rule)', () => {
    // Round 9 listed the prompt-injection question itself under "Still unanswered" beside a lead that answers it; the
    // coverage rewrite in the run loop (what MCP and the SDK return) now applies the same rule as the answer writer.
    for (const wording of ['modal', 'run'] as const) {
      expect(result('B1', wording).lead[0], wording).toMatch(/prompt injection cannot increase spending authorization/i)
      expect(result('B1', wording).openGaps, wording).not.toContain(liveQuestion('B1').run.requirements[0])
    }
    expect(result('B1', 'run').openGaps).toEqual([])
    // A fact the lead does not answer stays open: the fee question's lead gives the drops, not how many transactions.
    expect(result('A3', 'modal').openGaps.some(gap => /how many XRPL transactions/i.test(gap))).toBe(true)
  })
  it('the EscrowFinish/EscrowCancel question still leads with a cited escrow sentence', () => {
    for (const wording of ['modal', 'run'] as const) expect(result('A5', wording).lead[0], wording).toMatch(/EscrowFinish|EscrowCancel/)
  })
})

describe('H9-04 the hosted run uses the plan the visitor confirmed', () => {
  const question = RLUSD
  const live = liveQuestion('A1').modal
  const plan = { restatement: live.restatement, subqueries: live.subqueries, requirements: live.requirements }
  const bound = { ...plan, requirementsKey: requirementsKey(question, plan) }
  const stored = (value: unknown) => ({ scope_result: JSON.stringify(value) })
  it('returns the stored live plan with its bound requested facts and its label', () => {
    expect(confirmedPlan(stored({ questions: [], plan: bound, label: 'DeepSeek · deepseek-flash' }), question)).toEqual({ ...bound, label: 'DeepSeek · deepseek-flash' })
  })
  it('keeps a fallback plan and its label, but never requested facts bound to another question', () => {
    expect(confirmedPlan(stored({ questions: [], plan: { restatement: 'x', subqueries: ['x'] }, label: 'fixture · scope-fixture · spending guard' }), question)).toEqual({ restatement: 'x', subqueries: ['x'], label: 'fixture · scope-fixture · spending guard' })
    expect(confirmedPlan(stored({ questions: [], plan: { ...bound, requirementsKey: 'f'.repeat(32) }, label: 'DeepSeek · deepseek-flash' }), question)).toEqual({ restatement: plan.restatement, subqueries: plan.subqueries, label: 'DeepSeek · deepseek-flash' })
  })
  it('re-plans after a clarify answer, and for a chat reply, an expired scope or an unreadable one', () => {
    expect(confirmedPlan(stored({ questions: [], plan: bound, label: 'DeepSeek · deepseek-flash' }), question, { angle: 'issuer settings' })).toBeUndefined()
    expect(confirmedPlan(stored({ questions: [], plan: bound, label: 'DeepSeek · deepseek-flash' }), question, { angle: '  ' })).toEqual({ ...bound, label: 'DeepSeek · deepseek-flash' })
    expect(confirmedPlan(stored({ questions: [], plan: bound, chat: { reply: 'Hi' }, label: 'About ResearchAgent' }), question)).toBeUndefined()
    expect(confirmedPlan({ scope_result: null }, question)).toBeUndefined()
    expect(confirmedPlan({ scope_result: '{not json' }, question)).toBeUndefined()
  })

  describe('H9-12 a guard-refused scope plan gets one dedicated planner call, still guarded', () => {
    const B2 = liveQuestion('B2').question
    const fallback = { questions: [], plan: { restatement: B2, subqueries: ['language model ResearchAgent spend money'] }, label: 'fixture · scope-fixture · spending guard' }
    const livePlan = { restatement: 'r', subqueries: ['s'], requirements: ['Whether the language model can initiate payments'], requirementsKey: 'k'.repeat(32), label: 'DeepSeek · deepseek-flash' }
    it('replaces the fallback with the planner\'s plan when that plan passes the guard', async () => {
      const planner = vi.fn(async () => livePlan)
      const { label, ...plan } = livePlan
      expect(await scopeWithPlanner(B2, {}, planner, async () => fallback)).toEqual({ questions: [], plan, label })
      expect(planner).toHaveBeenCalledTimes(1)
    })
    it('keeps the labelled fallback when the planner is refused too, and never calls it for a live or chat scope', async () => {
      expect(await scopeWithPlanner(B2, {}, async () => ({ ...fallback.plan, label: 'fixture · scope-fixture · spending guard' }), async () => fallback)).toEqual(fallback)
      const planner = vi.fn(async () => livePlan)
      const live = { questions: [], plan: { restatement: 'x', subqueries: ['x'] }, label: 'DeepSeek · deepseek-flash' }
      expect(await scopeWithPlanner(B2, {}, planner, async () => live)).toBe(live)
      const chat = { questions: [], plan: { restatement: 'x', subqueries: ['x'] }, chat: { reply: 'Hi' }, label: 'fixture · scope-fixture · spending guard' }
      expect(await scopeWithPlanner(B2, {}, planner, async () => chat)).toBe(chat)
      expect(await scopeWithPlanner(B2, {}, planner, async () => ({ ...live, label: 'fixture · scope-fixture · planner unavailable' }))).toMatchObject({ label: 'fixture · scope-fixture · planner unavailable' })
      expect(planner).not.toHaveBeenCalled()
    })
  })

  const cleanup: (() => unknown)[] = []
  afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
  const wire = (url: string, method = 'GET', headers: Record<string, string> = {}, body?: unknown) => new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; json: <T = Record<string, unknown>>() => T }>((resolve, reject) => {
    const req = http(url, { method, headers: { Host: 'demo.example', 'Content-Type': 'application/json', ...headers } }, res => { let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, json: <T>() => JSON.parse(text) as T })) })
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body))
  })
  it('records a PLAN event equal to the modal plan, and does not plan again', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-11T04:00:00Z'))
    const dir = resources().tempDir('r9-hosted-plan-')
    for (const [k, v] of Object.entries({ HOSTED: '1', HOSTED_ORIGIN: 'https://demo.example', HOSTED_TRUSTED_PROXY: '127.0.0.2', HOSTED_IP_HMAC_KEY: 'a'.repeat(32), HOSTED_CONTROL_PATH: join(dir, 'control.json'), SETTLEMENT_RAIL: 'simulated', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', DEMO_PORT_OFFSET: '2700' })) vi.stubEnv(k, v)
    writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'test_ready', expiresAt: '2026-11-19T16:00:00Z' }))
    const api = await createApiApp({ dbPath: join(dir, 'app.db'), publisherUrl: 'http://127.0.0.1:1', hostedReadiness: async () => true })
    const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
    cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await api.close() })
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const status = await wire(url + '/api/demo/status')
    const jar = { Cookie: status.headers['set-cookie']![0].split(';')[0], Origin: 'https://demo.example', 'X-CSRF-Token': status.json<{ csrfToken: string }>().csrfToken, 'Idempotency-Key': 'r9-confirmed-plan' }
    const scoped = await wire(url + '/api/scope', 'POST', jar, { question })
    expect(scoped.status).toBe(200)
    const modal = scoped.json<{ plan: { restatement: string; subqueries: string[] }; label: string }>()
    const started = await wire(url + '/runs', 'POST', jar, { question, budgetMinor: 0 })
    expect(started.status).toBe(201)
    const runId = started.json<{ runId: string }>().runId
    let event: { data?: Record<string, unknown> } | undefined
    for (let i = 0; i < 200 && !event; i++) { event = api.store!.getRun(runId).events.find(e => e.type === 'PLAN'); if (!event) await new Promise(r => setTimeout(r, 25)) }
    expect(event?.data).toMatchObject({ plan: { restatement: modal.plan.restatement, subqueries: modal.plan.subqueries }, planner: modal.label, confirmed: true })
    expect(api.store!.getRun(runId).labels.plan).toBe(modal.label)
    expect(api.store!.getRun(runId).events.filter(e => e.type === 'PLAN')).toHaveLength(1)
  })
})
