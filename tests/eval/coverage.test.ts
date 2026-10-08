// #213 harness: requirement-level coverage labels over fixed evidence snapshots, both model arms wired
// against mocked transports, and the false-complete / false-missing metrics. No live call.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { COVERAGE_RUBRIC, deciderQuestions, deciderState, parseWriter, predict, writerBody } from '../../eval/coverage/arms.js'
import { coverageMetrics } from '../../eval/coverage/metrics.js'
import { buildSnapshots, STATUSES, type Snapshot } from '../../eval/coverage/snapshots.js'
import { setTransport } from '../../eval/decisions/transport.js'
import { loadWorld } from '../../eval/decisions/world.js'
import { loadBank } from '../../eval/questions/bank.js'

const out = mkdtempSync(join(tmpdir(), 'tftf-coverage-out-'))
const realFetch = globalThis.fetch
let snapshots: Snapshot[]
beforeAll(async () => { process.env.EVAL_OUT = out; globalThis.fetch = (async () => { throw new Error('network forbidden') }) as typeof fetch; snapshots = await buildSnapshots(await loadWorld(), loadBank()) })
afterEach(() => setTransport(undefined))
afterAll(() => { delete process.env.EVAL_OUT; globalThis.fetch = realFetch; rmSync(out, { recursive: true, force: true }) })
const snap = (id: string) => snapshots.find(s => s.id === id)!

describe('coverage labels (#213)', () => {
  it('labels requirements by construction across all four statuses', () => {
    const gold = snapshots.flatMap(s => Object.values(s.gold))
    for (const status of STATUSES) expect(gold).toContain(status)
    expect(snap('Q09:free').gold['Q09.margin']).toBe('missing')
    expect(snap('Q09:free+paid').gold['Q09.margin']).toBe('supported')
    expect(snap('Q45:free+paid').gold['Q45.rate']).toBe('conflicting')
    expect(snap('Q18:traps').gold['Q18.series']).toBe('missing')
    for (const s of snapshots.filter(x => x.questionId === 'Q42')) expect(s.gold['Q42.current']).toBe('missing')
  })
  it('includes the hard cases #213 names: topic present but answer absent, forecasts, wrong date or entity, conflicts', () => {
    const kinds = new Set(snapshots.flatMap(s => s.trapKinds))
    for (const kind of ['topic-only', 'forecast-as-fact', 'wrong-date', 'wrong-entity']) expect(kinds).toContain(kind)
    // UC2's trap: the free filing speaks about margins but gives no analyst figure.
    expect(snap('Q16:free').trapKinds).toContain('topic-only')
    expect(snap('Q16:free').gold['Q16.margin']).toBe('missing')
  })
  it('gives judges the frozen need text and evidence, never the planted answer or the gold label', () => {
    const s = snap('Q16:free')
    const bodies = [JSON.stringify(writerBody(s)), JSON.stringify({ state: deciderState(s), questions: deciderQuestions(s) })]
    for (const body of bodies) {
      expect(body).not.toContain('55.2%')
      expect(body).not.toContain('"gold"')
      expect(body).not.toContain(`"Q16.margin":"${s.gold['Q16.margin']}"`)
      expect(body).toContain('Q16.margin')
    }
    expect(Object.keys(deciderQuestions(snap('Q09:free+paid')))).toEqual(['r0', 'r1'])
    expect(Object.keys(COVERAGE_RUBRIC)).toEqual([...STATUSES])
  })
})

describe('coverage arms and metrics (#213)', () => {
  it('runs the decision-model arm as one multi-question request per snapshot (mocked)', async () => {
    let calls = 0
    setTransport(async (_url, init) => {
      calls++
      const body = JSON.parse(String(init?.body)) as { questions: Record<string, unknown> }
      const answers = Object.fromEntries(Object.keys(body.questions).map(k => [k, { type: 'choice', choice: 'supported', probabilities: { supported: 0.7, partial: 0.1, missing: 0.1, conflicting: 0.1 } }]))
      return new Response(JSON.stringify({ success: true, result: { answers } }), { status: 200 })
    })
    const p = await predict('flash', snap('Q09:free+paid'))
    expect(calls).toBe(1)
    expect(p.statuses).toEqual({ 'Q09.margin': 'supported', 'Q09.price': 'supported' })
  })
  it('runs the writer arm in the answer call and treats an unparsed status as an error, not a label', async () => {
    setTransport(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ conclusion: 'x', claims: [], openGaps: [], coverage: [{ id: 'Q16.margin', status: 'supported' }] }) } }] }), { status: 200 }))
    const p = await predict('writer', snap('Q16:free'))
    expect(p.statuses['Q16.margin']).toBe('supported')
    expect(parseWriter(snap('Q16:free'), { choices: [{ message: { content: 'not json' } }] })['Q16.margin']).toBeNull()
  })
  it('computes false-complete, false-missing and the confusion matrix', () => {
    const s = snap('Q16:free')
    const full = snap('Q09:free+paid')
    const m = coverageMetrics([s, full], [
      { snapshotId: s.id, arm: 'writer', statuses: { 'Q16.margin': 'supported' }, latencyMs: 100, usd: 0.001, calls: ['k1'] },
      { snapshotId: full.id, arm: 'writer', statuses: { 'Q09.margin': 'missing', 'Q09.price': 'supported' }, latencyMs: 300, usd: 0.001, calls: ['k2'] },
    ])
    expect(m.falseComplete).toBe(1)
    expect(m.falseMissing).toBe(0.5)
    expect(m.confusion.missing.supported).toBe(1)
    expect(m.confusion.supported.missing).toBe(1)
    expect(m.falseCompleteByTrap['topic-only'].falseComplete).toBe(1)
    expect(m.cost.calls).toBe(2)
    expect(m.latencyMs.p95).toBeGreaterThan(m.latencyMs.p50!)
  })
  it('scores the offline overlap baseline on every snapshot', async () => {
    const preds = await Promise.all(snapshots.map(s => predict('fixture', s)))
    const m = coverageMetrics(snapshots, preds)
    expect(m.requirements).toBeGreaterThan(100)
    expect(m.unparsed).toBe(0)
    expect(m.falseComplete).not.toBeNull()
  })
})
