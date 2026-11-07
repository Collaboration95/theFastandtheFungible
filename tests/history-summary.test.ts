import { expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { cpus, hostname } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { Store } from '../server/store.js'
import uc3 from '../src/fixtures/uc/uc3.json'

const database = (s: Store) => (s as unknown as { db: DatabaseSync }).db
// Frozen pre-refactor listPastRuns implementation; getRun remains the validation oracle.
function oracle(s: Store, recent = 4) {
  const db = database(s)
  const meta = new Map(db.prepare('SELECT run_id, pinned, hidden FROM run_meta').all().map(row => [row.run_id as string, row]))
  let others = 0
  return db.prepare('SELECT id FROM runs ORDER BY rowid DESC').all().flatMap(row => {
    const id = row.id as string, m = meta.get(id)
    if (m?.hidden || (!m?.pinned && others++ >= recent)) return []
    const run = s.getRun(id)
    return [{ runId: id, question: run.question, phase: run.phase, stopped: run.stopped, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, at: run.events[0]?.at ?? '', pinned: !!m?.pinned }]
  })
}
function fixture(count: number) {
  const s = new Store(':memory:'), db = database(s)
  db.exec('BEGIN')
  try {
    for (let n = 0; n < count; n++) {
      const runId = `synthetic-history-${n}`
      const run = JSON.parse(JSON.stringify(uc3).replaceAll(uc3.runId, runId)) as typeof uc3
      // Each fixture retains a full historical snapshot; normalized ledger is authoritative.
      db.prepare('INSERT INTO runs VALUES (?,?)').run(runId, JSON.stringify(run))
      db.prepare('INSERT INTO run_meta VALUES (?,?,?)').run(runId, n % 5 === 0 ? 1 : 0, n % 7 === 0 ? 1 : 0)
      for (const [k, i] of run.intents.entries()) {
        i.intentId = `${runId}-${k}`
        // Colliding resource ids across writers must never merge charges.
        i.resourceId = 'collided-resource'
        db.prepare('INSERT INTO intents VALUES (?,?,?)').run(i.intentId, runId, JSON.stringify(i))
        const receipt = run.receipts[k]
        if (receipt) db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(i.intentId, JSON.stringify({ ...receipt, intentId: i.intentId }), 'synthetic-token')
        const grant = run.grants[k]
        if (grant) db.prepare('INSERT INTO grants VALUES (?,?,?)').run(i.intentId, JSON.stringify({ ...grant, intentId: i.intentId }), JSON.stringify(run.contents[0]))
      }
      if (n % 11 === 0) db.prepare("UPDATE runs SET json=json_remove(json,'$.refundedMinor','$.policyVersion','$.ledgerAnchor') WHERE id=?").run(runId)
      // Legacy rows can lack newer optional fields and normalized first events.
      if (n % 11 !== 0) for (const event of run.events) db.prepare('INSERT INTO events(run_id,json) VALUES (?,?)').run(runId, JSON.stringify(event))
    }
    db.exec('COMMIT')
    return s
  } catch (error) { db.exec('ROLLBACK'); s.close(); throw error }
}
it('matches complete ordered old summaries for 2,000 retained paid histories, pins, hides, legacy and missing events', () => {
  const s = fixture(2000)
  try {
    expect(s.listPastRuns()).toEqual(oracle(s))
    const before = database(s).prepare('SELECT count(*) AS n FROM receipts').get()!.n
    s.setRunMeta('synthetic-history-1999', { hidden: true, pinned: true })
    expect(s.listPastRuns()).toEqual(oracle(s))
    expect(database(s).prepare('SELECT count(*) AS n FROM receipts').get()!.n).toBe(before)
    if (process.env.HISTORY_BENCH === '1') {
      const measure = (read: () => unknown) => {
        for (let n = 0; n < 3; n++) read()
        const times: number[] = [], cpu = process.cpuUsage()
        for (let n = 0; n < 30; n++) { const start = performance.now(); read(); times.push(performance.now() - start) }
        const used = process.cpuUsage(cpu)
        return { p95Ms: times.sort((a,b) => a-b)[28], cpuMsPerQuery: (used.user + used.system) / 30000 }
      }
      const old = measure(() => oracle(s)), current = measure(() => s.listPastRuns())
      mkdirSync('docs/evidence/refactor-d', { recursive: true })
      writeFileSync('docs/evidence/refactor-d/history.json', JSON.stringify({ host: hostname(), cpu: cpus()[0].model, node: process.version, retained: 2000, samples: 30, old, current, cpuReductionPercent: 100 * (1-current.cpuMsPerQuery/old.cpuMsPerQuery) }, null, 2)+'\n')
    }
  } finally { s.close() }
}, 60000)
it.each(['question', 'phase', 'stopped', 'budgetMinor', 'spentMinor'])('rejects invalid selected %s like getRun', field => {
  const s = fixture(1)
  try {
    database(s).prepare(`UPDATE runs SET json=json_set(json, ?, NULL)`).run(`$.${field}`)
    database(s).exec('UPDATE run_meta SET hidden=0')
    expect(() => oracle(s)).toThrow()
    expect(() => s.listPastRuns()).toThrow()
  } finally { s.close() }
})
it('matches every charged, reserved, failed-proof and refund status; rejects malformed summary inputs', () => {
  const s = fixture(2), db = database(s)
  try {
    db.exec('UPDATE run_meta SET hidden=0')
    const id = db.prepare('SELECT id FROM intents LIMIT 1').get()!.id as string
    for (const status of ['DECIDED','QUOTED','RESERVED','SUBMITTING','SETTLED','DELIVERY_PENDING','VERIFIED','SKIPPED','FAILED_NOT_SETTLED','DELIVERY_FAILED','CLAIM_FAILED','CHALLENGED','REFUNDED','CHALLENGE_REJECTED','CHALLENGE_REFUSED']) {
      db.prepare("UPDATE intents SET json=json_set(json,'$.status',?) WHERE id=?").run(status, id)
      expect(s.listPastRuns()).toEqual(oracle(s))
    }
    for (const value of ['null', '"90"', '-1', '1.5']) {
      db.prepare("UPDATE intents SET json=json_set(json,'$.amountMinor',json(?)) WHERE id=?").run(value, id)
      expect(() => oracle(s)).toThrow(); expect(() => s.listPastRuns()).toThrow()
    }
  } finally { s.close() }
})

it('preserves zero, fractional, negative and NaN recent limits', () => {
  const s = fixture(30)
  try { for (const recent of [0, 17, 2.5, -1, NaN]) expect(s.listPastRuns(recent)).toEqual(oracle(s, recent)) }
  finally { s.close() }
})
