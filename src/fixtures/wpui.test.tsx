// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEMO_QUESTIONS } from '../../shared/contracts/examples.js'
import { exampleRun, paidStoryRun, uc2Scope, uc3Reputation, uc3Run, ucRuns } from './run.js'
import bible from '../../data/corpus/v2/story-bible.json'
import Presenter from '../components/Presenter.js'
import Ask from '../components/Ask.js'
import EnvIndicator from '../components/EnvIndicator'
import App from '../App.js'
import PlanSheet from '../components/PlanSheet.js'
import DecisionTable from '../components/DecisionTable.js'
import DecisionPanel from '../components/DecisionPanel.js'
import Sources, { getAccessibleContent } from '../components/Sources.js'
import WriterChip from '../components/WriterChip.js'
import PaymentRow from '../components/PaymentRow.js'
import SpendPanel from '../components/SpendPanel.js'
import RunActivity from '../components/RunActivity.js'
import ReputationPanel from '../components/ReputationPanel.js'
import Sidebar, { NAV_WIDTH, NavToggle } from '../components/Sidebar.js'
import type { PastRun } from '../api.js'
import Toasts from '../components/Toasts.js'
import BudgetPicker from '../components/BudgetPicker.js'
import Settings from '../components/Settings.js'
import { getReputation, resetReputation, scope } from '../api.js'
import { dwell, staged } from '../stage.js'

// Wording that would make the plan card read as a purchase approval (gate 2).
const PURCHASE_APPROVAL = /approve (?:this )?purchase|confirm payment/i

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value() { this.setAttribute('open', '') }, configurable: true })
Object.defineProperty(HTMLDialogElement.prototype, 'close', { value() { this.removeAttribute('open') }, configurable: true })

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); try { localStorage.clear() } catch { /* no storage */ } })

function stubBrowser(onRun: (body: Record<string, unknown>) => void) {
  const calls: { path: string; body?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })
    const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data })
    if (path === '/api/settings') return json({csrf:'fixture-csrf', values:{MCP_MAX_BUDGET_MINOR:0,MCP_DAILY_CAP_MINOR:0,WALLET_DAILY_CAP_MINOR:2000,SETTLEMENT_RAIL:'simulated',ESCROW_MODE:'key-reveal',ESCROW_ASSET:'XRP',ANCHOR_RAIL:'off'},keys:{},version:'1.1.0'})
    if (path === '/api/settings/prompt-budget') return json({saved:true})
    if (path === '/api/health') return json({ status: 'ok', labels: exampleRun.labels, faults: false })
    if (path === '/api/scope') return json(body.clarify === 'never' ? { ...uc2Scope, questions: [], label: 'fixture · scope-fixture' } : { ...uc2Scope, label: 'fixture · scope-fixture' })
    if (path === '/runs') { onRun(body); return json({ ...paidStoryRun, question: body.question }, 201) }
    return json({}, 404)
  }))
  vi.stubGlobal('EventSource', class extends EventTarget { close() {} })
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion'), addEventListener() {}, removeEventListener() {} }))
  return calls
}

describe('clarify chips and the 5 s plan card (#150)', () => {
  it('drives scope → chips → plan card → run with the fixture API', async () => {
    const runs: Record<string, unknown>[] = []
    const calls = stubBrowser(body => runs.push(body))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Kestrel/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
    const chip = await screen.findByRole('button', { name: 'pricing & margins' })
    expect(calls.find(call => call.path === '/api/scope')?.body).toEqual({ question: DEMO_QUESTIONS[1].text })
    expect(runs).toHaveLength(0)
    fireEvent.click(chip)
    const card = await screen.findByRole('dialog', { name: 'Search plan' })
    expect(card.textContent).toContain('Search every listed writer for your question')
    // The stop-word-stripped search words are not read back to the visitor; Edit still shows them.
    for (const query of uc2Scope.plan.subqueries) expect(card.textContent).not.toContain(query)
    expect(card.textContent).not.toMatch(PURCHASE_APPROVAL)
    expect(runs).toHaveLength(0)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(runs).toEqual([{ question: DEMO_QUESTIONS[1].text, budgetMinor: 200, answers: { angle: 'pricing & margins' }, plan: uc2Scope.plan }])
    expect(await screen.findByRole('heading', { name: DEMO_QUESTIONS[1].text })).toBeTruthy()
  })

  it('honours ?clarify=never: no chips, straight to the card; Go now starts the run', async () => {
    window.history.replaceState(null, '', '/?clarify=never')
    const runs: Record<string, unknown>[] = []
    const calls = stubBrowser(body => runs.push(body))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Kestrel/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(calls.find(call => call.path === '/api/scope')?.body).toEqual({ question: DEMO_QUESTIONS[1].text, clarify: 'never' })
    expect(screen.queryByRole('group', { name: 'Which angle matters most to you?' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start now' }))
    expect(runs[0]).toEqual({ question: DEMO_QUESTIONS[1].text, budgetMinor: 200, plan: uc2Scope.plan })
  })

  it('starts on expiry, pauses while editing, Esc cancels, and never says money', () => {
    vi.useFakeTimers()
    const onGo = vi.fn(), onCancel = vi.fn()
    const { unmount } = render(<PlanSheet plan={uc2Scope.plan} writers={8} onGo={onGo} onCancel={onCancel} />)
    expect(screen.getByRole('dialog').textContent).toContain('Search 8 writers for')
    expect(screen.getByRole('dialog').textContent).not.toMatch(PURCHASE_APPROVAL)
    act(() => { vi.advanceTimersByTime(4999) })
    expect(onGo).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onGo).toHaveBeenCalledExactlyOnceWith(uc2Scope.plan)
    act(() => { vi.advanceTimersByTime(10_000); fireEvent.keyDown(window, { key: 'Enter' }) })
    expect(onGo).toHaveBeenCalledTimes(1)
    unmount()

    const edit = render(<PlanSheet plan={uc2Scope.plan} onGo={onGo} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(onGo).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Search 1'), { target: { value: 'Kestrel TSMC margin outlook' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start now' }))
    expect(onGo).toHaveBeenLastCalledWith({ ...uc2Scope.plan, subqueries: ['Kestrel TSMC margin outlook', ...uc2Scope.plan.subqueries.slice(1)] })
    edit.unmount()

    render(<PlanSheet plan={uc2Scope.plan} onGo={onGo} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onGo).toHaveBeenCalledTimes(2)
  })

  it('calls only the scope and reputation routes', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => uc2Scope }).mockResolvedValue({ ok: true, json: async () => ({ publishers: uc3Reputation }) })
    vi.stubGlobal('fetch', fetch)
    await scope('q?', 'never')
    await getReputation()
    await resetReputation()
    expect(fetch.mock.calls.map(call => [call[0], call[1].method])).toEqual([['/api/scope', 'POST'], ['/api/reputation', 'GET'], ['/api/reputation/reset', 'POST']])
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ question: 'q?', clarify: 'never' })
  })
})

describe('sources: writers, publishers, search mode, trust (#151)', () => {
  it('explains the low-trust skip on AlphaLeak in the UC3 fixture in plain words', () => {
    const table = renderToStaticMarkup(<DecisionTable run={uc3Run} />)
    const round2 = table.slice(table.indexOf('Decision round 2'))
    const leak = round2.slice(round2.indexOf('week by week'), round2.indexOf('</tr>', round2.indexOf('week by week')))
    expect(leak).toContain('Writer trust too low')
    expect(leak).not.toContain('SKIP_LOW_TRUST')
    expect(leak).toContain('AlphaLeak failed a proof check (honesty 0.40, under 0.50)')
    const panel = renderToStaticMarkup(<DecisionPanel run={uc3Run} />)
    expect(panel).toContain('Refunded')
    expect(panel).toContain('Refunded')
    // #205 (already on main): the failed proof also records its broken promise (observed 0), so T = H 0.40 × C 0.08.
    expect(panel).toContain('AlphaLeak')
    expect(panel).not.toContain('SKIP_')
  })

  it('labels each source: writer link, publisher, SYNTHETIC, FREE/PAID price, trust, and the search mode', () => {
    // T5: one line on the surface (search mode, the corpus label, the named sources); the per-source chips sit behind View all.
    const line = renderToStaticMarkup(<Sources run={uc3Run} />)
    for (const text of ['Failed promise check · Refunded', 'View all']) expect(line).toContain(text)
    const { container } = render(<Sources run={uc3Run} />)
    fireEvent.click(screen.getByRole('button', { name: 'View all' }))
    const html = container.innerHTML
    for (const text of ['AlphaLeak', 'The Fab Floor', 'NotFinancialTimes', 'Failed promise check · Refunded']) expect(html).toContain(text)
    expect(renderToStaticMarkup(<WriterChip candidate={uc3Run.candidates.find(candidate => candidate.tier === 'FREE')!} />)).toContain('>FREE<')
    expect(renderToStaticMarkup(<Sources run={{ ...uc3Run, labels: { ...uc3Run.labels, search: 'hybrid' } }} />)).not.toContain('search · hybrid')
  })
})

describe('proofs, challenge → refund, run tape (#152)', () => {
  const ids = uc3Run.events.map(event => event.id)
  const leak = uc3Run.intents[0]
  const first = (type: string, status?: string) => uc3Run.events.find(event => event.type === type && (!status || event.data?.status === status))!.id

  it('replays UC3 in timeline order: pay, proof fails, challenge, refund, reputation, then the honest buy', () => {
    const statuses: string[] = []
    for (const id of [0, ...ids]) {
      const status = staged(uc3Run, id).intents.find(item => item.intentId === leak.intentId)?.status
      if (status && statuses.at(-1) !== status) statuses.push(status)
    }
    expect(statuses).toEqual(['DECIDED', 'RESERVED', 'DELIVERY_PENDING', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED'])
    const refunded = staged(uc3Run, first('REFUND'))
    expect([refunded.spentMinor, refunded.refundedMinor]).toEqual([30, 30])
    expect(staged(uc3Run, first('CHALLENGE', 'REFUNDED') - 1).refundedMinor).toBe(0)
    const tape = renderToStaticMarkup(<RunActivity run={uc3Run} onStop={() => {}} stopping={false} onShowWork={() => {}} />)
    expect(tape).toContain('Done'); expect(tape).not.toContain('ra-runbar')
    for (const type of ['PLAN', 'PROOF', 'CHALLENGE', 'REFUND', 'REPUTATION']) expect(dwell({ id: 0, runId: '', type, label: '', at: '' })).toBeGreaterThan(0)
  })

  it('shows proof badges, the refund with its rail label, and spent / refunded / net', () => {
    const failed = renderToStaticMarkup(<PaymentRow run={uc3Run} intent={leak} onRetry={() => {}} onReceipt={() => {}} />)
    for (const text of ['Not found', 'Refunded S$0.30', 'simulated']) expect(failed).toContain(text)
    const ok = renderToStaticMarkup(<PaymentRow run={uc3Run} intent={uc3Run.intents[1]} onRetry={() => {}} onReceipt={() => {}} />)
    expect(ok).toContain('Verified')
    expect(ok).not.toContain('Refunded')
    const testnet = { ...uc3Run, labels: { ...uc3Run.labels, settlement: 'XRPL TESTNET · no real value' as const }, events: uc3Run.events.map(event => event.type === 'REFUND' ? { ...event, data: { ...event.data, label: 'XRPL TESTNET · no real value', explorerUrl: `https://testnet.xrpl.org/transactions/${leak.refund!.txHash}` } } : event) }
    const onLedger = renderToStaticMarkup(<PaymentRow run={testnet} intent={leak} onRetry={() => {}} onReceipt={() => {}} />)
    expect(onLedger).toContain(`href="https://testnet.xrpl.org/transactions/${leak.refund!.txHash}"`)
    expect(onLedger).toContain('XRPL Testnet')
    const budget = renderToStaticMarkup(<SpendPanel onRetry={() => {}} onReceipt={() => {}} run={uc3Run} />)
    for (const text of ['S$0.40', 'Paid S$0.70', 'Refunded S$0.30']) expect(budget).toContain(text)
  })

  it('never opens or cites a quarantined source, even with its delivered text present (gates 1 and 4)', () => {
    const alphaleak = uc3Run.candidates.find(candidate => candidate.publisherSlug === 'alphaleak')!
    const leaked = { ...uc3Run, contents: [...uc3Run.contents, { profileId: 'alphaleak', resourceId: alphaleak.resourceId, version: 'v1', title: alphaleak.title, publisher: 'AlphaLeak', body: 'Lead times are collapsing.', spans: [{ id: 'lead-times', text: 'Lead times are collapsing.' }] }] }
    expect(getAccessibleContent(leaked, alphaleak)).toBeUndefined()
    expect(getAccessibleContent(uc3Run, uc3Run.candidates.find(candidate => candidate.publisherSlug === 'the-fab-floor')!)).toBeDefined()
    expect(uc3Run.answers.flatMap(answer => answer.claims.flatMap(claim => claim.citations)).some(citation => citation.resourceId === alphaleak.resourceId)).toBe(false)
  })
})

describe('Writers tab: the reputation panel (#153)', () => {
  it('after UC3, AlphaLeak shows H 0.40 and quarantined; reset is presenter-only', () => {
    const html = renderToStaticMarkup(<ReputationPanel records={uc3Reputation} run={uc3Run} />)
    const leak = html.slice(html.indexOf('AlphaLeak'), html.indexOf('</tr>', html.indexOf('AlphaLeak')))
    for (const text of ['Quarantined', '0 / 1', '0.03']) expect(leak).toContain(text)
    expect(html).toContain('The Fab Floor')
    expect(html).not.toContain('Reset reputation')
    const onReset = vi.fn()
    render(<ReputationPanel records={uc3Reputation} run={uc3Run} presenter onReset={onReset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset reputation' }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('holds the pre-run score during the replay, then highlights the drop', () => {
    const drop = uc3Run.events.find(event => event.type === 'REPUTATION' && event.data?.publisherSlug === 'alphaleak')!.id
    const { container, rerender } = render(<ReputationPanel records={uc3Reputation} run={staged(uc3Run, drop - 1)} full={uc3Run} />)
    const leakRow = () => [...container.querySelectorAll('tbody')].find(body => body.textContent?.includes('AlphaLeak'))!
    expect(leakRow().textContent).toContain('0.80')
    expect(leakRow().className).not.toContain('is-drop')
    rerender(<ReputationPanel records={uc3Reputation} run={staged(uc3Run, drop)} full={uc3Run} />)
    expect(leakRow().textContent).toContain('Quarantined')
    expect(leakRow().textContent).toContain('Quarantined')
    fireEvent.click(screen.getByRole('button', { name: 'AlphaLeak' }))
    expect(leakRow().textContent).toContain('Honesty 0.40')
  })
})

describe('presenter controls, presets and the UC fixture runs (#154)', () => {
  it('the presenter menu toggles clarify=never, resets reputation and keeps the pace selector', async () => {
    const onClarifyNever = vi.fn(), onResetReputation = vi.fn().mockResolvedValue(undefined), onPace = vi.fn()
    render(<Presenter pace="stage" onPace={onPace} faults={false} busy={false} onClose={() => {}} clarifyNever={false} onClarifyNever={onClarifyNever} onResetReputation={onResetReputation} />)
    fireEvent.click(await screen.findByLabelText(/Skip them \(clarify=never\)/))
    expect(onClarifyNever).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'Reset reputation' }))
    expect(onResetReputation).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: /every writer starts at H 0.80/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Real' }))
    expect(onPace).toHaveBeenCalledWith('real')
  })

  it('the clarify=never toggle reaches /api/scope', async () => {
    const calls = stubBrowser(() => {})
    render(<App />)
    fireEvent.keyDown(window, { key: '.' })
    fireEvent.click(await screen.findByLabelText(/Skip them \(clarify=never\)/))
    fireEvent.keyDown(window, { key: '.' })
    fireEvent.click(screen.getByRole('button', { name: /^Kestrel/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(calls.find(call => call.path === '/api/scope')?.body).toEqual({ question: DEMO_QUESTIONS[1].text, clarify: 'never' })
  })

  it('three one-click presets fill the question (empty by default); free typing stays', () => {
    render(<Ask onAsk={() => {}} settlement="SIMULATED SGD · no real funds" />)
    const box = screen.getByLabelText('Your question') as HTMLTextAreaElement
    expect(box.value).toBe('')
    expect(screen.getByRole('button', { name: /^Ask/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /^Kestrel/ }))
    expect(box.value).toBe(DEMO_QUESTIONS[1].text)
    expect(screen.getByRole('button', { name: /^Kestrel/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^Malaysia/ }))
    expect(box.value).toBe(DEMO_QUESTIONS[2].text)
    fireEvent.change(box, { target: { value: 'My own question?' } })
    expect(box.value).toBe('My own question?')
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('the UC fixture runs are the scenario outputs for the story-bible questions', () => {
    const uc = Object.fromEntries(bible.useCases.map(u => [u.id, u]))
    for (const id of ['UC1', 'UC2', 'UC3'] as const) {
      expect(ucRuns[id].question).toBe(uc[id].question)
      expect(ucRuns[id].phase).toBe('DONE')
      expect(ucRuns[id].labels.settlement).toBe('SIMULATED SGD · no real funds')
    }
    expect(ucRuns.UC1.spentMinor).toBe(0)
    expect(ucRuns.UC2.intents.map(intent => `${intent.resourceId}:${intent.status}`)).toEqual([`${uc.UC2.expectedPicks.round1}:VERIFIED`])
    expect(ucRuns.UC3.intents.map(intent => `${intent.resourceId}:${intent.status}`)).toEqual([`${uc.UC3.expectedPicks.round1}:REFUNDED`, `${uc.UC3.expectedPicks.round2}:VERIFIED`])
    expect([ucRuns.UC3.spentMinor, ucRuns.UC3.refundedMinor]).toEqual([70, 30])
    expect(JSON.stringify(ucRuns)).not.toMatch(/Vertex|CANARY/)
  })
})

describe('v1.1 shell: sidebar, past runs and an empty Home (#166)', () => {
  const pastRun = (runId: string, extra: Partial<PastRun> = {}): PastRun => ({ runId, question: `Question ${runId}?`, phase: 'DONE', stopped: false, budgetMinor: 200, spentMinor: 90, at: new Date().toISOString(), pinned: false, ...extra })

  it('lists pinned and today’s runs; the ⋯ menu pins, and Delete asks first and is off while a run is going', () => {
    const onPin = vi.fn(), onDelete = vi.fn(), onOpenRun = vi.fn()
    const onResize = vi.fn()
    const { container } = render(<Sidebar runs={[pastRun('a', { pinned: true }), pastRun('b'), pastRun('c', { phase: 'DECIDE' })]} busy={false} open width={300} onResize={onResize} onNew={() => {}} onOpenRun={onOpenRun} onPin={onPin} onDelete={onDelete} />)
    expect(screen.getByText('Pinned')).toBeTruthy()
    // Titles only: no prices, no workspace or sign-in quips.
    expect(container.textContent).not.toMatch(/S\$|Demo workspace|Sign-in/)
    const edge = screen.getByRole('separator', { name: 'Resize sidebar' })
    fireEvent.keyDown(edge, { key: 'ArrowRight' })
    expect(onResize).toHaveBeenLastCalledWith(316)
    fireEvent.doubleClick(edge)
    expect(onResize).toHaveBeenLastCalledWith(NAV_WIDTH.initial)
    expect(screen.getByText('Today')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Run: Question b?' }))
    expect(onOpenRun).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByRole('button', { name: 'Options for Question b?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }))
    expect(onPin).toHaveBeenCalledWith('b', true)
    fireEvent.click(screen.getByRole('button', { name: 'Options for Question b?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByRole('button', { name: 'Options for Question c?' }))
    expect(screen.getByRole('button', { name: 'Delete…' }).hasAttribute('disabled')).toBe(true)
  })

  it('the header toggle is a labelled panel icon that shows and hides the sidebar', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<NavToggle open onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(onToggle).toHaveBeenCalledOnce()
    rerender(<NavToggle open={false} onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: 'Show sidebar' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('a toast is one compact row: the end of a run says it is done and offers a way back', () => {
    const onClick = vi.fn()
    const { container } = render(<Toasts toasts={[{ id: 'end', tone: '', icon: '✓', title: 'Your answer is ready', runId: 'r1', actions: [{ label: 'Go back to chat', primary: true, onClick }] }]} onDismiss={() => {}} />)
    expect(container.textContent).not.toMatch(/S\$|spent/)
    expect(container.querySelector('.ra-t-b p')).toBeNull()
    expect(container.querySelector('.ra-t-b .ra-t-acts')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go back to chat' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('opens on an empty Home with no header pills; a run opens only when the URL names it', async () => {
    try { localStorage.setItem('researchagent.october.active-run', paidStoryRun.runId) } catch { /* no storage */ }
    const calls = stubBrowser(() => {})
    render(<App />)
    expect(screen.getByRole('heading', { name: /Ask a question/ })).toBeTruthy()
    expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByRole('navigation', { name: 'Questions' })).toBeTruthy()
    expect(screen.queryByLabelText('Provider and simulation labels')).toBeNull()
    await act(async () => { await Promise.resolve() })
    expect(calls.some(call => call.path.startsWith('/runs/'))).toBe(false)
  })
})

describe('budget slider and the universal budget in Settings', () => {
  it('budget choices and custom amounts preserve five-cent budget steps', () => {
    const onChange = vi.fn()
    render(<BudgetPicker value={200} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'S$2.00' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Free' }))
    expect(onChange).toHaveBeenCalledWith(0)
    const custom = screen.getByRole('spinbutton', { name: 'Custom budget (S$)' }) as HTMLInputElement
    expect([custom.min, custom.max, custom.step]).toEqual(['0','5','0.05'])
    fireEvent.change(custom, { target: { value: '0.35' } })
    expect(onChange).toHaveBeenCalledWith(35)
  })

  it('Home sends the slider value (opened from the budget chip); no explainer text until then', async () => {
    const onAsk = vi.fn()
    const { container } = render(<Ask onAsk={onAsk} settlement="SIMULATED SGD · no real funds" />)
    expect(container.textContent).not.toMatch(/only spending authorisation|clear the bar|per source\./)
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Q?' } })
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'S$2.00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Free' }))
    expect(document.querySelector('.ra-budget-chip')?.textContent).toBe('Free')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom budget (S$)' }), { target: { value: '0.15' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('slider')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Ask/ })) })
    expect(onAsk).toHaveBeenCalledWith({ question: 'Q?', budgetMinor: 15 })
  })

  it('with a universal budget, Home shows a chip to Settings instead of the slider, and every question uses it', async () => {
    const onAsk = vi.fn(), onSettings = vi.fn()
    render(<Ask onAsk={onAsk} settlement="SIMULATED SGD · no real funds" universalMinor={45} onSettings={onSettings} />)
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'S$0.45' }))
    expect(onSettings).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Q?' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Ask/ })) })
    expect(onAsk).toHaveBeenCalledWith({ question: 'Q?', budgetMinor: 45 })
  })

  it('Settings: the tick box turns the universal budget on; its slider is off until then', async () => {
    const calls = stubBrowser(() => {})
    const onUniversal = vi.fn(), onBudget = vi.fn()
    const { rerender } = render(<Settings universal={false} budgetMinor={200} settlement="SIMULATED SGD · no real funds" notify={false} onBack={() => {}} onNotify={() => {}} onUniversal={onUniversal} onBudget={onBudget} />)
    fireEvent.click(await screen.findByRole('button', {name:'Budget and limits'}))
    expect((screen.getByRole('spinbutton', { name: 'Custom budget (S$)' }) as HTMLInputElement).disabled).toBe(true)
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: /Use the same budget/ })) })
    expect(onUniversal).toHaveBeenCalledWith(true)
    rerender(<Settings universal budgetMinor={200} settlement="SIMULATED SGD · no real funds" notify={false} onBack={() => {}} onNotify={() => {}} onUniversal={onUniversal} onBudget={onBudget} />)
    await act(async () => { fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom budget (S$)' }), { target: { value: '0.10' } }) })
    expect(onBudget).toHaveBeenCalledWith(10)
    expect(calls.filter(c => c.path === '/api/settings/prompt-budget').at(-1)?.body).toEqual({budgetMinor:10,universal:true})
  })

  it('Settings opens from the sidebar, and the universal budget reaches Home', async () => {
    stubBrowser(() => {})
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', {name:'Budget and limits'}))
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: /Use the same budget/ })) })
    await act(async () => { fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom budget (S$)' }), { target: { value: '0.95' } }) })
    fireEvent.click(screen.getByRole('button', { name: 'New question' }))
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('button', { name: 'S$0.95' })).toBeTruthy()
  })

  it('Settings has a Back that returns Home with the half-typed question and budget kept', async () => {
    stubBrowser(() => {})
    render(<App />)
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'half typed' } })
    fireEvent.click(screen.getByRole('button', { name: 'S$2.00' }))
    fireEvent.click(screen.getByRole('button', { name: 'S$3.00' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    expect(screen.queryByLabelText('Your question')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /^Back/ }))
    expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('half typed')
    expect(screen.getByRole('button', { name: 'S$3.00' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('half typed')
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('half typed')
  })

  it('keeps the environment on the header, and Escape closes its details', () => {
    render(<EnvIndicator labels={exampleRun.labels} recording />)
    const dot = screen.getByRole('button', { name: /Simulated demo · fixture models · no real value/ })
    fireEvent.click(dot)
    expect(screen.getByRole('region', { name: "What’s real here" }).textContent).toContain('fictional writers and labelled team-authored notes')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dot.getAttribute('aria-expanded')).toBe('false')
  })
  it('names the Testnet environment', () => {
    render(<EnvIndicator labels={{ ...exampleRun.labels, settlement: 'XRPL TESTNET · no real value' }} recording />)
    expect(screen.getByRole('button', { name: /Testnet demo · no real value/ })).toBeTruthy()
  })
})
