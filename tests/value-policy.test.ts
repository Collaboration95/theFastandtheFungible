import { describe, expect, it, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { signManifest } from '../shared/manifest.js'
import { simulatedKeys } from '../publisher/registry.js'
import { marginalValue, activeValueFit } from '../server/agents/value-policy.js'
import { decide, type DecisionProvider } from '../server/agents/decision.js'
import { candidateOf, contentOf, loadWorld } from '../eval/decisions/world.js'
import { signedFactMenu } from '../server/agents/clef.js'
import { fitReceiptValue } from '../eval/decisions/fit-calibration.js'
import { receiptTarget, refit } from '../scripts/refit-receipt-value.js'
import type { LabelRow } from '../scripts/export-decision-labels.js'
afterEach(() => vi.unstubAllEnvs())

async function example() {
  const world = await loadWorld()
  const article = world.articles.get('notft-kestrel-tsmc-deal-margins')!
  return { candidate: candidateOf(world, article), content: contentOf(world, article) }
}
describe('marginal fact policy', () => {
  it('vetoes a signed menu fully covered by accessible passages, never by another ungranted menu', async () => {
    const { candidate, content } = await example()
    expect(signedFactMenu(candidate).length).toBeGreaterThan(0)
    expect(marginalValue({ candidate, evidence: [content], probability: 1, trust: 1 })).toMatchObject({ novelty: 0, expectedFacts: 0, eligible: false })
    expect(marginalValue({ candidate, evidence: [], probability: 1, trust: 1 })).toMatchObject({ novelty: 1, eligible: true })
    const forged = { ...candidate, version: 'forged' }
    expect(marginalValue({ candidate: forged, evidence: [content], probability: 1, trust: 1 }).menuEntries).toBe(0)
  })
  it('does not confuse an explicit absence with a measurement elsewhere in the paragraph', async () => {
    const { candidate, content } = await example()
    const keys = simulatedKeys(candidate.publisherSlug!)
    const menu = signManifest({ ...candidate.manifest!, claims: [{ ...candidate.manifest!.claims[0], covers: { entity: 'Kestrel', measure: 'gross margin', period: 'twenty twenty seven' } }] }, keys.privateKey)
    const c = { ...candidate, manifest: menu }
    const evidence = (text: string) => [{ ...content, resourceId: 'free-record', spans: [{ id: 'p1', text }] }]
    expect(marginalValue({ candidate: c, evidence: evidence('Kestrel commissioned a plant in 2027 at 92 percent capacity. The record states no gross margin.'), probability: 1, trust: 1 }).novelty).toBe(1)
    expect(marginalValue({ candidate: c, evidence: evidence('Kestrel gross margin in 2027 was 55 percent.'), probability: 1, trust: 1 }).novelty).toBe(0)
    expect(marginalValue({ candidate: c, evidence: evidence('Kestrel gross margin in 2026 was 55 percent.'), probability: 1, trust: 1 }).novelty).toBe(1)
  })
  it('uses price and trust, caps one round to one expected fact, and handles zero price finitely', async () => {
    const { candidate } = await example()
    const input = { candidate, evidence: [], probability: 0.6, trust: 0.8 }
    const expensive = marginalValue({ ...input, candidate: { ...candidate, price: { ...candidate.price, amountMinor: 200 } } })
    expect(expensive.eligible).toBe(false)
    expect(expensive.expectedFacts).toBeCloseTo(0.48)
    const free = marginalValue({ ...input, candidate: { ...candidate, price: { ...candidate.price, amountMinor: 0 } } })
    expect(Number.isFinite(free.factsPerDollar)).toBe(true)
    expect(marginalValue({ ...input, trust: 0 }).eligible).toBe(false)
  })
  it('all-high model scores cannot override coverage, budget or reservations', async () => {
    const { candidate, content } = await example()
    const provider: DecisionProvider = { name: 'fixture', model: 'test', judgeRound: async () => ({ gapMaterial: 1 }), judgeCandidate: async () => ({ addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }) }
    const input = { question: 'Requested fact', conclusion: '', gap: 'Requested fact', requirement: true, candidates: [candidate], readSources: [], budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, provider }
    const covered = await decide({ ...input, accessibleEvidence: [content] })
    expect(covered.selectedResourceId).toBeUndefined()
    expect(covered.rows[0].reason).toContain('covered menu entries')
    expect((await decide({ ...input, accessibleEvidence: [], budgetMinor: 0 })).selectedResourceId).toBeUndefined()
    expect((await decide({ ...input, accessibleEvidence: [], reservedMinor: 200 })).selectedResourceId).toBeUndefined()
    expect((await decide({ ...input, accessibleEvidence: [] })).selectedResourceId).toBe(candidate.resourceId)
  })
  it('only loads an accepted map for the exact provider/model/prompt key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'receipt-fit-'))
    try {
      const file = join(dir, 'fit.json'); vi.stubEnv('DECISION_VALUE_FIT', file)
      writeFileSync(file, JSON.stringify({ schema: 'tftf.receipt-value/v1', version: 1, key: { provider: 'openai', model: 'm', promptVersion: 'p' }, model: { method: 'identity' }, minFactsPerDollar: 1, accepted: true, data: { sha256: 'x', rows: 20, groups: 5 } }))
      expect(activeValueFit({ name: 'openai', model: 'm', promptVersion: 'p' })?.version).toBe(1)
      expect(activeValueFit({ name: 'openai', model: 'm', promptVersion: 'next' })).toBeUndefined()
      writeFileSync(file, '{}')
      expect(activeValueFit({ name: 'openai', model: 'm', promptVersion: 'p' })).toBeUndefined()
    } finally { rmSync(dir, { recursive: true }) }
  })
})
describe('receipt learning', () => {
  it('rejects insufficient data and evaluates separate question groups', () => {
    expect(fitReceiptValue([]).accepted).toBe(false)
    const rows = Array.from({ length: 30 }, (_, i) => ({ questionId: `Q${i % 5}`, p: i % 2 ? 0.9 : 0.1, y: (i % 2) as 0 | 1, priceMinor: 25, trust: 0.8 }))
    const fit = fitReceiptValue(rows)
    expect(fit.accepted).toBe(true)
    expect(fit.receiptFilter.fp).toBe(0)
  })
  it('refuses a held-out report before it can fit or write a map', () => {
    const dir = mkdtempSync(join(tmpdir(), 'receipt-heldout-'))
    try {
      const file = join(dir, 'heldout.json')
      writeFileSync(file, JSON.stringify({ scorecard: { split: 'heldout' } }))
      expect(() => refit({ flowReport: file, out: join(dir, 'map.json') })).toThrow('dev reports only')
    } finally { rmSync(dir, { recursive: true }) }
  })
  it('never learns a positive from unresolved delivery, citation alone or uncharged intent', () => {
    const base = { charged: true, status: 'VERIFIED', reanswer: { determinable: true, gainedSupportedFact: true, citesPurchased: true } } as LabelRow
    expect(receiptTarget(base)).toBe(1)
    expect(receiptTarget({ ...base, charged: false })).toBeNull()
    expect(receiptTarget({ ...base, status: 'CHALLENGED' })).toBeNull()
    expect(receiptTarget({ ...base, status: 'REFUNDED' })).toBe(0)
    expect(receiptTarget({ ...base, reanswer: { ...base.reanswer, citesPurchased: false } })).toBe(0)
    expect(receiptTarget({ ...base, reanswer: { ...base.reanswer, determinable: false } })).toBeNull()
  })
})
