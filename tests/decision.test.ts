import { afterEach, describe, expect, it, vi } from 'vitest'
import { buyThreshold, decide, DecisionUnavailableError, FixtureDecisionProvider } from '../server/agents/decision.js'
import type { DecideInput, DecisionProvider } from '../server/agents/decision.js'
import { ClefDecisionProvider, parseClefCandidate, parseClefRound } from '../server/agents/clef.js'
import { tieBreakKey } from '../server/agents/tie-break.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import type { PublicCandidate } from '../shared/contracts/index.js'

export const paid = (resourceId: string, price = 80, extra: Partial<PublicCandidate> = {}): PublicCandidate => ({ ...exampleCandidate, resourceId, title: `Evidence ${resourceId}`, family: resourceId, tier: 'PAID', preview: 'Interviews with grid planners and energisation queue data.', facets: ['grid-energisation'], price: { amountMinor: price, currency: 'SGD' }, ...extra })
const input = (extra: Partial<DecideInput> = {}): DecideInput => ({ question: 'Will the project operate?', conclusion: 'Grid dates remain unknown.', gap: 'No independent evidence on grid energisation dates.', candidates: [paid('report')], readSources: [exampleCandidate], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, ...extra })
// Recorded response values from prompt.md §4, not a live request.
const recorded = { success: true, result: { model: 'clef-flash', answers: { addresses_gap: { type: 'noul', noul: 0.4546 }, originality: { type: 'choice', choice: 'original', probabilities: { original: 0.9035, rewrite: 0.0404, overlap: 0.0561 }, confidence: 0.7316 }, credibility: { type: 'score', score: 1.802, probabilities: { '0': 0.0234, '1': 0.1511, '2': 0.8255 }, confidence: 0.5572 } }, usage: { input_tokens: 428, output_tokens: 0 } }, errors: [], messages: [] }
const roundResponse = { success: true, result: { answers: { gap_material: { type: 'noul', noul: 0.8 } } } }
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('decision policy', () => {
  it('uses word/tag overlap, derivedFrom, authority and exact arithmetic for the stage traps', async () => {
    const result = await decide(input({ candidates: [paid('grid-report'), paid('rewrite', 30, { derivedFrom: 'supplier-report', preview: 'Summarises supplier reporting.' }), paid('expensive', 140), paid('supplier-report', 20, { facets: ['equipment-delivery'], preview: 'Supplier equipment lead times.' })] }))
    expect(result.selectedResourceId).toBe('grid-report')
    expect(result.rows.map(row => row.verdict)).toEqual(['BUY', 'SKIP_REWRITE', 'SKIP_OVER_CAP', 'SKIP_LOW_VALUE'])
    expect(result.rows[0].value).toBeCloseTo(0.9 * 1 * 0.9 * (0.5 + 0.25 * 2))
    expect(result.rows[0].valuePerDollar).toBeCloseTo(result.rows[0].value / 0.8)
    expect(result.provider).toBe('fixture')
  })
  it('computes would-buy at S$0 without selecting any resource', async () => {
    const result = await decide(input({ budgetMinor: 0 }))
    expect(result.selectedResourceId).toBeUndefined()
    expect(result.rows[0]).toMatchObject({ wouldBuy: true, verdict: 'SKIP_OVER_BUDGET' })
  })
  it('accounts for reservations, caps, previously bought resources and read derivations', async () => {
    const result = await decide(input({ spentMinor: 100, reservedMinor: 50, boughtResourceIds: ['bought'], candidates: [paid('remaining'), paid('bought'), paid('derived', 20, { derivedFrom: exampleCandidate.resourceId }), paid('cap', 101)] }))
    expect(result.rows.map(row => row.verdict)).toEqual(['SKIP_OVER_BUDGET', 'SKIP_REWRITE', 'SKIP_REWRITE', 'SKIP_OVER_CAP'])
    expect(result.selectedResourceId).toBeUndefined()
  })
  it('has no value when there is no open gap and chooses best value per dollar', async () => {
    expect((await decide(input({ gap: '' }))).rows[0].verdict).toBe('SKIP_NO_GAP')
    expect((await decide(input({ candidates: [paid('a', 80), paid('b', 40)] }))).selectedResourceId).toBe('b')
  })
  it('breaks equal value-per-dollar ties on a neutral hash, never alphabetically or on claimed relevance (#204)', async () => {
    const questions = Array.from({ length: 16 }, (_, i) => `Will project ${i} operate?`)
    const picks = await Promise.all(questions.map(async question => {
      // Identical public fields except the id, so value per dollar is exactly equal.
      const candidates = [paid('alphaleak-claim', 80, { relevance: 1 }), paid('notft-data', 80, { relevance: 1 })]
      const result = await decide(input({ question, candidates }))
      expect(result.rows.every(row => row.verdict === 'BUY')).toBe(true)
      expect(result.rows[0].valuePerDollar).toBe(result.rows[1].valuePerDollar)
      const reversed = await decide(input({ question, candidates: [...candidates].reverse() }))
      expect(reversed.selectedResourceId).toBe(result.selectedResourceId) // input order never matters
      const expected = tieBreakKey(question, 'alphaleak-claim', 'v1') < tieBreakKey(question, 'notft-data', 'v1') ? 'alphaleak-claim' : 'notft-data'
      expect(result.selectedResourceId).toBe(expected)
      return result.selectedResourceId
    }))
    expect(new Set(picks)).toEqual(new Set(['alphaleak-claim', 'notft-data']))
  })
  it('calibrates thresholds by model and permits explicit configuration', () => {
    expect(buyThreshold('@cf/cloudflare/clef-flash')).toBe(0.15)
    expect(buyThreshold('@cf/cloudflare/clef')).toBe(0.35)
    vi.stubEnv('BUY_THRESHOLD', '0.42')
    expect(buyThreshold('@cf/cloudflare/clef')).toBe(0.42)
    expect(() => buyThreshold('model', -1)).toThrow()
  })
  it('parses all public metadata before any provider call and strips nested payloads', async () => {
    const provider = new FixtureDecisionProvider()
    const candidateSpy = vi.spyOn(provider, 'judgeCandidate')
    const roundSpy = vi.spyOn(provider, 'judgeRound')
    await expect(decide(input({ candidates: [{ ...paid('bad'), price: { amountMinor: -1, currency: 'SGD' } }], provider }))).rejects.toThrow()
    expect(roundSpy).not.toHaveBeenCalled()
    const leaked = { ...paid('safe'), body: 'PAID_CANARY', spans: [{ text: 'PAID_CANARY' }], price: { amountMinor: 80, currency: 'SGD' as const, secret: 'PAID_CANARY' } }
    await decide(input({ candidates: [leaked], readSources: [{ ...exampleCandidate, body: 'PAID_CANARY' } as typeof exampleCandidate], provider }))
    expect(JSON.stringify(candidateSpy.mock.calls)).not.toContain('PAID_CANARY')
  })
  it('starts one round and every candidate concurrently; a failed call fails the round with no fixture substitution (#197)', async () => {
    const calls: string[] = []
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const fixture = new FixtureDecisionProvider()
    const provider: DecisionProvider = { name: 'cloudflare', model: '@cf/cloudflare/clef', judgeRound: async value => { calls.push('round'); await barrier; return fixture.judgeRound(value) }, judgeCandidate: async value => { calls.push(value.candidate.resourceId); await barrier; throw new Error('secret-token must never be displayed') } }
    const pending = decide(input({ provider, candidates: [paid('a'), paid('b')] }))
    expect(calls).toEqual(['round', 'a', 'b'])
    release()
    const error = await pending.then(() => undefined, (e: unknown) => e)
    expect(error).toBeInstanceOf(DecisionUnavailableError)
    expect(error).toMatchObject({ status: 'provider error', message: 'Decision model unavailable (provider error)' })
    expect(JSON.stringify(error)).not.toContain('secret-token')
    expect((error as Error).message).not.toContain('secret-token')
  })
})

describe('recorded Clef client', () => {
  it('reads noul probability without confidence and score/probabilities exactly', () => {
    expect(parseClefCandidate(recorded)).toEqual({ addressesGap: 0.4546, originality: { original: 0.9035, rewrite: 0.0404, overlap: 0.0561 }, credibility: 1.802 })
    expect(parseClefRound(roundResponse)).toEqual({ gapMaterial: 0.8 })
    expect(() => parseClefCandidate({ ...recorded, success: false })).toThrow()
    expect(() => parseClefCandidate({ success: true, result: { answers: {} } })).toThrow()
  })
  it('resolves the sole account once for parallel calls and sends public state only', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    const transport = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith('/accounts')) return response({ success: true, result: [{ id: 'account' }] })
      return response(String(init?.body).includes('gap_material') ? roundResponse : recorded)
    })
    const provider = new ClefDecisionProvider({ token: 'mock-token', fetch: transport })
    const result = await decide(input({ provider, candidates: [{ ...paid('safe'), body: 'PAID_CANARY' } as PublicCandidate] }))
    expect(result.provider).toBe('cloudflare')
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/accounts'))).toHaveLength(1)
    expect(transport).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(transport.mock.calls)).not.toContain('PAID_CANARY')
    expect(JSON.stringify(transport.mock.calls)).not.toContain('/tokens/verify')
  })
  it('retries once on HTTP failure and rejects ambiguous account resolution', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(response(roundResponse))
    const provider = new ClefDecisionProvider({ token: 'mock', accountId: 'account', fetch: transport })
    expect(await provider.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })).toEqual({ gapMaterial: 0.8 })
    expect(transport).toHaveBeenCalledTimes(2)
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '')
    await expect(new ClefDecisionProvider({ token: 'mock', fetch: async () => response({ success: true, result: [{ id: 'a' }, { id: 'b' }] }) }).resolveAccount()).rejects.toThrow()
  })
  it('retries malformed model answers once, then fails the round as an invalid response (#197)', async () => {
    const transport = vi.fn<typeof fetch>(async (_url, init) => response(String(init?.body).includes('gap_material') ? roundResponse : { success: true, result: { answers: {} } }))
    await expect(decide(input({ provider: new ClefDecisionProvider({ token: 'mock', accountId: 'account', fetch: transport }) }))).rejects.toMatchObject({ status: 'invalid response' })
    expect(transport).toHaveBeenCalledTimes(3) // round once, invalid candidate twice
  })
  it('aborts at the 5 s default per attempt even when transport ignores abort, then fails the round (#195, #197)', async () => {
    vi.useFakeTimers()
    vi.stubEnv('CLEF_TIMEOUT_MS', '')
    const transport = vi.fn<typeof fetch>(() => new Promise(() => {}))
    const provider = new ClefDecisionProvider({ token: 'mock', accountId: 'account', fetch: transport })
    const failed = expect(decide(input({ provider }))).rejects.toMatchObject({ status: 'timeout' })
    await vi.advanceTimersByTimeAsync(9999)
    expect(transport).toHaveBeenCalledTimes(4) // round + candidate, two attempts each
    await vi.advanceTimersByTimeAsync(2)
    await failed
    expect(transport.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true)
  })
  it('never uses global fetch without explicit live opt-in', async () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch')
    await expect(decide(input({ provider: new ClefDecisionProvider({ token: 'mock', accountId: 'account' }) }))).rejects.toBeInstanceOf(DecisionUnavailableError)
    expect(globalFetch).not.toHaveBeenCalled()
  })
})
