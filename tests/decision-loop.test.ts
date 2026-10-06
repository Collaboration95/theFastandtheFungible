import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient as RealPublisherClient } from '../server/publisher-client.js'
import { PurchaseManager as RealPurchaseManager } from '../server/purchases.js'
import { Store as RealStore } from '../server/store.js'
import { Reputation } from '../server/reputation.js'
import { fixturePlan } from '../server/agents/scope.js'
import { RunLoop, type RunLoopOptions } from '../server/agents/loop.js'
import { FixtureDecisionProvider } from '../server/agents/decision.js'
import type { Store } from '../server/store.js'
import type { PublisherClient } from '../server/publisher-client.js'
import type { PurchaseManager } from '../server/purchases.js'
import type { Answer, ContentEnvelope, DecisionRound, Impact, PurchaseIntent, RunSnapshot, TraceEvent } from '../shared/contracts/index.js'
import { exampleAnswer, exampleCandidate, exampleContent, exampleRun } from '../shared/contracts/examples.js'
import type { PublicCandidate } from '../shared/contracts/index.js'
const paid = (resourceId: string): PublicCandidate => ({ ...exampleCandidate, resourceId, family: resourceId, tier: 'PAID', preview: 'Grid planner energisation queue data.', facets: ['grid-energisation'], price: { amountMinor: 80, currency: 'SGD' } })

function harness(budgetMinor = 200) {
  const candidate = paid('paid-evidence')
  const content: ContentEnvelope = { ...exampleContent, resourceId: candidate.resourceId, title: candidate.title }
  const run: RunSnapshot = structuredClone({ ...exampleRun, budgetMinor, phase: 'SEARCH', answers: [], candidates: [], contents: [], round: 0 })
  const store = {
    getRun: vi.fn(() => structuredClone(run)),
    updateRun: vi.fn((_id: string, patch: Partial<RunSnapshot>) => { Object.assign(run, structuredClone(patch)); return structuredClone(run) }),
    appendEvent: vi.fn((_id: string, input: Omit<TraceEvent, 'id' | 'runId' | 'at'>) => { const event = { ...input, id: run.events.length + 1, runId: run.runId, at: new Date().toISOString() }; run.events.push(event); return event }),
    addAnswer: vi.fn((_id: string, answer: Answer, impact?: Impact) => { if (run.answers.some(value => value.version === answer.version)) throw new Error('Immutable'); run.answers.push(structuredClone(answer)); run.impact = impact }),
    addDecision: vi.fn((_id: string, decision: DecisionRound) => { run.decisions.push(structuredClone(decision)) }),
    addContent: vi.fn((_id: string, value: ContentEnvelope) => { run.contents.push(structuredClone(value)) }),
    getIntent: vi.fn((id: string) => structuredClone(run.intents.find(intent => intent.intentId === id))),
  }
  const grant = (intent: PurchaseIntent) => {
    intent.status = 'VERIFIED'
    if (!run.contents.some(value => value.resourceId === intent.resourceId)) run.contents.push({ ...content, resourceId: intent.resourceId })
    run.grants.push({ runId: run.runId, intentId: intent.intentId, resourceId: intent.resourceId, version: intent.version, contentDigest: 'verified-digest', grantedAt: new Date().toISOString() })
  }
  const purchases = {
    purchase: vi.fn(async (input: { runId: string; candidate: typeof candidate; intentId: string }) => {
      const intent: PurchaseIntent = { intentId: input.intentId, runId: run.runId, resourceId: input.candidate.resourceId, profileId: input.candidate.profileId, version: input.candidate.version, amountMinor: input.candidate.price.amountMinor, status: 'VERIFIED' }
      run.intents.push(intent); run.spentMinor += intent.amountMinor; grant(intent); return intent
    }),
    retryDelivery: vi.fn(async (id: string) => { const intent = run.intents.find(value => value.intentId === id)!; grant(intent); return intent }),
    reconcile: vi.fn(async () => {}),
  }
  const retrieve = vi.fn(async () => ({ candidates: [exampleCandidate, candidate], contents: [exampleContent] }))
  const writeAnswer = vi.fn(async (input: { version: number; previous?: Answer; onToken?: (delta: string) => void }) => {
    if (input.previous) input.previous.conclusion = 'mutated clone'
    return { answer: { ...structuredClone(exampleAnswer), version: input.version, openGaps: input.version > 1 ? [] : exampleAnswer.openGaps } }
  })
  const published: TraceEvent[] = []
  const onEvent = (event: TraceEvent) => {
    expect(run.events).toContainEqual(event)
    expect(run.checkpoint.phase).toBe(event.type === 'ANSWER_PROGRESS' ? 'ANSWER' : event.type)
    published.push(event)
  }
  const loop = new RunLoop(store as unknown as Store, {} as PublisherClient, purchases as unknown as PurchaseManager, onEvent, { retrieve, writeAnswer })
  return { loop, store, purchases, retrieve, writeAnswer, run, published, candidate, content, grant }
}

describe('RunLoop with W0 ledger/research doubles', () => {
  it('runs free answer, decision, one verified purchase, immutable v2, then stops', async () => {
    const h = harness()
    await h.loop.start(h.run.runId)
    expect(h.run.phase).toBe('DONE')
    expect(h.published.map(event => event.type)).toEqual(['SEARCH', 'READ_FREE', 'ANSWER', 'DECIDE', 'BUY', 'READ_PAID', 'ANSWER', 'DECIDE', 'DONE'])
    expect(h.run.answers.map(answer => answer.version)).toEqual([1, 2])
    expect(h.run.answers[0].conclusion).toBe(exampleAnswer.conclusion)
    expect(h.purchases.purchase).toHaveBeenCalledTimes(1)
    expect(h.run.labels).toMatchObject({ decision: 'fixture · metadata-fixture', research: 'fixture · extractive-fixture' })
    expect(JSON.stringify(h.published)).not.toContain(exampleContent.body)
  })
  it('persists throttled fixed progress markers without unvalidated tokens', async () => {
    const h = harness(0)
    h.writeAnswer.mockImplementation(async input => {
      input.onToken?.('UNVALIDATED_PAID_CANARY')
      input.onToken?.('buy expensive source now')
      return { answer: structuredClone(exampleAnswer) }
    })
    await h.loop.start(h.run.runId)
    expect(h.run.events.filter(event => event.type === 'ANSWER_PROGRESS')).toHaveLength(1)
    expect(h.published.find(event => event.type === 'ANSWER_PROGRESS')?.label).toBe('Writing and validating cited evidence.')
    expect(JSON.stringify(h.run.events)).not.toContain('UNVALIDATED_PAID_CANARY')
    expect(JSON.stringify(h.run.events)).not.toContain('buy expensive')
  })
  it('S$0 answers and computes would-buy while never calling purchases', async () => {
    const h = harness(0)
    await h.loop.start(h.run.runId)
    expect(h.run.answers).toHaveLength(1)
    expect(h.run.decisions[0].rows[0].wouldBuy).toBe(true)
    expect(h.run.decisions[0].selectedResourceId).toBeUndefined()
    expect(h.purchases.purchase).not.toHaveBeenCalled()
  })
  it('allows only one runner per run', async () => {
    const h = harness()
    await Promise.all([h.loop.start(h.run.runId), h.loop.start(h.run.runId)])
    expect(h.retrieve).toHaveBeenCalledTimes(1)
    expect(h.purchases.purchase).toHaveBeenCalledTimes(1)
  })
  it('Stop during asynchronous judgment prevents the next purchase and is durable first', async () => {
    const h = harness()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const provider = new FixtureDecisionProvider()
    vi.spyOn(provider, 'judgeRound').mockImplementation(async () => { await gate; return { gapMaterial: 0.9 } })
    h.loop.options.provider = provider
    const pending = h.loop.start(h.run.runId)
    await vi.waitFor(() => expect(h.run.phase).toBe('DECIDE'))
    h.loop.stop(h.run.runId)
    expect(h.run.checkpoint.phase).toBe('STOPPED')
    release(); await pending
    expect(h.run.phase).toBe('STOPPED')
    expect(h.purchases.purchase).not.toHaveBeenCalled()
    expect(h.run.answers).toHaveLength(1)
  })
  it('rejects paid bytes in retrieval before any writer or content persistence', async () => {
    const h = harness()
    h.retrieve.mockResolvedValue({ candidates: [exampleCandidate, h.candidate], contents: [h.content] })
    await h.loop.start(h.run.runId)
    expect(h.run.phase).toBe('FAILED')
    expect(h.writeAnswer).not.toHaveBeenCalled()
    expect(h.store.addContent).not.toHaveBeenCalled()
  })
  it('preserves v1 on delivery failure, then retries verification and v2 without buying', async () => {
    const h = harness()
    h.purchases.purchase.mockImplementation(async input => {
      const intent: PurchaseIntent = { intentId: input.intentId, runId: h.run.runId, resourceId: h.candidate.resourceId, profileId: h.candidate.profileId, version: h.candidate.version, amountMinor: 80, status: 'DELIVERY_FAILED' }
      h.run.intents.push(intent); h.run.spentMinor = 80; return intent
    })
    await h.loop.start(h.run.runId)
    expect(h.run.phase).toBe('FAILED')
    expect(h.run.answers).toHaveLength(1)
    expect(h.run.checkpoint.nextAction).toBe('retry-delivery')
    const intentId = h.run.intents[0].intentId
    await h.loop.retryDelivery(h.run.runId, intentId)
    expect(h.purchases.retryDelivery).toHaveBeenCalledWith(intentId)
    expect(h.purchases.purchase).toHaveBeenCalledTimes(1)
    expect(h.run.spentMinor).toBe(80)
    expect(h.run.answers.map(value => value.version)).toEqual([1, 2])
    expect(h.run.decisions).toHaveLength(1)
    expect(h.run.phase).toBe('DONE')
  })
  it('requires a matching grant even if purchase returns VERIFIED', async () => {
    const h = harness()
    h.purchases.purchase.mockImplementation(async input => {
      h.run.contents.push(h.content)
      return { intentId: input.intentId, runId: h.run.runId, resourceId: h.candidate.resourceId, profileId: h.candidate.profileId, version: h.candidate.version, amountMinor: 80, status: 'VERIFIED' }
    })
    await h.loop.start(h.run.runId)
    expect(h.run.phase).toBe('FAILED')
    expect(h.writeAnswer).toHaveBeenCalledTimes(1)
    expect(h.run.answers).toHaveLength(1)
  })
  it('fails safely on re-answer errors and rejects retry intents owned by other runs', async () => {
    const h = harness()
    h.writeAnswer.mockImplementationOnce(async () => ({ answer: structuredClone(exampleAnswer) })).mockRejectedValueOnce(new Error('PRIVATE_BODY'))
    await h.loop.start(h.run.runId)
    expect(h.run.answers).toHaveLength(1)
    expect(h.run.error).not.toContain('PRIVATE_BODY')
    h.run.intents[0].runId = 'other-run'
    await h.loop.retryDelivery(h.run.runId, h.run.intents[0].intentId)
    expect(h.purchases.retryDelivery).not.toHaveBeenCalled()
  })
  it('reconciles interrupted settlements without starting another purchase', async () => {
    const h = harness()
    h.run.answers = [structuredClone(exampleAnswer)]
    h.run.candidates = [exampleCandidate, h.candidate]; h.run.contents = [exampleContent]
    h.run.intents.push({ intentId: 'old-intent', runId: h.run.runId, resourceId: h.candidate.resourceId, profileId: h.candidate.profileId, version: h.candidate.version, amountMinor: 80, status: 'SUBMITTING' })
    h.purchases.reconcile.mockImplementation(async () => { h.grant(h.run.intents[0]) })
    await h.loop.start(h.run.runId)
    expect(h.purchases.reconcile).toHaveBeenCalledTimes(1)
    expect(h.purchases.purchase).not.toHaveBeenCalled()
    expect(h.run.answers).toHaveLength(2)
  })
  it('re-answers after a crash between VERIFIED and READ_PAID without repurchasing', async () => {
    const h = harness()
    h.run.answers = [structuredClone(exampleAnswer)]
    h.run.candidates = [exampleCandidate, h.candidate]; h.run.contents = [exampleContent]
    h.run.phase = 'BUY'; h.run.round = 1; h.run.checkpoint = { intentId: 'verified-intent', answerVersion: 1 }
    h.run.intents.push({ intentId: 'verified-intent', runId: h.run.runId, resourceId: h.candidate.resourceId, profileId: h.candidate.profileId, version: h.candidate.version, amountMinor: 80, status: 'VERIFIED' })
    h.grant(h.run.intents[0])
    await h.loop.start(h.run.runId)
    expect(h.run.answers.map(answer => answer.version)).toEqual([1, 2])
    expect(h.run.checkpoint.answeredIntentId).toBe('verified-intent')
    expect(h.purchases.purchase).not.toHaveBeenCalled()
  })
  it('limits continued acquisition to three rounds and one purchase per round', async () => {
    const h = harness(500)
    h.retrieve.mockResolvedValue({ candidates: [exampleCandidate, paid('a'), paid('b'), paid('c'), paid('d')], contents: [exampleContent] })
    h.writeAnswer.mockImplementation(async input => ({ answer: { ...structuredClone(exampleAnswer), version: input.version } }))
    await h.loop.start(h.run.runId)
    expect(h.run.round).toBe(3)
    expect(h.purchases.purchase).toHaveBeenCalledTimes(3)
    expect(new Set(h.run.intents.map(intent => intent.resourceId)).size).toBe(3)
    expect(h.run.answers.map(answer => answer.version)).toEqual([1, 2, 3, 4])
  })
})

describe('RunLoop × reputation (#140, #141)', () => {
  const WALLET = 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp'
  const withReputation = (reputation: RunLoopOptions['reputation']) => {
    const h = harness()
    const candidate = { ...h.candidate, wallet: WALLET }
    const retrieve = vi.fn(async () => ({ candidates: [exampleCandidate, candidate], contents: [exampleContent] }))
    const loop = new RunLoop(h.store as unknown as Store, {} as PublisherClient, h.purchases as unknown as PurchaseManager, undefined, { retrieve, writeAnswer: h.writeAnswer, reputation })
    return { ...h, loop }
  }
  it('passes reputation summaries into decide: a quarantined seller is SKIP_LOW_TRUST and never bought', async () => {
    const calibrate = vi.fn(async () => ({ status: 'SKIPPED' as const, reason: 'none' }))
    const h = withReputation({ summaries: () => ({ [WALLET]: { H: 0.4, C: 1, T: 0.4, status: 'quarantined' as const } }), calibrate })
    await h.loop.start(h.run.runId)
    expect(h.run.decisions[0].rows[0]).toMatchObject({ verdict: 'SKIP_LOW_TRUST', reputation: { status: 'quarantined' } })
    expect(h.purchases.purchase).not.toHaveBeenCalled()
    expect(calibrate).not.toHaveBeenCalled()
  })
  it('D5: a failed proof that cannot be challenged (no re-checkable claim) still costs trust, once', async () => {
    const recordProof = vi.fn()
    const h = withReputation({ summaries: () => ({}), calibrate: vi.fn(), recordProof } as never)
    Object.assign(h.purchases, { store: { ...h.store, getManifest: () => undefined, getDelivery: () => undefined }, client: {}, payer: {} })
    h.purchases.purchase.mockImplementationOnce(async input => {
      const intent: PurchaseIntent = { intentId: input.intentId, runId: h.run.runId, resourceId: input.candidate.resourceId, profileId: input.candidate.profileId, version: input.candidate.version, amountMinor: 80, status: 'CLAIM_FAILED', txHash: 'AB'.repeat(32) }
      h.run.intents.push(intent); h.run.spentMinor += 80; return intent
    })
    await h.loop.start(h.run.runId)
    expect(h.run.intents[0].status).toBe('CLAIM_FAILED') // nothing the writer could re-check
    expect(recordProof.mock.calls.filter(([c]) => c.outcome === 'REJECTED')).toHaveLength(1)
    expect(recordProof.mock.calls[0][0]).toMatchObject({ wallet: WALLET, outcome: 'REJECTED' })
  })
  it('restart: a terminal challenge outcome whose trust update a crash lost is recorded once, never twice', async () => {
    const recordProof = vi.fn()
    const h = withReputation({ summaries: () => ({}), calibrate: vi.fn(), recordProof } as never)
    h.run.answers.push({ ...structuredClone(exampleAnswer), openGaps: [] })
    h.run.candidates.push({ ...h.candidate, wallet: WALLET })
    h.run.intents.push({ intentId: 'leak', runId: h.run.runId, resourceId: h.candidate.resourceId, profileId: h.candidate.profileId, version: h.candidate.version, amountMinor: 80, status: 'REFUNDED', refund: { txHash: 'CD'.repeat(32), amountMinor: 80 } })
    await h.loop.start(h.run.runId)
    h.run.phase = 'SEARCH'
    await h.loop.start(h.run.runId)
    expect(recordProof).toHaveBeenCalledTimes(1)
    expect(recordProof.mock.calls[0][0]).toMatchObject({ wallet: WALLET, outcome: 'REFUNDED' })
    expect(h.run.checkpoint.trustRecorded).toEqual(['leak'])
  })
  it('calibrates once after each verified, granted purchase with the active provider, and a failure never blocks the run', async () => {
    let grantsAtCall = -1
    const calibrate = vi.fn(async (input: { run: RunSnapshot; intentId: string; provider: unknown }) => {
      grantsAtCall = input.run.grants.filter(g => g.intentId === input.intentId).length
      throw new Error('Clef down')
    })
    const h = withReputation({ summaries: () => ({}), calibrate: calibrate as never })
    await h.loop.start(h.run.runId)
    expect(h.purchases.purchase).toHaveBeenCalledTimes(1)
    expect(calibrate).toHaveBeenCalledTimes(1)
    expect(grantsAtCall).toBe(1)
    expect(calibrate.mock.calls[0][0].provider).toBeInstanceOf(FixtureDecisionProvider)
    expect(h.run.phase).toBe('DONE')
    expect(h.run.answers).toHaveLength(2)
  })
})

// Story-bible UC1–UC3 end to end in fixture mode (#142): the real publisher app with the v2 corpus on an
// ephemeral port, the real Store, PurchaseManager (SIMULATED rail), challenge and Reputation. No keys, no network.
describe('fixture-mode use cases, end to end (#142)', () => {
  type Bible = { useCases: { id: string; question: string; clarify: { expectedUserPick: string } | null; expectedPicks: { round1: string | null; round2: string | null } }[] }
  const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as Bible
  const uc = (id: string) => bible.useCases.find(u => u.id === id)!
  let h: Awaited<ReturnType<typeof world>>
  async function world() {
    const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
    await app.locals.ready; await app.locals.writersReady
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const client = new RealPublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
    const store = new RealStore(':memory:')
    const purchases = new RealPurchaseManager(store, client)
    const reputation = new Reputation(store)
    const loop = new RunLoop(store, client, purchases, undefined, { provider: new FixtureDecisionProvider(), reputation })
    async function ask(id: string, budgetMinor = 200) {
      const u = uc(id)
      const answers = u.clarify ? { angle: u.clarify.expectedUserPick } : undefined
      const run = store.createRun(u.question, budgetMinor)
      store.updateRun(run.runId, { checkpoint: { plan: fixturePlan(u.question, answers), ...(answers ? { answers } : {}) } })
      await loop.start(run.runId)
      return store.getRun(run.runId)
    }
    const close = async () => { store.close(); await new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()) }); app.locals.journal.close() }
    return { ask, reputation, close, store }
  }
  beforeAll(async () => { h = await world() }, 60_000)
  afterAll(async () => { await h?.close() })
  const bought = (run: RunSnapshot) => run.intents.map(i => `${i.resourceId}:${i.status}`)
  const cited = (run: RunSnapshot) => run.answers.flatMap(a => a.claims.flatMap(c => c.citations.map(r => r.resourceId)))
  const verdicts = (run: RunSnapshot, round: number) => Object.fromEntries(run.decisions.find(d => d.round === round)!.rows.map(r => [r.candidate.resourceId, r.verdict]))
  it('UC1: free sources suffice: no gap, no purchase, S$0', async () => {
    const run = await h.ask('UC1')
    expect(run.answers[0].openGaps).toEqual([])
    expect(run.intents).toEqual([])
    expect(run.spentMinor).toBe(0)
    expect(run.phase).toBe('DONE')
    expect(run.events.find(e => e.type === 'SEARCH' && e.data)?.data).toMatchObject({ searchMode: 'keyword only (embeddings unavailable)', perPublisher: { 'open-records': expect.any(Number) } })
  }, 30_000)
  it('UC2: the chosen angle drives the gap; NotFT is bought once and changes the answer', async () => {
    const run = await h.ask('UC2')
    expect(run.answers[0].openGaps.map(g => g.text)).toEqual(['No accessible analyst estimates on pricing and margins.'])
    expect(bought(run)).toEqual([`${uc('UC2').expectedPicks.round1}:VERIFIED`])
    expect(verdicts(run, 1)['mp-kestrel-deal-digest']).toBe('SKIP_REWRITE')
    expect(run.spentMinor).toBe(run.intents[0].amountMinor)
    expect(run.answers).toHaveLength(2)
    expect(run.impact?.classification).toMatch(/^(QUALIFIES|STRENGTHENS|CONTRADICTS)$/)
    expect(cited(run)).toContain(uc('UC2').expectedPicks.round1)
    expect(h.reputation.list().find(r => r.publisherSlug === 'notfinancialtimes')).toMatchObject({ passes: 1, status: 'active' })
  }, 30_000)
  it('UC3: AlphaLeak bought → CLAIM_FAILED → REFUNDED → round 2 buys The Fab Floor; a re-ask shows SKIP_LOW_TRUST', async () => {
    const { round1, round2 } = uc('UC3').expectedPicks
    const run = await h.ask('UC3')
    // AlphaLeak's 0.96 is now truly inflated against absolute relevance, so it wins round 1 on value per S$.
    expect(run.decisions[0].selectedResourceId).toBe(round1)
    expect(bought(run)).toEqual([`${round1}:REFUNDED`, `${round2}:VERIFIED`])
    const types = run.events.map(e => e.type)
    for (const type of ['SEARCH', 'PROOF', 'CHALLENGE', 'REFUND', 'REPUTATION']) expect(types).toContain(type)
    expect(types.indexOf('REFUND')).toBeLessThan(types.lastIndexOf('BUY'))
    expect(run.refundedMinor).toBe(run.intents[0].amountMinor)
    expect(verdicts(run, 2)[round1!]).toBe('SKIP_LOW_TRUST')
    expect(cited(run)).not.toContain(round1) // gate 4: quarantined, never cited
    expect(cited(run)).toContain(round2)
    expect(new Set(run.intents.map(i => i.intentId)).size).toBe(run.intents.length) // gate 3
    expect(h.reputation.list().find(r => r.publisherSlug === 'alphaleak')).toMatchObject({ H: 0.4, refunds: 1, status: 'quarantined' })
    const again = await h.ask('UC3')
    expect(verdicts(again, 1)[round1!]).toBe('SKIP_LOW_TRUST')
    expect(bought(again)).toEqual([`${round2}:VERIFIED`])
  }, 30_000)
})
