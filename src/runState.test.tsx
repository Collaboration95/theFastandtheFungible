import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { deriveRunState, purchaseState } from './runState'
import { staged, runEvents } from './stage'
import { ucRuns } from './fixtures/run'
import Answer from './components/Answer'
import DecisionPanel from './components/DecisionPanel'
import type { PurchaseIntent } from '../shared/contracts'

const answer = (run: typeof ucRuns.UC2) => renderToStaticMarkup(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />)
describe('one run view model', () => {
  for (const [uc, run] of Object.entries(ucRuns)) it(`${uc}: every recorded event prefix derives the displayed phase and payments without mutation`, () => {
    const before = JSON.stringify(run)
    for (const event of runEvents(run)) {
      const visible = staged(run, event.id)
      const model = deriveRunState(visible)
      expect(model.purchases).toHaveLength(visible.intents.length)
      expect(model.rail).toBe('SIMULATED')
      expect(model.rows.every(row => !row.event || row.event.id <= event.id)).toBe(true)
      expect(model.purchases.every(item => !item.ok || visible.grants.some(grant => grant.intentId === item.intent.intentId))).toBe(true)
    }
    expect(deriveRunState(run).phase).toBe('done')
    expect(JSON.stringify(run)).toBe(before)
  })
  it('represents every payment lifecycle and terminal failure', () => {
    const run = ucRuns.UC2, base = run.intents[0]
    const cases = { QUOTED: 'quoted', RESERVED: 'approved by policy', SUBMITTING: 'submitted', SETTLED: 'validated', DELIVERY_PENDING: 'delivered', VERIFIED: 'verified', CHALLENGED: 'challenged', REFUNDED: 'refunded', FAILED_NOT_SETTLED: 'failed', SKIPPED: 'skipped' }
    for (const [status, phase] of Object.entries(cases)) expect(purchaseState(run, { ...base, status: status as PurchaseIntent['status'] }).phase).toBe(phase)
    expect(deriveRunState(undefined).phase).toBe('idle')
    expect(deriveRunState(undefined, 'clarify').phase).toBe('clarifying')
    expect(deriveRunState(undefined, 'plan').phase).toBe('planning')
    expect(deriveRunState({ ...run, phase: 'FAILED' }).phase).toBe('failed')
  })
  it('Stop preserves in-flight and paid-unused payments honestly (#229)', () => {
    const run = ucRuns.UC2
    const stopped = { ...run, stopped: true, phase: 'STOPPED' as const, answers: run.answers.slice(0, 1) }
    expect(deriveRunState(stopped).stopMessage).toContain('not used in this answer')
    expect(deriveRunState({ ...stopped, intents: [{ ...run.intents[0], status: 'SUBMITTING' }] }).stopMessage).toContain('may still settle')
    expect(deriveRunState(stopped).purchases[0].phase).toBe('verified')
  })
  it('keeps unchanged UC2 headline unhighlighted and composes a complete gap sentence (#225, #226)', () => {
    const html = answer(ucRuns.UC2)
    expect(html).not.toContain('ra-vtext is-hl')
    expect(html).toContain('Lead finding')
    expect(html).not.toContain('No accessible')
  })
  it('UC4 never claims the run was free if any payment was made (#230)', () => {
    expect(answer({ ...ucRuns.UC4, spentMinor: 60 })).not.toContain('nothing bought')
    expect(answer({ ...ucRuns.UC4, spentMinor: 60 })).not.toContain('nothing bought')
    expect(answer(ucRuns.UC4)).toContain('found free on a focused search')
  })
  it('all decision rows name their articles (#227)', () => {
    const html = renderToStaticMarkup(<DecisionPanel run={ucRuns.UC2} />)
    for (const row of ucRuns.UC2.decisions[0].rows) expect(html).toContain(renderToStaticMarkup(<span>{row.candidate.title}</span>).slice(6, -7))
  })
})

// #314: a reconciled payment must not contradict the pending answer recovery.
it('shows Recovering when delivery verifies but a failed run still needs its answer resumed', () => {
  const run = structuredClone(ucRuns.UC2)
  run.phase = 'FAILED'
  run.error = 'Delivery incomplete. Retry delivery to verify and re-answer.'
  run.checkpoint = { ...run.checkpoint, nextAction: 'retry-delivery' }
  expect(deriveRunState(run).phase).toBe('recovering')
  expect(deriveRunState({ ...ucRuns.UC3, phase: 'FAILED', checkpoint: { ...ucRuns.UC3.checkpoint, nextAction: 'retry-delivery', intentId: ucRuns.UC3.intents[0].intentId } }).phase).toBe('failed')
  expect(deriveRunState({ ...run, stopped: true }).phase).toBe('stopped')
  expect(deriveRunState({ ...run, checkpoint: { ...run.checkpoint, nextAction: 'ask' } }).phase).toBe('failed')
})
