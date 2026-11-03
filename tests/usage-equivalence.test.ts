import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { Store } from '../server/store.js'
import type { Surface } from '../server/spend-policy.js'
import { legacyUsage } from './fixtures/legacy-usage.js'

type Access = { db: DatabaseSync; usage: typeof legacyUsage }
const access = (s: Store) => s as unknown as Access
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.reverse().forEach(f => f()); cleanup.length = 0; vi.unstubAllEnvs(); vi.restoreAllMocks() })
function fixture(oracle = false) {
  const dir = mkdtempSync(join(tmpdir(), 'usage-equivalence-')), path = join(dir, 'app.db')
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  const s = new Store(path); cleanup.push(() => s.close())
  if (oracle) access(s).usage = legacyUsage
  return s
}
function seed(s: Store) {
  const db = access(s).db
  const agents = ['a', 'b'].map(name => s.addAgent({ name, maxMinor: 200, dailyMinor: 400 }))
  const statuses = ['RESERVED', 'SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED', 'FAILED_NOT_SETTLED', 'SKIPPED']
  const ids: string[] = []
  for (let n = 0; n < 104; n++) {
    const surface = (['web', 'mcp', 'agent', 'x402'] as const)[n % 4], principal = agents[n % 2].id
    const run = s.createRun(n % 7 ? 'synthetic' : '[pruned]', 200); ids.push(run.runId)
    s.updateRun(run.runId, { phase: (['DONE', 'STOPPED', 'FAILED', 'SEARCH'] as const)[n % 4] })
    if (n % 9) db.prepare('INSERT INTO admissions VALUES (?,?,?,?,?,?,?,?)').run(String(n), surface, principal, run.runId, 200, 200, '2026-11-01', 'legacy')
    const intentId = `i${n}`, day = `2026-11-0${n % 3 + 1}`
    const intent = { runId: run.runId, intentId, profileId: 'writer', resourceId: `article${n}`, version: 'v1', amountMinor: n % 11, status: statuses[n % statuses.length], createdAt: day+'T00:00:01Z', ...(n % 8 === 0 ? { escrow: { state: 'CANCELLED' } } : {}), ...(n % 13 === 0 ? { refundCandidate: { reason: 'synthetic pending refund' } } : {}) }
    db.prepare('INSERT INTO intents VALUES (?,?,?)').run(intentId, run.runId, JSON.stringify(intent))
    if (n % 3) db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(intentId, JSON.stringify({ intentId, settledAt: day+'T01:00:00Z' }), 'synthetic')
    if (n % 5 === 0) db.prepare('INSERT INTO hire_reserves VALUES (?,?,?)').run(run.runId, 17, n % 2)
    if (n % 6 === 0) for (let k = 0; k < 3; k++) db.prepare('INSERT INTO policy_payments VALUES (?,?,?)').run(`p${n}-${k}`, run.runId, JSON.stringify({ id: `p${n}-${k}`, amountDrops: String(10000 + k), kind: k ? 'royalty' : 'hire', ...(k === 0 ? { confirmedAt: day+'T02:00:00Z' } : k === 1 ? { cancelledAt: day } : { submission: { txHash: 'synthetic signed unconfirmed' } }) }))
  }
  return { ids, agents }
}
it('matches the frozen oracle across days, surfaces, principals, exclusions and mixed durable money states, before and after restart', () => {
  const s = fixture(), { ids, agents } = seed(s)
  const check = (store: Store) => {
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
      for (const surface of [undefined, 'web', 'mcp', 'agent', 'x402'] as (Surface | undefined)[]) for (const principal of [undefined, ...agents.map(a => a.id)]) for (const exclude of [undefined, ids[0], ids[3]]) {
        expect(access(store).usage.call(store, day, surface, exclude, principal)).toEqual(legacyUsage.call(store, day, surface, exclude, principal))
      }
      expect(store.walletStatus(day)).toMatchObject(legacyUsage.call(store, day))
      expect(store.mcpStatus(day)).toEqual(legacyUsage.call(store, day, 'mcp'))
    }
  }
  check(s)
  const restarted = new Store(s.path); cleanup.push(() => restarted.close()); check(restarted)
})
it('keeps admission and reservation decisions identical through pause, revoke, midnight, reservation restart and settlement', () => {
  vi.stubEnv('WALLET_DAILY_CAP_MINOR', '350')
  const stores = [fixture(), fixture(true)]
  const agents = stores.map(s => s.addAgent({ name: 'agent', maxMinor: 200, dailyMinor: 300 }))
  const results = stores.map((s, index) => {
    const a = agents[index], out: unknown[] = []
    const input = { surface: 'agent' as const, principal: a.id, question: 'synthetic', requestedMinor: 200, maxMinor: 200, idempotencyKey: 'one' }
    const run = s.admit(input, '2026-11-01').run
    const identity = { runId: run.runId, intentId: 'payment', profileId: 'writer', resourceId: 'article', version: 'v1', amountMinor: 90 }
    out.push(run.budgetMinor)
    out.push(s.reserveIntent({ ...identity, status: 'QUOTED', quote: { ...identity, quoteId: 'quote', quoteHash: 'hash', currency: 'SGD', expiresAt: '2099-01-01T00:00:00Z', contentDigest: 'digest' } }).status)
    out.push(s.claimSubmitting('payment'))
    const restarted = new Store(s.path); cleanup.push(() => restarted.close()); if (index) access(restarted).usage = legacyUsage
    out.push(restarted.mcpStatus('2026-11-02'), restarted.walletStatus('2026-11-02'))
    restarted.recordSettlement('payment', { receiptId: 'receipt', intentId: 'payment', runId: run.runId, resourceId: 'article', version: 'v1', amountMinor: 90, currency: 'SGD', settledAt: '2026-11-02T00:00:01Z', label: 'SIMULATED SGD · no real funds' }, 'synthetic')
    restarted.updateRun(run.runId, { phase: 'DONE' })
    out.push(restarted.admit({ ...input, idempotencyKey: 'two' }, '2026-11-02').run.budgetMinor)
    const status = restarted.agentStatus(a.id, '2026-11-02')
    out.push({ spentMinor: status.spentMinor, reservedMinor: status.reservedMinor, spent7DaysMinor: status.spent7DaysMinor, rails: status.rails })
    restarted.setAgentPaused(a.id, true)
    try { restarted.admit({ ...input, idempotencyKey: 'paused' }) } catch (e) { out.push((e as Error).message) }
    restarted.setAgentPaused(a.id, true, true)
    try { restarted.admit({ ...input, idempotencyKey: 'revoked' }) } catch (e) { out.push((e as Error).message) }
    return out
  })
  expect(results[0]).toEqual(results[1])
})

it('matches the oracle under four concurrent reserving OS processes', async () => {
  vi.stubEnv('WALLET_DAILY_CAP_MINOR', '500')
  const totals: number[] = []
  for (const oracle of [false, true]) {
    const s = fixture(oracle), a = s.addAgent({ name: 'concurrent', maxMinor: 100, dailyMinor: 500 })
    const values = await Promise.all(Array.from({ length: 4 }, (_, lane) => new Promise<number>((done, fail) => {
      const p = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/usage-concurrent.mjs', s.path, a.id, String(lane), String(oracle)], { env: { ...process.env, LANGFUSE_ENABLED: '0' } })
      let out = ''; p.stdout.on('data', c => out += c); p.stderr.resume()
      p.on('error', fail); p.on('exit', code => code === 0 ? done(Number(out.trim())) : fail(new Error('Concurrent fixture failed')))
    })))
    totals.push(values.reduce((a, b) => a + b, 0))
    expect(s.walletStatus().reservedMinor).toBe(500)
  }
  expect(totals).toEqual([500, 500])
}, 15000)

it('reopens a WAL after process death between reservation and settlement with exactly the oracle authority', () => {
  const outputs = [false, true].map(oracle => {
    const s = fixture(oracle)
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'tests/fixtures/usage-crash.mjs', s.path, String(oracle)], { env: { ...process.env, LANGFUSE_ENABLED: '0' } })
    expect(child.signal).toBe('SIGKILL')
    const reopened = new Store(s.path); cleanup.push(() => reopened.close()); if (oracle) access(reopened).usage = legacyUsage
    const intent = reopened.getIntent('crash-payment')!
    expect(intent.status).toBe('SUBMITTING')
    const before = reopened.walletStatus()
    reopened.recordSettlement(intent.intentId, { receiptId: 'receipt', intentId: intent.intentId, runId: intent.runId, resourceId: 'article', version: 'v1', amountMinor: 90, currency: 'SGD', settledAt: new Date().toISOString(), label: 'SIMULATED SGD · no real funds' }, 'synthetic')
    return [before, reopened.walletStatus()]
  })
  expect(outputs[0]).toEqual(outputs[1])
})
