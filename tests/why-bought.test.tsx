// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PaymentRow from '../src/components/PaymentRow'
import PlanSheet from '../src/components/PlanSheet'
import ShowWork from '../src/components/ShowWork'
import { ucRuns } from '../src/fixtures/run'
import { confirmedPlanFor, forgetConfirmedPlans, planCheck, ranSearches, rememberConfirmedPlan } from '../src/planCheck'
import { WHY_MAX, coveredThing, decisionFor, whyBought } from '../src/whyBought'
import type { RunSnapshot } from '../shared/contracts'

// T4 · "Why bought" on each payment, and "Ran the plan you confirmed". Read-only: both lines come from run data the
// server already records (the decision record, the PLAN event), so there is no server change to test.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value() { this.setAttribute('open', '') }, configurable: true })
Object.defineProperty(HTMLDialogElement.prototype, 'close', { value() { this.removeAttribute('open') }, configurable: true })
beforeEach(() => forgetConfirmedPlans())
afterEach(() => { cleanup(); vi.useRealTimers() })

const clone = <T,>(value: T): T => structuredClone(value)
const row = (run: RunSnapshot, intent = run.intents[0]) => renderToStaticMarkup(<PaymentRow run={run} intent={intent} onRetry={() => {}} onReceipt={() => {}} />)
const whyLines = (html: string) => [...html.matchAll(/<p class="ra-why-line">([^<]*)<\/p>/g)].map(match => match[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'"))
/** UC2 is the one-purchase run; its decision round names the fact it bought for. */
function oneBuy(gap = 'What fields an x402 402 response contains') {
  const run = clone(ucRuns.UC2)
  run.decisions[0].gap = gap
  return run
}
const planEvent = (run: RunSnapshot, subqueries: string[], data: Record<string, unknown> = {}) => {
  const events = run.events.filter(event => event.type !== 'PLAN' && event.type !== 'CLARIFY')
  return { ...run, events: [{ id: 0, runId: run.runId, type: 'PLAN', label: `Search plan (fixture · scope-fixture): ${subqueries.join(' · ')}`, at: run.events[0].at, data: { plan: { restatement: 'r', subqueries }, planner: 'fixture · scope-fixture', requirements: ['a fact'], requirementsBy: 'fixture · scope-fixture', ...data } }, ...events] }
}

describe('the why line on each payment', () => {
  it('the one-purchase x402 run shows exactly one plain line built from the decision record', () => {
    const run = oneBuy()
    const lines = whyLines(row(run))
    expect(lines).toEqual(['Bought to fill: “What fields an x402 402 response contains” · within your S$2.00'])
    expect(lines[0].length).toBeLessThanOrEqual(WHY_MAX)
  })

  it('uses covers only when saved coverage supports this gap with a claim citing this purchase', () => {
    const run = clone(ucRuns.UC2)
    const line = whyBought(run, run.intents[0])!
    expect(line).toMatch(/^Covers “analyst estimates on pricing and margins”/)
    expect(line.length).toBeLessThanOrEqual(WHY_MAX)
  })

  it('keeps the recorded F-P3 owner-reserve target honest in a synthetic uncovered-gap case', () => {
    // H10-06's saved target: trust-lines/TrustSet were bought for this still-open fact.
    const run = oneBuy('The owner-reserve increment')
    run.checkpoint.requirements = [{ id: 'r1', text: 'The owner-reserve increment' }]
    run.checkpoint.coverage = [{ answerVersion: 2, judge: 'fixture', entries: [{ requirementId: 'r1', status: 'missing' }] }]
    expect(whyBought(run, run.intents[0])).toBe('Bought to fill: “The owner-reserve increment” · within your S$2.00')
    expect(whyLines(row(run))[0]).not.toContain('covers')
  })

  it.each(['missing', 'partial', 'conflicting', 'unknown'] as const)('never calls %s coverage verified', status => {
    const run = clone(ucRuns.UC2)
    run.checkpoint.coverage!.find(c => c.answerVersion === 2)!.entries.find(e => e.requirementId === 'r2')!.status = status
    expect(whyBought(run, run.intents[0])).toMatch(/^Bought to fill:/)
  })

  it.each(['no record', 'stale answer', 'error', 'other source', 'no grant', 'delivery pending'])('does not claim coverage with %s', problem => {
    const run = clone(ucRuns.UC2), coverage = run.checkpoint.coverage!.find(c => c.answerVersion === 2)!
    if (problem === 'no record') run.checkpoint.coverage = []
    if (problem === 'stale answer') run.answers.push({ ...clone(run.answers.at(-1)!), version: 3 })
    if (problem === 'error') coverage.error = 'unavailable'
    if (problem === 'other source') coverage.entries.find(e => e.requirementId === 'r2')!.claimIds = [run.answers.at(-1)!.claims.at(-1)!.id]
    if (problem === 'no grant') run.grants = []
    if (problem === 'delivery pending') run.intents[0].status = 'DELIVERY_PENDING'
    expect(whyBought(run, run.intents[0])).toMatch(/^Bought to fill:/)
  })

  it('a run that bought nothing shows no line', () => {
    expect(ucRuns.UC1.intents).toHaveLength(0)
    expect(ucRuns.UC4.intents).toHaveLength(0)
    // A payment row for a source policy never selected has nothing to say, rather than a guess.
    const stray = { ...clone(ucRuns.UC2.intents[0]), resourceId: 'never-judged', source: undefined }
    expect(whyBought(ucRuns.UC2, stray)).toBeUndefined()
  })

  it('a refunded purchase keeps its reason and adds who signed the refund after it', () => {
    const run = clone(ucRuns.UC3)
    const refunded = run.intents.find(intent => intent.status === 'REFUNDED')!
    const [line] = whyLines(row(run, refunded))
    expect(line).toMatch(/^Bought to fill: “.+” · within your S\$2\.00 · Refunded: writer-signed$|^Bought to fill: “.+” · Refunded: writer-signed$/)
    expect(line.length).toBeLessThanOrEqual(WHY_MAX)
    // The article bought in the second round shows its own reason, with no refund.
    const kept = run.intents.find(intent => intent.status === 'VERIFIED')!
    expect(whyLines(row(run, kept))[0]).not.toContain('Refunded')
  })

  it('finds the round that picked the source, not just any round that listed it as a BUY', () => {
    const run = ucRuns.UC3
    const kept = run.intents.find(intent => intent.status === 'VERIFIED')!
    // fab-floor was a BUY row in round 1 too, but round 1 picked the other writer.
    expect(decisionFor(run, kept)?.round.round).toBe(2)
    expect(decisionFor(run, run.intents.find(intent => intent.status === 'REFUNDED')!)?.round.round).toBe(1)
  })

  it('does not borrow the reason from a round that selected a different article', () => {
    const run = oneBuy()
    run.decisions[0].selectedResourceId = 'another-article'
    run.decisions[0].selectedSourceKey = 'another-writer:another-article'
    expect(whyBought(run, run.intents[0])).toBeUndefined()
  })

  it('never exceeds 90 characters, whatever the fact, the budget or the refund', () => {
    const gaps = ['', 'x', 'No accessible evidence on grid energisation.', 'What fields an x402 402 response contains', `The XRPL network fee for the transactions in one key-reveal purchase, in drops or XRP ${'and more '.repeat(30)}`, 'Superlongwordwithoutanyspaces'.repeat(12)]
    for (const gap of gaps) for (const budget of [0, 50, 200, 100000]) for (const refund of [false, true]) for (const verified of [false, true]) {
      const run = oneBuy(gap); run.budgetMinor = budget
      if (verified && gap.trim()) {
        run.checkpoint.requirements = [{ id: 'r1', text: gap }]
        run.checkpoint.coverage = [{ answerVersion: 2, judge: 'fixture', entries: [{ requirementId: 'r1', status: 'supported', claimIds: [run.answers.at(-1)!.claims[0].id] }] }]
      }
      if (refund) run.intents[0].status = 'REFUNDED'
      const line = whyBought(run, run.intents[0])
      expect(line, JSON.stringify({ gap: gap.slice(0, 20), budget, refund })).toBeDefined()
      expect(line!.length).toBeLessThanOrEqual(WHY_MAX)
      expect(line!.endsWith('Refunded: writer-signed')).toBe(refund)
    }
  })

  it('uses plain English: no coverage, requirement ids or policy codes', () => {
    for (const run of [oneBuy(), ucRuns.UC2, ucRuns.UC3]) for (const intent of run.intents) {
      const line = whyBought(run, intent) ?? ''
      expect(line).not.toMatch(/coverage|requirement|req-|intentId|SKIP_|BUY\b|verdict|probe|gap\b/i)
    }
    expect(coveredThing('No accessible dated figures for lead times in weeks, or their trend.')).toBe('dated figures for lead times in weeks, or their trend')
    expect(coveredThing('Whether x402 supports paying with XRP?')).toBe('Whether x402 supports paying with XRP')
  })

  it('a new writer’s test purchase says so, and a purchase that settled nothing says nothing', () => {
    const probe = oneBuy(); probe.decisions[0].rows.forEach(r => { if (r.verdict === 'BUY') r.probe = true })
    expect(whyBought(probe, probe.intents[0])).toBe('A small test purchase from a new writer · within your S$2.00')
    const unsettled = oneBuy(); unsettled.intents[0].status = 'FAILED_NOT_SETTLED'
    expect(whyBought(unsettled, unsettled.intents[0])).toBeUndefined()
    const noReceipt = oneBuy(); noReceipt.receipts = []
    expect(whyBought(noReceipt, noReceipt.intents[0])).toBeUndefined()
    const cancelled = oneBuy(); cancelled.intents[0].escrow = { scheme: 'escrow-v1', policy: 'escrow-policy-v1', mode: 'key-reveal', state: 'CANCELLED', owner: 'o', cancelAfter: 1 }
    expect(whyBought(cancelled, cancelled.intents[0])).toBeUndefined()
  })

  it('cuts a long fact at a word and never leaves a dangling "in" or "of"', () => {
    const refunded = oneBuy('Dated figures for lead times in weeks, or their trend'); refunded.intents[0].status = 'REFUNDED'
    const line = whyBought(refunded, refunded.intents[0])!
    expect(line).toBe('Bought to fill: “dated figures for lead times in weeks,…” · Refunded: writer-signed'.replace('dated', 'Dated'))
    expect(line.length).toBeLessThanOrEqual(WHY_MAX)
  })

  it('drops the budget before it drops the reason', () => {
    const long = oneBuy('A requested fact that is described in a fairly long sentence about escrow release')
    const line = whyBought(long, long.intents[0])!
    expect(line.length).toBeLessThanOrEqual(WHY_MAX)
    expect(line.startsWith('Bought to fill: “A requested fact that')).toBe(true)
  })
})

describe('the plan check in Show work', () => {
  const searches = ['analyst outlook Kestrel Semiconductor deal TSMC', 'Kestrel TSMC deal margins']
  const work = (run: RunSnapshot, confirmed?: { subqueries: string[] }) => renderToStaticMarkup(<ShowWork run={run} onClose={() => {}} confirmed={confirmed} />)

  it('a run that searched what was confirmed says so with a ✓', () => {
    const run = planEvent(ucRuns.UC2, searches)
    expect(planCheck(run, { subqueries: searches })).toEqual({ ok: true, text: 'Ran the plan you confirmed ✓' })
    expect(work(run, { subqueries: searches })).toContain('Ran the plan you confirmed ✓')
    // Order and capitalisation are not a change.
    expect(planCheck(run, { subqueries: [searches[1].toUpperCase(), ` ${searches[0]} `] })?.ok).toBe(true)
  })

  it('a different plan gets a plain sentence that says what changed, and never the ✓', () => {
    const added = planEvent(ucRuns.UC2, [...searches, 'Kestrel Penang lead times'])
    const swapped = planEvent(ucRuns.UC2, [searches[0], 'Kestrel Penang lead times'])
    const dropped = planEvent(ucRuns.UC2, [searches[0]])
    const cases = [
      [added, 'The run added “Kestrel Penang lead times” to the searches you confirmed.'],
      [swapped, 'The run searched for “Kestrel Penang lead times” instead of “Kestrel TSMC deal margins”, which you confirmed.'],
      [dropped, 'The run left out “Kestrel TSMC deal margins” from the searches you confirmed.'],
    ] as const
    for (const [run, sentence] of cases) {
      expect(planCheck(run, { subqueries: searches })).toEqual({ ok: false, text: sentence })
      const html = work(run, { subqueries: searches })
      expect(html).toContain(sentence.replace(/“/g, '“'))
      expect(html).not.toContain('✓')
      expect(html).not.toContain('Ran the plan you confirmed')
      expect(html).toContain('is-changed')
    }
  })

  it('says why when the plan was made again after a clarifying answer', () => {
    const run = planEvent(ucRuns.UC2, [searches[0], 'Kestrel pricing margins'])
    const clarify = { id: 99, runId: run.runId, type: 'CLARIFY', label: 'Clarified: pricing & margins', at: run.events[0].at }
    run.events.push(clarify)
    expect(planCheck(run, { subqueries: searches })).toEqual({ ok: false, text: 'The run searched for “Kestrel pricing margins” instead of “Kestrel TSMC deal margins”, which you confirmed. Your answer to the clarifying question was used to plan again.' })
    // The same searches after a clarifying answer are still a match.
    const same = planEvent(ucRuns.UC2, searches); same.events.push(clarify)
    expect(planCheck(same, { subqueries: searches })?.ok).toBe(true)
  })

  it('an old snapshot without a PLAN event shows nothing, and so does a run with no confirmation to compare', () => {
    const old = { ...ucRuns.UC2, events: ucRuns.UC2.events.filter(event => event.type !== 'PLAN') }
    expect(ranSearches(old)).toBeUndefined()
    expect(planCheck(old, { subqueries: searches })).toBeUndefined()
    expect(work(old, { subqueries: searches })).not.toContain('ra-plan-check')
    expect(planCheck(planEvent(ucRuns.UC2, searches), undefined)).toBeUndefined() // nothing remembered in this browser
    expect(work(planEvent(ucRuns.UC2, searches))).not.toContain('ra-plan-check')
    expect(planCheck(planEvent(ucRuns.UC2, searches), { subqueries: [] })).toBeUndefined()
    // A PLAN event without searches is as good as none.
    expect(planCheck({ events: [{ id: 1, runId: 'r', type: 'PLAN', label: 'x', at: '2026-11-11T00:00:00Z', data: { plan: {} } }] }, { subqueries: searches })).toBeUndefined()
  })

  it('PlanSheet remembers what was confirmed, and the run started just after is matched to it', () => {
    const plan = { restatement: 'Kestrel outlook', subqueries: searches }
    const onGo = vi.fn()
    render(<PlanSheet plan={plan} budgetMinor={200} onGo={onGo} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Start now/ }))
    expect(onGo).toHaveBeenCalledTimes(1)
    const created = new Date(Date.now() + 400).toISOString()
    const run = { ...planEvent(ucRuns.UC2, searches), events: planEvent(ucRuns.UC2, searches).events.map(event => ({ ...event, at: created })) }
    expect(confirmedPlanFor(run)?.subqueries).toEqual(searches)
    expect(planCheck(run)?.ok).toBe(true)
    expect(work(run)).toContain('Ran the plan you confirmed ✓')
    // The same run opened with a different plan on record is a mismatch, not a ✓.
    const other = { ...planEvent(ucRuns.UC2, ['something else']), events: planEvent(ucRuns.UC2, ['something else']).events.map(event => ({ ...event, at: created })) }
    expect(planCheck(other)?.ok).toBe(false)
  })

  it('an edited plan is the one that counts as confirmed', () => {
    const plan = { restatement: 'Kestrel outlook', subqueries: searches }
    render(<PlanSheet plan={plan} budgetMinor={200} onGo={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(screen.getByLabelText('Search 2'), { target: { value: 'Kestrel Penang lead times' } })
    fireEvent.click(screen.getByRole('button', { name: /Start now/ }))
    expect(confirmedPlanFor({ events: [{ id: 1, runId: 'r', type: 'PLAN', label: '', at: new Date(Date.now() + 200).toISOString() }] })?.subqueries).toEqual([searches[0], 'Kestrel Penang lead times'])
  })

  it('only a confirmation made just before the run began is used', () => {
    const t = Date.parse('2026-11-11T10:00:00.000Z')
    const at = (ms: number) => ({ events: [{ id: 1, runId: `r-${ms}`, type: 'SNAPSHOT', label: '', at: new Date(t + ms).toISOString() }] })
    rememberConfirmedPlan({ subqueries: ['older'] }, t - 120_000)
    rememberConfirmedPlan({ subqueries: ['just before'] }, t - 800)
    rememberConfirmedPlan({ subqueries: ['much later'] }, t + 60_000)
    expect(confirmedPlanFor(at(0))?.subqueries).toEqual(['just before'])
    expect(confirmedPlanFor(at(5 * 60_000))).toBeUndefined() // a run started later by something else (an agent, another tab)
    expect(confirmedPlanFor({ events: [] })).toBeUndefined()
  })

  it('does not use a future confirmation or reuse one for another run', () => {
    const t = Date.now()
    const run = (id: string) => ({ events: [{ id: 1, runId: id, type: 'PLAN', label: '', at: new Date(t).toISOString() }] })
    rememberConfirmedPlan({ subqueries: searches }, t + 1)
    expect(confirmedPlanFor(run('before'))).toBeUndefined()
    rememberConfirmedPlan({ subqueries: searches }, t - 1)
    expect(confirmedPlanFor(run('first'))?.subqueries).toEqual(searches)
    expect(confirmedPlanFor(run('second'))).toBeUndefined()
    rememberConfirmedPlan({ subqueries: ['later confirmation'] }, t)
    expect(confirmedPlanFor(run('first'))?.subqueries).toEqual(searches)
  })

  it('a changed search count is a mismatch even when the terms are unchanged', () => {
    expect(planCheck(planEvent(ucRuns.UC2, [...searches, searches[0]]), { subqueries: searches }))
      .toEqual({ ok: false, text: 'The run changed how many times it searched the terms you confirmed.' })
  })

  it('ignores malformed session storage instead of breaking Show work', () => {
    sessionStorage.setItem('ra-confirmed-plans', '[null, 7, {"subqueries":[1],"at":2}]')
    expect(confirmedPlanFor(planEvent(ucRuns.UC2, searches))).toBeUndefined()
  })

  it('survives a reload of the tab through session storage', async () => {
    const t = Date.parse('2026-11-11T10:00:00.000Z')
    rememberConfirmedPlan({ subqueries: searches }, t - 500)
    vi.resetModules()
    const fresh = await import('../src/planCheck')
    expect(fresh.confirmedPlanFor({ events: [{ id: 1, runId: 'r', type: 'SNAPSHOT', label: '', at: new Date(t).toISOString() }] })?.subqueries).toEqual(searches)
  })
})
