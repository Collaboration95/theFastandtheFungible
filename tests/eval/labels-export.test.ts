// #203 label flywheel: the export reads the app store read-only, emits one row per purchase intent from
// what is already persisted, and never carries delivered bytes or tokens out of the grant tables.
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { Store } from '../../server/store.js'
import { exportLabels, READ_TABLES } from '../../scripts/export-decision-labels.js'

const dir = mkdtempSync(join(tmpdir(), 'tftf-labels-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const PREMIUM = 'PREMIUM_BODY_CANARY_77Q'
const TOKEN = 'DELIVERY_TOKEN_CANARY_77Q'

function seed(path: string) {
  new Store(path).close() // the real schema
  const db = new DatabaseSync(path)
  const runId = 'run-1'
  const candidate = (resourceId: string, publisherSlug: string, relevance: number) => ({ profileId: publisherSlug, resourceId, version: 'v1', title: resourceId, publisher: publisherSlug, preview: 'public abstract', price: { amountMinor: 30, currency: 'SGD' }, family: resourceId, facets: [], authority: 1, tier: 'PAID', license: { kind: 'SYNTHETIC', attribution: publisherSlug }, publisherSlug, relevance })
  const notft = candidate('notft-kestrel-tsmc-deal-margins', 'notfinancialtimes', 0.8), leak = candidate('alphaleak-kestrel-penang-lead-times', 'alphaleak', 0.96)
  const run = { runId, question: "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC?", candidates: [notft, leak], checkpoint: { answers: { angle: 'pricing & margins' } }, labels: { research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', publisher: 'local', settlement: 'SIMULATED SGD · no real funds', search: 'keyword only (embeddings unavailable)' } }
  db.prepare('INSERT INTO runs VALUES (?,?)').run(runId, JSON.stringify(run))
  const claim = (id: string, text: string, resourceId: string) => ({ id, text, stance: 'UNCERTAIN', citations: [{ resourceId, version: 'v1', spanId: 'p1' }] })
  db.prepare('INSERT INTO answers VALUES (?,?,?)').run(runId, 1, JSON.stringify({ version: 1, conclusion: 'free', claims: [claim('c1', 'Kestrel will pay a US$1.1 billion prepayment and gave no margin guidance.', 'or-kestrel-tsmc-filing-2026-09-29')], openGaps: [{ text: 'No analyst estimates' }], provider: 'fixture', model: 'x' }))
  db.prepare('INSERT INTO answers VALUES (?,?,?)').run(runId, 2, JSON.stringify({ version: 2, conclusion: 'paid', claims: [claim('c2', 'Consensus fiscal 2027 gross margin was cut to 55.2% from 58.5%.', 'notft-kestrel-tsmc-deal-margins')], openGaps: [], provider: 'fixture', model: 'x' }))
  const row = (c: typeof notft, addressesGap: number, verdict: string) => ({ candidate: c, judgment: { addressesGap, originality: { original: 0.9, rewrite: 0.05, overlap: 0.05 }, credibility: 1.5 }, value: 0.4, valuePerDollar: 1.3, verdict, reason: 'r', wouldBuy: verdict === 'BUY', reputation: { H: 0.8, C: 1, T: 0.8, status: 'active' } })
  db.prepare('INSERT INTO decisions VALUES (?,?,?)').run(runId, 1, JSON.stringify({ round: 1, gap: 'No analyst estimates', gapMaterial: 0.9, provider: 'fixture', model: 'metadata-fixture', threshold: 0.2, rows: [row(notft, 0.7, 'BUY'), row(leak, 0.2, 'SKIP_LOW_VALUE')], selectedResourceId: notft.resourceId }))
  db.prepare('INSERT INTO decisions VALUES (?,?,?)').run(runId, 2, JSON.stringify({ round: 2, gap: 'Lead times', gapMaterial: 0.9, provider: 'fixture', model: 'metadata-fixture', threshold: 0.2, rows: [row(leak, 0.9, 'BUY')], selectedResourceId: leak.resourceId }))
  const i1 = `${runId}:1:${notft.resourceId}:v1`, i2 = `${runId}:2:${leak.resourceId}:v1`
  db.prepare('INSERT INTO intents VALUES (?,?,?)').run(i1, runId, JSON.stringify({ intentId: i1, runId, profileId: 'notfinancialtimes', resourceId: notft.resourceId, version: 'v1', amountMinor: 90, status: 'VERIFIED' }))
  db.prepare('INSERT INTO intents VALUES (?,?,?)').run(i2, runId, JSON.stringify({ intentId: i2, runId, profileId: 'alphaleak', resourceId: leak.resourceId, version: 'v1', amountMinor: 30, status: 'REFUNDED', refund: { txHash: 'T', amountMinor: 30 } }))
  // The premium bytes and the delivery token sit in tables the export must never read.
  db.prepare('INSERT INTO grants VALUES (?,?,?)').run(i1, JSON.stringify({ runId, resourceId: notft.resourceId, version: 'v1', intentId: i1, contentDigest: 'd', grantedAt: 'now' }), JSON.stringify({ body: PREMIUM }))
  db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(i1, JSON.stringify({ intentId: i1 }), TOKEN)
  const event = (label: string, data: unknown) => db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)').run(runId, JSON.stringify({ id: 0, runId, type: 'REPUTATION', label, at: 'now', data }))
  event('notfinancialtimes: proof pass · H 0.80→0.81', { publisherSlug: 'notfinancialtimes' })
  event('notfinancialtimes: relevance claimed 0.80, observed 0.65 · H 0.81→0.81', { publisherSlug: 'notfinancialtimes' })
  event('alphaleak: proof refunded · H 0.80→0.40', { publisherSlug: 'alphaleak' })
  db.close()
}

describe('decision label export (#203)', () => {
  it('emits one row per intent with pre-purchase scores, observed score, proof outcome and gained facts', () => {
    const path = join(dir, 'app.db')
    seed(path)
    const before = createHash('sha256').update(readFileSync(path)).digest('hex')
    const rows = exportLabels(path)
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(before)
    expect(rows).toHaveLength(2)
    const [bought, refunded] = rows
    expect(bought.bankQuestionId).toBe('Q09')
    expect(bought.pre).toMatchObject({ addressesGap: 0.7, original: 0.9, credibility: 1.5, value: 0.4, verdict: 'BUY', gapMaterial: 0.9, trust: 0.8, claimedRelevance: 0.8 })
    expect(bought.post).toEqual({ claimedRelevance: 0.8, observedRelevance: 0.65, calibrationSkipped: null })
    expect(bought.proofOutcome).toBe('PASS')
    expect(bought.reanswer).toMatchObject({ beforeVersion: 1, afterVersion: 2, citesPurchased: true, gainedSupportedFact: true, determinable: true })
    expect(bought.reanswer.gainedRequestedFacts).toContain('Q09.margin')
    expect(refunded).toMatchObject({ round: 2, status: 'REFUNDED', proofOutcome: 'REFUNDED', refundedMinor: 30, charged: true })
    expect(refunded.post.observedRelevance).toBeNull()
    expect(refunded.reanswer.determinable).toBe(false)
    const text = JSON.stringify(rows)
    expect(text).not.toContain(PREMIUM)
    expect(text).not.toContain(TOKEN)
  })
  it('reads only the run, answer, decision, intent and event tables', () => {
    expect(READ_TABLES).toEqual(['runs', 'answers', 'decisions', 'intents', 'events'])
    const source = readFileSync(new URL('../../scripts/export-decision-labels.ts', import.meta.url), 'utf8')
    for (const table of ['grants', 'grant_salts', 'receipts', 'submissions']) expect(source).not.toMatch(new RegExp(`FROM ${table}\\b`))
  })
})
