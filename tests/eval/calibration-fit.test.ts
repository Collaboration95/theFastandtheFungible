// #207 + #212: the production-path harness (`offline.ts --decision production`, the requested-fact flow and the
// calibration sweep), the per-candidate dataset and `npm run calibration:fit`. Mocks only: no network, no live flag.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { activeCalibrator, CalibratorSchema } from '../../server/agents/calibration.js'
import { OpenAIDecisionsProvider } from '../../server/agents/openai-decisions.js'
import { ClefDecisionProvider } from '../../server/agents/clef.js'
import { DATASET_SCHEMA, readJsonl, writeJsonl, type DatasetRow } from '../../eval/decisions/dataset.js'
import { fitDataset, fitKey, proposeThreshold, purchaseMetrics } from '../../eval/decisions/fit-calibration.js'
import { evaluateBank, forceFixtureResearch, planProduction, requestsPerRound, sweepBank } from '../../eval/decisions/offline.js'
import { countingFetch, harnessFetch, productionProvider } from '../../eval/decisions/providers/production.js'
import { setTransport } from '../../eval/decisions/transport.js'
import { loadWorld, type World } from '../../eval/decisions/world.js'

const out = mkdtempSync(join(tmpdir(), 'tftf-calibration-fit-'))
const realFetch = globalThis.fetch
let world: World
let network = 0
beforeAll(async () => { forceFixtureResearch(); process.env.EVAL_OUT = join(out, 'eval-out'); globalThis.fetch = (async () => { network++; throw new Error('network forbidden') }) as typeof fetch; world = await loadWorld() })
afterEach(() => { vi.unstubAllEnvs(); setTransport(undefined) })
afterAll(() => { delete process.env.EVAL_OUT; globalThis.fetch = realFetch; rmSync(out, { recursive: true, force: true }); expect(network).toBe(0) })

describe('the production decision provider in the harness (#212)', () => {
  it('is built from DECISION_PROVIDER with the demo env, and never holds a real key', () => {
    expect(() => productionProvider({ env: {} })).toThrow(/DECISION_PROVIDER=openai or DECISION_PROVIDER=cloudflare/)
    const openai = productionProvider({ env: { DECISION_PROVIDER: 'openai' }, fetch: countingFetch().fetch })
    expect(openai).toBeInstanceOf(OpenAIDecisionsProvider)
    expect(openai).toMatchObject({ name: 'openai', model: 'gpt-6-luna', arm: 'luna', promptVersion: new OpenAIDecisionsProvider().promptVersion })
    vi.stubEnv('DECISIONS_WORDING', 'production')
    expect(productionProvider({ env: { DECISION_PROVIDER: 'openai' } }).promptVersion).toMatch(/^batch-production\/v1/)
    const clef = productionProvider({ env: { DECISION_PROVIDER: 'cloudflare' }, fetch: countingFetch().fetch })
    expect(clef).toBeInstanceOf(ClefDecisionProvider)
    expect(clef).toMatchObject({ name: 'cloudflare', model: '@cf/cloudflare/clef-flash', arm: 'flash' })
  })
  it('sends the provider’s exact request body through the opt-in transport', async () => {
    const bodies: unknown[] = []
    setTransport((async (_url: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return countingFetch().fetch('', init) }) as typeof fetch)
    vi.stubEnv('DECISION_PROVIDER', 'openai')
    const provider = productionProvider({ fetch: harnessFetch('luna', 'test') })
    const report = await sweepBank({ provider, ids: ['Q09'], world })
    expect(report.dataset.length).toBeGreaterThan(0)
    expect(bodies.length).toBeGreaterThan(0)
    expect(bodies[0]).toMatchObject({ model: 'gpt-6-luna' })
    expect(JSON.stringify(bodies)).not.toContain('gap_material')
  })
})

describe('the requested-fact flow and the calibration sweep (#207, #221)', () => {
  it('flow: each round judges a frozen requested fact with gap_material 1; dataset rows carry raw scores and labels', async () => {
    vi.stubEnv('DECISION_PROVIDER', 'openai')
    const stub = countingFetch()
    const dataset: DatasetRow[] = []
    const report = await evaluateBank({ provider: productionProvider({ fetch: stub.fetch }), ids: ['Q01', 'Q09', 'Q18'], world, flow: 'requested', paidRelevance: false, dataset })
    const by = Object.fromEntries(report.results.map(r => [r.id, r]))
    // UC1: the free reads answer both facts: one round with an empty gap, no model call, nothing bought.
    expect(by.Q01.rounds).toEqual([expect.objectContaining({ round: 1, gap: '', selected: null })])
    expect(by.Q01.stop).toBe('complete')
    // UC2: the open fact is the frozen requirement text, and a follow-up search ran before round 1.
    const q09 = report.results.find(r => r.id === 'Q09')!
    expect(q09.followUp).toBeDefined()
    expect(q09.rounds[0].factId).toMatch(/^Q09\./)
    expect(dataset.length).toBeGreaterThan(0)
    for (const row of dataset) {
      expect(row).toMatchObject({ schema: DATASET_SCHEMA, mode: 'flow', provider: 'openai', model: 'gpt-6-luna', gapMaterial: 1 })
      expect(row.promptVersion).toMatch(/^batch-evidence\/v1\+gap-plain/)
    }
    // No gap_material question is ever sent for a requested fact.
    expect(stub.calls.length).toBeGreaterThan(0)
    expect(report.labels.coverage).toMatch(/scripted/)
  })
  it('sweep: one round per requested fact, exact call count, labels from the bank', async () => {
    vi.stubEnv('DECISION_PROVIDER', 'openai')
    vi.stubEnv('DECISIONS_MAX_QUESTIONS', '25')
    const stub = countingFetch()
    const provider = productionProvider({ fetch: stub.fetch })
    const sweep = await sweepBank({ provider, ids: ['Q01', 'Q09', 'Q18'], world })
    const facts = sweep.questions.flatMap(q => q.facts)
    expect(facts.length).toBe(2 + 2 + 1)
    expect(stub.calls.length).toBe(facts.reduce((s, f) => s + requestsPerRound(provider, f.paid), 0))
    const notft = sweep.dataset.filter(r => r.factId === 'Q09.margin' && r.resourceId === 'notft-kestrel-tsmc-deal-margins')
    expect(notft[0]?.labels).toEqual({ addressesGap: 1, original: 1, buy: 1 })
    const digest = sweep.dataset.find(r => r.questionId === 'Q09' && r.resourceId === 'mp-kestrel-deal-digest')
    if (digest) expect(digest.labels.original).toBe(0)
    // Free sources answer UC1's facts: closed facts never count as buys, and the avoid list is negative.
    for (const row of sweep.dataset.filter(r => r.questionId === 'Q01')) expect(row.labels.buy).toBe(0)
    const plan = await planProduction({ ids: ['Q01', 'Q09', 'Q18'], sweep: true, world })
    expect(plan).toMatchObject({ mode: 'sweep', exactCalls: stub.calls.length, facts: 5, datasetRows: sweep.dataset.length })
    const flow = await planProduction({ ids: ['Q01', 'Q09', 'Q18'], sweep: false, world }) as { minCalls: number; maxCalls: number; stubRunCalls: number }
    expect(flow.minCalls).toBeLessThanOrEqual(flow.stubRunCalls)
    expect(flow.stubRunCalls).toBeLessThanOrEqual(flow.maxCalls)
  })
})

const row = (over: Partial<DatasetRow> & { y: 0 | 1; p: number; q: string }): DatasetRow => ({
  schema: DATASET_SCHEMA, questionId: over.q, family: over.family ?? `f${Number(over.q.slice(1)) % 4}`, kind: 'paid-needed', factId: `${over.q}.a`, factOpen: true, gap: 'g', round: 1, mode: 'sweep',
  resourceId: over.resourceId ?? `${over.q}-${over.y}-${over.p}`, publisherSlug: 'w', priceMinor: 30, provider: 'openai', model: 'gpt-6-luna', promptVersion: 'pv-test',
  addressesGap: over.p, originality: { original: 0.9, rewrite: 0.05, overlap: 0.05 }, credibility: 2, gapMaterial: 1, value: over.p * 0.9, verdict: 'SKIP_LOW_VALUE', threshold: 0.2,
  labels: { addressesGap: over.y, original: 1, buy: over.y }, labelSource: over.y ? 'sources' : 'other', unknown: false,
})
/** A model that is right but over-confident in the wrong place: positives score 0.12–0.18 raw, negatives 0.02–0.3. */
function syntheticDataset(): DatasetRow[] {
  const rows: DatasetRow[] = []
  for (let i = 0; i < 40; i++) {
    const q = `Q${String(i + 10).padStart(2, '0')}`
    rows.push(row({ q, y: 1, p: 0.12 + (i % 7) * 0.01 }))
    rows.push(row({ q, y: 0, p: 0.02 + (i % 5) * 0.01 }))
    if (i % 4 === 0) rows.push(row({ q, y: 0, p: 0.3, resourceId: `${q}-decoy` }))
  }
  return rows
}

describe('npm run calibration:fit (#207)', () => {
  it('purchase metrics select per decision like policy: best value per dollar at or above the threshold', () => {
    const units = [{ rows: [row({ q: 'Q01', y: 1, p: 0.5 }), row({ q: 'Q01', y: 0, p: 0.4 })] }, { rows: [row({ q: 'Q02', y: 0, p: 0.3 })] }]
    const values = new Map(units.flatMap(u => u.rows).map(r => [r, r.addressesGap]))
    expect(purchaseMetrics(units, values, 0.35)).toMatchObject({ tp: 1, fp: 0, fn: 0, f1: 1 })
    expect(purchaseMetrics(units, values, 0.2)).toMatchObject({ tp: 1, fp: 1, wastedMinor: 30 })
    expect(proposeThreshold(units, values).threshold).toBeGreaterThan(0.3)
  })
  it('fits by grouped CV, beats raw at the raw threshold, and writes a versioned calibrator plus a report', () => {
    const rows = syntheticDataset()
    const fit = fitKey({ provider: 'openai', model: 'gpt-6-luna', promptVersion: 'pv-test' }, rows)
    expect(fit.sample).toMatchObject({ rows: rows.length, groups: 4, grouping: 'family', folds: 4 })
    expect(fit.methods.addressesGap).not.toBe('identity')
    expect(fit.cvBrier.addressesGap[fit.methods.addressesGap]!).toBeLessThan(fit.cvBrier.addressesGap.identity!)
    expect(fit.purchase.calibrated.f1).toBeGreaterThan(fit.purchase.raw.f1)
    expect(fit.accepted).toBe(true)

    const data = writeJsonl(join(out, 'dataset.jsonl'), rows)
    const calDir = join(out, 'calibration'), reportDir = join(out, 'reports')
    const [first] = fitDataset({ data, outDir: calDir, reportDir, now: '2026-10-09T00:00:00.000Z' })
    const calibrator = CalibratorSchema.parse(JSON.parse(readFileSync(first.file!, 'utf8')))
    expect(calibrator).toMatchObject({ version: 1, key: { provider: 'openai', model: 'gpt-6-luna', promptVersion: 'pv-test' }, buyThreshold: fit.purchase.calibrated.threshold, data: { rows: rows.length, groups: 4 } })
    expect(readFileSync(first.report, 'utf8')).toMatch(/Calibrated \(out of fold\), proposed threshold/)
    expect(readJsonl<DatasetRow>(data)).toHaveLength(rows.length)
    // A refit bumps the version; decide() would load it only for this exact key with the flag on.
    expect(fitDataset({ data, outDir: calDir, reportDir })[0].file).toBe(first.file)
    expect(CalibratorSchema.parse(JSON.parse(readFileSync(first.file!, 'utf8'))).version).toBe(2)
    expect(activeCalibrator({ name: 'openai', model: 'gpt-6-luna', promptVersion: 'pv-test' }, { DECISION_CALIBRATION: 'on', DECISION_CALIBRATION_DIR: calDir })?.version).toBe(2)
    expect(activeCalibrator({ name: 'openai', model: 'gpt-6-luna', promptVersion: 'pv-other' }, { DECISION_CALIBRATION: 'on', DECISION_CALIBRATION_DIR: calDir })).toBeUndefined()
  })
  it('refuses to write a calibrator it cannot validate, unless forced', () => {
    // Every fact already answered by free reads: no open-fact decision to tune or check a threshold on.
    const rows = syntheticDataset().map(r => ({ ...r, factOpen: false }))
    const data = writeJsonl(join(out, 'closed.jsonl'), rows)
    const calDir = join(out, 'refused')
    const [result] = fitDataset({ data, outDir: calDir, reportDir: join(out, 'reports') })
    expect(result.fit.accepted).toBe(false)
    expect(result.fit.reasons).toContain('no open-fact decision units to tune a threshold on')
    expect(result.file).toBeNull()
    expect(existsSync(calDir)).toBe(false)
    expect(readFileSync(result.report, 'utf8')).toMatch(/Not accepted/)
    const forced = fitDataset({ data, outDir: calDir, reportDir: join(out, 'reports'), force: true })[0]
    expect(JSON.parse(readFileSync(forced.file!, 'utf8'))).toMatchObject({ accepted: false, forcedDespite: result.fit.reasons })
  })
})
