// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import KeyRevealLifecycle, { KeyCheckResult } from './KeyRevealLifecycle'
import type { EscrowStatus } from '../../shared/contracts/escrow'
import type { KeyCheck } from '../verify/key-on-ledger'
// This suite isolates the key checker; the independent purchase read is fixture-tested in ledger-ui.
vi.mock('./LedgerReceipt', () => ({ default: () => null }))
afterEach(cleanup)
const base: EscrowStatus = { scheme:'escrow-v1',policy:'escrow-policy-v1',mode:'key-reveal',state:'LOCKED',owner:'fixture',cancelAfter:2000000000,createHash:'A'.repeat(64) }
const render1 = (patch: Partial<EscrowStatus>) => renderToStaticMarkup(createElement(KeyRevealLifecycle,{escrow:{...base,...patch}}))
it('shows pending cancellation authority without inventing a proof or refund',()=>{
  const html=render1({})
  expect(html).toContain('Payment locked in escrow')
  expect(html).toContain('Auto-refund available in')
  expect(html).not.toContain('Condition ✓')
  expect(html).not.toContain('principal returned')
})
it('shows individual policy checks, ledger publication and transaction links',()=>{
  const html=render1({state:'RELEASED',finishHash:'B'.repeat(64),revealLedger:123,keyVerified:true,decryptVerified:true})
  expect(html).toContain('Writer released the key')
  expect(html).toContain('in ledger 123')
  expect(html).toContain('sha256(K) = Condition ✓')
  expect(html).toContain('ciphertext decrypts ✓')
  expect(html).toContain(`https://testnet.xrpl.org/transactions/${'B'.repeat(64)}`)
  expect(render1({state:'CANCELLED',cancelHash:'C'.repeat(64)})).toContain('funds returned')
})

// T1 · "Check the key yourself": sha256(key) = lock, recomputed in the browser from the public ledger.
const released: EscrowStatus = { ...base, state: 'RELEASED', finishHash: 'B'.repeat(64), keyVerified: true, decryptVerified: true }
const LOCK = 'E4FD995AB816AC4C6EF73F775B1AD291A6DA5E937A1881FB9FC7F5E298D341B2', KEY = '69228F168B1805F527B89EE9ACF37CA4FAB80D71FA4AF0C9EC23AFC79391F2AC'
const match: KeyCheck = { status: 'match', lock: LOCK, key: KEY, ledger: 22228567, node: 's.altnet.rippletest.net' }
const html = (check: KeyCheck, replay?: boolean) => renderToStaticMarkup(createElement(KeyCheckResult, { check, escrow: released, replay }))

it('offers the check only for a Testnet escrow that has both transactions, and never on a cancelled or simulated one', () => {
  const offered = (patch: Partial<EscrowStatus>, testnet: boolean) => renderToStaticMarkup(createElement(KeyRevealLifecycle, { escrow: { ...released, ...patch }, testnet })).includes('Check the key yourself')
  expect(offered({}, true)).toBe(true)
  expect(offered({}, false)).toBe(false) // a SIMULATED run has nothing on the public ledger to look up
  expect(offered({ finishHash: undefined }, true)).toBe(false)
  expect(offered({ createHash: undefined }, true)).toBe(false)
  expect(offered({ finishHash: 'not-a-hash' }, true)).toBe(false)
  expect(offered({ state: 'CANCELLED', cancelHash: 'C'.repeat(64) }, true)).toBe(false)
})

it('a match says sha256(key) = lock ✓ with the ledger, short hex and the labels, and never prints the full values', () => {
  const out = html(match)
  expect(out).toContain('sha256(key) = lock ✓')
  expect(out).toContain('Computed in this browser from XRPL Testnet ledger 22228567')
  expect(out).toContain('E4FD995A…98D341B2')
  expect(out).toContain('69228F16…9391F2AC')
  expect(out).not.toContain(LOCK); expect(out).not.toContain(KEY)
  expect(out).toContain('XRPL Testnet · no real value')
  expect(out).not.toContain('fictional writer')
  expect(out).toContain(`https://testnet.xrpl.org/transactions/${'B'.repeat(64)}`)
  expect(out).toContain(`https://testnet.xrpl.org/transactions/${'A'.repeat(64)}`)
  expect(html(match, true)).toContain('XRPL Testnet · no real value · fictional writer')
})

it('every other state says what happened without a ✓, and a missing transaction is pending, not failed', () => {
  const states: [KeyCheck, string][] = [
    [{ status: 'mismatch', why: 'key', lock: LOCK, key: KEY }, 'Doesn’t match'],
    [{ status: 'mismatch', why: 'lock' }, 'Doesn’t match'],
    [{ status: 'mismatch', why: 'escrow' }, 'not the same escrow'],
    [{ status: 'mismatch', why: 'failed' }, 'did not succeed'],
    [{ status: 'pending', why: 'not-found' }, 'Not found on this node yet'],
    [{ status: 'pending', why: 'not-validated' }, 'Not final on the ledger yet'],
    [{ status: 'unreachable' }, 'Couldn’t reach a public XRPL node'],
    [{ status: 'unreadable' }, 'Couldn’t read this escrow'],
  ]
  for (const [check, words] of states) {
    const out = html(check)
    expect(out, JSON.stringify(check)).toContain(words)
    expect(out, JSON.stringify(check)).not.toContain('✓')
    expect(out, JSON.stringify(check)).not.toContain('is-match')
  }
  for (const pending of [{ status: 'pending', why: 'not-found' }, { status: 'pending', why: 'not-validated' }, { status: 'unreachable' }] as KeyCheck[]) expect(html(pending).toLowerCase()).not.toMatch(/fail|error|wrong|tamper/)
  expect(html({ status: 'mismatch', why: 'key', lock: LOCK, key: KEY })).toContain('is-mismatch')
})

it('pressing the button checks once, shows the result in a polite status region and offers a retry only when nothing was decided', async () => {
  let release: (check: KeyCheck) => void = () => {}
  const verify = vi.fn(() => new Promise<KeyCheck>(resolve => { release = resolve }))
  render(createElement(KeyRevealLifecycle, { escrow: { ...released }, testnet: true, verify: verify as never }))
  const button = screen.getByRole('button', { name: /Check the key yourself/ })
  fireEvent.click(button)
  expect(verify).toHaveBeenCalledWith({ create: 'A'.repeat(64), finish: 'B'.repeat(64) })
  expect((screen.getByRole('button', { name: /Checking the ledger/ }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => release({ status: 'pending', why: 'not-found' }))
  expect(screen.getByRole('status').textContent).toContain('Not found on this node yet')
  fireEvent.click(screen.getByRole('button', { name: /Check again/ }))
  await act(async () => release(match))
  expect(screen.getByRole('status').textContent).toContain('sha256(key) = lock ✓')
  expect(screen.queryByRole('button', { name: /Check/ })).toBeNull() // decided: nothing left to retry
  expect(verify).toHaveBeenCalledTimes(2)
})

it('a check that throws reads as unreachable, never as a result', async () => {
  const verify = vi.fn(() => Promise.reject(new Error('boom')))
  render(createElement(KeyRevealLifecycle, { escrow: { ...released }, testnet: true, verify: verify as never }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Check the key yourself/ })) })
  expect(screen.getByRole('status').textContent).toContain('Couldn’t reach a public XRPL node')
  expect(screen.getByRole('status').textContent).not.toContain('✓')
})

it('a previous payment’s result cannot appear under changed transaction hashes', async () => {
  let release: (check: KeyCheck) => void = () => {}
  const verify = vi.fn(() => new Promise<KeyCheck>(resolve => { release = resolve }))
  const view = render(createElement(KeyRevealLifecycle, { escrow: released, testnet: true, verify }))
  fireEvent.click(screen.getByRole('button', { name: /Check the key yourself/ }))
  view.rerender(createElement(KeyRevealLifecycle, { escrow: { ...released, finishHash: 'C'.repeat(64) }, testnet: true, verify }))
  await act(async () => release(match))
  expect(screen.queryByText('sha256(key) = lock ✓')).toBeNull()
  expect(screen.getByRole('button', { name: /Check the key yourself/ })).toBeTruthy()
})
