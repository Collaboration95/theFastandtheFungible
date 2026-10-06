import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Reputation } from '../server/reputation.js'
import { Store } from '../server/store.js'
import { FixtureDecisionProvider } from '../server/agents/decision.js'
import { ClefDecisionProvider } from '../server/agents/clef.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import type { ContentEnvelope, RunSnapshot } from '../shared/contracts/index.js'

const WALLET = 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp'
const PAID_TEXT = 'Penang lead times fell from 14 weeks in June 2026 to 9 weeks in September 2026.'
const cleanups: (() => void)[] = []
afterEach(() => { for (const fn of cleanups.splice(0).reverse()) fn(); vi.restoreAllMocks() })

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'calibration-'))
  const store = new Store(join(dir, 'app.db'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }), () => store.close())
  const created = store.createRun('Are lead times getting shorter?', 200)
  const candidate = { ...exampleCandidate, profileId: 'the-fab-floor', publisherSlug: 'the-fab-floor', resourceId: 'fab-lead-times', tier: 'PAID' as const, wallet: WALLET, relevance: 1, price: { amountMinor: 25, currency: 'SGD' as const } }
  const content: ContentEnvelope = { profileId: 'the-fab-floor', resourceId: 'fab-lead-times', version: 'v1', title: 't', publisher: 'p', body: PAID_TEXT, spans: [{ id: 'lead-times', text: PAID_TEXT }] }
  const intent = { intentId: 'i1', runId: created.runId, profileId: 'the-fab-floor', resourceId: 'fab-lead-times', version: 'v1', amountMinor: 25, status: 'VERIFIED' as const }
  const grant = { runId: created.runId, resourceId: 'fab-lead-times', version: 'v1', intentId: 'i1', contentDigest: 'c'.repeat(64), grantedAt: '2026-10-08T00:00:00.000Z' }
  // The manifest's promise (0.78) is what calibration checks, not the search response's normalised relevance.
  const run = (extra: Partial<RunSnapshot> = {}): RunSnapshot => ({ ...created, candidates: [{ ...candidate, manifest: { relevance: 0.78 } as never }], contents: [content], intents: [intent], grants: [grant], ...extra })
  return { store, reputation: new Reputation(store), run, runId: created.runId }
}
const gap = 'No accessible dated figures for lead times in weeks, or their trend.'

describe('calibration re-score after a verified purchase (#141)', () => {
  it('scores the paid body only after the grant exists (gate 1), then updates C', async () => {
    const { reputation, run } = setup()
    const provider = new FixtureDecisionProvider()
    const judge = vi.spyOn(provider, 'judgePaidRelevance')
    // No grant, or not VERIFIED (e.g. a quarantined CLAIM_FAILED delivery): no model call.
    expect(await reputation.calibrate({ run: run({ grants: [] }), intentId: 'i1', question: 'q', gap, provider })).toMatchObject({ status: 'SKIPPED' })
    expect(await reputation.calibrate({ run: run({ intents: [{ ...run().intents[0], status: 'CLAIM_FAILED' }] }), intentId: 'i1', question: 'q', gap, provider })).toMatchObject({ status: 'SKIPPED' })
    expect(judge).not.toHaveBeenCalled()
    const result = await reputation.calibrate({ run: run(), intentId: 'i1', question: 'q', gap, provider })
    expect(judge).toHaveBeenCalledTimes(1)
    // Fixture: word overlap of the gap (lead, times, weeks, trend) with the body → 1.
    expect(result).toMatchObject({ status: 'RECORDED', record: { n: 1 } })
    if (result.status === 'RECORDED') expect(result.record.C).toBeCloseTo(1 - (0.78 - 1) ** 2, 10)
  })
  it('sends Clef the granted passages, and a Clef failure skips the update with a label', async () => {
    const { reputation, run, store, runId } = setup()
    const bodies: string[] = []
    const ok = new ClefDecisionProvider({ accountId: 'a', token: 't', fetch: async (_url, init) => { bodies.push(String(init?.body)); return Response.json({ success: true, result: { answers: { addresses_gap: { type: 'noul', noul: 0.7 } } } }) } })
    const recorded = await reputation.calibrate({ run: run(), intentId: 'i1', question: 'q', gap, provider: ok })
    expect(JSON.parse(bodies[0]).state.passages).toEqual([PAID_TEXT])
    if (recorded.status === 'RECORDED') expect(recorded.record.C).toBeCloseTo(1 - (0.78 - 0.7) ** 2, 10)
    else throw new Error('expected a calibration record')
    const failing = new ClefDecisionProvider({ accountId: 'a', token: 't', timeoutMs: 50, fetch: async () => new Response('', { status: 400 }) })
    expect(await reputation.calibrate({ run: run(), intentId: 'i1', question: 'q', gap, provider: failing })).toMatchObject({ status: 'SKIPPED', reason: expect.stringContaining('Clef unavailable') })
    expect(reputation.get('the-fab-floor', WALLET).n).toBe(1)
    expect(store.getRun(runId).events.filter(e => e.type === 'REPUTATION').map(e => e.label).at(-1)).toContain('Calibration skipped')
  })
})
