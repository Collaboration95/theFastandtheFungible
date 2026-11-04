// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import EnvIndicator from '../src/components/EnvIndicator.js'
import { exampleRun } from '../src/fixtures/run.js'
import { XRPL_LABEL } from '../shared/contracts/index.js'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('keeps simulation labels usable when private mode refuses storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage disabled') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled') })
  render(<EnvIndicator labels={exampleRun.labels} />)
  const trigger = screen.getByRole('button', { name: /Demo.*simulated payments/ })
  fireEvent.click(trigger)
  expect(screen.getByText('Simulated, no ledger entry')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})
it('keeps an unconnected environment explicitly simulated', () => {
  render(<EnvIndicator />)
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getAllByText('Connecting…', { exact: false }).length).toBeGreaterThan(0)
  expect(screen.getByText('Simulated, no ledger entry')).toBeTruthy()
})
it('labels Testnet funds as having no value and preserves supplied model labels', () => {
  render(<EnvIndicator recording labels={{ ...exampleRun.labels, settlement: XRPL_LABEL, research: 'research protocol fixture', decision: 'decision protocol fixture', search: 'hybrid' }} />)
  const trigger = screen.getByRole('button')
  fireEvent.click(trigger)
  expect(screen.getByText('XRPL Testnet, test funds with no value')).toBeTruthy()
  expect(screen.getByText('Hybrid')).toBeTruthy()
  expect(screen.getByText(/research protocol fixture/)).toBeTruthy()
  fireEvent.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

for (const interaction of ['pointer', 'keyboard']) it(`does not cover an active question when health labels arrive late (${interaction})`, () => {
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  try {
    const { rerender } = render(<EnvIndicator />)
    if (interaction === 'pointer') fireEvent.pointerDown(document.body)
    else fireEvent.keyDown(document.body, { key: 'k' })
    rerender(<EnvIndicator labels={exampleRun.labels} />)
    act(() => { vi.runAllTimers() })
    expect(screen.queryByRole('region', { name: "What's real here" })).toBeNull()
    // Explicit disclosure remains available after automatic onboarding is skipped.
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('region', { name: "What's real here" })).toBeTruthy()
  } finally { vi.useRealTimers() }
})
