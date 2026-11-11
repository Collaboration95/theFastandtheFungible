// @vitest-environment jsdom
// Web panels that only browser specs exercised: Show work (W), the hosted environment chip, the command palette, and
// Export's receipts download. Each test checks what a judge reads or can do there. Fixture runs and invented statuses only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { XRPL_LABEL, type RunSnapshot } from '../shared/contracts/index.js'
import type { HostedDemoStatus } from '../src/api'
import type { Hosted } from '../src/hosted'
import ShowWork from '../src/components/ShowWork'
import HostedEnv from '../src/components/hosted/HostedEnv'
import CommandPalette, { type Command } from '../src/components/CommandPalette'
import { ucRuns } from '../src/fixtures/run'
import { saveReceipts } from '../src/download'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Show work', () => {
  const tabNames = () => screen.getAllByRole('tab', { hidden: true }).map(tab => tab.textContent)
  it('opens as a modal on Trace, switches views and lists only this run’s receipts', () => {
    const onClose = vi.fn()
    render(<ShowWork run={ucRuns.UC3} onClose={onClose} />)
    const sheet = screen.getByRole('dialog', { name: 'Show work', hidden: true }) as HTMLDialogElement
    expect(sheet.open).toBe(true)
    expect(tabNames()).toEqual(['Trace', 'Wire', 'Policy', 'Receipts', 'Models'])
    expect(sheet.textContent).toContain('What the agent did, in order.')
    for (const [tab, note] of [['Wire', 'The requests and responses behind this run.'], ['Policy', 'Why each article was bought or skipped.'], ['Models', 'The providers and substitutions used in this run.']]) {
      fireEvent.click(screen.getByRole('tab', { name: tab, hidden: true }))
      expect(screen.getByRole('tab', { name: tab, hidden: true }).getAttribute('aria-selected')).toBe('true')
      expect(screen.getByRole('tabpanel', { hidden: true }).getAttribute('aria-label')).toBe(tab)
      expect(sheet.textContent).toContain(note)
    }
    fireEvent.click(screen.getByRole('tab', { name: 'Receipts', hidden: true }))
    const items = within(screen.getByRole('tabpanel', { hidden: true })).getAllByRole('listitem', { hidden: true })
    expect(items).toHaveLength(ucRuns.UC3.receipts.length)
    for (const receipt of ucRuns.UC3.receipts) expect(sheet.textContent).toContain(`receipt ${receipt.receiptId}`)
    fireEvent.click(screen.getByRole('button', { name: 'Close show work', hidden: true }))
    fireEvent(sheet, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('says so when a run has no receipts, and adds the Ledger view only on XRPL Testnet', () => {
    const { unmount } = render(<ShowWork run={ucRuns.UC1} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Receipts', hidden: true }))
    expect(screen.getByText('No receipts in this run.')).toBeTruthy()
    unmount()
    const testnet: RunSnapshot = { ...ucRuns.UC1, labels: { ...ucRuns.UC1.labels, settlement: XRPL_LABEL } }
    render(<ShowWork run={testnet} onClose={() => {}} />)
    expect(tabNames()).toContain('Ledger')
    fireEvent.click(screen.getByRole('tab', { name: 'Ledger', hidden: true }))
    expect(screen.getByRole('tabpanel', { hidden: true }).textContent).toContain('The transactions on XRPL Testnet.')
  })
})

describe('hosted environment chip', () => {
  const status = (patch: Partial<HostedDemoStatus> = {}): HostedDemoStatus => ({
    questionCapMinor: 200, state: 'ready', csrfToken: 't', queue: [],
    capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false },
    remaining: { questions: 4, minor: 1000 }, labels: { models: 'deepseek · fixture purchase decisions', rail: 'Shared XRPL Testnet demo · no real value' },
    links: { repo: 'https://github.com/example/repo', deck: '', video: '', progress: '', replay: '' }, ...patch,
  })
  const chip = (hosted: Hosted) => { render(<HostedEnv hosted={hosted} />); return screen.getByRole('button', { expanded: false }) }

  it('names the rail and models, opens details on demand and closes back to the chip', () => {
    const trigger = chip({ status: status() })
    expect(trigger.getAttribute('aria-label')).toBe('Shared XRPL Testnet demo · live answers, rule-based buying · no real value')
    expect(screen.queryByRole('region', { name: 'About this demo' })).toBeNull()
    fireEvent.click(trigger)
    const details = screen.getByRole('region', { name: 'About this demo' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(details.textContent).toContain('Shared XRPL Testnet demo')
    expect(details.textContent).toContain('Paid over x402 on XRPL Testnet.')
    expect(details.textContent).toContain('What to buy is decided by fixed offline rules')
    expect(details.textContent).toContain('Up to S$2.00 of test funds per question, 5 questions a day, one at a time. Today: 4 left.')
    fireEvent.click(within(details).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'About this demo' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('says simulated payments and fixture models plainly, and live models when both are live', () => {
    fireEvent.click(chip({ status: status({ labels: { models: 'fixture models', rail: 'Simulated payments · no real value' } }) }))
    let details = screen.getByRole('region', { name: 'About this demo' })
    expect(details.textContent).toContain('Shared demo · simulated payments')
    expect(details.textContent).toContain('Simulated: no ledger transactions. Receipts say so.')
    expect(details.textContent).toContain('Fixture models: offline extracts and rules')
    cleanup()
    fireEvent.click(chip({ status: status({ labels: { models: 'deepseek · openai decisions', rail: 'Shared XRPL Testnet demo · no real value' } }) }))
    details = screen.getByRole('region', { name: 'About this demo' })
    expect(details.textContent).toContain('Live models plan, judge what to buy and write.')
  })
  it('shows a degraded demo as live once today’s allowance is spent, and an offline one as offline', () => {
    const degraded = chip({ status: status({ state: 'degraded', remaining: { questions: 0, minor: 0 } }) })
    expect(degraded.className).toContain('is-live')
    cleanup()
    expect(chip({ status: status({ state: 'degraded' }) }).className).toContain('is-warn')
    cleanup()
    const offline = chip({ status: status(), connection: 'offline' })
    expect(offline.className).toContain('is-off')
    expect(offline.getAttribute('aria-label')).toBe('Shared XRPL Testnet demo · offline · no real value')
  })
})

describe('command palette', () => {
  beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 }) })
  const commands = (): Command[] => [
    { id: 'cmd-run-1', label: 'Orchid fertiliser', group: 'Recent runs', run: vi.fn() },
    { id: 'cmd-example-uc3', label: 'Kestrel outlook', group: 'Examples', run: vi.fn() },
    { id: 'cmd-show-work', label: 'Show work', hint: 'W', run: vi.fn() },
    { id: 'cmd-new', label: 'New question', hint: 'N', run: vi.fn() },
  ]
  const options = () => screen.getAllByRole('option', { hidden: true })

  it('groups actions first, filters as you type and runs the chosen command after closing', () => {
    const list = commands(), onClose = vi.fn()
    render(<CommandPalette commands={list} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Command palette', hidden: true })).toBeTruthy()
    expect(options().map(option => option.textContent)).toEqual(['ActionsShow workW', 'New questionN', 'ExamplesKestrel outlook', 'Recent runsOrchid fertiliser'])
    const search = screen.getByRole('combobox', { hidden: true })
    fireEvent.change(search, { target: { value: 'kestrel' } })
    expect(options().map(option => option.id)).toEqual(['cmd-example-uc3'])
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(list[1].run).toHaveBeenCalledTimes(1)
    for (const other of [list[0], list[2], list[3]]) expect(other.run).not.toHaveBeenCalled()
  })
  it('moves the selection with the arrow keys, wrapping at both ends', () => {
    const list = commands()
    render(<CommandPalette commands={list} onClose={() => {}} sheet />)
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts', hidden: true })).toBeTruthy()
    const search = screen.getByRole('combobox', { hidden: true })
    const selected = () => search.getAttribute('aria-activedescendant')
    expect(selected()).toBe('cmd-show-work')
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    expect(selected()).toBe('cmd-run-1')
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(selected()).toBe('cmd-new')
    fireEvent.click(options()[1])
    expect(list[3].run).toHaveBeenCalledTimes(1)
  })
  it('says when nothing matches, and closes on Escape or a click outside the list', () => {
    const onClose = vi.fn()
    render(<CommandPalette commands={commands()} onClose={onClose} />)
    fireEvent.change(screen.getByRole('combobox', { hidden: true }), { target: { value: 'buy everything' } })
    expect(screen.getByText('No matching commands.')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('combobox', { hidden: true }), { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Command palette', hidden: true })
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Export → Download receipts.json', () => {
  const saved = () => {
    const files: { name: string; text: string; type?: string }[] = []
    vi.stubGlobal('Blob', class { constructor(readonly parts: string[], readonly options: BlobPropertyBag) {} })
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: (blob: { parts: string[]; options: BlobPropertyBag }) => { files.push({ name: '', text: blob.parts.join(''), type: blob.options.type }); return 'blob:receipts' }, revokeObjectURL: vi.fn() }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { files[files.length - 1].name = this.download })
    return files
  }
  afterEach(() => { vi.restoreAllMocks() })
  it('saves the run’s own receipts bundle, as fetched, under the name the verifier docs use', async () => {
    const files = saved(), bundle = { schema: 'receipts', runId: 'run 1/2' }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(bundle), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await saveReceipts('run 1/2')
    expect(fetchMock).toHaveBeenCalledWith('/runs/run%201%2F2/receipts.json')
    expect(files.map(file => file.name)).toEqual(['receipts.json'])
    expect(files[0].type).toBe('application/json')
    expect(JSON.parse(files[0].text)).toEqual(bundle)
    await saveReceipts('run 1/2', 'proof.json', data => data.runId)
    expect(files[1].name).toBe('proof.json')
    expect(JSON.parse(files[1].text)).toBe('run 1/2')
  })
  it('saves nothing when the server refuses or the picked part is missing', async () => {
    const files = saved()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    await expect(saveReceipts('gone')).rejects.toThrow('receipts unavailable')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await saveReceipts('empty', 'part.json', () => undefined)
    expect(files).toEqual([])
  })
})
