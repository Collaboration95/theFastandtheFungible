// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import Answer from '../components/Answer.js'
import { uc3Run } from './run.js'
import type { AnswerDraft, RunSnapshot } from '../../shared/contracts/index.js'

afterEach(() => { cleanup(); vi.useRealTimers() })

// A live run re-answering (v2) while the model writes; v1 is stored and validated.
const writingRun: RunSnapshot = { ...structuredClone(uc3Run), phase: 'ANSWER', stopped: false, answers: uc3Run.answers.filter(answer => answer.version === 1) }
const keptRun: RunSnapshot = { ...structuredClone(uc3Run), phase: 'ANSWER', stopped: false }
const v2 = uc3Run.answers.find(answer => answer.version === 2)!
const draft = (patch: Partial<AnswerDraft>): AnswerDraft => ({ runId: uc3Run.runId, version: 2, conditional: false, status: 'WRITING', claims: v2.claims.slice(0, 2).map(claim => ({ text: claim.text })), ...patch })
const props = { view: 'latest' as const, onView: () => {}, compare: false, onCompare: () => {} }

describe('streamed answer draft', () => {
  it('types the draft under an unverified label, with no citation chips, in place of the stored answer', () => {
    vi.useFakeTimers()
    const { container } = render(<Answer run={writingRun} {...props} drafts={[draft({})]} />)
    expect(screen.getByRole('status').textContent).toBe('Drafting · unverified')
    expect(container.querySelector('.ra-verdict.is-draft')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(container.querySelector('.ra-vtext')?.textContent).toBe(v2.claims[0].text)
    expect(container.querySelector('.ra-caret')).not.toBeNull()
    // Unverified text never carries a citation chip.
    expect(container.querySelectorAll('button.ra-cite')).toHaveLength(0)
    expect(container.querySelectorAll('.ra-cite-pending:not(.is-ok)').length).toBeGreaterThan(0)
  })
  it('strikes what the check removed, then hands over to the validated answer without re-typing it', () => {
    vi.useFakeTimers()
    const removed = 'A drafted claim the passage did not support.'
    const checking = draft({ status: 'CHECKING', claims: [...draft({}).claims, { text: removed }], removed: [removed] })
    const { container, rerender } = render(<Answer run={writingRun} {...props} drafts={[checking]} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('status').textContent).toBe('Citation check removed 1')
    expect(container.querySelector('.ra-claim.is-gone')?.textContent).toContain(removed)
    rerender(<Answer run={keptRun} {...props} drafts={[{ ...checking, status: 'KEPT' }]} />)
    // The struck claim stays readable for a moment before the validated answer takes over.
    expect(container.querySelector('.is-draft')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(container.querySelector('.is-draft')).toBeNull()
    expect(container.querySelector('.ra-verdict.is-typed')).not.toBeNull()
    expect(screen.getByText('✓ Citations checked')).toBeTruthy()
    expect(container.querySelector('.ra-struck-list')?.textContent).toContain(removed)
    expect(container.querySelectorAll('button.ra-cite').length).toBeGreaterThan(0)
  })
  it('a paced replay behind the live run shows no draft until it reaches that version’s own ANSWER step', () => {
    // The replay has reached only v1's ANSWER step while the model already writes v2.
    const firstAnswer = writingRun.events.findIndex(event => event.type === 'ANSWER')
    const behind: RunSnapshot = { ...writingRun, events: writingRun.events.slice(0, firstAnswer + 1) }
    const { container } = render(<Answer run={behind} {...props} drafts={[draft({})]} />)
    expect(container.querySelector('.is-draft')).toBeNull()
    expect(container.querySelectorAll('button.ra-cite').length).toBeGreaterThan(0)
    cleanup()
    // Nor before v1 is on screen, even with the replay in an ANSWER phase.
    const { container: none } = render(<Answer run={{ ...behind, answers: [] }} {...props} drafts={[draft({})]} />)
    expect(none.querySelector('.is-draft')).toBeNull()
  })
  it('keeps each version’s draft: a replay that reaches v1 after v2 began still types v1 out, then hands over', () => {
    vi.useFakeTimers()
    const firstAnswer = writingRun.events.findIndex(event => event.type === 'ANSWER')
    const atV1: RunSnapshot = { ...writingRun, events: writingRun.events.slice(0, firstAnswer + 1) }
    const v1 = uc3Run.answers.find(answer => answer.version === 1)!
    const kept1 = draft({ version: 1, status: 'KEPT', claims: v1.claims.map(claim => ({ text: claim.text })), removed: [] })
    const { container } = render(<Answer run={atV1} {...props} drafts={[kept1, draft({})]} />)
    expect(screen.getByRole('status').textContent).toBe('Citations checked')
    act(() => { vi.advanceTimersByTime(1000) })
    // Mid-replay: typing, not the whole text at once.
    expect(container.querySelector('.ra-vtext')?.textContent?.length).toBeLessThan(v1.claims[0].text.length + 1)
    act(() => { vi.advanceTimersByTime(8000) })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(container.querySelector('.is-draft')).toBeNull()
    expect(container.querySelector('.ra-verdict.is-typed')).not.toBeNull()
  })
  it('a discarded or failed draft disappears at once and the stored answer stands', () => {
    for (const status of ['DISCARDED', 'FAILED'] as const) {
      const { container } = render(<Answer run={writingRun} {...props} drafts={[draft({ status })]} />)
      expect(container.querySelector('.is-draft')).toBeNull()
      expect(container.querySelectorAll('button.ra-cite').length).toBeGreaterThan(0)
      cleanup()
    }
  })
  it('no draft while comparing versions, viewing v1, or once the run has ended', () => {
    const cases = [
      <Answer key="c" run={writingRun} {...props} compare={true} drafts={[draft({})]} />,
      <Answer key="b" run={writingRun} {...props} view="baseline" drafts={[draft({})]} />,
      <Answer key="d" run={{ ...writingRun, phase: 'DONE' }} {...props} drafts={[draft({})]} />,
    ]
    for (const element of cases) {
      const { container } = render(element)
      expect(container.querySelector('.is-draft')).toBeNull()
      cleanup()
    }
  })
})
