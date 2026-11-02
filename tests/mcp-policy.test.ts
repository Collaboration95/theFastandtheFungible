import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { budgetPolicy } from '../mcp/policy.js'
import { Store } from '../server/store.js'

describe('MCP human spending authority', () => {
  it('defaults to zero and rejects malformed human configuration', () => {
    expect(budgetPolicy({})).toEqual({ maxMinor: 0, dailyMinor: 0 })
    for (const bad of ['-1', 'NaN', '1.5', 'Infinity', '9007199254740992']) expect(() => budgetPolicy({ MCP_MAX_BUDGET_MINOR: bad })).toThrow()
  })
  it('clamps per call, reserves concurrent budgets and accounts across days', () => {
    const store = new Store(':memory:')
    const policy = { maxMinor: 203, dailyMinor: 250 }
    const first = store.createMcpRun('one', 1000, 'a', policy, undefined, '2026-11-02').run
    expect(first.budgetMinor).toBe(200)
    expect(store.createMcpRun('two', 1000, 'b', policy, undefined, '2026-11-02').run.budgetMinor).toBe(50)
    expect(store.createMcpRun('three', 1000, 'c', policy, undefined, '2026-11-03').run.budgetMinor).toBe(0)
    // A terminal no-purchase run releases its unused reservation, including after midnight.
    store.updateRun(first.runId, { phase: 'DONE' })
    expect(store.mcpStatus('2026-11-03')).toEqual({ spentMinor: 0, reservedMinor: 50 })
    expect(store.createMcpRun('four', 1000, 'd', policy, undefined, '2026-11-03').run.budgetMinor).toBe(200)
    store.close()
  })
  it('keeps uncertain settlement reserved after Stop and counts receipts on the settlement day', () => {
    const store = new Store(':memory:')
    const run = store.createMcpRun('receipt dates', 200, 'uncertain', { maxMinor: 200, dailyMinor: 200 }, undefined, '2026-11-02').run
    const identity = { runId: run.runId, intentId: 'payment', profileId: 'writer', resourceId: 'article', version: 'v1', amountMinor: 90 }
    store.reserveIntent({ ...identity, status: 'QUOTED', quote: { ...identity, quoteId: 'quote', quoteHash: 'hash', currency: 'SGD', expiresAt: new Date(Date.now() + 60_000).toISOString(), contentDigest: 'digest' } })
    expect(store.claimSubmitting('payment')).toBe(true)
    store.updateRun(run.runId, { phase: 'STOPPED', stopped: true })
    expect(store.mcpStatus('2026-11-03')).toEqual({ spentMinor: 0, reservedMinor: 200 })
    store.recordSettlement('payment', { receiptId: 'receipt', intentId: 'payment', runId: run.runId, resourceId: 'article', version: 'v1', amountMinor: 90, currency: 'SGD', settledAt: '2026-11-03T00:00:01Z', label: 'SIMULATED SGD · no real funds' }, 'private-delivery-token')
    expect(store.mcpStatus('2026-11-02')).toEqual({ spentMinor: 0, reservedMinor: 0 })
    expect(store.mcpStatus('2026-11-03')).toEqual({ spentMinor: 90, reservedMinor: 0 })
    expect(store.createMcpRun('next', 200, 'next', { maxMinor: 200, dailyMinor: 200 }, undefined, '2026-11-03').run.budgetMinor).toBe(110)
    store.close()
  })
  it('persists idempotency across connections/restart and refuses changed questions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-policy-'))
    const path = join(dir, 'app.db'), policy = { maxMinor: 200, dailyMinor: 200 }
    let store = new Store(path)
    const first = store.createMcpRun('same', 200, 'intent', policy).run
    store.close()
    store = new Store(path)
    expect(store.createMcpRun('same', 500, 'intent', policy)).toMatchObject({ reused: true, run: { runId: first.runId, budgetMinor: 200 } })
    expect(() => store.createMcpRun('different', 200, 'intent', policy)).toThrow('different question')
    const second = new Store(path)
    expect(second.createMcpRun('new', 200, 'new', policy).run.budgetMinor).toBe(0)
    second.close(); store.close(); rmSync(dir, { recursive: true, force: true })
  })
})
