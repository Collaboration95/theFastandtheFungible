// @vitest-environment jsdom
// "Share proof of refusal" in the decline view (lane W1): the question is published only after an explicit second step
// that says so; the server's words explain a run that can't be shared yet; nothing is shown where there is no server.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { readFileSync } from 'node:fs'
import type { RunSnapshot } from '../shared/contracts/index.js'
import { getRefusalProof, createRefusalProof } from '../src/api'
import { HostedContext } from '../src/hosted'
import ShareProof from '../src/components/ShareProof'
import Answer from '../src/components/Answer'

vi.mock('../src/api', () => {
  class ApiError extends Error { constructor(readonly status: number, readonly code?: string) { super(`HTTP ${status}`) } }
  return { ApiError, getRefusalProof: vi.fn(), createRefusalProof: vi.fn(), getRun: vi.fn(async () => { throw new Error('offline') }) }
})
const status = vi.mocked(getRefusalProof), create = vi.mocked(createRefusalProof)
const uc2 = JSON.parse(readFileSync('src/fixtures/uc/uc2.json', 'utf8')) as RunSnapshot
const decline = { ...uc2, phase: 'DONE', answers: [], receipts: [], intents: [], grants: [], contents: [], spentMinor: 0 } as RunSnapshot
const PROOF = { id: 'a'.repeat(32), path: `/proof/${'a'.repeat(32)}`, createdAt: '2026-11-11T00:00:00Z' }
const hostedStatus = { state: 'ready', capabilities: {}, remaining: { questions: 5, minor: 1000 }, labels: { models: 'fixture models', rail: 'Shared XRPL Testnet demo · no real value' }, links: {} } as never
const asHosted = (node: ReactElement) => <HostedContext.Provider value={{ status: hostedStatus }}>{node}</HostedContext.Provider>
const why = () => document.querySelector('.ra-share-why')
beforeEach(() => { status.mockReset(); create.mockReset() })
afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows nothing where there is no server for it (a replay, offline)', async () => {
  status.mockRejectedValue(new Error('no server'))
  const { container } = render(<ShareProof run={decline} />)
  await act(async () => { await Promise.resolve() })
  expect(container.textContent).toBe('')
})

it('stays out of the way of runs that bought something or answered', async () => {
  for (const code of ['purchased', 'answered', 'not_finished']) {
    status.mockResolvedValueOnce({ eligible: false, code, message: 'x' })
    const { container, unmount } = render(<ShareProof run={decline} />)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent, code).toBe('')
    unmount()
  }
})

it('says why an unanchored decline cannot be shared yet, and keeps checking while the anchor arrives', async () => {
  vi.useFakeTimers()
  status.mockResolvedValueOnce({ eligible: false, code: 'anchor_pending', message: 'Sharing opens once the answer is anchored on XRPL, usually within a minute.' })
  status.mockResolvedValue({ eligible: true })
  render(<ShareProof run={decline} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(why()?.textContent).toContain('Sharing opens once the answer is anchored on XRPL')
  expect(screen.queryByRole('button', { name: 'Share proof of refusal' })).toBeNull()
  await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
  expect(screen.getByRole('button', { name: 'Share proof of refusal' })).toBeTruthy()
  expect(why()).toBeNull()
})

it('explains simulated payments instead of offering a share', async () => {
  status.mockResolvedValue({ eligible: false, code: 'simulated', message: 'Simulated payments leave nothing on the ledger, so there is nothing to prove. Use XRPL Testnet to share a refusal.' })
  render(<ShareProof run={decline} />)
  await screen.findByText(/nothing to prove/)
  expect(why()?.textContent).toContain('nothing to prove')
  expect(screen.queryByRole('button')).toBeNull()
})

it('local: needs a second, explicit step that names the question and says nothing is uploaded', async () => {
  status.mockResolvedValue({ eligible: true }); create.mockResolvedValue(PROOF)
  render(<ShareProof run={decline} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Share proof of refusal' }))
  expect(create).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Create this proof?' })).toBeTruthy()
  expect(screen.getByText(/Nothing is uploaded/)).toBeTruthy()
  expect(document.body.textContent).toContain(decline.question)
  // Cancel returns to the button without creating anything.
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(create).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share proof of refusal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Share proof of refusal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create proof page' }))
  expect(await screen.findByText('Proof page ready')).toBeTruthy()
  expect(create).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Open proof page' }).getAttribute('href')).toBe(PROOF.path)
  expect(screen.getByRole('link', { name: 'Download proof card' }).getAttribute('href')).toBe(`${PROOF.path}/card.html`)
  expect(screen.getByRole('link', { name: 'Download proof card' }).hasAttribute('download')).toBe(true)
})

it('hosted: says the page is public, who can open it, how long it stays and that it cannot be edited', async () => {
  status.mockResolvedValue({ eligible: true })
  render(asHosted(<ShareProof run={decline} />))
  fireEvent.click(await screen.findByRole('button', { name: 'Share proof of refusal' }))
  expect(screen.getByRole('heading', { name: 'Publish this proof?' })).toBeTruthy()
  const text = document.body.textContent ?? ''
  expect(text).toContain('anyone with the link')
  expect(text).toContain(decline.question)
  expect(text).toContain('can’t be edited')
  expect(text).toContain('21 November 2026')
  expect(text).toContain('Clearing your history won’t take it down')
  expect(create).not.toHaveBeenCalled()
})

it('Escape closes the step without sharing; an existing proof shows its link straight away', async () => {
  status.mockResolvedValueOnce({ eligible: true })
  const first = render(<ShareProof run={decline} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Share proof of refusal' }))
  fireEvent.keyDown(screen.getByRole('heading', { name: 'Create this proof?' }), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Share proof of refusal' })).toBeTruthy()
  expect(create).not.toHaveBeenCalled()
  first.unmount()
  status.mockResolvedValueOnce({ eligible: true, proof: PROOF })
  render(<ShareProof run={decline} />)
  expect(await screen.findByText('Proof page ready')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Share proof of refusal' })).toBeNull()
})

it('reports a session limit and any other refusal in the server’s words, publishing nothing', async () => {
  const { ApiError } = await import('../src/api')
  status.mockResolvedValue({ eligible: true })
  create.mockRejectedValueOnce(new ApiError(429, 'proof_limit'))
  render(<ShareProof run={decline} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Share proof of refusal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create proof page' }))
  expect((await screen.findByRole('alert')).textContent).toContain('as many proofs as this session allows')
  expect(screen.queryByText('Proof page ready')).toBeNull()
  create.mockRejectedValueOnce(new ApiError(409, 'anchor_missing'))
  status.mockResolvedValue({ eligible: false, code: 'anchor_missing', message: 'No ledger anchor is recorded for this run, so it can’t be shared.' })
  fireEvent.click(screen.getByRole('button', { name: 'Share proof of refusal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create proof page' }))
  await waitFor(() => expect(why()?.textContent).toContain('No ledger anchor is recorded'))
})

it('appears in the decline view of the answer and nowhere else', async () => {
  status.mockResolvedValue({ eligible: true })
  const props = { view: 'latest' as const, onView: () => {}, compare: false, onCompare: () => {} }
  render(<Answer run={decline} {...props} />)
  expect(await screen.findByRole('button', { name: 'Share proof of refusal' })).toBeTruthy()
  cleanup()
  const answered = { ...uc2, phase: 'DONE' } as RunSnapshot
  render(<Answer run={answered} {...props} />)
  await act(async () => { await Promise.resolve() })
  expect(screen.queryByRole('button', { name: 'Share proof of refusal' })).toBeNull()
})
