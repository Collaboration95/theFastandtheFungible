// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import Verification from '../src/components/Verification'
import SpendPanel from '../src/components/SpendPanel'
import { HostedIntro, HostedJudgesCorner } from '../src/components/hosted/HostedHome'
import type { Hosted } from '../src/hosted'
import { ucRuns } from '../src/fixtures/run'
const payer = vi.fn(async () => ({ network: 'XRPL Testnet', ledger: 1, readAt: new Date().toISOString(), text: 'Fixture payer' }))
vi.mock('../src/components/LedgerCheckEntry', () => ({ SharedPayer: () => { payer(); return null } }))
afterEach(() => { cleanup(); payer.mockClear() })
const hosted = { status: { labels: { rail: 'XRPL Testnet', models: 'fixture models' }, remaining: { questions: 5, minor: 1000 }, questionCapMinor: 200, links: {} } } as Hosted
it('defers the shared payer until the grouped proof area opens', async () => {
  const { container } = render(<HostedJudgesCorner hosted={hosted} />)
  expect(payer).not.toHaveBeenCalled()
  await act(async () => { container.querySelector('details')!.open = true; fireEvent(container.querySelector('details')!, new Event('toggle')) })
  expect(payer).toHaveBeenCalled()
})
it('keeps the paired promise and provenance visible, with a truthful simulated variant', () => {
  const view = render(<HostedIntro hosted={hosted} state="ready" />)
  expect(screen.getByText('Paid on delivery. Proven on the ledger.')).toBeTruthy()
  expect(screen.getByText(/Rule-based buying · team-authored/)).toBeTruthy()
  view.rerender(<HostedIntro hosted={{ status: { ...hosted.status, labels: { ...hosted.status.labels, rail: 'Simulated payments' } } }} state="ready" />)
  expect(screen.getByText('Simulated payments. Receipts you can check.')).toBeTruthy()
  expect(screen.queryByText('Paid on delivery. Proven on the ledger.')).toBeNull()
})
it('does not open successful promise checks when the proof arrives, but opens failures', async () => {
  const run = ucRuns.UC2, intent = run.intents[0]
  const view = render(<Verification run={{ ...run, events: [] }} intent={{ ...intent, status: 'SETTLED' }} />)
  view.rerender(<Verification run={run} intent={{ ...intent, status: 'VERIFIED' }} />)
  expect(view.container.querySelector('details')!.open).toBe(false)
  view.rerender(<Verification run={run} intent={{ ...intent, status: 'CLAIM_FAILED' }} />)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(view.container.querySelector('details')!.open).toBe(true)
})
it('keeps receipts and prices visible while successful proof stays behind one spending disclosure', () => {
  const { container } = render(<SpendPanel run={ucRuns.UC2} onRetry={() => {}} onReceipt={() => {}} />)
  expect(screen.getByRole('button', { name: /Receipt/ })).toBeTruthy()
  expect(container.querySelector('.ra-spending-proof')?.hasAttribute('open')).toBe(false)
  expect(container.querySelector('.ra-key-reveal')).toBeNull()
})
