// @vitest-environment jsdom
// R8-B hosted polish: who a waiting visitor is waiting for, the Writers page order, notices that name their real reason, one
// run duration, the skip link, the demo-video link, and the browser verifier's count wording. Invented names throughout.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RunSnapshot } from '../shared/contracts/index.js'
import type { HostedDemoStatus } from '../src/api'
import { aheadText, HostedContext, waitCopy, type Hosted } from '../src/hosted'
import { HostedFooter, HostedWaiting } from '../src/components/hosted/HostedHome'
import HostedRunNotice from '../src/components/hosted/HostedRunNotice'
import WriterEarnings, { orderWriters, writerTitle } from '../src/components/WriterEarnings'
import RunActivity from '../src/components/RunActivity'
import Layout from '../src/components/Layout'
import ChatThread from '../src/components/ChatThread'
import { offlineNotice, planNotice } from '../src/notices'
import { ucRuns } from '../src/fixtures/run'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.doUnmock('../src/verify/browser'); vi.resetModules() })
const status = (patch: Partial<HostedDemoStatus> = {}): HostedDemoStatus => ({
  questionCapMinor: 200, state: 'ready', csrfToken: 't', queue: [],
  capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false },
  remaining: { questions: 5, minor: 1000 }, labels: { models: 'fixture models', rail: 'Shared XRPL Testnet demo · no real value' },
  links: { repo: 'https://github.com/example/repo', deck: '', video: '', progress: '', replay: '' }, ...patch,
})
const hosted = (patch: Partial<HostedDemoStatus> = {}): Hosted => ({ status: status(patch) })

describe('queue copy: who is waiting, for how long, no blame', () => {
  it('names another visitor to a first-time visitor, and the visitor’s own last question to a returning one', () => {
    expect(waitCopy(status({ wait: { ahead: 1, own: false } }))).toBe('Another visitor’s question is ahead of yours. That usually takes under a minute, and yours starts automatically.')
    expect(waitCopy(status({ wait: { ahead: 3, own: false } }))).toBe('3 other visitors’ questions are ahead of yours. That usually takes a minute or two, and yours starts automatically.')
    expect(waitCopy(status({ wait: { ahead: 1, own: true } }))).toMatch(/^Your previous question is still being finished: its record is being written to the ledger\. Yours starts right after, usually within a minute\.$/)
    expect(waitCopy(status())).toBe('Yours starts automatically in a moment.')
    for (const copy of [waitCopy(status({ wait: { ahead: 1, own: false } })), waitCopy(status({ wait: { ahead: 1, own: true } }))]) expect(copy).not.toMatch(/can be your own|sorry|slow|fault|busy/i)
  })
  it('renders on the waiting card with the cancel and the "nothing is reserved" promise', () => {
    render(<HostedWaiting hosted={hosted({ wait: { ahead: 1, own: false } })} onCancel={() => {}} />)
    const card = screen.getByRole('status', { name: 'Waiting for a turn' })
    expect(card.textContent).toContain('Waiting for a turn on the shared demo')
    expect(card.textContent).toContain('Another visitor’s question is ahead of yours')
    expect(card.textContent).toContain('Nothing is reserved or spent until then.')
    expect(card.textContent).not.toContain('can be your own')
  })
  it('counts the questions ahead of a queued run', () => {
    expect([aheadText(1), aheadText(2)]).toEqual(['1 question ahead of yours', '2 questions ahead of yours'])
    const run = { ...ucRuns.UC2, phase: 'SEARCH', stopped: false, runId: 'queued-run' } as RunSnapshot
    render(<HostedRunNotice hosted={hosted({ queue: [{ runId: 'queued-run', position: 2, expiresAt: '2026-11-12T00:00:00Z' }] })} run={run} onCancel={() => {}} stopping={false} />)
    expect(screen.getByRole('status', { name: 'Waiting for a turn' }).textContent).toContain('Waiting for a turn · 2 questions ahead of yours')
  })
})

describe('Writers page order', () => {
  const w = (slug: string, authorship: string, sales: number, publisher = slug) => ({ slug, publisherSlug: slug, name: publisher, publisher, authorship, verification: { status: 'unverified' }, articleCount: 4, priceRange: [30], articles: [], sales: Array.from({ length: sales }, (_, i) => ({ finishHash: `${slug}${i}`, refunded: false })), trust: [] })
  const list = [w('alpha', 'Fictional writer', 0), w('basis', 'Fictional writer', 0), w('team-builder-notes', 'Team-authored', 1, 'ResearchAgent builders (team-authored)'), w('kopi', 'Fictional writer', 0), w('team-b', 'Team-authored', 8, 'ResearchAgent builders · XRPL explainers (team-authored)'), w('indie', 'Author-supplied', 0)]
  it('puts writers with sales first, then the team, then the rest, keeping ties in catalogue order', () => {
    expect(orderWriters(list, false).shown.map(x => x.slug)).toEqual(['team-b', 'team-builder-notes', 'alpha', 'basis', 'kopi', 'indie'])
  })
  it('on the hosted demo folds the fictional writers with no sales away', () => {
    const { shown, demo } = orderWriters(list, true)
    expect(shown.map(x => x.slug)).toEqual(['team-b', 'team-builder-notes', 'indie'])
    expect(demo.map(x => x.slug)).toEqual(['alpha', 'basis', 'kopi'])
    // A fictional writer that has sold something stays in the main list.
    const sold = orderWriters([w('sold', 'Fictional writer', 2), ...list], true)
    expect(sold.shown.map(x => x.slug)).toContain('sold'); expect(sold.demo.map(x => x.slug)).not.toContain('sold')
  })
  it('writes the team under one name', () => {
    expect(writerTitle('ResearchAgent builders (team-authored)')).toBe('ResearchAgent builders')
    expect(writerTitle('ResearchAgent builders · XRPL explainers (team-authored)')).toBe('ResearchAgent builders')
    expect(writerTitle('NotFinancialTimes')).toBe('NotFinancialTimes')
  })
  it('renders the team first and the fictional writers inside a closed disclosure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ scope: 'Your retained history only.', writers: list }) })))
    const { container } = render(<HostedContext.Provider value={hosted()}><WriterEarnings /></HostedContext.Provider>)
    await waitFor(() => expect(container.querySelector('.ra-writer-card')).toBeTruthy())
    const titles = [...container.querySelectorAll('.ra-writer-earnings > .ra-writer-grid > .ra-writer-card h2')].map(node => node.textContent)
    expect(titles).toEqual(['ResearchAgent builders ↗', 'ResearchAgent builders ↗', 'indie ↗'])
    expect([...container.querySelectorAll('.ra-writer-earnings > .ra-writer-grid > .ra-writer-card .ra-writer-by')].map(node => node.textContent)).toEqual(['XRPL explainers', 'Build notes'])
    const demo = container.querySelector('details.ra-writer-demo')!
    expect(demo.hasAttribute('open')).toBe(false)
    expect(demo.querySelector('summary')?.textContent).toBe('Fictional demo writers (3)')
    expect(demo.querySelectorAll('.ra-writer-card')).toHaveLength(3)
  })
})

describe('notices state their real reason', () => {
  it('names the planner failure from the server’s own label, never "unavailable" for a guard', () => {
    expect(planNotice('DeepSeek · deepseek-flash')).toBeUndefined()
    expect(planNotice('fixture · scope-fixture · spending guard')).toBe('Planned with built-in rules: the live plan was rejected by the spending guard, which only the budget rules may override.')
    expect(planNotice('fixture · scope-fixture · subject guard')).toMatch(/dropped the subject of your question/)
    expect(planNotice('fixture · scope-fixture · planner unavailable')).toBe('Planned with built-in rules: the live planner didn’t respond.')
    // A label recorded before reasons existed reads as the planner not answering.
    expect(planNotice('fixture · scope-fixture')).toBe('Planned with built-in rules: the live planner didn’t respond.')
    expect(planNotice(undefined)).toBeUndefined()
    for (const label of ['fixture · scope-fixture', 'fixture · scope-fixture · spending guard']) expect(planNotice(label)).not.toMatch(/offline|unavailable/)
  })
  it('says "written from offline extracts" only when something was written (or bought, H9-03)', () => {
    const answered = { labels: { research: 'fixture · extractive-fixture' }, answers: [{ claims: [{ id: 'c' }] }], receipts: [], events: [] } as unknown as RunSnapshot
    const decline = { labels: { research: 'fixture · extractive-fixture' }, answers: [{ claims: [] }], receipts: [], events: [] } as unknown as RunSnapshot
    expect([offlineNotice(answered), offlineNotice(decline)]).toEqual(['Written from offline extracts: the model was unavailable.', undefined])
    expect(offlineNotice({ labels: { research: 'DeepSeek · deepseek-flash' }, answers: [{ claims: [{ id: 'c' }] }], receipts: [], events: [] } as unknown as RunSnapshot)).toBeUndefined()
  })
})

describe('one duration, live and after a reload', () => {
  it('stops the clock at the DONE event, not at the anchor line that lands after it', () => {
    const at = (s: number) => new Date(Date.UTC(2026, 10, 11, 6, 0, 0) + s * 1000).toISOString()
    const events = [{ id: 1, type: 'SEARCH', at: at(0) }, { id: 2, type: 'DONE', at: at(12.3) }, { id: 3, type: 'SNAPSHOT', at: at(24.6) }].map(e => ({ ...e, runId: 'r', label: e.type }))
    const run = { ...structuredClone(ucRuns.UC2), runId: 'r', phase: 'DONE', events, receipts: [], answers: [] } as unknown as RunSnapshot
    render(<RunActivity run={run} onStop={() => {}} stopping={false} onShowWork={() => {}} />)
    expect(screen.getByRole('status').textContent).toContain('Done in 12.3 s.')
    expect(screen.getByRole('status').textContent).not.toContain('24.6')
  })
})

describe('keyboard: a skip link reaches the question box in one step', () => {
  it('focuses the composer', () => {
    render(<Layout><main><textarea aria-label="Your question" /></main></Layout>)
    const link = screen.getByRole('link', { name: 'Skip to question' })
    expect(link.getAttribute('href')).toBe('#main')
    fireEvent.click(link)
    expect(document.activeElement).toBe(screen.getByLabelText('Your question'))
  })
  it('focuses the page body where there is no composer (a run)', () => {
    render(<Layout><main><h1>A run</h1></main></Layout>)
    fireEvent.click(screen.getByRole('link', { name: 'Skip to question' }))
    expect(document.activeElement?.tagName).toBe('MAIN')
  })
})

describe('the demo-video link', () => {
  it('appears in the footer when the server carries a video URL, and stays hidden when it does not', () => {
    const { rerender } = render(<HostedFooter hosted={hosted({ links: { ...status().links, video: 'https://video.example/demo' } })} />)
    const link = screen.getByRole('link', { name: /Demo video/ })
    expect(link.getAttribute('href')).toBe('https://video.example/demo')
    rerender(<HostedFooter hosted={hosted()} />)
    expect(screen.queryByRole('link', { name: /Demo video/ })).toBeNull()
  })
})

describe('chat', () => {
  it('says on the hosted demo that a chat reply counts toward the five questions', () => {
    render(<HostedContext.Provider value={hosted()}><ChatThread messages={[]} onSend={() => {}} /></HostedContext.Provider>)
    expect(document.querySelector('.ra-chat-note')?.textContent).toBe('Research questions go to Home, where they get a budget. A chat reply counts as one of your 5 questions a day.')
  })
})

describe('the in-page verifier’s count', () => {
  const run = { ...ucRuns.UC2, labels: { ...ucRuns.UC2.labels, settlement: 'XRPL TESTNET · no real value' } } as RunSnapshot
  const check = (status: 'PASS' | 'FAIL' | 'SKIP') => ({ check: `c-${status}`, status, detail: '' })
  async function headline(checks: ReturnType<typeof check>[]) {
    vi.doMock('../src/verify/browser', () => ({ verifyInBrowser: async () => ({ ok: !checks.some(c => c.status === 'FAIL'), checks, groups: [], endpoint: '', testnet: true, at: '' }) }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const { default: VerifyInBrowser } = await import('../src/components/hosted/VerifyInBrowser')
    render(<VerifyInBrowser run={run} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run the checks' })) })
    return (await screen.findByText(/passed|failed/, { selector: '.ra-hv-head' })).textContent
  }
  it('says "N passed · K not checked" rather than "All N checks passed" when something was not checked', async () => {
    expect(await headline([check('PASS'), check('PASS'), check('SKIP')])).toBe('2 passed · 1 not checked')
  })
  it('keeps "All N checks passed" when nothing was skipped, and counts a failure plainly', async () => {
    expect(await headline([check('PASS'), check('PASS')])).toBe('All 2 checks passed')
    cleanup(); vi.doUnmock('../src/verify/browser'); vi.resetModules()
    expect(await headline([check('PASS'), check('FAIL')])).toBe('1 of 2 checks failed')
  })
})
