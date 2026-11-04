import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { auditRuns, readRuns, type Rule } from '../scripts/gate-audit.js'
import { exampleAnswer, exampleCandidate, exampleContent, exampleRun } from '../shared/contracts/examples.js'
import { SIMULATED_LABEL, type RunSnapshot } from '../shared/contracts/index.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import type { WriterCorpus } from '../shared/contracts/writers.js'
import { assertNoLeaks } from './scenarios/harness.js'
import { Store } from '../server/store.js'

let corpus: WriterCorpus
beforeAll(async () => { corpus = await loadWriterCorpus(undefined, { allowMini: false }) })
const copy = () => structuredClone(exampleRun)
function paidRun(): RunSnapshot {
  const run = copy(), id = `${run.runId}:1:${exampleCandidate.resourceId}:${exampleCandidate.version}`
  run.candidates = [{ ...exampleCandidate, tier: 'PAID' }]
  run.contents = [exampleContent]
  run.answers = [exampleAnswer]
  run.intents = [{ intentId: id, runId: run.runId, profileId: exampleCandidate.profileId, resourceId: exampleCandidate.resourceId, version: exampleCandidate.version, amountMinor: 80, status: 'VERIFIED' }]
  run.grants = [{ runId: run.runId, intentId: id, resourceId: exampleCandidate.resourceId, version: exampleCandidate.version, contentDigest: 'test', grantedAt: new Date().toISOString() }]
  run.receipts = [{ receiptId: 'x402-first', runId: run.runId, intentId: id, resourceId: exampleCandidate.resourceId, version: exampleCandidate.version, amountMinor: 80, currency: 'SGD', settledAt: new Date().toISOString(), label: SIMULATED_LABEL }]
  run.decisions = [{ round: 1, gap: 'test', gapMaterial: 1, provider: 'fixture', model: 'fixture', threshold: 0.2, selectedResourceId: exampleCandidate.resourceId, rows: [{ candidate: run.candidates[0], judgment: { addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }, value: 1, valuePerDollar: 1, verdict: 'BUY', reason: 'policy', wouldBuy: true }] }]
  run.events = [{ id: 1, runId: run.runId, type: 'DECIDE', label: 'policy', at: '' }, { id: 2, runId: run.runId, type: 'BUY', label: 'policy pick', at: '', data: { intentId: id } }]
  return run
}
const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })))
describe('hard-gate audit', () => {
  it('requires the writer cooperation label on key-reveal refunds', () => {
    const r = paidRun(), i = r.intents[0]
    i.status = 'REFUNDED'; i.refund = { amountMinor: i.amountMinor, txHash: 'refund' }
    i.escrow = { mode: 'key-reveal', scheme: 'escrow-v1', policy: 'escrow-policy-v1', state: 'RELEASED', owner: 'payer', cancelAfter: 1, proofOk: false }
    expect(auditRuns([r], corpus).byRule.missing_rail_label).toBe(1)
    r.events.push({ id: 3, runId: r.runId, at: '', type: 'REFUND', label: 'Refund · writer-signed · fixture writer cooperates (a real writer could refuse)', data: { intentId: i.intentId } })
    expect(auditRuns([r], corpus).byRule.missing_rail_label).toBe(0)
  })
  it('accepts clean free and verified-paid runs', () => { expect(auditRuns([copy(), paidRun()], corpus).total).toBe(0) })
  const cases: [Rule, (r: RunSnapshot) => void][] = [
    ['citation_without_verified_grant', r => { r.intents[0].status = 'CLAIM_FAILED' }],
    ['duplicate_settlement', r => { r.receipts.push({ ...r.receipts[0], receiptId: 'second-charge' }) }],
    ['over_budget', r => { r.budgetMinor = 50; r.intents[0].status = 'REFUNDED'; r.intents[0].refund = { amountMinor: 80, txHash: 'refund' } }],
    ['purchase_without_policy', r => { r.events.reverse(); r.events[0].id = 1; r.events[1].id = 2 }],
    ['premium_leak', r => { const a = corpus.articles.find(a => a.tier === 'PAID')!; r.events.push({ id: 3, runId: r.runId, type: 'SEARCH', at: '', label: a.passages.map(p => p.text).join(' ') }) }],
    ['missing_rail_label', r => { r.labels.settlement = '' as typeof r.labels.settlement }],
  ]
  it.each(cases)('catches seeded %s', (rule, mutate) => { const r = paidRun(); mutate(r); expect(auditRuns([r], corpus).byRule[rule]).toBeGreaterThan(0) })
  it('requires the matching resource/version and a BUY verdict in the persisted policy decision', () => {
    const r = paidRun(); r.decisions[0].rows[0].verdict = 'SKIP_OVER_BUDGET'
    expect(auditRuns([r], corpus).byRule.purchase_without_policy).toBe(1)
    r.grants[0].version = 'other'
    expect(auditRuns([r], corpus).byRule.citation_without_verified_grant).toBeGreaterThan(0)
  })
  it('does not treat receipt replay with the same tx hash as another charge', () => {
    const r = paidRun(); const e = { id: 3, runId: r.runId, type: 'XRPL', at: '', label: 'issued a receipt', data: { intentId: r.intents[0].intentId, txHash: 'first' } }
    r.events.push(e, { ...e, id: 4 }); expect(auditRuns([r], corpus).byRule.duplicate_settlement).toBe(0)
    r.events.push({ ...e, id: 5, data: { ...e.data, txHash: 'another' } }); expect(auditRuns([r], corpus).byRule.duplicate_settlement).toBe(1)
  })
  it('catches raw search/SSE leaks even when a later grant exists', () => {
    const r = paidRun(), a = corpus.articles.find(a => a.tier === 'PAID')!
    const result = auditRuns([r], corpus, [{ kind: 'SSE before grant', runId: r.runId, grants: [], raw: JSON.stringify({ body: a.body }) }])
    expect(result.byRule.premium_leak).toBeGreaterThan(0)
    expect(JSON.stringify(result)).not.toContain(a.passages[0].text)
  })
  it('does not authorize an earlier citation with a later verified grant', () => {
    const final = paidRun(), early = structuredClone(final); early.intents[0].status = 'DELIVERY_PENDING'
    expect(auditRuns([final], corpus, [{ kind: 'SSE', runId: final.runId, grants: [], raw: JSON.stringify(early) }]).byRule.citation_without_verified_grant).toBeGreaterThan(0)
  })
  it('catches orphan purchase events without an intent row', () => {
    const r = copy(); r.events.push({ id: 1, runId: r.runId, type: 'PURCHASE', at: '', label: 'RESERVED', data: { intentId: 'unknown' } })
    expect(auditRuns([r], corpus).byRule.purchase_without_policy).toBe(1)
  })
  it('invalidates cached leak markers after paid or public corpus mutation', () => {
    const c = structuredClone(corpus), paid = c.articles.find(a => a.tier === 'PAID')!, free = c.articles.find(a => a.tier === 'FREE')!
    assertNoLeaks([], c)
    const text = 'Private cache mutation sentinel has nine entirely novel words.'
    paid.passages.push({ id: 'new-private', text }); paid.body += '\n' + text
    const observation = { kind: 'mutated', raw: text, grants: [] }
    expect(() => assertNoLeaks([observation], c)).toThrow(`leaked ${paid.articleId}`)
    free.body += '\n' + text
    expect(() => assertNoLeaks([observation], c)).not.toThrow()
  })
  it('audits raw SQLite without sanitizing corrupt public fields or writing to the store', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-audit-')); dirs.push(dir)
    const file = join(dir, 'api.db'), store = new Store(file), run = store.createRun('test', 200); store.close()
    const db = new DatabaseSync(file)
    const raw = JSON.parse(String(db.prepare('SELECT json FROM runs').get()!.json)); raw.labels.settlement = 'unlabelled'
    db.prepare('UPDATE runs SET json=?').run(JSON.stringify(raw)); db.close()
    expect(auditRuns(readRuns(file), corpus).byRule.missing_rail_label).toBe(1)
    const check = new DatabaseSync(file, { readOnly: true }); expect(JSON.parse(String(check.prepare('SELECT json FROM runs WHERE id=?').get(run.runId)!.json)).labels.settlement).toBe('unlabelled'); check.close()
  })
})
