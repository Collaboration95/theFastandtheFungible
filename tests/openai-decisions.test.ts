// OpenAI Decisions provider (#214) with a mocked transport only: no live call, no key.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buyThreshold, decide, decisionModel, DecisionUnavailableError, NO_GAP_NOT_CALLED } from '../server/agents/decision.js'
import type { DecideInput } from '../server/agents/decision.js'
import { candidateQuestions, chunkCandidates, DECISIONS_PROMPT_VERSION, DECISIONS_URL, decisionsPromptVersion, EVIDENCE, GAP_WORDINGS, PRODUCTION, OpenAIDecisionsProvider, parseDecisionsAnswers, type DecisionsQuestion } from '../server/agents/openai-decisions.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import { decisionLabel, type PublicCandidate } from '../shared/contracts/index.js'
import { clefQuestions } from '../server/agents/clef.js'

const paid = (resourceId: string, price = 80, extra: Partial<PublicCandidate> = {}): PublicCandidate => ({ ...exampleCandidate, resourceId, title: `Evidence ${resourceId}`, family: resourceId, tier: 'PAID', preview: 'Interviews with grid planners and energisation queue data.', facets: ['grid-energisation'], price: { amountMinor: price, currency: 'SGD' }, ...extra })
const input = (extra: Partial<DecideInput> = {}): DecideInput => ({ question: 'Will the project operate?', conclusion: 'Grid dates remain unknown.', gap: 'No independent evidence on grid energisation dates.', candidates: [paid('report')], readSources: [exampleCandidate], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, ...extra })
type Body = { model: string; input: string; questions: DecisionsQuestion[] }
type Scores = { addressesGap: number; original: number; credibility: number }
/**
 * A Decisions double: answers every question it was asked, by name, in REVERSED order, with choice probabilities in
 * reversed option order, so any index-based mapping would read the wrong values.
 */
function decisions(scores: (resourceId: string) => Scores = () => ({ addressesGap: 0.9, original: 0.9, credibility: 2 }), gapMaterial = 0.8) {
  const bodies: Body[] = []
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Body
    bodies.push(body)
    const state = JSON.parse(body.input) as { candidates?: { resourceId: string }[]; candidate?: { resourceId: string } }
    const resourceOf = (name: string) => { const match = /^c(\d+)_/.exec(name); return match ? state.candidates![Number(match[1])].resourceId : state.candidate?.resourceId ?? '' }
    const answers = body.questions.map(q => {
      const s = scores(resourceOf(q.name))
      if (q.name === 'gap_material') return { type: 'predicate', name: q.name, probability: gapMaterial }
      if (q.type === 'predicate') return { type: 'predicate', name: q.name, probability: s.addressesGap }
      if (q.type === 'choice') return { type: 'choice', name: q.name, choice: 'original', probabilities: [{ value: 'overlap', probability: (1 - s.original) / 2 }, { value: 'rewrite', probability: (1 - s.original) / 2 }, { value: 'original', probability: s.original }], confidence: 1 }
      return { type: 'score', name: q.name, score: s.credibility, probabilities: [], confidence: 1 }
    }).reverse()
    return Response.json({ model: body.model, answers, usage: { input_tokens: 500, output_tokens: 0 } })
  })
  return { transport, bodies, provider: (extra: ConstructorParameters<typeof OpenAIDecisionsProvider>[0] = {}) => new OpenAIDecisionsProvider({ apiKey: 'mock-key', fetch: transport, ...extra }) }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('OpenAI Decisions provider (#214)', () => {
  it('sends one batch-evidence request per round: public state only, the gap question plus indexed per-candidate questions', async () => {
    const d = decisions()
    const leaky = { ...paid('a', 80, { relevance: 0.7 }), body: 'PAID_CANARY', spans: [{ id: 's', text: 'PAID_CANARY' }] } as PublicCandidate
    const round = await decide(input({ provider: d.provider(), candidates: [leaky, paid('b', 40)] }))
    expect(d.transport).toHaveBeenCalledTimes(1)
    expect(d.transport.mock.calls[0][0]).toBe(DECISIONS_URL)
    const [body] = d.bodies
    expect(body.model).toBe('gpt-6-luna')
    const state = JSON.parse(body.input)
    expect(Object.keys(state)).toEqual(['question', 'conclusion', 'gap', 'readSources', 'candidates'])
    expect(state.candidates.map((c: { resourceId: string }) => c.resourceId)).toEqual(['a', 'b'])
    // The same Zod-stripped public projection Clef sees: no body, spans, price, wallet, url or manifest.
    for (const forbidden of ['PAID_CANARY', 'price', 'amountMinor', 'wallet', 'url', 'manifest', 'spans']) expect(body.input).not.toContain(forbidden)
    expect(body.questions.map(q => q.name)).toEqual(['gap_material', 'c0_addresses_gap', 'c0_originality', 'c0_credibility', 'c1_addresses_gap', 'c1_originality', 'c1_credibility'])
    expect(body.questions[0]).toEqual({ name: 'gap_material', type: 'predicate', instructions: clefQuestions.round.gap_material.instructions })
    expect(body.questions[4].instructions).toBe(`Evaluate only candidates[1] (resourceId b). ${EVIDENCE.candidate.addresses_gap}`)
    // Pinned option order (#214): original, rewrite, overlap; levels 0, 1, 2.
    expect(body.questions[2]).toMatchObject({ type: 'choice', choices: [{ value: 'original' }, { value: 'rewrite' }, { value: 'overlap' }] })
    expect(body.questions[3]).toMatchObject({ type: 'score', levels: [{ label: '0' }, { label: '1' }, { label: '2' }] })
    expect(round).toMatchObject({ provider: 'openai', model: 'gpt-6-luna', promptVersion: DECISIONS_PROMPT_VERSION, threshold: 0.2, selectedResourceId: 'b' })
    expect(decisionLabel(round)).toBe('OpenAI Decisions · gpt-6-luna')
  })
  it('switches the gap_material wording with DECISIONS_GAP_WORDING (default plain) and records it in the version', async () => {
    expect(GAP_WORDINGS.plain).toBe('The open gap is part of what the question asks.')
    expect(DECISIONS_PROMPT_VERSION).toBe(decisionsPromptVersion('plain'))
    expect(DECISIONS_PROMPT_VERSION).toMatch(/^batch-evidence\/v1\+gap-plain /)
    for (const [env, wording] of [[undefined, 'plain'], ['plain', 'plain'], ['bogus', 'plain'], ['evidence', 'evidence']] as const) {
      if (env !== undefined) vi.stubEnv('DECISIONS_GAP_WORDING', env)
      const d = decisions()
      const round = await decide(input({ provider: d.provider() }))
      const [body] = d.bodies
      expect(body.questions[0].instructions).toBe(GAP_WORDINGS[wording])
      // Only the gap instruction changes: the candidate questions are the benchmark's either way.
      expect(body.questions[1].instructions).toBe(`Evaluate only candidates[0] (resourceId report). ${EVIDENCE.candidate.addresses_gap}`)
      expect(round.promptVersion).toBe(decisionsPromptVersion(wording))
      expect(round.promptVersion).toContain(`+gap-${wording}`)
      vi.unstubAllEnvs()
    }
    expect(GAP_WORDINGS.evidence).toBe(EVIDENCE.round.gap_material)
    // judgeRound (no batch) and an explicit option use the same switch.
    const d = decisions()
    const provider = d.provider({ gapWording: 'evidence' })
    await provider.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })
    expect(d.bodies[0].questions[0].instructions).toBe(EVIDENCE.round.gap_material)
    expect(provider.promptVersion).toContain('+gap-evidence')
  })
  it('switches the candidate and paid wording with DECISIONS_WORDING (default evidence), independent of the gap wording', async () => {
    const bodyFor = async (provider: OpenAIDecisionsProvider, d: ReturnType<typeof decisions>) => { const round = await decide(input({ provider, candidates: [paid('a'), paid('b')] })); return { round, body: d.bodies[0] } }
    // Default: today's benchmark bundle.
    let d = decisions()
    let { round, body } = await bodyFor(d.provider(), d)
    expect(body.questions.slice(1, 4)).toEqual([
      { name: 'c0_addresses_gap', type: 'predicate', instructions: `Evaluate only candidates[0] (resourceId a). ${EVIDENCE.candidate.addresses_gap}` },
      { name: 'c0_originality', type: 'choice', instructions: `Evaluate only candidates[0] (resourceId a). ${EVIDENCE.candidate.originality}`, choices: EVIDENCE.originality },
      { name: 'c0_credibility', type: 'score', instructions: `Evaluate only candidates[0] (resourceId a). ${EVIDENCE.candidate.credibility}`, levels: EVIDENCE.credibility },
    ])
    expect(round.promptVersion).toMatch(/^batch-evidence\/v1\+gap-plain /)
    // production: the Clef wording mapped noul → predicate, criteria → choices by value / levels 0–2, pinned order.
    vi.stubEnv('DECISIONS_WORDING', 'production')
    vi.stubEnv('DECISIONS_GAP_WORDING', 'evidence')
    d = decisions()
    ;({ round, body } = await bodyFor(d.provider(), d))
    const c = clefQuestions.candidate
    expect(body.questions[0].instructions).toBe(EVIDENCE.round.gap_material)
    expect(body.questions.slice(4, 7)).toEqual([
      { name: 'c1_addresses_gap', type: 'predicate', instructions: `Evaluate only candidates[1] (resourceId b). ${c.addresses_gap.instructions}` },
      { name: 'c1_originality', type: 'choice', instructions: `Evaluate only candidates[1] (resourceId b). ${c.originality.instructions}`, choices: [
        { value: 'original', description: c.originality.criteria.original }, { value: 'rewrite', description: c.originality.criteria.rewrite }, { value: 'overlap', description: c.originality.criteria.overlap }] },
      { name: 'c1_credibility', type: 'score', instructions: `Evaluate only candidates[1] (resourceId b). ${c.credibility.instructions}`, levels: [
        { label: '0', description: c.credibility.criteria[0] }, { label: '1', description: c.credibility.criteria[1] }, { label: '2', description: c.credibility.criteria[2] }] },
    ])
    expect(round.promptVersion).toBe(decisionsPromptVersion('evidence', 'production'))
    expect(round.promptVersion).toMatch(/^batch-production\/v1\+gap-evidence /)
    // Paid relevance and the per-candidate path follow the same switch.
    d = decisions()
    const provider = d.provider()
    await provider.judgePaidRelevance({ question: 'q', gap: 'g', content: { resourceId: 'a', spans: [{ id: 's', text: 'passage' }] } as never })
    expect(d.bodies[0].questions).toEqual([{ name: 'addresses_gap', type: 'predicate', instructions: PRODUCTION.paid.addresses_gap }])
    expect(PRODUCTION.paid.addresses_gap).toBe(clefQuestions.paid.addresses_gap.instructions)
    vi.unstubAllEnvs()
    d = decisions()
    await d.provider().judgePaidRelevance({ question: 'q', gap: 'g', content: { resourceId: 'a', spans: [{ id: 's', text: 'passage' }] } as never })
    expect(d.bodies[0].questions[0].instructions).toBe(EVIDENCE.paid.addresses_gap)
    expect(candidateQuestions(undefined, 'production')[0].instructions).toBe(c.addresses_gap.instructions)
  })
  it('maps answers by question name and option value, never by position', async () => {
    const d = decisions(id => id === 'a' ? { addressesGap: 0.1, original: 0.2, credibility: 0.5 } : { addressesGap: 0.95, original: 0.5, credibility: 1.8 }, 0.7)
    const round = await decide(input({ provider: d.provider(), candidates: [paid('a'), paid('b')] }))
    expect(round.gapMaterial).toBe(0.7)
    expect(round.rows.map(r => [r.candidate.resourceId, r.judgment])).toEqual([
      ['a', { addressesGap: 0.1, originality: { original: 0.2, rewrite: 0.4, overlap: 0.4 }, credibility: 0.5 }],
      ['b', { addressesGap: 0.95, originality: { original: 0.5, rewrite: 0.25, overlap: 0.25 }, credibility: 1.8 }],
    ])
    expect(round.selectedResourceId).toBe('b')
  })
  it('a refusal fails the round at once: nothing bought, no retry, no substitution (H3)', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ answers: [{ type: 'refusal', name: 'gap_material' }] }))
    const error = await decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'mock-key', fetch: transport }) })).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DecisionUnavailableError)
    expect(error).toMatchObject({ status: 'refusal' })
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('an invalid answer is retried once, then fails the round; a 4xx or exhausted credit fails at once', async () => {
    const missing = vi.fn<typeof fetch>(async () => Response.json({ answers: [{ type: 'predicate', name: 'gap_material', probability: 0.5 }] }))
    await expect(decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'k', fetch: missing }) }))).rejects.toMatchObject({ status: 'invalid response' })
    expect(missing).toHaveBeenCalledTimes(2)
    const rejected = vi.fn<typeof fetch>(async () => new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 }))
    await expect(decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'k', fetch: rejected }) }))).rejects.toMatchObject({ status: 'HTTP 401' })
    expect(rejected).toHaveBeenCalledTimes(1)
    const broke = vi.fn<typeof fetch>(async () => new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }))
    await expect(decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'k', fetch: broke }) }))).rejects.toMatchObject({ status: 'no credit' })
    expect(broke).toHaveBeenCalledTimes(1)
    const flaky = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 503 }))
    const d = decisions()
    flaky.mockImplementation(d.transport)
    expect((await decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'k', fetch: flaky }) }))).selectedResourceId).toBe('report')
    expect(flaky).toHaveBeenCalledTimes(2)
  })
  it('rejects duplicated, unexpected or incomplete choice answers rather than guessing', () => {
    const questions = [...candidateQuestions()]
    const good = [{ type: 'predicate', name: 'addresses_gap', probability: 0.5 }, { type: 'choice', name: 'originality', probabilities: [{ value: 'original', probability: 1 }, { value: 'rewrite', probability: 0 }, { value: 'overlap', probability: 0 }] }, { type: 'score', name: 'credibility', score: 1 }]
    expect(parseDecisionsAnswers({ answers: good }, questions).size).toBe(3)
    expect(() => parseDecisionsAnswers({ answers: [...good, good[0]] }, questions)).toThrow()
    expect(() => parseDecisionsAnswers({ answers: [...good, { type: 'predicate', name: 'extra', probability: 1 }] }, questions)).toThrow()
    expect(() => parseDecisionsAnswers({ answers: good.slice(1) }, questions)).toThrow()
  })
  it('times out at 5 s per attempt by default and fails the round', async () => {
    vi.useFakeTimers()
    vi.stubEnv('DECISION_TIMEOUT_MS', '')
    vi.stubEnv('CLEF_TIMEOUT_MS', '')
    const transport = vi.fn<typeof fetch>(() => new Promise(() => {}))
    const failed = expect(decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'k', fetch: transport }) }))).rejects.toMatchObject({ status: 'timeout' })
    await vi.advanceTimersByTimeAsync(5001)
    expect(transport).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5001)
    await failed
    expect(transport.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true)
  })
  it('splits a round above the question limit into parallel requests and still maps every candidate by name', async () => {
    expect(chunkCandidates(8, 19)).toEqual([[0, 1, 2, 3, 4, 5], [6, 7]])
    expect(chunkCandidates(8, 25)).toEqual([[0, 1, 2, 3, 4, 5, 6, 7]])
    expect(chunkCandidates(0, 19)).toEqual([[]])
    const ids = Array.from({ length: 8 }, (_, i) => `c-${i}`)
    const d = decisions(id => ({ addressesGap: 0.5 + Number(id.slice(2)) / 20, original: 0.9, credibility: 1 }))
    const round = await decide(input({ provider: d.provider(), candidates: ids.map(id => paid(id)) }))
    expect(d.bodies.map(b => b.questions.length)).toEqual([19, 6])
    expect(d.bodies[1].questions.map(q => q.name)).toEqual(['c6_addresses_gap', 'c6_originality', 'c6_credibility', 'c7_addresses_gap', 'c7_originality', 'c7_credibility'])
    expect(round.rows.map(r => r.judgment.addressesGap)).toEqual(ids.map((_, i) => 0.5 + i / 20))
    const one = decisions()
    await decide(input({ provider: one.provider({ maxQuestions: 25 }), candidates: ids.map(id => paid(id)) }))
    expect(one.bodies.map(b => b.questions.length)).toEqual([25])
  })
  it('makes no call when the gap is empty: policy records SKIP_NO_GAP, labelled', async () => {
    const d = decisions()
    const round = await decide(input({ gap: ' ', provider: d.provider(), candidates: [paid('a'), paid('digest', 20, { derivedFrom: 'a' })] }))
    expect(d.transport).not.toHaveBeenCalled()
    expect(round.rows.map(r => [r.verdict, r.reason])).toEqual([['SKIP_NO_GAP', NO_GAP_NOT_CALLED], ['SKIP_REWRITE', 'Already acquired or a rewrite of existing evidence.']])
    expect(round).toMatchObject({ provider: 'openai', gapMaterial: 0 })
    expect(round.selectedResourceId).toBeUndefined()
  })
  it('never uses global fetch without explicit live opt-in, and needs a key', async () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch')
    await expect(decide(input({ provider: new OpenAIDecisionsProvider({ apiKey: 'k' }) }))).rejects.toBeInstanceOf(DecisionUnavailableError)
    vi.stubEnv('OPENAI_API_KEY', '')
    await expect(decide(input({ provider: new OpenAIDecisionsProvider({ fetch: decisions().transport }) }))).rejects.toMatchObject({ status: 'no credentials' })
    expect(globalFetch).not.toHaveBeenCalled()
  })
  it('the calibration call goes through the same provider with the paid wording, in its own request', async () => {
    const d = decisions(() => ({ addressesGap: 0.6, original: 1, credibility: 1 }))
    const content = { profileId: 'p', resourceId: 'r', version: 'v1', title: 't', publisher: 'p', body: 'Granted text.', spans: [{ id: 's', text: 'Granted text.' }] }
    expect(await d.provider().judgePaidRelevance({ question: 'q', gap: 'g', content })).toEqual({ observed: 0.6 })
    expect(d.bodies[0].questions).toEqual([{ name: 'addresses_gap', type: 'predicate', instructions: EVIDENCE.paid.addresses_gap }])
    expect(JSON.parse(d.bodies[0].input)).toEqual({ question: 'q', gap: 'g', passages: ['Granted text.'] })
  })
  it('picks the model per provider, so DECISION_PROVIDER=cloudflare alone reverts; luna runs raw at 0.20', () => {
    expect(decisionModel('openai', '@cf/cloudflare/clef-flash')).toBe('gpt-6-luna')
    expect(decisionModel('openai', undefined)).toBe('gpt-6-luna')
    expect(decisionModel('openai', 'gpt-6-luna-next')).toBe('gpt-6-luna-next')
    expect(decisionModel('cloudflare', 'gpt-6-luna')).toBe('@cf/cloudflare/clef-flash')
    expect(decisionModel('cloudflare', '@cf/cloudflare/clef')).toBe('@cf/cloudflare/clef')
    expect(buyThreshold('gpt-6-luna', '')).toBe(0.2)
  })
})
