// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import HostedEnv from '../src/components/hosted/HostedEnv'
import EnvIndicator from '../src/components/EnvIndicator'
import { HostedIntro, HostedComposerNote } from '../src/components/hosted/HostedHome'
import type { Hosted } from '../src/hosted'
import { HostedContext } from '../src/hosted'
import type { ModeLabels } from '../shared/contracts'
import Ask from '../src/components/Ask'
const hosted = { status: { questionCapMinor: 200, state: 'ready', remaining: { questions: 5, minor: 1000 }, labels: { models: 'live models · fixture purchase decisions', rail: 'Shared XRPL Testnet demo · no real value' }, links: {} } } as Hosted
const labels = { settlement: 'XRPL TESTNET · no real value', research: 'deepseek', decision: 'fixture · metadata-fixture', publisher: 'local' } as ModeLabels
afterEach(cleanup)
it('Home has a single environment label and reaches money, raw model and rate-limit details from its chip', () => {
  render(<HostedContext.Provider value={hosted}><HostedEnv hosted={hosted} /><Ask onAsk={() => {}} settlement={labels.settlement} intro={<HostedIntro hosted={hosted} state="ready" />} composerNote={<HostedComposerNote hosted={hosted} state="ready" />} /></HostedContext.Provider>)
  const chip = screen.getByRole('button', { name: 'XRPL Testnet' })
  expect(document.querySelectorAll('.ra-env-trigger')).toHaveLength(1)
  expect(screen.queryByText(/in test funds|test funds only|Rule-based buying/)).toBeNull()
  expect(document.querySelectorAll('.ra-hv')).toHaveLength(0)
  fireEvent.click(chip)
  expect(screen.getByText(/No real value/)).toBeTruthy()
  expect(screen.getByText(/Policy rules decide purchases deterministically/)).toBeTruthy()
  expect(screen.getByText(/5 questions a day/)).toBeTruthy()
  expect(screen.getByText(/fixture purchase decisions/)).toBeTruthy()
})
it('the desktop environment chip uses the same quiet label and retains full payment and fallback disclosures', () => {
  render(<EnvIndicator labels={{ ...labels, testnetFallback: undefined }} />)
  const chip = screen.getByRole('button', { name: 'XRPL Testnet' })
  expect(chip.textContent).toBe('XRPL Testnet')
  fireEvent.click(chip)
  expect(screen.getByText(/No real value/)).toBeTruthy()
})
it('both entry controls share one checker, without asking a question', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  const onAsk = vi.fn()
  render(<HostedContext.Provider value={hosted}><Ask onAsk={onAsk} settlement={labels.settlement} /></HostedContext.Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Verify a recorded run' }))
  expect(await screen.findAllByRole('button', { name: 'Run the checks' })).toHaveLength(1)
  const corner = document.querySelector<HTMLDetailsElement>('.ra-hwork')!
  expect(corner.open).toBe(true)
  fireEvent.click(corner.querySelector('summary')!)
  fireEvent.click(corner.querySelector('summary')!)
  expect(await screen.findAllByRole('button', { name: 'Run the checks' })).toHaveLength(1)
  expect(onAsk).not.toHaveBeenCalled()
})
