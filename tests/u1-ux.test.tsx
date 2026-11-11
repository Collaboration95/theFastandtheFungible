// @vitest-environment jsdom
// U1 polish: presentation-only guarantees for the judge-facing screens.
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, render, screen } from '@testing-library/react'
import { RunSnapshotSchema } from '../shared/contracts'
import { offlineZeroBudgetRun, ucRuns } from '../src/fixtures/run'
import RunActivity from '../src/components/RunActivity'
import Answer from '../src/components/Answer'
import SpendPanel from '../src/components/SpendPanel'
import PaymentRow from '../src/components/PaymentRow'
import MobileSpend from '../src/components/MobileSpend'
import OwnerSettings from '../src/components/OwnerSettings'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const activity = (run: Parameters<typeof RunActivity>[0]['run']) => renderToStaticMarkup(<RunActivity run={run} onStop={() => {}} stopping={false} onShowWork={() => {}} />)

it('never marks an upcoming step done: nothing reads as paid or checked before its event', () => {
  const run = { ...ucRuns.UC2, phase: 'SEARCH' as const, candidates: [], contents: [], decisions: [], intents: [], receipts: [], answers: [], events: ucRuns.UC2.events.filter(e => e.type === 'SEARCH').slice(0, 1) }
  const html = activity(run)
  expect(html).toContain('Searching writers…')
  expect(html).not.toContain('Searched writers · 0 sources')
  for (const upcoming of ['Pay the writer, only if an article helps', 'Check the article against the writer’s promises', 'Update the answer with verified evidence']) {
    expect(html).toMatch(new RegExp(`<li class="is-todo"><span><i aria-hidden="true"><svg[^>]*>.*?</svg></i><span class="ra-sr">Next: </span>${upcoming}`))
  }
  expect(html).not.toMatch(/✓<\/i>(?:<span[^>]*>[^<]*<\/span>)?Pay/)
})

it('reads sub-second fixture runs as "under 1 s" and drops 0.0 s step timings', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 7, 0, 0, 0, s)).toISOString()
  const run = { ...offlineZeroBudgetRun, phase: 'DONE' as const, events: [{ id: 1, runId: 'x', type: 'SEARCH' as const, label: 'search', at: at(0) }, { id: 2, runId: 'x', type: 'DONE' as const, label: 'done', at: at(120) }] }
  const html = activity(run)
  expect(html).toContain('under 1 s')
  expect(html).not.toContain('0.0 s')
  expect(html).not.toContain('0.1 s')
})

it('explains a decline in the proof page\u2019s words with no scores, open by default for a short list, and says it once in Payments', () => {
  const candidate = { ...offlineZeroBudgetRun.candidates[0], tier: 'PAID' as const }
  const base = offlineZeroBudgetRun.decisions[0].rows[0]
  const rows = [{ ...base, candidate: { ...candidate, resourceId: 'a', title: 'Note A' }, value: 0.08, verdict: 'SKIP_LOW_VALUE' as const, reason: 'Reason A' }, { ...base, candidate: { ...candidate, resourceId: 'b', title: 'Note B' }, value: 0.01, verdict: 'SKIP_LOW_TRUST' as const, reason: 'Reason B' }]
  const run = { ...offlineZeroBudgetRun, phase: 'DONE' as const, answers: [], intents: [], receipts: [], candidates: rows.map(r => r.candidate), decisions: [{ ...offlineZeroBudgetRun.decisions[0], threshold: 0.2, rows }] }
  const html = renderToStaticMarkup(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />)
  expect(html).toContain('<summary><span>Why nothing was bought</span><span class="ra-why-count"> · 2 articles considered</span></summary>')
  expect(html).toContain('<details class="ra-why-not" open="">')
  expect(html).toContain('Wouldn’t add enough')
  expect(html).toContain('Writer didn’t meet the trust checks')
  expect(html).not.toMatch(/value 0\.\d|vs 0\.20/)
  expect(html).toContain('Reason A')
  expect(html).not.toContain('SKIP_LOW_VALUE')
  const spend = renderToStaticMarkup(<SpendPanel run={run} onRetry={() => {}} onReceipt={() => {}} />)
  expect(spend).toContain('Nothing bought. 2 paid articles considered; none bought.')
  expect(spend).not.toContain('Found 2 paid articles')
})

it('tells the key-reveal story in order: escrow → key → refund, then promise checks; labels stay on the card', () => {
  const trace = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8'))
  const run = RunSnapshotSchema.parse(trace.run)
  const intent = run.intents.find(i => i.escrow?.mode === 'key-reveal' && i.refund)!
  const html = renderToStaticMarkup(<PaymentRow run={run} intent={intent} onRetry={() => {}} onReceipt={() => {}} />)
  const at = (text: string) => { const index = html.indexOf(text); expect(index, text).toBeGreaterThan(-1); return index }
  expect(at('Payment locked in escrow')).toBeLessThan(at('Refund signed by the writer. This demo writer agrees to refund; a real writer could refuse.'))
  expect(at('XRPL Testnet · key-reveal escrow · no real value')).toBeLessThan(at('The writer’s trust score drops.'))
  expect(at('Download evidence')).toBeLessThan(at('ra-verification'))
})

it('pluralises the mobile spend summary', () => {
  const one = { ...ucRuns.UC2 }
  expect(renderToStaticMarkup(<MobileSpend run={one} onRetry={() => {}} onReceipt={() => {}} />)).toContain(`${one.receipts.length} payment${one.receipts.length === 1 ? '' : 's'} `)
  expect(renderToStaticMarkup(<MobileSpend run={{ ...one, receipts: [one.receipts[0]] }} onRetry={() => {}} onReceipt={() => {}} />)).toContain('1 payment ')
})

it('Settings shows readable names but keeps the stored identifiers as values', async () => {
  history.replaceState(null, '', '/?settings=1&onboarding=1')
  vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ ok: true, status: 200, json: async () => path === '/api/settings' ? { values: { SETTLEMENT_RAIL: 'simulated', MCP_MAX_BUDGET_MINOR: 0, MCP_DAILY_CAP_MINOR: 0 }, csrf: 'c', keys: { DEEPSEEK_API_KEY: 'Not configured' } } : {} })))
  render(<OwnerSettings />)
  await screen.findByText('Only you can change these settings. Policy code remains the spending authority.')
  const network = screen.getByLabelText('Network') as HTMLSelectElement
  expect([...network.options].map(o => [o.value, o.textContent])).toEqual([['simulated', 'Simulated · no real value'], ['xrpl-testnet', 'XRPL Testnet demo · no real value']])
  expect(screen.getByText('DeepSeek API key', { selector: 'b' })).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Confirm limits and start' }) as HTMLButtonElement).className).toContain('owner-primary')
  history.replaceState(null, '', '/')
})

it('shows the receipt date in Singapore time', async () => {
  const { default: ReceiptSheet } = await import('../src/components/ReceiptSheet')
  const run = ucRuns.UC2
  const receipt = { ...run.receipts[0], settledAt: '2026-11-07T06:16:00Z' }
  const html = renderToStaticMarkup(<ReceiptSheet run={run} receipt={receipt} onClose={() => {}} />)
  expect(html).toContain('7 Nov 2026, 14:16 SGT')
  expect(html).not.toContain('07/11/2026')
})

it('omits the unsourced registry Articles column from Writers', async () => {
  const { default: ReputationPanel } = await import('../src/components/ReputationPanel')
  const { uc3Reputation } = await import('../src/fixtures/run')
  const html = renderToStaticMarkup(<ReputationPanel records={uc3Reputation} run={ucRuns.UC3} />)
  expect(html).toContain('Promise checks passed / failed')
  expect(html).not.toContain('>Articles<')
})
