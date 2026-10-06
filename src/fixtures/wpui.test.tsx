// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEMO_QUESTIONS } from '../../shared/contracts/examples.js'
import { exampleRun, paidStoryRun, uc2Scope, uc3Reputation, uc3Run, ucRuns } from './run.js'
import bible from '../../data/corpus/v2/story-bible.json'
import Presenter from '../components/Presenter.js'
import Ask from '../components/Ask.js'
import App from '../App.js'
import ActionModal from '../components/ActionModal.js'
import DecisionTable from '../components/DecisionTable.js'
import DecisionPanel from '../components/DecisionPanel.js'
import Sources, { getAccessibleContent } from '../components/Sources.js'
import WriterChip from '../components/WriterChip.js'
import Purchase from '../components/Purchase.js'
import Budget from '../components/Budget.js'
import RunTape from '../components/RunTape.js'
import ReputationPanel from '../components/ReputationPanel.js'
import { getReputation, resetReputation, scope } from '../api.js'
import { dwell, staged } from '../stage.js'

// Wording that would make the plan card read as a purchase approval (gate 2).
const MONEY = /S\$|\$|\bbuy|purchas|spend|\bpay|budget|approv|charg|price|cost/i

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); try { localStorage.clear() } catch { /* no storage */ } })

function stubBrowser(onRun: (body: Record<string, unknown>) => void) {
  const calls: { path: string; body?: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })
    const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data })
    if (path === '/api/health') return json({ status: 'ok', labels: exampleRun.labels, faults: false })
    if (path === '/api/scope') return json(body.clarify === 'never' ? { ...uc2Scope, questions: [], label: 'fixture · scope-fixture' } : { ...uc2Scope, label: 'fixture · scope-fixture' })
    if (path === '/runs') { onRun(body); return json({ ...paidStoryRun, question: body.question }, 201) }
    return json({}, 404)
  }))
  vi.stubGlobal('EventSource', class extends EventTarget { close() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  return calls
}

describe('clarify chips and the 5 s plan card (#150)', () => {
  it('drives scope → chips → plan card → run with the fixture API', async () => {
    const runs: Record<string, unknown>[] = []
    const calls = stubBrowser(body => runs.push(body))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
    const chip = await screen.findByRole('button', { name: 'pricing & margins' })
    expect(calls.find(call => call.path === '/api/scope')?.body).toEqual({ question: DEMO_QUESTIONS[1].text })
    expect(runs).toHaveLength(0)
    fireEvent.click(chip)
    const card = await screen.findByRole('dialog', { name: 'Search plan' })
    expect(card.textContent).toContain('I’ll search every listed writer for:')
    for (const query of uc2Scope.plan.subqueries) expect(card.textContent).toContain(query)
    expect(card.textContent).not.toMatch(MONEY)
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
    fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(calls.find(call => call.path === '/api/scope')?.body).toEqual({ question: DEMO_QUESTIONS[1].text, clarify: 'never' })
    expect(screen.queryByRole('group', { name: 'Which angle matters most to you?' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go now' }))
    expect(runs[0]).toEqual({ question: DEMO_QUESTIONS[1].text, budgetMinor: 200, plan: uc2Scope.plan })
  })

  it('starts on expiry, pauses while editing, Esc cancels, and never says money', () => {
    vi.useFakeTimers()
    const onGo = vi.fn(), onCancel = vi.fn()
    const { unmount } = render(<ActionModal plan={uc2Scope.plan} writers={8} onGo={onGo} onCancel={onCancel} />)
    expect(screen.getByRole('dialog').textContent).toContain('I’ll search 8 writers for:')
    expect(screen.getByRole('dialog').textContent).not.toMatch(MONEY)
    act(() => { vi.advanceTimersByTime(4999) })
    expect(onGo).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onGo).toHaveBeenCalledExactlyOnceWith(uc2Scope.plan)
    act(() => { vi.advanceTimersByTime(10_000); fireEvent.keyDown(window, { key: 'Enter' }) })
    expect(onGo).toHaveBeenCalledTimes(1)
    unmount()

    const edit = render(<ActionModal plan={uc2Scope.plan} onGo={onGo} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(onGo).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Search 1'), { target: { value: 'Kestrel TSMC margin outlook' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go now' }))
    expect(onGo).toHaveBeenLastCalledWith({ ...uc2Scope.plan, subqueries: ['Kestrel TSMC margin outlook', ...uc2Scope.plan.subqueries.slice(1)] })
    edit.unmount()

    render(<ActionModal plan={uc2Scope.plan} onGo={onGo} onCancel={onCancel} />)
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
  it('shows SKIP_LOW_TRUST on AlphaLeak in the UC3 fixture, in plain words on the surface', () => {
    const table = renderToStaticMarkup(<DecisionTable run={uc3Run} />)
    const round2 = table.slice(table.indexOf('Decision round 2'))
    const leak = round2.slice(round2.indexOf('LEAKED'), round2.indexOf('</tr>', round2.indexOf('LEAKED')))
    expect(leak).toContain('SKIP_LOW_TRUST')
    expect(leak).toContain('AlphaLeak failed a proof check (honesty 0.40, under 0.50)')
    const panel = renderToStaticMarkup(<DecisionPanel run={uc3Run} />)
    expect(panel).toContain('LOW TRUST')
    expect(panel).toContain('T 0.40 · quarantined')
    expect(panel).not.toContain('SKIP_')
  })

  it('labels each source: writer link, publisher, SYNTHETIC, FREE/PAID price, trust, and the search mode', () => {
    const html = renderToStaticMarkup(<Sources run={uc3Run} />)
    for (const text of [`search · ${uc3Run.labels.search}`, 'SYNTHETIC', 'PAID S$0.30', 'href="/w/alphaleak" target="_blank"', 'Priya Nair', 'NotFinancialTimes', 'proof failed · refunded']) expect(html).toContain(text)
    expect(renderToStaticMarkup(<WriterChip candidate={uc3Run.candidates.find(candidate => candidate.tier === 'FREE')!} />)).toContain('>FREE<')
    expect(renderToStaticMarkup(<Sources run={{ ...uc3Run, labels: { ...uc3Run.labels, search: 'hybrid' } }} />)).toContain('search · hybrid')
  })
})

describe('proofs, challenge → refund, run tape (#152)', () => {
  const ids = uc3Run.events.map(event => event.id)
  const leak = uc3Run.intents[0]
  const first = (type: string, status?: string) => uc3Run.events.find(event => event.type === type && (!status || event.data?.status === status))!.id
  const failedClaim = leak.failedClaimIds![0]

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
    const tape = renderToStaticMarkup(<RunTape run={uc3Run} replaying={false} onStop={() => {}} stopping={false} onShowWork={() => {}} />)
    const order = ['Plan', 'Search', 'Choose what to buy', 'Proof check', 'Challenge', 'Refund', 'Reputation', 'Check again', 'Done'].map(title => tape.indexOf(`<b>${title}</b>`))
    expect(order.every(index => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(tape).toContain(`Proof failed · ${failedClaim}`)
    for (const type of ['PLAN', 'PROOF', 'CHALLENGE', 'REFUND', 'REPUTATION']) expect(dwell({ id: 0, runId: '', type, label: '', at: '' })).toBeGreaterThan(0)
  })

  it('shows proof badges, the refund with its rail label, and spent / refunded / net', () => {
    const failed = renderToStaticMarkup(<Purchase run={uc3Run} intent={leak} onRetry={() => {}} onReceipt={() => {}} />)
    for (const text of [`✗ ${failedClaim}`, 'Proof failed', 'Challenged', 'Refunded S$0.30', 'SIMULATED', 'Quarantined: never cited']) expect(failed).toContain(text)
    const ok = renderToStaticMarkup(<Purchase run={uc3Run} intent={uc3Run.intents[1]} onRetry={() => {}} onReceipt={() => {}} />)
    expect(ok).toMatch(/✓ \d+ claims?/)
    expect(ok).not.toContain('Refunded')
    const testnet = { ...uc3Run, events: uc3Run.events.map(event => event.type === 'REFUND' ? { ...event, data: { ...event.data, label: 'XRPL TESTNET · no real value', explorerUrl: `https://testnet.xrpl.org/transactions/${leak.refund!.txHash}` } } : event) }
    const onLedger = renderToStaticMarkup(<Purchase run={testnet} intent={leak} onRetry={() => {}} onReceipt={() => {}} />)
    expect(onLedger).toContain(`href="https://testnet.xrpl.org/transactions/${leak.refund!.txHash}"`)
    expect(onLedger).toContain('XRPL TESTNET')
    const budget = renderToStaticMarkup(<Budget run={uc3Run} />)
    for (const text of ['spent</dt><dd>S$0.55', 'refunded</dt><dd', 'S$0.30', 'net</dt><dd>S$0.25']) expect(budget).toContain(text)
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
    for (const text of ['H 0.40', 'quarantined', '0 / 1', '1 / 0', 'claimed 0.96']) expect(leak).toContain(text)
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
    expect(leakRow().textContent).toContain('H 0.80')
    expect(leakRow().className).not.toContain('is-drop')
    rerender(<ReputationPanel records={uc3Reputation} run={staged(uc3Run, drop)} full={uc3Run} />)
    expect(leakRow().textContent).toContain('H 0.40')
    expect(leakRow().className).toContain('is-drop')
  })
})

describe('presenter controls, presets and the UC fixture runs (#154)', () => {
  it('the presenter menu toggles clarify=never, resets reputation and keeps the pace selector', async () => {
    const onClarifyNever = vi.fn(), onResetReputation = vi.fn().mockResolvedValue(undefined), onPace = vi.fn()
    render(<Presenter pace="stage" onPace={onPace} faults={false} busy={false} onClose={() => {}} clarifyNever={false} onClarifyNever={onClarifyNever} onResetReputation={onResetReputation} />)
    fireEvent.click(screen.getByLabelText(/Skip them \(clarify=never\)/))
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
    fireEvent.click(screen.getByLabelText(/Skip them \(clarify=never\)/))
    fireEvent.keyDown(window, { key: '.' })
    fireEvent.click(screen.getByRole('button', { name: /^Ask/ }))
    await screen.findByRole('dialog', { name: 'Search plan' })
    expect(calls.find(call => call.path === '/api/scope')?.body).toEqual({ question: DEMO_QUESTIONS[1].text, clarify: 'never' })
  })

  it('three one-click presets fill the question (UC2 by default); free typing stays', () => {
    render(<Ask onAsk={() => {}} settlement="SIMULATED SGD · no real funds" notify={false} onNotify={() => {}} />)
    const box = screen.getByLabelText('Your question') as HTMLTextAreaElement
    expect(box.value).toBe(DEMO_QUESTIONS[1].text)
    expect(screen.getByRole('button', { name: /^UC2/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^UC3/ }))
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
    expect([ucRuns.UC3.spentMinor, ucRuns.UC3.refundedMinor]).toEqual([55, 30])
    expect(JSON.stringify(ucRuns)).not.toMatch(/Vertex|CANARY/)
  })
})
