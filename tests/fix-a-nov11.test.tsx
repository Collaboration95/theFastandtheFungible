// @vitest-environment jsdom
// FIX-A (sweep 11 Nov): the answer, run and writer surfaces say one thing, count one way and look finished.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { cleanup, render, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunSnapshotSchema, type RunSnapshot } from '../shared/contracts'
import { VERDICT_WORDS } from '../shared/refusal-proof'
import { offlineZeroBudgetRun, ucRuns } from '../src/fixtures/run'
import { detectHosted, getDemoStatus, type HostedDemoStatus } from '../src/api'
import { environment, hostedLinks } from '../src/hosted'
import { purchaseCounts } from '../src/format'
import RunActivity from '../src/components/RunActivity'
import Sources from '../src/components/Sources'
import Answer, { citationNumbersFor } from '../src/components/Answer'
import Activity, { traceLabel } from '../src/components/Activity'
import WriterEarnings, { priceRange } from '../src/components/WriterEarnings'
import ReputationPanel from '../src/components/ReputationPanel'
import Sidebar from '../src/components/Sidebar'
import Ask from '../src/components/Ask'

beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true }; HTMLDialogElement.prototype.close = function () { this.open = false } })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const keyReveal = RunSnapshotSchema.parse(JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8')).run)
const finished = () => Object.values({ keyReveal, ...ucRuns }).filter(item => item.phase === 'DONE')
const summaryOf = (run: RunSnapshot) => render(<RunActivity run={run} onStop={() => {}} stopping={false} onShowWork={() => {}} />).container.querySelector('[role="status"]')!.textContent ?? ''
const stripOf = (run: RunSnapshot) => render(<Sources run={run} />).container.querySelector('.ra-source-summary')!.textContent ?? ''

describe('S5 one counting rule: "bought" means paid', () => {
  it('counts a refunded purchase as paid in the summary and in the strip, never as "kept"', () => {
    expect(purchaseCounts(keyReveal)).toEqual({ paid: 2, refunded: 1, cancelled: 0 })
    expect(summaryOf(keyReveal)).toContain('Paid for 2 articles, 1 refunded.')
    expect(stripOf(keyReveal)).toContain('2 bought · 1 refunded')
    expect(`${summaryOf(keyReveal)}${stripOf(keyReveal)}`).not.toMatch(/kept|Bought 2/i)
  })
  it('the summary and the strip agree on every finished fixture run', () => {
    for (const run of finished()) {
      const { paid, refunded } = purchaseCounts(run), summary = summaryOf(run), strip = stripOf(run)
      expect(strip, run.runId).toContain(`${paid} bought · ${refunded} refunded`)
      if (paid) {
        expect(summary, run.runId).toContain(`Paid for ${paid} article${paid === 1 ? '' : 's'}`)
        expect(summary, run.runId).toMatch(refunded ? new RegExp(`, ${refunded} refunded\\.`) : /article\./)
      } else expect(summary, run.runId).not.toContain('Paid for')
      cleanup()
    }
  })
  it('keeps the net cost in its own span, so a phone can drop it beside the spend line', () => {
    const { container } = render(<RunActivity run={keyReveal} onStop={() => {}} stopping={false} onShowWork={() => {}} />)
    expect(container.querySelector('.ra-net-cost')?.textContent).toBe(' Net cost S$0.40.')
    expect(container.querySelector('.ra-run-activity')?.className).toContain('is-done')
  })
  it('says a decline once: the status line reports the time, the answer carries the sentence', () => {
    expect(summaryOf(offlineZeroBudgetRun)).not.toMatch(/Nothing was bought/)
  })
})

describe('S7 citations number 1…n by first appearance, never 0, after a full stop', () => {
  const cite = (spanId: string) => ({ resourceId: `r-${spanId}`, version: '1', spanId })
  const claim = (id: string, ...spans: string[]) => ({ id, text: id, stance: 'SUPPORTS' as const, citations: spans.map(cite) })
  it('numbers the claims as shown, not every passage an earlier draft cited', () => {
    const numbers = citationNumbersFor([claim('lead', 'p9'), claim('second', 'p2', 'p9')])
    expect([...numbers.values()]).toEqual([1, 2])
  })
  it('renders the recorded refund run with 1 on a one-source lead, a full stop before it, and no 0', () => {
    const { container } = render(<Answer run={keyReveal} view="latest" onView={() => {}} compare={false} onCompare={() => {}} onCitation={() => {}} />)
    const shown = [...container.querySelectorAll('.ra-cite')].map(node => node.textContent)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown[0]).toBe('1')
    expect(shown).not.toContain('0')
    expect(Math.max(...shown.map(Number))).toBeLessThanOrEqual(new Set(shown).size)
    for (const sentence of container.querySelectorAll('.ra-vtext > span')) expect(sentence.firstChild?.textContent?.trim()).toMatch(/[.!?…]["')\]”’]*$/)
  })
})

describe('S8 the decline explains itself', () => {
  const declined = (count: number): RunSnapshot => {
    const base = offlineZeroBudgetRun.decisions[0], rows = Array.from({ length: count }, (_, i) => ({ ...base.rows[0], candidate: { ...offlineZeroBudgetRun.candidates[0], tier: 'PAID' as const, resourceId: `n${i}`, title: `Note ${i}` }, value: 0.1, verdict: (['SKIP_LOW_VALUE', 'SKIP_REWRITE', 'SKIP_LOW_TRUST'] as const)[i % 3], reason: `Reason ${i}` }))
    return { ...offlineZeroBudgetRun, phase: 'DONE', answers: [], intents: [], receipts: [], candidates: rows.map(row => row.candidate), decisions: [{ ...base, threshold: 0.2, rows }] }
  }
  const view = (run: RunSnapshot) => render(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />).container
  it('opens the reasons by default for six rows or fewer, with a chevron-bearing summary and the count', () => {
    const why = view(declined(6)).querySelector('details.ra-why-not')!
    expect(why.hasAttribute('open')).toBe(true)
    expect(why.querySelector('summary')?.textContent).toBe('Why nothing was bought · 6 articles considered')
  })
  it('keeps a long list closed, and speaks in the proof page’s words with no scores', () => {
    const why = view(declined(7)).querySelector('details.ra-why-not')!
    expect(why.hasAttribute('open')).toBe(false)
    const text = why.textContent ?? ''
    for (const verdict of ['SKIP_LOW_VALUE', 'SKIP_REWRITE', 'SKIP_LOW_TRUST']) expect(text).toContain(VERDICT_WORDS[verdict])
    expect(text).not.toMatch(/value \d|vs \d|SKIP_/)
  })
})

describe('S9 writers: the publication is the title', () => {
  const writer = (patch: Record<string, unknown>) => ({ slug: 'priya-nair', publisherSlug: 'notfinancialtimes', name: 'Priya Nair', publisher: 'NotFinancialTimes', authorship: 'Fictional writer', verification: { status: 'unverified' }, articleCount: 6, priceRange: [90, 90], articles: [], sales: [], trust: [], ...patch })
  const stub = (writers: unknown[]) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ scope: 'Your retained history only.', writers }) })))
  it('shows one price for a point range, "Free" for a zero range and a range otherwise', () => {
    expect([priceRange([30, 30]), priceRange([0, 40]), priceRange([0, 0]), priceRange([])]).toEqual(['S$0.30', 'S$0.00–S$0.40', 'Free', 'No articles'])
  })
  it('titles the card with the publication, adds the byline, and wears one badge', async () => {
    stub([writer({}), writer({ slug: 'alphaleak', name: 'AlphaLeak', publisher: 'AlphaLeak', publisherSlug: 'alphaleak', priceRange: [0, 40] })])
    const { container } = render(<WriterEarnings />)
    await waitFor(() => expect(container.querySelectorAll('.ra-writer-card').length).toBe(2))
    const [first, second] = [...container.querySelectorAll('.ra-writer-card')]
    expect(first.querySelector('h2')?.textContent?.trim()).toBe('NotFinancialTimes')
    expect(first.querySelector('h2 svg[aria-hidden="true"]')).toBeTruthy()
    expect(first.querySelector('.ra-writer-by')?.textContent).toBe('by Priya Nair')
    expect(first.querySelectorAll('.ra-badge').length).toBe(1)
    expect(first.querySelector('.ra-badge')?.textContent).toBe('Fictional · unverified')
    expect(first.textContent).not.toMatch(/unverified writer|Fictional writer/)
    expect(first.textContent).toContain('S$0.90')
    expect(first.textContent).not.toContain('S$0.90–S$0.90')
    expect(second.querySelector('.ra-writer-by')).toBeNull()
  })
  it('has one heading called Writers on the page, not a second inside the panel', async () => {
    stub([writer({})])
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('earnings') ? { scope: 'x', writers: [writer({})] } : { writers: [] } })))
    const { container } = render(<ReputationPanel records={[]} />)
    await waitFor(() => expect(container.querySelector('.ra-writer-card')).toBeTruthy())
    // The page's own h1 is "Writers"; the cards are h2s under it (no skipped level, no second "Writers" heading).
    expect(container.querySelector('h3')).toBeNull()
    expect([...container.querySelectorAll('h2')].map(node => node.textContent?.trim())).toEqual(['NotFinancialTimes'])
  })
})

describe('S14 the hosted home collapses when it cannot take a question', () => {
  it('shows the intro and the state card, but no composer and no examples, when closed', () => {
    const open = renderToStaticMarkup(<Ask onAsk={() => {}} settlement="SIMULATED SGD · no real funds" intro={<h1>Intro</h1>} />)
    const closed = renderToStaticMarkup(<Ask onAsk={() => {}} settlement="SIMULATED SGD · no real funds" intro={<h1>Intro</h1>} closed />)
    expect(open).toContain('ra-composer')
    expect(open).toContain('ra-presets')
    expect(closed).toContain('Intro')
    expect(closed).not.toMatch(/ra-composer|ra-presets|textarea/)
  })
})

describe('S15 the local server answers the status route', () => {
  const stub = (body: unknown, status = 200) => { const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status })); vi.stubGlobal('fetch', fetcher); return fetcher }
  it('reads {hosted:false} as "not hosted" at once, without retrying or failing', async () => {
    const fetcher = stub({ hosted: false })
    expect(await detectHosted()).toEqual({ failed: false })
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(getDemoStatus()).rejects.toMatchObject({ status: 404 })
  })
  it('still reads an older 404 as local, and a real status as hosted', async () => {
    stub({}, 404)
    expect(await detectHosted()).toEqual({ failed: false })
    const status: HostedDemoStatus = { state: 'ready', capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 100 }, labels: { models: 'fixture models', rail: 'SIMULATED' }, links: { repo: '', deck: '', video: '', progress: '', replay: '' } }
    stub(status)
    expect((await detectHosted()).status?.state).toBe('ready')
  })
})

describe('S16 and S27 the hosted chip and footer', () => {
  const status = (rail: string, state: HostedDemoStatus['state'] = 'ready'): HostedDemoStatus => ({ state, capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 100 }, labels: { models: 'fixture models', rail }, links: { repo: 'https://github.com/example/repo', deck: '', video: '', progress: '', replay: '' } })
  it('shortens the one chip for a phone without renaming it', () => {
    expect(environment(status('SIMULATED · no real value')).short).toBe('Simulated · no real value')
    expect(environment(status('Shared XRPL Testnet demo · no real value')).short).toBe('Testnet demo · no real value')
    expect(environment(status('SIMULATED · no real value', 'paused')).short).toBe('Simulated · paused · no real value')
    expect(environment(status('Shared XRPL Testnet demo · no real value', 'paused')).short).toBe('Testnet demo · paused · no real value')
  })
  it('sends "How to verify a receipt" to the README how-to, not the wire-format spec', () => {
    const { verify } = hostedLinks({ status: status('SIMULATED') })
    expect(verify).toBe('https://github.com/example/repo#verify-it-yourself')
    expect(verify).not.toContain('receipt-spec')
    expect(readFileSync('README.md', 'utf8')).toMatch(/^## Verify it yourself$/m)
  })
})

describe('S21 the trace speaks in trust, not in retired letters', () => {
  it('turns an H/C move into one Trust move and drops the invoice mechanics', () => {
    expect(traceLabel('the-fab-floor: proof pass · H 0.80→0.83 · C 1.00→1.00 · active')).toBe('the-fab-floor: proof pass · Trust 0.80 → 0.83 · active')
    expect(traceLabel('alphaleak: relevance claimed 0.96, observed 0.00 (proof failed) · H 0.40→0.40 · C 1.00→0.08 · quarantined')).toContain('Trust 0.40 → 0.03')
    expect(traceLabel('SIMULATED · no ledger transaction · S$0.30 ≈ 0.03 XRP (Testnet rate) → rN9L · InvoiceID = sha256(invoiceId) · sent to the publisher\'s facilitator')).not.toContain('InvoiceID')
    expect(traceLabel('Refunded S$0.30 · InvoiceID = original tx · SIMULATED SGD · no real funds')).toBe('Refunded S$0.30 · SIMULATED SGD · no real funds')
  })
  it('renders the cleaned labels in Show work → Trace and never the retired letters', () => {
    const { container } = render(<Activity run={keyReveal} />)
    expect(container.textContent).toMatch(/Trust \d\.\d\d → \d\.\d\d/)
    expect(container.textContent).not.toMatch(/ H \d\.\d\d→| C \d\.\d\d→|sha256\(invoiceId\)/)
  })
})

describe('S22 and S26 the sidebar', () => {
  const props = { runs: [], busy: false, open: true, onNew: () => {}, onOpenRun: () => {}, onPin: () => {}, onDelete: () => {} }
  it('shows the pixel agent in the empty sidebar only where Home has none (the hosted demo)', () => {
    expect(renderToStaticMarkup(<Sidebar {...props} />)).not.toContain('ra-agent-sprite')
    expect(renderToStaticMarkup(<Sidebar {...props} hosted={{ onClear: () => {} }} />)).toContain('ra-agent-sprite')
  })
  it('offers a scrim that closes the phone drawer, and none for the rail', () => {
    const onClose = vi.fn()
    const { container } = render(<Sidebar {...props} onClose={onClose} />)
    const scrim = container.querySelector<HTMLButtonElement>('.ra-nav-scrim')!
    expect(scrim.getAttribute('aria-label')).toBe('Close sidebar')
    scrim.click()
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    expect(render(<Sidebar {...props} open={false} onClose={onClose} />).container.querySelector('.ra-nav-scrim')).toBeNull()
  })
})
