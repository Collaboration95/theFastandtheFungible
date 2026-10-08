// #212 harness port: statistics, the opt-in transport, the provider adapters and real-corpus scenarios.
// Mocks only: no provider is ever reached, and no live flag is set.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyCalibration, chooseCalibration, fitCalibration } from '../../eval/decisions/calibration.js'
import { binaryMetrics, decisionMetrics, mcnemar, pairedBootstrap } from '../../eval/decisions/metrics.js'
import { HarnessDecisionProvider, judgment, mapQuestions, normalize } from '../../eval/decisions/providers/decisions.js'
import { buildScenarios, candidateState, evaluate, plannedCalls, select, testLock } from '../../eval/decisions/run.js'
import { compare, summarizeRows } from '../../eval/decisions/analyze.js'
import { enableLive, request, setTransport } from '../../eval/decisions/transport.js'
import { loadWorld, type World } from '../../eval/decisions/world.js'
import { clefQuestions } from '../../server/agents/clef.js'

const out = mkdtempSync(join(tmpdir(), 'tftf-eval-out-'))
const realFetch = globalThis.fetch
let world: World
beforeAll(async () => { process.env.EVAL_OUT = out; globalThis.fetch = (async () => { throw new Error('network forbidden') }) as typeof fetch; world = await loadWorld() })
afterEach(() => setTransport(undefined))
afterAll(() => { delete process.env.EVAL_OUT; globalThis.fetch = realFetch; rmSync(out, { recursive: true, force: true }) })

const clefOk = (answers: Record<string, unknown>) => new Response(JSON.stringify({ success: true, result: { answers, usage: { input_tokens: 50, output_tokens: 0 } } }), { status: 200 })

describe('ported statistics (#212)', () => {
  it('keeps the bench metrics: loss, discrimination, purchase F1, McNemar and paired bootstrap', () => {
    const perfect = binaryMetrics([0, 0, 1, 1], [0, 0, 1, 1])
    expect(perfect.brier).toBe(0)
    expect(perfect.auroc).toBe(1)
    expect(binaryMetrics([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]).auroc).toBe(0.5)
    const d = decisionMetrics([{ expected: 'a', selected: 'a', priceMinor: 30 }, { expected: null, selected: 'b', priceMinor: 20 }, { expected: 'c', selected: null, priceMinor: 0 }])
    expect(d).toMatchObject({ precision: 0.5, recall: 0.5, wastedSpend: 20, missedValue: 1 })
    expect(mcnemar([true, true, false], [false, true, false])).toMatchObject({ b: 1, c: 0, pValue: 1 })
    const boot = pairedBootstrap([1, 1, 1, 0], [0, 0, 1, 0], rows => rows.reduce((s, x) => s + x, 0) / rows.length, 200)
    expect(boot.difference).toBe(0.5)
  })
  it('fits calibration on dev only and keeps identity without independent groups', () => {
    expect(() => chooseCalibration([{ p: 0.2, y: 0, split: 'test' }])).toThrow(/dev only/)
    expect(chooseCalibration([{ p: 0.2, y: 0, group: 'a' }]).method).toBe('identity')
    const iso = fitCalibration([{ p: 0.1, y: 0 }, { p: 0.4, y: 1 }, { p: 0.6, y: 0 }, { p: 0.9, y: 1 }], 'isotonic')
    expect(applyCalibration(iso, 0.95)).toBe(1)
  })
})

describe('transport opt-in (#212)', () => {
  it('refuses a call with no cache, no live opt-in and no mock, without touching the network', async () => {
    await expect(request('flash', { state: 'x' }, { phase: 'unit', kind: 'round' })).rejects.toThrow(/live calls are off/)
    expect(() => enableLive()).toThrow(/EVAL_LIVE=1/)
    process.env.EVAL_LIVE = '1'
    try { expect(() => enableLive()).toThrow(/test runner/) } finally { delete process.env.EVAL_LIVE }
  })
  it('caches a mocked call without writing any credential, then replays it with no transport', async () => {
    let calls = 0
    setTransport(async (_url, init) => { calls++; expect(String((init?.headers as Record<string, string>).Authorization)).toContain('mock-credential'); return clefOk({ gap_material: { type: 'noul', noul: 0.7 } }) })
    const first = await request('flash', { state: 'cache-me' }, { phase: 'unit', kind: 'round' })
    setTransport(undefined)
    const again = await request('flash', { state: 'cache-me' }, { phase: 'unit', kind: 'round' })
    expect(calls).toBe(1)
    expect(again.cacheHit).toBe(true)
    expect(again.key).toBe(first.key)
    const cached = readdirSync(join(out, 'cache')).map(f => readFileSync(join(out, 'cache', f), 'utf8')).join('\n')
    expect(cached).not.toContain('mock-credential')
  })
})

describe('provider adapters (#212)', () => {
  it('maps Clef questions to Decisions questions and fails on a refusal rather than scoring zero', () => {
    expect(mapQuestions(clefQuestions.candidate as never).map(q => q.type)).toEqual(['predicate', 'choice', 'score'])
    expect(() => normalize('luna', { answers: [{ name: 'a', type: 'refusal' }] })).toThrow(/refusal/)
    expect(() => judgment({})).toThrow()
    const answers = normalize('luna', { answers: [{ name: 'addresses_gap', type: 'predicate', probability: 0.6 }, { name: 'originality', type: 'choice', probabilities: [{ value: 'original', probability: 0.8 }, { value: 'rewrite', probability: 0.1 }, { value: 'overlap', probability: 0.1 }] }, { name: 'credibility', type: 'score', score: 2 }] })
    expect(judgment(answers)).toMatchObject({ addressesGap: 0.6, credibility: 2 })
    expect(answers.originality.choice).toBe('original')
  })
  it('runs the harness provider over a mocked Clef transport', async () => {
    setTransport(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { questions: Record<string, unknown> }
      return clefOk(body.questions.gap_material ? { gap_material: { type: 'noul', noul: 0.8 } } : { addresses_gap: { type: 'noul', noul: 0.5 }, originality: { type: 'choice', choice: 'original', probabilities: { original: 0.9, rewrite: 0.05, overlap: 0.05 } }, credibility: { type: 'score', score: 1 } })
    })
    const p = new HarnessDecisionProvider('flash', 'unit')
    expect((await p.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })).gapMaterial).toBe(0.8)
    const candidate = [...world.articles.values()].find(a => a.tier === 'PAID')!
    const { candidateOf } = await import('../../eval/decisions/world.js')
    expect((await p.judgeCandidate({ question: 'q', gap: 'g', readSources: [], candidate: candidateOf(world, candidate, 0.5) })).addressesGap).toBe(0.5)
    expect(p.records).toHaveLength(2)
  })
})

describe('real-corpus scenarios (#212)', () => {
  it('builds one scenario per bank question, with dev and test splits and in-domain labels', async () => {
    const scenarios = await buildScenarios(world)
    expect(scenarios.length).toBeGreaterThanOrEqual(40)
    expect(new Set(scenarios.map(s => s.split))).toEqual(new Set(['dev', 'test']))
    const uc2 = scenarios.find(s => s.id === 'Q09')!
    expect(uc2.labels['notft-kestrel-tsmc-deal-margins']).toBe(1)
    expect(uc2.gaps.requested).toMatch(/Analysts/)
    expect(uc2.gaps.requested).not.toMatch(/55\.2/)
    expect(testLock(scenarios)).toMatch(/^[0-9a-f]{64}$/)
    // Candidate requests carry public fields only.
    const state = JSON.stringify(candidateState(uc2, uc2.gaps.requested, uc2.candidates[0]))
    for (const forbidden of ['amountMinor', 'wallet', 'body', 'spans', 'manifest']) expect(state).not.toContain(forbidden)
    expect(plannedCalls(uc2, 'batch-evidence', false)).toBe(1)
    expect(plannedCalls(uc2, 'baseline', false)).toBe(1 + uc2.candidates.length)
  })
  it('evaluates the fixture arm through the real policy and summarizes it', async () => {
    const scenarios = (await buildScenarios(world)).filter(s => ['Q09', 'Q01', 'Q42'].includes(s.id))
    const rows = await Promise.all(scenarios.map(s => evaluate(world, s, 'fixture')))
    expect(rows.find(r => r.id === 'Q09')?.selected).toBe('notft-kestrel-tsmc-deal-margins')
    const summary = summarizeRows(rows)
    expect(summary.n).toBe(3)
    expect(summary.failedRounds).toBe(0)
    expect(compare(rows, rows).f1.difference).toBe(0)
  })
  it('lets budget and cap bind under a maximally positive judgment', async () => {
    const s = (await buildScenarios(world)).find(x => x.id === 'Q09')!
    const max = s.candidates.map(() => ({ addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }))
    expect((await select({ ...s, budgetMinor: 0 }, 'luna', 'gap', 1, max, 0.2)).selected).toBeNull()
    expect((await select({ ...s, perSourceCapMinor: 5 }, 'luna', 'gap', 1, max, 0.2)).selected).toBeNull()
  })
})
