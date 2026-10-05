import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunSnapshotSchema } from '../../shared/contracts/index.js'
import { exampleRun, offlineWireExampleRun, offlineZeroBudgetRun } from './run.js'
import DecisionTable from '../components/DecisionTable.js'
import Budget from '../components/Budget.js'
import Wire from '../components/Wire.js'
import Ledger from '../components/Ledger.js'
import Modes from '../components/Modes.js'
import Activity from '../components/Activity.js'
import Layout from '../components/Layout.js'
import { ask, getRun, stop, retryDelivery, createReport, streamRun } from '../api.js'

afterEach(() => vi.unstubAllGlobals())

describe('visible internals', () => {
  it('retains every round, all originality categories, and the zero-budget counterfactual', () => {
    const first = offlineZeroBudgetRun.decisions[0]
    const run = { ...offlineZeroBudgetRun, decisions: [first, { ...first, round: 2 }] }
    const html = renderToStaticMarkup(<DecisionTable run={run} />)
    expect(html).toContain('Round 1')
    expect(html).toContain('Round 2')
    for (const row of first.rows) expect(html).toContain(row.candidate.title)
    for (const label of ['Original:', 'Rewrite:', 'Overlap:', 'Addresses gap:', 'Gap material:', 'BUY_THRESHOLD', 'Would buy', 'SKIP_OVER_BUDGET', 'synthetic-table-example', 'argmax', 'reserved']) expect(html).toContain(label)
    expect(html).toContain('ra-probability-bar')
    expect(html).toContain('style="width:')
    expect(html).not.toContain('<strong>BUY</strong>')
    expect(run.intents).toHaveLength(0)
    expect(run.spentMinor).toBe(0)
    expect(run.contents.every(content => run.candidates.some(candidate => candidate.resourceId === content.resourceId && candidate.tier === 'FREE'))).toBe(true)
    expect(RunSnapshotSchema.safeParse(run).success).toBe(true)
  })

  it('shows the XRPL ledger panel only on the Testnet rail, with payee and explorer link', () => {
    expect(renderToStaticMarkup(<Ledger run={exampleRun} />)).toBe('')
    const hash = 'A'.repeat(64)
    const run = { ...exampleRun, phase: 'DONE' as const, labels: { ...exampleRun.labels, settlement: 'XRPL TESTNET · no real value' as const },
      receipts: [{ receiptId: 'r1', intentId: 'i1', runId: exampleRun.runId, resourceId: 'grid-operators-report', version: 'v1', amountMinor: 80, currency: 'SGD' as const, settledAt: '2026-10-05T10:00:00.000Z', label: 'XRPL TESTNET · no real value' as const,
        xrpl: { txHash: hash, ledgerIndex: 21296154, payer: 'rwi1i3TJfZKmLWoAiNkXUBZmdWVGFxBNRQ', payTo: 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp', amountDrops: '80000', explorerUrl: `https://testnet.xrpl.org/transactions/${hash}` } }] }
    const html = renderToStaticMarkup(<Ledger run={run} />)
    for (const text of ['Ledger · XRPL Testnet', 'S$0.80 = 0.08 XRP', 'ledger 21296154', `https://testnet.xrpl.org/transactions/${hash}`, 'rGhpLN…UVkp']) expect(html).toContain(text)
  })

  it('shows exact minor-unit budget and permanent simulation labels', () => {
    const html = renderToStaticMarkup(<Budget run={{ ...exampleRun, budgetMinor: 200, spentMinor: 80, reservedMinor: 35 }} />)
    for (const amount of ['S$2.00', 'S$0.80', 'S$0.35', 'S$0.85']) expect(html).toContain(amount)
    expect(html).toContain('SIMULATED SGD · no real funds')
    const modes = renderToStaticMarkup(<Modes labels={exampleRun.labels} />)
    expect(renderToStaticMarkup(<Modes labels={{ ...exampleRun.labels, settlement: 'XRPL TESTNET · no real value' }} />)).toContain('XRPL TESTNET · no real value')
    for (const label of ['fixture', 'Research:', 'Decision:', 'Publisher:', 'local', 'Synthetic corpus', 'SIMULATED SGD']) expect(modes).toContain(label)
  })

  it('displays safe 402/quote/delivery fields without tokens, queries, headers or paid bodies', () => {
    const secret = 'PAID_CANARY_OR_TOKEN'
    const run = { ...offlineWireExampleRun, events: [...offlineWireExampleRun.events, {
      id: 5, runId: exampleRun.runId, type: 'HTTP', label: secret, at: '2026-10-04T14:00:04Z',
      data: { deliveryToken: secret, body: secret, headers: { Authorization: `Bearer ${secret}` },
        response: { status: 402, body: secret, deliveryToken: secret },
        request: { method: 'GET', url: `https://user:${secret}@publisher.test/resources/${secret}?token=${secret}#${secret}` },
        unknown: { status: secret }, contentDigest: secret },
    }] }
    run.events.push({ id: 6, runId: run.runId, type: 'GRANT', label: secret, at: '2026-10-04T14:00:05Z', data: { intentId: secret, resourceId: secret, version: secret, body: secret, deliveryToken: secret } })
    run.grants = [{ runId: run.runId, intentId: secret, resourceId: secret, version: secret, contentDigest: 'a'.repeat(64), grantedAt: '2026-10-04T14:00:05Z' }]
    run.intents = [{ runId: run.runId, intentId: secret, profileId: secret, resourceId: secret, version: secret, amountMinor: 80, status: 'VERIFIED', quote: { runId: run.runId, intentId: secret, profileId: secret, resourceId: secret, version: secret, quoteId: secret, amountMinor: 80, currency: 'SGD', quoteHash: 'b'.repeat(64), contentDigest: 'a'.repeat(64), expiresAt: '2026-10-04T14:30:00Z' } }]
    const html = renderToStaticMarkup(<Wire run={run} />)
    expect(html).toContain('402')
    expect(html).toContain('/quote')
    expect(html).toContain('/settle')
    expect(html).toContain('sha-256 ✓')
    expect(html).toContain('Verified delivery')
    expect(html).toContain('a'.repeat(64))
    expect(html).toContain('b'.repeat(64))
    expect(html).toContain('/v1/quotes')
    expect(html).toContain('/resources/[id]')
    expect(html).not.toContain(secret)
    expect(html).not.toContain('Authorization')
    expect(html).not.toContain('deliveryToken')
  })

  it('keeps layout slots and historical activity without dumping event data', () => {
    const html = renderToStaticMarkup(<Layout header={<Modes />} aside={<Activity run={offlineZeroBudgetRun} />}><p>Answer slot</p></Layout>)
    expect(html).toContain('Answer slot')
    expect(html).toContain('ResearchAgent')
    expect(html).toContain('Offline synthetic example')
    expect(html).toContain('disabled=""')
  })
})

describe('run command adapter', () => {
  it('uses only the agreed routes and validates each server snapshot', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => exampleRun })
    vi.stubGlobal('fetch', fetch)
    await ask({ question: 'Grid?', budgetMinor: 200 })
    await getRun('a/b')
    await stop('a/b')
    await retryDelivery('a/b', 'intent-1')
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/runs', '/runs/a%2Fb', '/runs/a%2Fb/stop', '/runs/a%2Fb/retry-delivery'])
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ intentId: 'intent-1' })
    expect(fetch.mock.calls[1][1].method).toBe('GET')
    expect(fetch.mock.calls[2][1].method).toBe('POST')
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...exampleRun, spentMinor: 'invalid' }) })
    await expect(getRun('bad')).rejects.toThrow()
    await expect(ask({ question: '', budgetMinor: 0 })).rejects.toThrow()
  })

  it('does not expose arbitrary error response bodies and rejects executable report URLs', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'SECRET' }) })
    vi.stubGlobal('fetch', fetch)
    await expect(stop('run')).rejects.toThrow('ResearchAgent request failed (HTTP 500)')
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ format: 'HTML', url: 'javascript:alert(1)' }) })
    await expect(createReport('run')).rejects.toThrow('Unsafe report URL')
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ format: 'PDF', url: '/reports/run.pdf' }) })
    await expect(createReport('run')).resolves.toEqual({ format: 'PDF', url: '/reports/run.pdf' })
    expect(fetch.mock.calls[2][0]).toBe('/runs/run/report')
  })

  it('handles both SSE event names, invalid data and complete idempotent listener cleanup', () => {
    class FakeSource extends EventTarget {
      static instance: FakeSource
      close = vi.fn()
      removeEventListener = vi.fn(super.removeEventListener.bind(this))
      constructor(readonly url: string) { super(); FakeSource.instance = this }
    }
    vi.stubGlobal('EventSource', FakeSource)
    const onSnapshot = vi.fn(), onEvent = vi.fn(), onError = vi.fn()
    const unsubscribe = streamRun('a/b', { onSnapshot, onEvent, onError })
    const source = FakeSource.instance
    expect(source.url).toBe('/runs/a%2Fb/events')
    source.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify(exampleRun) }))
    source.dispatchEvent(new MessageEvent('trace', { data: JSON.stringify(offlineZeroBudgetRun.events[0]) }))
    expect(onSnapshot).toHaveBeenCalledWith(exampleRun)
    expect(onEvent).toHaveBeenCalledWith(offlineZeroBudgetRun.events[0])
    source.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify({ runId: 'bad' }) }))
    source.dispatchEvent(new MessageEvent('trace', { data: 'invalid json' }))
    source.dispatchEvent(new Event('error'))
    expect(onError).toHaveBeenCalledTimes(3)
    unsubscribe()
    unsubscribe()
    expect(source.close).toHaveBeenCalledTimes(1)
    expect(source.removeEventListener.mock.calls.map(call => call[0])).toEqual(['snapshot', 'trace', 'error'])
    source.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify(exampleRun) }))
    expect(onSnapshot).toHaveBeenCalledTimes(1)
  })
})
