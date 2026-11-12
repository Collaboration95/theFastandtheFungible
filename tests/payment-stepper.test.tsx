// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { PurchaseIntent, RunSnapshot } from '../shared/contracts'
import PaymentStepper from '../src/components/PaymentStepper'
import { staged } from '../src/stage'
vi.mock('../src/components/KeyRevealLifecycle', () => ({ default: () => <button>Check the key yourself</button> }))
afterEach(cleanup)
const trace: RunSnapshot = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8')).run
const settled = trace.intents.find(i => i.status === 'VERIFIED')!
const view = (intent: PurchaseIntent) => render(<PaymentStepper run={{ ...trace, intents: [intent] }} />)
it('keeps a settled purchase as one collapsed line, with all three steps and exact tx links on expansion', async () => {
  view(settled)
  const details = document.querySelector('details')!
  expect(details.open).toBe(false)
  fireEvent.click(details.querySelector('summary')!)
  expect(details.open).toBe(true)
  for (const label of ['Locked', 'Key published', 'Unlocked', 'Passage delivered']) expect(screen.getAllByText(label)[0]).toBeTruthy()
  expect(screen.getByRole('link', { name: 'EscrowCreate' }).getAttribute('href')).toContain(settled.escrow!.createHash)
  expect(screen.getByRole('link', { name: 'EscrowFinish' }).getAttribute('href')).toContain(settled.escrow!.finishHash)
  expect(await screen.findByRole('button', { name: 'Check the key yourself' })).toBeTruthy()
})
it('keeps pending open, renders the create link immediately, and does not claim key publication or delivery', () => {
  view({ ...settled, status: 'SUBMITTING', escrow: { ...settled.escrow!, state: 'LOCKED', finishHash: undefined, decryptVerified: undefined, keyVerified: undefined } })
  expect(document.querySelector('details')!.open).toBe(true)
  expect(screen.getByRole('link', { name: 'EscrowCreate' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'EscrowFinish' })).toBeNull()
  expect(screen.queryByText('Passage delivered')).toBeNull()
  expect(screen.getByText(/confirmed cancellation/)).toBeTruthy()
})
it('shows a no-show cancellation with its exact EscrowCancel link, without claiming unlock', () => {
  view({ ...settled, status: 'FAILED_NOT_SETTLED', escrow: { ...settled.escrow!, state: 'CANCELLED', cancelHash: 'C'.repeat(64), finishHash: undefined, decryptVerified: undefined } })
  fireEvent.click(document.querySelector('summary')!)
  expect(screen.getAllByText('Refunded: escrow cancelled after the deadline')).toHaveLength(2)
  expect(screen.getByRole('link', { name: 'EscrowCancel' }).getAttribute('href')).toBe(`https://testnet.xrpl.org/transactions/${'C'.repeat(64)}`)
  expect(screen.queryByText('Passage delivered')).toBeNull()
})
it('distinguishes a writer-signed quality refund after release from a no-show', () => {
  const refunded = trace.intents.find(i => i.status === 'REFUNDED')!
  view(refunded); fireEvent.click(document.querySelector('summary')!)
  expect(screen.getAllByText('Quality refund: writer-signed')).toHaveLength(2)
  expect(screen.getByText('Passage rejected · not used in the answer')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Refund transaction' }).getAttribute('href')).toContain(refunded.refund!.txHash)
  expect(screen.queryByRole('link', { name: 'EscrowCancel' })).toBeNull()
})
it('reacts to incoming snapshots, collapses on settlement and keeps each purchase separate', () => {
  const pending = { ...settled, escrow: { ...settled.escrow!, state: 'LOCKED' as const, finishHash: undefined, decryptVerified: undefined } }
  const root = view(pending)
  root.rerender(<PaymentStepper run={trace} />)
  expect(document.querySelectorAll('.ra-payment-stepper')).toHaveLength(2)
  for (const el of document.querySelectorAll<HTMLDetailsElement>('.ra-payment-stepper')) expect(el.open).toBe(false)
})
it('does not offer a public explorer lookup for a simulated or missing transaction', () => {
  render(<PaymentStepper run={{ ...trace, labels: { ...trace.labels, settlement: 'SIMULATED SGD · no real funds' }, intents: [settled] }} />)
  fireEvent.click(document.querySelector('summary')!)
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})
it('paces recorded escrow states from events without exposing future key publication or refunds', () => {
  const create = trace.events.find(e => e.type === 'ESCROW_CREATE')!
  const finish = trace.events.find(e => e.type === 'ESCROW_FINISH')!
  const early = staged(trace, create.id).intents[0]
  expect(early.escrow!.state).toBe('LOCKED')
  expect(early.escrow!.finishHash).toBeUndefined()
  expect(early.escrow!.decryptVerified).toBeUndefined()
  expect(early.refund).toBeUndefined()
  const later = staged(trace, finish.id).intents[0]
  expect(later.escrow!.state).toBe('RELEASED')
  expect(later.escrow!.finishHash).toBe(trace.intents[0].escrow!.finishHash)
  expect(later.refund).toBeUndefined()
  render(<PaymentStepper run={staged(trace, create.id)} />)
  expect(within(screen.getByRole('region', { name: 'Payment and delivery' })).queryByText('Passage delivered')).toBeNull()
})

it('keeps a released payment open until the passage is actually unlocked', () => {
  view({ ...settled, status: 'DELIVERY_PENDING', escrow: { ...settled.escrow!, decryptVerified: undefined } })
  expect(document.querySelector('details')!.open).toBe(true)
  expect(screen.queryByText('Passage delivered')).toBeNull()
  expect(document.querySelectorAll('ol > li.is-complete')).toHaveLength(2)
})

it('shows recorded durations and ledger indexes, with the full breakdown on finished runs', () => {
  const mark = (elapsedMs: number, ledgerIndex?: number, txHash?: string) => ({ at: '2026-11-12T00:00:00.000Z', elapsedMs, source: 'buyer' as const, ledgerIndex, txHash })
  view({ ...settled, timing: { startedAt: '2026-11-12T00:00:00.000Z', phases: { quote: mark(400), createSubmitted: mark(2000), createValidated: mark(6000, 100, settled.escrow!.createHash), lockProven: { ...mark(7000), source: 'writer' }, finishSubmitted: { ...mark(8000), source: 'writer' }, finishValidated: mark(13000, 102, settled.escrow!.finishHash), unlocked: mark(13005, 102) } } })
  fireEvent.click(document.querySelector('summary')!)
  expect(screen.getByText('6.0 s · Ledger 100')).toBeTruthy()
  expect(screen.getByText('7.0 s · Ledger 102')).toBeTruthy()
  expect(screen.getByText('<0.1 s · Ledger 102')).toBeTruthy()
  expect(screen.getByText('Timing breakdown')).toBeTruthy()
  expect(screen.getByText('8.00 s since start · writer-reported')).toBeTruthy()
})
it('does not show a submitted finish as validated or unlocked', () => {
  view({ ...settled, status: 'SUBMITTING', escrow: { ...settled.escrow!, state: 'LOCKED', finishHash: undefined, decryptVerified: undefined }, timing: { startedAt: new Date().toISOString(), phases: { createValidated: { at: new Date().toISOString(), elapsedMs: 0, source: 'buyer', ledgerIndex: 100, txHash: settled.escrow!.createHash }, finishSubmitted: { at: new Date().toISOString(), elapsedMs: 0, source: 'writer', txHash: settled.escrow!.finishHash } } } })
  expect(screen.getByRole('link', { name: 'EscrowCreate' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'EscrowFinish' })).toBeNull()
  expect(screen.queryByText('The writer published the key')).toBeNull()
  expect(screen.queryByText('Passage delivered')).toBeNull()
  expect(screen.getByText(/s elapsed/)).toBeTruthy()
})
it('reveals the finish link live after validation while delivery is still locked', () => {
  const now = new Date().toISOString()
  view({ ...settled, status: 'SUBMITTING', escrow: { ...settled.escrow!, state: 'LOCKED', finishHash: undefined, decryptVerified: undefined }, timing: { startedAt: now, phases: { finishValidated: { at: now, elapsedMs: 1000, source: 'buyer', ledgerIndex: 102, txHash: settled.escrow!.finishHash } } } })
  expect(screen.getByRole('link', { name: 'EscrowFinish' }).getAttribute('href')).toContain(settled.escrow!.finishHash)
  expect(screen.getByText('The writer published the key')).toBeTruthy()
  expect(screen.queryByText('Passage delivered')).toBeNull()
})
it('filters future recorded phase observations at the replay cursor', () => {
  const create = trace.events.find(e => e.type === 'ESCROW_CREATE')!
  const now = new Date().toISOString()
  const run = { ...trace, intents: [{ ...settled, timing: { startedAt: now, phases: { finishValidated: { at: now, elapsedMs: 1000, source: 'buyer' as const, ledgerIndex: 102, txHash: settled.escrow!.finishHash } } } }] }
  expect(staged(run, create.id).intents[0].timing?.phases.finishValidated).toBeUndefined()
})

it('keeps a decrypted but rejected passage from being described as delivered', () => {
  view({ ...settled, status: 'CLAIM_FAILED', escrow: { ...settled.escrow!, proofOk: false, decryptVerified: true } })
  fireEvent.click(document.querySelector('summary')!)
  expect(screen.getByText('Passage did not pass verification')).toBeTruthy()
  expect(screen.getByText('Passage rejected · not used in the answer')).toBeTruthy()
  expect(screen.queryByText('Passage delivered')).toBeNull()
})

it('uses the recorded replay cursor for a historical pending step without starting a wall clock', () => {
  const start = '2020-01-01T00:00:00.000Z'
  const timer = vi.spyOn(window, 'setInterval')
  render(<PaymentStepper clockAt={Date.parse(start) + 8000} run={{ ...trace, intents: [{ ...settled, status: 'SUBMITTING', escrow: { ...settled.escrow!, state: 'LOCKED', finishHash: undefined, decryptVerified: undefined }, timing: { startedAt: start, phases: { createValidated: { at: start, elapsedMs: 6000, source: 'buyer', ledgerIndex: 100, txHash: settled.escrow!.createHash } } } }] }} />)
  try {
    expect(screen.getByText('2 s elapsed')).toBeTruthy()
    expect(timer).not.toHaveBeenCalled()
  } finally { timer.mockRestore() }
})

it('shows the validated create immediately at its timing event before the following escrow-state event', () => {
  const now = new Date().toISOString()
  view({ ...settled, status: 'SUBMITTING', escrow: { ...settled.escrow!, state: 'PREPARED', createHash: undefined, finishHash: undefined, decryptVerified: undefined }, timing: { startedAt: now, phases: { createValidated: { at: now, elapsedMs: 6000, source: 'buyer', ledgerIndex: 100, txHash: settled.escrow!.createHash } } } })
  expect(screen.getByText(/Escrow created/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'EscrowCreate' }).getAttribute('href')).toContain(settled.escrow!.createHash)
  expect(document.querySelectorAll('ol > li.is-complete')).toHaveLength(1)
  expect(screen.queryByText('Creating escrow')).toBeNull()
})

for (const state of ['pending','released','refunded'] as const) it(`shows a quiet fourth holdback ${state} state with its transaction link`, () => {
  const hash='B'.repeat(64)
  view({...settled,escrow:{...settled.escrow!,holdback:{state,amount:'8000',amountMinor:8,percent:20,condition:`A0258020${'A'.repeat(64)}810120`,cancelAfter:800000600,batchHash:hash,...(state==='released'?{finishHash:hash,checks:'pass' as const}:state==='refunded'?{cancelHash:hash,checks:'fail' as const}:{})}}})
  fireEvent.click(document.querySelector('summary')!)
  expect(screen.getByText(`Holdback ${state}`)).toBeTruthy()
  expect(document.querySelectorAll('ol > li')).toHaveLength(4)
  expect(document.querySelector(`a[href$="${hash}"]`)).toBeTruthy()
  expect(screen.queryByText('Quality refund: writer-signed')).toBeNull()
})
