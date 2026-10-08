// #207: the calibration layer in decide(). OFF by default; applied only with DECISION_CALIBRATION=on and a calibrator
// for the exact (provider, model, prompt version). The story-bible use cases hold with it off and with a planted
// calibrator on, which lifts every P(original) to 0.99 (the failure the synthetic calibrators had): the rewrite guard
// reads the RAW originality, so the MarketPulse digests are never bought.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import type { ContentEnvelope, PublicCandidate } from '../shared/contracts/index.js'
import { DecisionRoundSchema, decisionLabel } from '../shared/contracts/index.js'
import { decide, FixtureDecisionProvider } from '../server/agents/decision.js'
import { activeCalibrator, CALIBRATOR_SCHEMA, calibratorFileName, loadCalibrators, type Calibrator } from '../server/agents/calibration.js'
import { writeAnswer } from '../server/agents/research.js'

type BibleArticle = { articleId: string; publisherSlug: string; tier: 'FREE' | 'PAID'; priceMinor: number; family: string; derivedFrom?: string; title: string; tags: string[]; facts: { text: string }[]; expectedRelevance?: number }
type UseCase = { id: string; question: string; articles: BibleArticle[]; expectedPicks: { round1: string | null; round2: string | null; skippedRewrite: string | null; wouldHaveBought?: string } }
const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { useCases: UseCase[] }
const authority = (slug: string) => ({ records: 2, masthead: 1.5, independent: 1 } as Record<string, number>)[(JSON.parse(readFileSync(`data/writers/${slug}.json`, 'utf8')) as { publisher: { kind: string } }).publisher.kind]
const candidate = (a: BibleArticle): PublicCandidate => ({
  profileId: a.publisherSlug, resourceId: a.articleId, version: 'v1', title: a.title, publisher: a.publisherSlug, preview: a.title, price: { amountMinor: a.priceMinor, currency: 'SGD' },
  family: a.family, ...(a.derivedFrom ? { derivedFrom: a.derivedFrom } : {}), facets: a.tags, authority: authority(a.publisherSlug), tier: a.tier,
  license: { kind: 'SYNTHETIC', attribution: a.publisherSlug }, publisherSlug: a.publisherSlug, relevance: a.expectedRelevance ?? 0.5,
})
const content = (a: BibleArticle): ContentEnvelope => ({ profileId: a.publisherSlug, resourceId: a.articleId, version: 'v1', title: a.title, publisher: a.publisherSlug, body: a.facts.map(f => f.text).join(' '), spans: a.facts.map((f, i) => ({ id: `p${i}`, text: f.text })) })
async function round(id: string, options: { bought?: string[]; budgetMinor?: number; gap?: string } = {}) {
  const useCase = bible.useCases.find(u => u.id === id)!
  const candidates = useCase.articles.map(candidate)
  const contents = useCase.articles.filter(a => a.tier === 'FREE' && a.facts.length).map(content)
  const { answer } = await writeAnswer({ question: useCase.question, candidates, contents, version: 1 })
  const gap = options.gap ?? answer.openGaps[0]?.text ?? ''
  const decision = await decide({ question: useCase.question, conclusion: answer.conclusion, gap, candidates, readSources: candidates.filter(c => c.tier === 'FREE'), budgetMinor: options.budgetMinor ?? 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, boughtResourceIds: options.bought ?? [] })
  return { useCase, decision, verdict: (resourceId: string) => decision.rows.find(r => r.candidate.resourceId === resourceId)?.verdict }
}
const fixtureKey = { provider: 'fixture' as const, model: 'metadata-fixture', promptVersion: 'unversioned' }
/** Lifts every P(original) to 0.99 (isotonic, constant); P(addresses gap) unchanged. */
const planted = (overrides: Partial<Calibrator> = {}): Calibrator => ({
  schema: CALIBRATOR_SCHEMA, version: 3, key: fixtureKey, addressesGap: { method: 'identity' }, original: { method: 'isotonic', knots: [0.01, 0.99], values: [0.99, 0.99] },
  buyThreshold: 0.2, fittedAt: '2026-10-09T00:00:00.000Z', data: { file: 'planted', sha256: 'none', rows: 0, groups: 0, grouping: 'family' }, ...overrides,
})
const dir = mkdtempSync(join(tmpdir(), 'tftf-calibration-'))
const plant = (c: Calibrator) => writeFileSync(join(dir, calibratorFileName(c.key)), JSON.stringify(c))
const turnOn = () => { vi.stubEnv('DECISION_CALIBRATION', 'on'); vi.stubEnv('DECISION_CALIBRATION_DIR', dir) }
afterEach(() => { vi.unstubAllEnvs(); for (const c of loadCalibrators(dir)) rmSync(join(dir, calibratorFileName(c.key)), { force: true }) })
afterAll(() => rmSync(dir, { recursive: true, force: true }))

async function story() {
  const uc1 = await round('UC1'), uc2 = await round('UC2'), uc3a = await round('UC3')
  const uc3b = await round('UC3', { bought: [uc3a.useCase.expectedPicks.round1!] })
  const uc4 = bible.useCases.find(u => u.id === 'UC4')!
  // UC4 after the free follow-up: every requested fact is answered, so nothing is open and nothing is bought.
  const uc4Answered = await round('UC4', { gap: '' })
  // UC4 at S$0 with the renewable-share fact still open: the deep-dive is at most a would-buy row, never bought.
  const uc4Zero = await round('UC4', { gap: 'How much of its electricity comes from renewable sources', budgetMinor: 0 })
  return { uc1, uc2, uc3a, uc3b, uc4, uc4Answered, uc4Zero }
}

describe('calibration layer in decide() (#207)', () => {
  it('off by default: UC1–UC4 keep the story verdicts and rounds carry raw scores only', async () => {
    plant(planted())
    vi.stubEnv('DECISION_CALIBRATION_DIR', dir)
    const { uc1, uc2, uc3a, uc3b, uc4, uc4Answered, uc4Zero } = await story()
    expect(uc1.decision.selectedResourceId).toBeUndefined()
    expect(uc1.verdict(uc1.useCase.expectedPicks.skippedRewrite!)).toBe('SKIP_REWRITE')
    expect(uc2.decision.selectedResourceId).toBe(uc2.useCase.expectedPicks.round1)
    expect(uc2.verdict(uc2.useCase.expectedPicks.skippedRewrite!)).toBe('SKIP_REWRITE')
    expect(uc3a.decision.selectedResourceId).toBe(uc3a.useCase.expectedPicks.round1)
    expect(uc3b.decision.selectedResourceId).toBe(uc3a.useCase.expectedPicks.round2)
    expect(uc4Answered.decision.selectedResourceId).toBeUndefined()
    expect(uc4Zero.decision.selectedResourceId).toBeUndefined()
    expect(uc4Answered.verdict(uc4.expectedPicks.wouldHaveBought!)).toBe('SKIP_NO_GAP')
    for (const { decision } of [uc1, uc2, uc3a, uc3b, uc4Answered, uc4Zero]) {
      expect(decision.calibration).toBeUndefined()
      expect(decision.rows.every(r => r.calibrated === undefined)).toBe(true)
      expect(decisionLabel(decision)).toBe('fixture · metadata-fixture')
    }
  })

  it('on with a planted calibrator: the rewrite is never bought, UC2 buys NotFT, UC3 buys AlphaLeak then The Fab Floor', async () => {
    plant(planted())
    turnOn()
    const { uc1, uc2, uc3a, uc3b, uc4Answered, uc4Zero } = await story()
    for (const uc of [uc1, uc2, uc3a]) {
      const rewrite = uc.useCase.expectedPicks.skippedRewrite!
      expect(uc.verdict(rewrite)).toBe('SKIP_REWRITE')
      expect(uc.decision.selectedResourceId).not.toBe(rewrite)
      // The guard read raw originality: the calibrated P(original) of the rewrite is 0.99 when a model was asked.
      const row = uc.decision.rows.find(r => r.candidate.resourceId === rewrite)!
      if (uc.decision.gap) expect(row.calibrated?.original).toBeCloseTo(0.99, 10)
      expect(row.judgment.originality.rewrite).toBeGreaterThanOrEqual(row.judgment.originality.original)
    }
    expect(uc1.decision.selectedResourceId).toBeUndefined()
    expect(uc2.decision.selectedResourceId).toBe(uc2.useCase.expectedPicks.round1)
    expect(uc3a.decision.selectedResourceId).toBe(uc3a.useCase.expectedPicks.round1)
    expect(uc3b.decision.selectedResourceId).toBe(uc3a.useCase.expectedPicks.round2)
    expect(uc3b.decision.rows.filter(r => r.verdict === 'BUY').map(r => r.candidate.resourceId)).not.toContain(uc3a.useCase.expectedPicks.skippedRewrite)
    expect(uc4Answered.decision.selectedResourceId).toBeUndefined()
    expect(uc4Zero.decision.selectedResourceId).toBeUndefined()
    // Raw and calibrated both recorded; value uses the calibrated pair; the round names the calibrator (gate 5).
    const notft = uc2.decision.rows.find(r => r.candidate.resourceId === uc2.useCase.expectedPicks.round1)!
    expect(notft.calibrated?.addressesGap).toBe(notft.judgment.addressesGap)
    expect(notft.calibrated?.original).toBeCloseTo(0.99, 10)
    expect(notft.value).toBeCloseTo(uc2.decision.gapMaterial * notft.judgment.addressesGap * 0.99 * (0.5 + 0.25 * notft.judgment.credibility), 10)
    expect(uc2.decision.calibration).toMatchObject({ version: 3, methods: { addressesGap: 'identity', original: 'isotonic' } })
    expect(decisionLabel(uc2.decision)).toBe('fixture · metadata-fixture · calibrated v3')
    expect(DecisionRoundSchema.parse(JSON.parse(JSON.stringify(uc2.decision)))).toEqual(uc2.decision)
    // An empty gap asks no model, so no calibrator runs (UC1, UC4 answered).
    expect(uc1.decision.calibration).toBeUndefined()
  })

  it('the calibrated threshold applies only to calibrated values; an explicit threshold still wins', async () => {
    plant(planted({ buyThreshold: 0.99 }))
    turnOn()
    const strict = await round('UC2')
    expect(strict.decision.threshold).toBe(0.99)
    expect(strict.decision.selectedResourceId).toBeUndefined()
    // BUY_THRESHOLD is on the raw scale and never replaces the calibrator's.
    vi.stubEnv('BUY_THRESHOLD', '0.01')
    expect((await round('UC2')).decision.threshold).toBe(0.99)
    vi.unstubAllEnvs()
    expect((await round('UC2')).decision.threshold).toBe(0.2)
  })

  it('applies only to the exact (provider, model, prompt version), the latest version, and never when off', () => {
    plant(planted())
    plant(planted({ version: 1, key: { ...fixtureKey, promptVersion: 'other wording' } }))
    writeFileSync(join(dir, 'broken.json'), '{"schema":"nope"}')
    const fixture = new FixtureDecisionProvider()
    expect(activeCalibrator(fixture, { DECISION_CALIBRATION_DIR: dir })).toBeUndefined()
    expect(activeCalibrator(fixture, { DECISION_CALIBRATION: '1', DECISION_CALIBRATION_DIR: dir })).toBeUndefined()
    expect(activeCalibrator(fixture, { DECISION_CALIBRATION: 'on', DECISION_CALIBRATION_DIR: dir })?.version).toBe(3)
    expect(activeCalibrator({ name: 'fixture', model: 'metadata-fixture', promptVersion: 'other wording' }, { DECISION_CALIBRATION: 'on', DECISION_CALIBRATION_DIR: dir })?.version).toBe(1)
    expect(activeCalibrator({ name: 'openai', model: 'gpt-6-luna', promptVersion: 'batch-evidence/v1' }, { DECISION_CALIBRATION: 'on', DECISION_CALIBRATION_DIR: dir })).toBeUndefined()
    expect(activeCalibrator(fixture, { DECISION_CALIBRATION: 'on', DECISION_CALIBRATION_DIR: join(dir, 'missing') })).toBeUndefined()
    rmSync(join(dir, 'broken.json'))
  })
})
