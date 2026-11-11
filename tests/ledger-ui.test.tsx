// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LedgerCheck, { SharedPayer } from '../src/components/LedgerCheck'
import LedgerReceipt from '../src/components/LedgerReceipt'
import { readLedgerFact } from '../src/ledger-check'
import bank from '../eval/questions/bank.v1.json'
import ledgerFixture from './fixtures/ledger-check/rpc.json'
import { ledgerReceipt } from '../shared/ledger-receipt'
vi.mock('../src/ledger-check', async original => ({ ...await original<typeof import('../src/ledger-check')>(), readLedgerFact: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); delete (window as unknown as { desktop?: unknown }).desktop })
it('hides the card with no read for 20 bank questions and on desktop', () => {
  for (const q of bank.questions.slice(0, 20)) { const r = render(<LedgerCheck question={q.question} />); expect(r.container.textContent).toBe(''); r.unmount() }
  ;(window as unknown as { desktop?: unknown }).desktop = {}
  expect(render(<LedgerCheck question="What are XRPL fees?" />).container.textContent).toBe('')
  expect(readLedgerFact).not.toHaveBeenCalled()
})
it('offers Retry on failure, then renders the exact label and provenance', async () => {
  vi.mocked(readLedgerFact).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ network: 'XRPL Testnet', ledger: 123, readAt: '2026-11-11T07:06:00Z', text: 'Base fee 10 drops.' })
  render(<LedgerCheck question="What are XRPL fees?" />)
  await screen.findByRole('button', { name: 'Retry' }); expect(screen.getByText(/couldn’t read the ledger right now/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Base fee 10 drops.')
  expect(screen.getByText('Live ledger read · read-only · not part of the paid answer')).toBeTruthy()
  expect(screen.getByText(/validated ledger 123/).textContent).toContain('11 Nov 2026, 15:06 SGT')
})
it('ignores a late result for a previous subject', async () => {
  let resolve!: (v: Awaited<ReturnType<typeof readLedgerFact>>) => void
  vi.mocked(readLedgerFact).mockImplementationOnce(() => new Promise(r => { resolve = r })).mockRejectedValueOnce(new Error('offline'))
  const r = render(<LedgerCheck question="What are XRPL fees?" />)
  r.rerender(<LedgerCheck question="Can RLUSD be escrowed?" />)
  await screen.findByRole('button', { name: 'Retry' })
  await act(async () => resolve({ network: 'XRPL Testnet', ledger: 1, readAt: new Date().toISOString(), text: 'Old result' }))
  expect(screen.queryByText('Old result')).toBeNull()
})
it('never prints zero payer counts when the read fails', async () => {
  render(<SharedPayer read={async () => { throw new Error('offline') }} />)
  await screen.findByRole('button', { name: 'Retry' }); expect(screen.queryByText(/open escrows 0/)).toBeNull()
})
it('a purchase read failure is distinct from a failed receipt and can retry', async () => {
  const read = vi.fn().mockRejectedValue(new Error('unavailable'))
  render(<LedgerReceipt create={'A'.repeat(64)} finish={'B'.repeat(64)} read={read} />)
  await screen.findByRole('button', { name: 'Retry' }); expect(screen.queryByText(/failed receipt/i)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
})

it('refreshes a changed question even when it has the same ledger subject', async () => {
  vi.mocked(readLedgerFact).mockResolvedValueOnce({ network: 'XRPL Testnet', ledger: 1, readAt: '2026-11-11T07:06:00Z', text: 'First read' }).mockResolvedValueOnce({ network: 'XRPL Testnet', ledger: 2, readAt: '2026-11-11T07:07:00Z', text: 'Fresh read' })
  const r = render(<LedgerCheck question="What are XRPL fees?" />)
  await screen.findByText('First read')
  r.rerender(<LedgerCheck question="What fee does EscrowFinish pay?" />)
  await screen.findByText('Fresh read')
  expect(screen.queryByText('First read')).toBeNull()
})

it('keeps the static replay tx-only, with no purchase reserve read', () => {
  vi.stubEnv('MODE', 'browser-demo')
  const read = vi.fn()
  expect(render(<LedgerReceipt create={'A'.repeat(64)} finish={'B'.repeat(64)} read={read} />).container.textContent).toBe('')
  expect(read).not.toHaveBeenCalled()
})

it('shows the recorded purchase fees, reserve release and provenance after loading the UI', async () => {
  const fields = ledgerReceipt(ledgerFixture.hostedCreate, ledgerFixture.hostedFinish, ledgerFixture.hostedFees)
  render(<LedgerReceipt create={ledgerFixture.hostedCreate.hash} finish={ledgerFixture.hostedFinish.hash} read={async () => ({ fields, readAt: '2026-11-11T07:06:00Z' })} />)
  expect((await screen.findByText(/Buyer locked 40,000 drops/)).textContent).toBe('Buyer locked 40,000 drops (fee 12, paid by the buyer) · writer revealed the key 2 ledgers later (fee 423, paid by the writer) · 0.20 XRP owner reserve held 2 s, then released.')
  expect(screen.getByText(/XRPL Testnet.*validated ledger 22228567/).textContent).toContain('11 Nov 2026, 15:06 SGT')
  expect(screen.getByText(/Create ledger 22228565/).textContent).toContain('historical ledger facts, read-only · no real value')
})
