// #203: the offline eval (npm run eval:decisions) compares free-only with with-purchase answers in fixture
// mode, in process, with no network. Assertions stay tolerant of the corpus PR (#198, #204).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { evaluateBank, forceFixtureResearch, summarize } from '../../eval/decisions/offline.js'

const realFetch = globalThis.fetch
let attempts = 0
beforeAll(() => { forceFixtureResearch(); globalThis.fetch = (async () => { attempts++; throw new Error('network forbidden in the offline eval') }) as typeof fetch })
afterAll(() => { globalThis.fetch = realFetch })

describe('offline decision eval (#203)', () => {
  it('scores free-only against with-purchase answers on the use cases and an unanswerable question', async () => {
    const report = await evaluateBank({ ids: ['Q01', 'Q09', 'Q18', 'Q42'] })
    const by = Object.fromEntries(report.results.map(r => [r.id, r]))
    expect(report.labels.settlement).toMatch(/SIMULATED/)
    expect(report.labels.search).toMatch(/keyword only/)
    // UC1: free sources answer what changed; nothing is bought.
    expect(by.Q01.free.supported).toContain('Q01.rate')
    expect(by.Q01.spentMinor).toBe(0)
    // UC2: the NotFT piece is bought and the re-answer gains the analyst facts.
    expect(by.Q09.free.supported).toEqual([])
    expect(by.Q09.purchases[0]?.resourceId).toBe('notft-kestrel-tsmc-deal-margins')
    expect(by.Q09.final.supported).toContain('Q09.margin')
    // UC3: any AlphaLeak purchase fails its proof and is refunded; the dated series ends up supported.
    for (const p of by.Q18.purchases.filter(x => x.resourceId.startsWith('alphaleak-'))) expect(p.proof).toBe('REFUNDED')
    expect(by.Q18.final.supported).toContain('Q18.series')
    // Unanswerable by construction: nothing is supported, and any spend is wasted.
    expect(by.Q42.final.supported).toEqual([])
    expect(by.Q42.wastedMinor).toBe(by.Q42.spentMinor)
    for (const r of report.results) {
      expect(r.final.citations.valid).toBe(r.final.citations.total)
      expect(r.spentMinor).toBeLessThanOrEqual(200)
      expect(r.purchases.every(p => p.priceMinor <= 100)).toBe(true)
      expect(r.error).toBeUndefined()
    }
    expect(attempts).toBe(0)
  })
  it('summarizes recall, citation validity, purchases per question and wasted spend', () => {
    const base = { kind: 'paid-needed' as const, requested: 2, free: { supported: [], citations: { valid: 2, total: 2 }, gaps: [] }, rounds: [], expectedBuy: 'a', error: undefined }
    const s = summarize([
      { ...base, id: 'X1', final: { supported: ['f1', 'f2'], citations: { valid: 4, total: 4 }, answerVersions: 2 }, purchases: [{ round: 1, resourceId: 'a', priceMinor: 30, proof: 'PASS', gainedFacts: ['f1', 'f2'], wasted: false }], spentMinor: 30, refundedMinor: 0, wastedMinor: 0, firstBuy: 'a', firstBuyPriceMinor: 30 },
      { ...base, id: 'X2', final: { supported: [], citations: { valid: 2, total: 2 }, answerVersions: 1 }, purchases: [{ round: 1, resourceId: 'b', priceMinor: 20, proof: 'REFUNDED', gainedFacts: [], wasted: true }], spentMinor: 20, refundedMinor: 20, wastedMinor: 20, firstBuy: 'b', firstBuyPriceMinor: 20 },
    ])
    expect(s.overall.freeOnly.factRecall).toBe(0)
    expect(s.overall.withPurchase.factRecall).toBe(0.5)
    expect(s.overall.purchasesPerQuestion).toBe(1)
    expect(s.overall.wastedMinor).toBe(20)
    expect(s.overall.refundedMinor).toBe(20)
    expect(s.overall.firstPurchaseVsBank.precision).toBe(0.5)
  })
})
