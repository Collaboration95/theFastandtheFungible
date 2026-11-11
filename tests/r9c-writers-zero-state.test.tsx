// @vitest-environment jsdom
// R9-C, H9-15 (round-9 mock judges): a new visitor's Writers tab showed "Confirmed sales 0 · rate unavailable" on every card.
// It now says what will appear there, and the hosted demo adds a demo-wide count of confirmed sales (counts only).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { demoSalesByArticle } from '../server/hosted/writers.js'
import WriterEarnings, { salesCount } from '../src/components/WriterEarnings'
import { HostedContext } from '../src/hosted'
import type { PurchaseIntent } from '../shared/contracts/index.js'

describe('R9-C H9-15: the Writers tab has a zero state and a demo-wide sales count', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const sale = (profileId: string, resourceId: string, patch: Partial<PurchaseIntent> = {}): PurchaseIntent => ({ intentId: `${resourceId}-${Math.random()}`, runId: 'r', profileId, resourceId, version: 'v1', amountMinor: 40, status: 'VERIFIED', escrow: { scheme: 'escrow-v1', policy: 'escrow-policy-v1', owner: 'rOwner', cancelAfter: 1, finishHash: 'A'.repeat(64), revealLedger: 7, state: 'RELEASED' }, ...patch } as PurchaseIntent)
  it('counts only sales whose key reveal was validated on the ledger, by public article id', () => {
    const counts = demoSalesByArticle([
      sale('team-xrpl-explainers', 'product-writer-paid'), sale('team-xrpl-explainers', 'product-writer-paid'), sale('team-xrpl-explainers', 'product-how-it-decides'),
      sale('team-xrpl-explainers', 'product-writer-paid', { escrow: undefined }),
      sale('team-xrpl-explainers', 'product-writer-paid', { escrow: { scheme: 'escrow-v1', policy: 'escrow-policy-v1', owner: 'rOwner', cancelAfter: 1, state: 'LOCKED' } as PurchaseIntent['escrow'] }),
    ])
    expect(Object.fromEntries(counts)).toEqual({ 'team-xrpl-explainers/product-writer-paid': 2, 'team-xrpl-explainers/product-how-it-decides': 1 })
  })
  it('says "None yet" instead of a zero and a missing refund rate', () => {
    expect([0, 1, 12].map(salesCount)).toEqual(['None yet', '1 sale', '12 sales'])
  })
  const writer = (patch: Record<string, unknown>) => ({ slug: 'team-xrpl-explainers', publisherSlug: 'team-xrpl-explainers', name: 'ResearchAgent builders · XRPL explainers (team-authored)', publisher: 'ResearchAgent builders · XRPL explainers (team-authored)', authorship: 'Team-authored', articleCount: 182, priceRange: [40, 40], articles: [], sales: [], trust: [], ...patch })
  const hosted = () => ({ status: { state: 'ready', questionCapMinor: 200, capabilities: {}, remaining: { questions: 5, minor: 1000 }, labels: { models: 'live answers', rail: 'Shared XRPL Testnet demo · no real value' }, links: {} } }) as never
  it('a new hosted visitor sees the zero state, the demo-wide count, and no refund row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ scope: 'Your retained history only; not total writer earnings.', writers: [writer({ demoSales: 12 })] }) })))
    const { container } = render(<HostedContext.Provider value={hosted()}><WriterEarnings /></HostedContext.Provider>)
    await waitFor(() => expect(container.querySelector('.ra-writer-card')).toBeTruthy())
    expect(container.querySelector('.ra-writer-empty')?.textContent).toMatch(/^No purchases in your history yet\./)
    const rows = Object.fromEntries([...container.querySelectorAll('.ra-writer-card dl > div')].map(row => [row.querySelector('dt')!.textContent, row.querySelector('dd')!.textContent]))
    expect(rows).toEqual({ Articles: '182', 'Price range': 'S$0.40', 'Sales on this demo': '12 sales', 'Your purchases': 'None yet' })
    expect(container.textContent).not.toMatch(/rate unavailable|no observations/)
  })
  it('after a purchase the card shows it with its refund rate, and the zero state is gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ scope: 'x', writers: [writer({ sales: [{ finishHash: 'A'.repeat(64), refunded: false }], trust: [{ at: '2026-11-11T00:00:00Z', value: 0.62 }] })] }) })))
    const { container } = render(<WriterEarnings />)
    await waitFor(() => expect(container.querySelector('.ra-writer-card')).toBeTruthy())
    expect(container.querySelector('.ra-writer-empty')).toBeNull()
    const rows = Object.fromEntries([...container.querySelectorAll('.ra-writer-card dl > div')].map(row => [row.querySelector('dt')!.textContent, row.querySelector('dd')!.textContent]))
    expect(rows).toEqual({ Articles: '182', 'Price range': 'S$0.40', 'Your purchases': '1 sale', Refunds: '0 · 0%' })
    expect(container.textContent).toContain('Trust over time · latest 0.62')
  })
})
