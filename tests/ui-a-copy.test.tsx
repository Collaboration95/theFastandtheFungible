// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import RunActivity from '../src/components/RunActivity'
import MobileSpend from '../src/components/MobileSpend'
import Sources from '../src/components/Sources'
import WriterProvenance from '../src/components/WriterProvenance'
import { purchaseCounts } from '../src/format'
import { offlineNotice } from '../src/notices'
import type { RunSnapshot } from '../shared/contracts'
import { HostedContext } from '../src/hosted'
import Ask from '../src/components/Ask'

const noShow = JSON.parse(readFileSync('demo/traces/UC-key-reveal.json', 'utf8')).run as RunSnapshot
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true }; HTMLDialogElement.prototype.close = function () { this.open = false } })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('the no-show replay counts one purchase, keeping the returned attempt separate in Activity and on mobile', () => {
  expect(purchaseCounts(noShow)).toEqual({ paid: 1, refunded: 0, cancelled: 1 })
  const { container } = render(<><RunActivity run={noShow} onStop={() => {}} stopping={false} onShowWork={() => {}} /><MobileSpend run={noShow} onRetry={() => {}} onReceipt={() => {}} /><Sources run={noShow} /></>)
  expect(container.querySelector('.ra-run-status')!.textContent).toContain('Paid for 1 article.')
  expect(container.querySelector('.ra-run-status')!.textContent).toContain('1 attempt cancelled, funds returned')
  expect(container.querySelector('.ra-mobile-spend > button')!.textContent).toContain('1 payment')
  expect(container.querySelector('.ra-source-summary')!.textContent).toContain('1 bought · 0 refunded')
  expect(container.textContent).not.toMatch(/Paid for 2|2 payments|Paid AlphaLeak/)
  expect(container.querySelector('.ra-activity-list')!.textContent).toContain('Attempt cancelled, funds returned')
})
it('completed empty free reads and drafts do not claim to have read or drafted from free sources', () => {
  const run = structuredClone(noShow)
  run.contents = run.contents.filter(c => !run.candidates.some(s => s.resourceId === c.resourceId && s.tier === 'FREE'))
  const { container } = render(<RunActivity run={run} onStop={() => {}} stopping={false} onShowWork={() => {}} />)
  expect(container.textContent).toContain('No free evidence found; checking paid previews')
  expect(container.textContent).not.toMatch(/Read 0 free|Drafted an answer from free sources/)
})
it('an empty extractive draft without a fallback event does not assert a provider outage; an explicit outage stays labelled', () => {
  const run = structuredClone(noShow)
  run.labels.research = 'fixture · extractive-fixture'
  run.answers = run.answers.map(a => ({ ...a, claims: [] }))
  run.events = run.events.filter(e => e.type !== 'MODEL_FALLBACK')
  expect(offlineNotice(run)).toBe('Empty extractive draft: no citable evidence was found.')
  run.events.push({ ...run.events[0], type: 'MODEL_FALLBACK', data: { reason: 'http' } })
  expect(offlineNotice(run)).toBe('Offline extracts used: the model was unavailable. They held no citable passage.')
})
it('a single short badge retains the full provenance in a disclosure', () => {
  const publisher = 'ResearchAgent builders · XRPL explainers (team-authored) · team-authored explainer · sources cited · not an independent writer · Testnet'
  const { container } = render(<WriterProvenance publisher={publisher} />)
  expect(screen.getByText('Team-authored')).toBeTruthy()
  expect(container.querySelector('details')?.open).toBe(false)
  expect(container.querySelector('details > p')?.textContent).toBe(publisher)
})
it('the composer proof button opens the existing corner without submitting a question', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  const onAsk = vi.fn()
  render(<HostedContext.Provider value={{ status: { links: {}, labels: { rail: 'XRPL Testnet' } } } as never}><Ask onAsk={onAsk} settlement="XRPL Testnet" /></HostedContext.Provider>)
  const button = screen.getByRole('button', { name: 'Verify a recorded run, no question used' })
  fireEvent.click(button)
  const corner = document.querySelector<HTMLDetailsElement>('.ra-hwork')!
  expect(corner.open).toBe(true)
  expect(onAsk).not.toHaveBeenCalled()
  expect(within(corner).getByText('Check our work')).toBeTruthy()
})
