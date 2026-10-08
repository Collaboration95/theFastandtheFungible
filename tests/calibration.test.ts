import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cosineObserver, deliveredText, Reputation, searchQueries, type RelevanceObserver } from '../server/reputation.js'
import { Store } from '../server/store.js'
import { cosineRelevance, SEARCH_TUNING } from '../publisher/search.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import { SEARCH_LABELS, type ContentEnvelope, type RunSnapshot } from '../shared/contracts/index.js'

const WALLET = 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp'
const PAID_TEXT = 'Penang lead times fell from 14 weeks in June 2026 to 9 weeks in September 2026.'
const cleanups: (() => void)[] = []
afterEach(() => { for (const fn of cleanups.splice(0).reverse()) fn(); vi.restoreAllMocks() })
/** A unit vector whose cosine with [1, 0] is `cos`. */
const at = (cos: number) => [cos, Math.sqrt(1 - cos * cos)]
/** The cosine that maps to `relevance` on the search's own scale. */
const cosFor = (relevance: number) => SEARCH_TUNING.cosineRange.lo + relevance * (SEARCH_TUNING.cosineRange.hi - SEARCH_TUNING.cosineRange.lo)

function setup(options: { claimed?: number; observe?: RelevanceObserver } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'calibration-'))
  const store = new Store(join(dir, 'app.db'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }), () => store.close())
  const created = store.createRun('Are lead times getting shorter?', 200)
  const candidate = { ...exampleCandidate, profileId: 'the-fab-floor', publisherSlug: 'the-fab-floor', resourceId: 'fab-lead-times', tier: 'PAID' as const, wallet: WALLET, relevance: 1, price: { amountMinor: 25, currency: 'SGD' as const } }
  const content: ContentEnvelope = { profileId: 'the-fab-floor', resourceId: 'fab-lead-times', version: 'v1', title: 't', publisher: 'p', body: PAID_TEXT, spans: [{ id: 'lead-times', text: PAID_TEXT }] }
  const intent = { intentId: 'i1', runId: created.runId, profileId: 'the-fab-floor', resourceId: 'fab-lead-times', version: 'v1', amountMinor: 25, status: 'VERIFIED' as const }
  const grant = { runId: created.runId, resourceId: 'fab-lead-times', version: 'v1', intentId: 'i1', contentDigest: 'c'.repeat(64), grantedAt: '2026-10-08T00:00:00.000Z' }
  // The manifest's signed promise is what calibration checks, not the search response's relevance.
  const run = (extra: Partial<RunSnapshot> = {}): RunSnapshot => ({ ...store.getRun(created.runId), candidates: [{ ...candidate, manifest: { relevance: options.claimed ?? 0.78 } as never }], contents: [content], intents: [intent], grants: [grant], ...extra })
  return { store, reputation: new Reputation(store, { observe: options.observe }), run, runId: created.runId, candidate, content }
}

describe('trust check: the signed promise vs the same measure on the delivered article (#205, option A)', () => {
  it('measures only after a verified grant (gate 1), with the search queries and the delivered article', async () => {
    const observe = vi.fn<RelevanceObserver>(async () => 0.78)
    const { reputation, run, candidate, content } = setup({ observe })
    // No grant, or not VERIFIED (e.g. a quarantined CLAIM_FAILED delivery): nothing is measured.
    expect(await reputation.calibrate({ run: run({ grants: [] }), intentId: 'i1' })).toMatchObject({ status: 'SKIPPED' })
    expect(await reputation.calibrate({ run: run({ intents: [{ ...run().intents[0], status: 'CLAIM_FAILED' }] }), intentId: 'i1' })).toMatchObject({ status: 'SKIPPED' })
    expect(observe).not.toHaveBeenCalled()
    const result = await reputation.calibrate({ run: run({ checkpoint: { plan: { restatement: 'Lead times', subqueries: ['penang lead times', 'kestrel packaging'] } } }), intentId: 'i1' })
    expect(observe).toHaveBeenCalledTimes(1)
    expect(observe.mock.calls[0][0]).toEqual({ queries: ['penang lead times', 'kestrel packaging'], text: deliveredText(candidate, content) })
    expect(observe.mock.calls[0][0].text).toContain(PAID_TEXT)
    expect(result).toMatchObject({ status: 'RECORDED', record: { n: 1, C: 1 } })
  })
  it('an honest writer bought for a gap its article never promised keeps C near 1: the gap plays no part', async () => {
    // The delivered article re-measures to its signed promise, whatever the agent was looking for.
    const { reputation, run } = setup({ claimed: 0.59, observe: async () => 0.59 })
    const result = await reputation.calibrate({ run: run(), intentId: 'i1' })
    expect(result.status === 'RECORDED' && result.record.C).toBeCloseTo(1, 10)
  })
  it('an inflated claim that delivers a less relevant article loses C', async () => {
    const { reputation, run } = setup({ claimed: 0.96, observe: async () => 0.2 })
    const result = await reputation.calibrate({ run: run(), intentId: 'i1' })
    expect(result.status === 'RECORDED' && result.record.C).toBeCloseTo(1 - (0.96 - 0.2) ** 2, 10)
    expect(result.status === 'RECORDED' && result.record.C).toBeLessThan(0.5)
  })
  it('a failed proof records the promise as broken (observed 0) without re-measuring anything', async () => {
    const observe = vi.fn<RelevanceObserver>()
    const { reputation, store, runId } = setup({ observe })
    const after = reputation.recordProof({ publisherSlug: 'alphaleak', wallet: WALLET, outcome: 'REFUNDED', runId, claimed: 0.96 })
    expect(after).toMatchObject({ H: 0.4, n: 1, status: 'quarantined' })
    expect(after.C).toBeCloseTo(1 - 0.96 ** 2, 10)
    expect(observe).not.toHaveBeenCalled()
    expect(store.getRun(runId).events.filter(e => e.type === 'REPUTATION').at(-1)?.label).toContain('observed 0.00 (proof failed)')
    // A pass, or an outcome with no promise to check, leaves calibration alone.
    expect(reputation.recordProof({ publisherSlug: 'notft', wallet: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', outcome: 'PASS', claimed: 0.5 }).n).toBe(0)
  })
  it('is idempotent per intent: a second calibration of the same delivery changes nothing', async () => {
    const observe = vi.fn<RelevanceObserver>(async () => 0.5)
    const { reputation, run, store, runId } = setup({ observe })
    const [first, second] = await Promise.all([reputation.calibrate({ run: run(), intentId: 'i1' }), reputation.calibrate({ run: run(), intentId: 'i1' })])
    expect([first.status, second.status].sort()).toEqual(['RECORDED', 'SKIPPED'])
    expect(await reputation.calibrate({ run: run(), intentId: 'i1' })).toMatchObject({ status: 'SKIPPED', reason: 'Already calibrated.' })
    expect(reputation.get('the-fab-floor', WALLET).n).toBe(1)
    expect(store.getRun(runId).checkpoint.calibrated).toEqual(['i1'])
  })
  it('skips with a label when it cannot measure on the same scale: keyword-only search, no embedder, or an embedder failure', async () => {
    const keyword = setup({ observe: vi.fn(async () => 0.5) })
    expect(await keyword.reputation.calibrate({ run: keyword.run({ labels: { ...keyword.run().labels, search: SEARCH_LABELS[1] } }), intentId: 'i1' })).toMatchObject({ status: 'SKIPPED', reason: expect.stringContaining('keyword only') })
    const none = setup()
    expect(await none.reputation.calibrate({ run: none.run(), intentId: 'i1' })).toMatchObject({ status: 'SKIPPED', reason: expect.stringContaining('no live embedding') })
    const failing = setup({ observe: async () => { throw new Error('Workers AI down') } })
    expect(await failing.reputation.calibrate({ run: failing.run(), intentId: 'i1' })).toMatchObject({ status: 'SKIPPED', reason: expect.stringContaining('Calibration skipped') })
    expect(failing.reputation.get('the-fab-floor', WALLET).n).toBe(0)
    expect(failing.store.getRun(failing.runId).events.filter(e => e.type === 'REPUTATION').map(e => e.label).at(-1)).toContain('Calibration skipped')
  })
})

describe('cosine observer: the search embedder and the search cosineRange mapping', () => {
  it('embeds the normalised queries and the delivered text in one call; the best query wins', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(text => text === 'delivered' ? [1, 0] : text === 'penang lead times' ? at(cosFor(0.78)) : at(0.5)))
    const observed = await cosineObserver(embed)({ queries: ['  Penang  LEAD times ', 'unrelated'], text: 'delivered' })
    expect(embed).toHaveBeenCalledTimes(1)
    expect(embed.mock.calls[0][0]).toEqual(['penang lead times', 'unrelated', 'delivered'])
    expect(observed).toBeCloseTo(0.78, 10)
    expect(cosineRelevance(0.5)).toBe(0.01) // below the range: the same floor a search hit gets
    await expect(cosineObserver(async () => [[1, 0]])({ queries: ['q'], text: 't' })).rejects.toThrow()
  })
  it('reads the queries the search used: the plan sub-queries, else the question', () => {
    expect(searchQueries({ question: 'Q?', checkpoint: {} })).toEqual(['Q?'])
    expect(searchQueries({ question: 'Q?', checkpoint: { plan: { restatement: 'Q', subqueries: ['a', 'b'] } } })).toEqual(['a', 'b'])
  })
})
