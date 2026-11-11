// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import Answer from '../src/components/Answer'
import { offlineZeroBudgetRun } from '../src/fixtures/run'
import { VERDICT_WORDS } from '../shared/refusal-proof.js'
import { ANSWER_VERDICT_WORDS } from '../shared/answer-verdict-words.js'

const loadProof = vi.hoisted(() => vi.fn(() => { throw new Error('Optional proof chunk unavailable') }))
vi.mock('../src/components/ShareProof', loadProof)
afterEach(cleanup)

it('keeps the refusal visible when the optional proof-sharing chunk cannot load', async () => {
  const run = { ...structuredClone(offlineZeroBudgetRun), phase: 'DONE' as const, answers: [] }
  const { container } = render(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />)
  await waitFor(() => expect(loadProof).toHaveBeenCalledOnce())
  await act(async () => { await Promise.resolve() })
  expect(screen.getByRole('region', { name: 'Research answer' })).toBeTruthy()
  expect(container.querySelector('.ra-verdict > p')?.textContent).toMatch(/Nothing was bought/)
  expect(screen.queryByRole('button', { name: 'Share proof of refusal' })).toBeNull()
})

it('keeps answer-only refusal wording identical to the proof authority', () => {
  expect(ANSWER_VERDICT_WORDS).toEqual(VERDICT_WORDS)
})
