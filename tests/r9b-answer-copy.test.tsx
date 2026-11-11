// @vitest-environment jsdom
// R9-B H9-03 (judge V's C1): paid S$0.80, got no answer, and the screen said "Why nothing was bought" with no notice.
// After a purchase the answer says what was bought, under "Why there's no answer", and the offline writer is labelled
// with its reason. A decline keeps its own words and no notice. H9-10: "Still unanswered" never repeats the lead.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { RunSnapshot } from '../shared/contracts'
import { offlineZeroBudgetRun, ucRuns } from '../src/fixtures/run'
import Answer from '../src/components/Answer'
import { offlineNotice } from '../src/notices'

afterEach(cleanup)
const view = (run: RunSnapshot) => render(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />).container
const fallback = (reason?: string) => ({ id: 900, runId: 'r', type: 'MODEL_FALLBACK', label: 'LLM fallback · labelled fixture', at: '2026-11-11T04:00:00.000Z', data: { fallback: true, ...(reason ? { reason } : {}) } })
/** A finished purchase run whose final answer has no cited claim: the offline writer stood in and found nothing to quote. */
const paidNoAnswer = (base: RunSnapshot, reason?: string): RunSnapshot => ({
  ...structuredClone(base), phase: 'DONE',
  answers: base.answers.map(answer => ({ ...answer, lead: undefined, claims: [], conclusion: 'Bought 1 article; it gave no citable answer to this question.', provider: 'fixture', model: 'extractive-fixture' })),
  labels: { ...base.labels, research: 'fixture · extractive-fixture' },
  events: [...base.events, fallback(reason)] as RunSnapshot['events'],
})

describe('H9-03: paid with no answer says so', () => {
  it('one purchase: "Bought 1 article; it gave no citable answer", under "Why there’s no answer"', () => {
    const container = view(paidNoAnswer(ucRuns.UC2))
    expect(container.querySelector('.ra-verdict > p')?.textContent).toBe('Bought 1 article; it gave no citable answer to this question.')
    expect(container.querySelector('details.ra-why-not summary')?.textContent).toMatch(/^Why there’s no answer · \d+ articles? considered$/)
    expect(container.textContent).not.toMatch(/nothing (?:was )?bought/i)
  })
  it('two purchases (one refunded still counts as paid): "neither gave a citable answer"', () => {
    const container = view(paidNoAnswer(ucRuns.UC3))
    expect(container.querySelector('.ra-verdict > p')?.textContent).toBe('Bought 2 articles; neither gave a citable answer to this question.')
    expect(container.textContent).not.toMatch(/nothing (?:was )?bought/i)
  })
  it('a decline keeps its words and its heading', () => {
    const base = offlineZeroBudgetRun.decisions[0]
    const declined: RunSnapshot = { ...offlineZeroBudgetRun, phase: 'DONE', answers: [], intents: [], receipts: [], decisions: [{ ...base, rows: [{ ...base.rows[0], candidate: { ...offlineZeroBudgetRun.candidates[0], tier: 'PAID' } }] }] }
    const container = view(declined)
    expect(container.querySelector('.ra-verdict > p')?.textContent).toMatch(/^Nothing was bought/)
    expect(container.querySelector('details.ra-why-not summary')?.textContent).toMatch(/^Why nothing was bought/)
    expect(offlineNotice({ ...declined, labels: { ...declined.labels, research: 'fixture · extractive-fixture' } })).toBeUndefined()
  })
})

describe('H9-03: the offline writer is labelled, with its reason', () => {
  it('after a purchase with no answer, whatever the reason', () => {
    expect(offlineNotice(paidNoAnswer(ucRuns.UC2, 'guard'))).toBe('The model wasn’t asked: no bought passage matched the question closely enough to quote.')
    expect(offlineNotice(paidNoAnswer(ucRuns.UC2, 'timeout'))).toBe('Offline extracts used: the model didn’t respond in time. They held no citable passage.')
    expect(offlineNotice(paidNoAnswer(ucRuns.UC2, 'http'))).toBe('Offline extracts used: the model was unavailable. They held no citable passage.')
    // A run recorded before reasons existed still gets the notice.
    expect(offlineNotice(paidNoAnswer(ucRuns.UC2))).toBe('Offline extracts used: the model was unavailable. They held no citable passage.')
  })
  it('when the offline writer wrote the answer, it names why', () => {
    const written = { ...paidNoAnswer(ucRuns.UC2, 'invalid'), answers: ucRuns.UC2.answers }
    expect(offlineNotice(written)).toBe('Written from offline extracts: the model’s draft failed the exact-quote check.')
    expect(offlineNotice({ ...written, events: [...written.events, fallback('cap')] as RunSnapshot['events'] })).toBe('Written from offline extracts: this question used up its model allowance.')
  })
  it('a live-written answer carries no notice', () => {
    expect(offlineNotice({ ...ucRuns.UC2, labels: { ...ucRuns.UC2.labels, research: 'DeepSeek · deepseek-flash' } })).toBeUndefined()
  })
})

describe('H9-10: "Still unanswered" never repeats what the lead answers', () => {
  it.each(['missing', 'partial', 'conflicting'] as const)('a planned %s fact remains visible beside the stored counter', status => {
    const run = structuredClone(ucRuns.UC2)
    const answer = run.answers.at(-1)!
    // The legacy lead matcher would close this restated question. A stored judgment has stronger authority.
    run.checkpoint = { ...run.checkpoint, requirements: [{ id: 'r1', text: run.question }], coverage: [{ answerVersion: answer.version, judge: 'fixture', entries: [{ requirementId: 'r1', status }] }] }
    const container = view(run)
    expect(container.textContent).toContain('0 of 1 answered')
    expect([...container.querySelectorAll('.ra-answer-context li')].map(li => li.textContent)).toContain(run.question)
  })
  it('drops a gap that restates the question when the lead answers it', () => {
    const run = structuredClone(ucRuns.UC2)
    delete run.checkpoint.requirements
    delete run.checkpoint.coverage
    const answer = run.answers.at(-1)!
    run.answers[run.answers.length - 1] = { ...answer, openGaps: [{ text: run.question }, { text: 'An unrelated missing fact about tide tables' }] }
    const container = view(run)
    const gaps = [...container.querySelectorAll('.ra-answer-context li')].map(li => li.textContent)
    expect(gaps).not.toContain(run.question)
    expect(gaps).toContain('An unrelated missing fact about tide tables')
  })
})
