import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyCalibration, applyProof, newRecord, Reputation, REPUTATION, type ProofOutcome } from '../server/reputation.js'
import { Store } from '../server/store.js'
import { decide, type DecideInput } from '../server/agents/decision.js'
import { createApiApp } from '../server/routes.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import type { PublicCandidate } from '../shared/contracts/index.js'

const W = { alpha: 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp', beta: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe' }
const cleanups: (() => void)[] = []
afterEach(() => { for (const fn of cleanups.splice(0).reverse()) fn() })
const tempDir = () => { const dir = mkdtempSync(join(tmpdir(), 'reputation-')); cleanups.push(() => rmSync(dir, { recursive: true, force: true })); return dir }

describe('Beta Reputation honesty × calibration (#140)', () => {
  it('matches the §7 numbers', () => {
    const fresh = newRecord('alphaleak', W.alpha)
    expect(fresh).toMatchObject({ H: 0.8, C: 1, T: 0.8, status: 'active' })
    expect(applyProof(fresh, 'REFUNDED')).toMatchObject({ H: 0.4, status: 'quarantined', fails: 1, refunds: 1 })
    expect(applyProof(fresh, 'REJECTED')).toMatchObject({ H: 0.4, status: 'quarantined' })
    expect(applyProof(fresh, 'PASS').H).toBeCloseTo(5 / 6, 10)
    expect(applyProof(fresh, 'REFUSED')).toMatchObject({ status: 'delisted', refusals: 1 })
    // λ forgets: a pass after a fail weighs the fail by 0.95.
    expect(applyProof(applyProof(fresh, 'REFUNDED'), 'PASS').H).toBeCloseTo((1 + 4) / (1 + 5 * 0.95 + 5), 10)
    // A delisting is sticky even after passes.
    expect(applyProof(applyProof(applyProof(fresh, 'REFUSED'), 'PASS'), 'PASS').status).toBe('delisted')
  })
  it('calibration is 1 − mean squared error on a fixed series, and T = H × C', () => {
    const series: [number, number][] = [[0.96, 0.1], [0.78, 0.8], [0.5, 0.5]]
    const record = series.reduce((r, [claimed, observed]) => applyCalibration(r, claimed, observed), newRecord('p', W.alpha))
    const brier = (0.86 ** 2 + 0.02 ** 2 + 0) / 3
    expect(record.C).toBeCloseTo(1 - brier, 10)
    expect(record.T).toBeCloseTo(0.8 * (1 - brier), 10)
    expect(record.n).toBe(3)
  })
  it('persists across store reopen, emits REPUTATION before/after events, and resets', () => {
    const path = join(tempDir(), 'app.db')
    let store = new Store(path)
    const run = store.createRun('q', 200)
    new Reputation(store).recordProof({ publisherSlug: 'alphaleak', wallet: W.alpha, outcome: 'REFUNDED', runId: run.runId })
    const event = store.getRun(run.runId).events.find(e => e.type === 'REPUTATION')!
    expect(event.data).toMatchObject({ publisherSlug: 'alphaleak', wallet: W.alpha, before: { H: 0.8, status: 'active' }, after: { H: 0.4, status: 'quarantined' } })
    store.close()
    store = new Store(path); cleanups.push(() => store.close())
    const reputation = new Reputation(store)
    expect(reputation.get('alphaleak', W.alpha)).toMatchObject({ H: 0.4, status: 'quarantined' })
    expect(reputation.summaries()[W.alpha].status).toBe('quarantined')
    reputation.reset()
    expect(reputation.list()).toEqual([])
    expect(reputation.get('alphaleak', W.alpha).H).toBe(0.8)
  })
  it('GET /api/reputation lists records and POST /api/reputation/reset wipes them', async () => {
    const dir = tempDir()
    const api = await createApiApp({ dbPath: join(dir, 'api.db'), publisherUrl: 'http://127.0.0.1:9', reportDir: join(dir, 'reports') })
    cleanups.push(() => api.close())
    api.reputation.recordProof({ publisherSlug: 'the-fab-floor', wallet: W.beta, outcome: 'PASS' })
    const server = api.app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done))
    cleanups.push(() => server.close())
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    expect((await (await fetch(`${base}/api/reputation`)).json()).publishers).toMatchObject([{ publisherSlug: 'the-fab-floor', passes: 1 }])
    expect((await (await fetch(`${base}/api/reputation/reset`, { method: 'POST' })).json()).publishers).toEqual([])
    expect((await (await fetch(`${base}/api/reputation`)).json()).publishers).toEqual([])
  })
})

const paid = (resourceId: string, wallet: string, price = 30, extra: Partial<PublicCandidate> = {}): PublicCandidate => ({ ...exampleCandidate, resourceId, family: resourceId, tier: 'PAID', title: 'Lead times', preview: 'Lead times in weeks', facets: ['lead times'], price: { amountMinor: price, currency: 'SGD' }, wallet, ...extra })
const input = (extra: Partial<DecideInput> = {}): DecideInput => ({ question: 'Are lead times getting shorter?', conclusion: 'c', gap: 'Lead times in weeks', candidates: [paid('a', W.alpha), paid('b', W.beta, 25)], readSources: [exampleCandidate], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, ...extra })

describe('decision × reputation (#140)', () => {
  it('multiplies value by T, and a quarantined or delisted seller gets SKIP_LOW_TRUST', async () => {
    const plain = await decide(input())
    const quarantined = applyProof(newRecord('a', W.alpha), 'REFUNDED')
    const trusted = await decide(input({ reputation: { [W.alpha]: { H: quarantined.H, C: quarantined.C, T: quarantined.T, status: quarantined.status } } }))
    const row = (round: typeof plain, id: string) => round.rows.find(r => r.candidate.resourceId === id)!
    expect(row(trusted, 'a').verdict).toBe('SKIP_LOW_TRUST')
    expect(row(trusted, 'a').value).toBeCloseTo(row(plain, 'a').value * 0.4, 10)
    // No entry: a newcomer at T = 0.8.
    expect(row(trusted, 'b').value).toBeCloseTo(row(plain, 'b').value * 0.8, 10)
    expect(row(trusted, 'b').reputation).toMatchObject({ H: 0.8, status: 'active' })
    expect(trusted.selectedResourceId).toBe('b')
    const delisted = applyProof(newRecord('b', W.beta), 'REFUSED')
    expect(row(await decide(input({ reputation: { [W.beta]: { ...delisted } } })), 'b').verdict).toBe('SKIP_LOW_TRUST')
  })
  it('property: for any history T ∈ [0, 1], value never rises and budget and cap stay binding (gate 2)', async () => {
    let seed = 7
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const outcomes: ProofOutcome[] = ['PASS', 'REFUNDED', 'REJECTED', 'REFUSED']
    for (let trial = 0; trial < 60; trial++) {
      let record = newRecord('a', W.alpha)
      for (let i = Math.floor(random() * 8); i > 0; i--) record = random() < 0.5 ? applyProof(record, outcomes[Math.floor(random() * 4)]) : applyCalibration(record, random(), random())
      expect(record.T).toBeGreaterThanOrEqual(0); expect(record.T).toBeLessThanOrEqual(1)
      expect(record.H).toBeGreaterThanOrEqual(0); expect(record.C).toBeLessThanOrEqual(1)
      const budget = { budgetMinor: [0, 100, 200][trial % 3], perSourceCapMinor: [20, 100][trial % 2] }
      const candidates = [paid('a', W.alpha, 30), paid('b', W.alpha, 120)]
      const base = await decide(input({ ...budget, candidates }))
      const withTrust = await decide(input({ ...budget, candidates, reputation: { [W.alpha]: record } }))
      withTrust.rows.forEach((r, i) => {
        expect(r.value).toBeLessThanOrEqual(base.rows[i].value + 1e-12)
        if (base.rows[i].verdict !== 'BUY') expect(r.verdict).not.toBe('BUY')
        if (r.verdict === 'BUY') expect(r.candidate.price.amountMinor).toBeLessThanOrEqual(Math.min(budget.perSourceCapMinor, budget.budgetMinor))
      })
    }
    expect(REPUTATION.quarantineBelowH).toBe(0.5)
  })
})
