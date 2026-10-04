import { describe, expect, it, vi } from 'vitest'
import { RunLoop } from '../server/agents/loop.js'
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
