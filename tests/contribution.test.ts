import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { contributions, assessedSpend } from '../shared/contribution.js'
import { verifyAnswer } from '../sdk/verify.js'
import { qualityMetrics } from '../eval/scorecard/metrics.js'
import type { QuestionResult } from '../eval/decisions/offline.js'
import type { ReceiptBundle } from '../shared/contracts/receipts.js'
const read = (name: string): ReceiptBundle => JSON.parse(readFileSync(`docs/evidence/round2-g/${name}.receipts.json`, 'utf8'))
it('verifies 30 extractive paid claim/passage links, including removed use and quarantined refunds', async () => {
  let count = 0
  for (const name of ['useful','redundant','refunded']) {
    const b = read(name)
    expect((await verifyAnswer(b)).ok).toBe(true)
    count += b.contributions!.purchases.flatMap(p => p.links).length
    for (const p of b.contributions!.purchases) {
      expect(p.assessment).toBe('not assessed')
      if (p.status !== 'VERIFIED') expect(p.links).toEqual([])
    }
  }
  expect(count).toBe(30)
  expect(read('redundant').contributions!.purchases.every(p => p.structuralUse === 'none')).toBe(true)
})
it('rejects each contribution link class and dispatch downgrade', async () => {
  const b = read('useful')
  for (const field of ['answerVersion','claimId','claim','citation','spanId','passage','manifestRoot','grantIntentId','retained']) {
    const c = structuredClone(b), link = c.contributions!.purchases[0].links[0] as unknown as Record<string, unknown>
    link[field] = typeof link[field] === 'boolean' ? false : typeof link[field] === 'number' ? 999 : 'tampered'
    expect((await verifyAnswer(c)).ok, field).toBe(false)
  }
  const c = structuredClone(b); c.schemaVersion = 2
  expect((await verifyAnswer(c)).ok).toBe(false)
})
it('deduplicates citations, preserves pending/refused refund and does not invent semantic assessments', () => {
  const b = read('useful'), original = contributions(b)
  b.answers[0].claims[0].citations.push(b.answers[0].claims[0].citations[0])
  expect(contributions(b)).toEqual(original)
  b.intents[0].refundCandidate = { txHash: 'A'.repeat(64), observedAt: 'fixture' }
  expect(contributions(b).purchases[0].refundStatus).toBe('pending')
  b.intents[0].refundCandidate = undefined; b.intents[0].status = 'CHALLENGE_REFUSED'
  expect(contributions(b).purchases[0]).toMatchObject({ refundStatus: 'refused', refundMinor: 0, links: [] })
})
it('matches unchanged scorecard arithmetic on the same rows; refunds never reduce gross denominator', () => {
  const e = JSON.parse(readFileSync('docs/evidence/round2-g/metric-equivalence.json','utf8'))
  expect(assessedSpend(e.rows)).toMatchObject({ numeratorMinor: 30, denominatorMinor: 100, usedSpendPct: 30 })
  expect(Math.abs(assessedSpend(e.rows).usedSpendPct! - qualityMetrics(e.rows as QuestionResult[],[],null).usedSpendPct!)).toBeLessThan(1e-9)
  expect(assessedSpend([]).usedSpendPct).toBeNull()
})
it('retains original v1 and v2 fixture semantics', async () => {
  for (const v of [1,2]) expect((await verifyAnswer(JSON.parse(readFileSync(`docs/evidence/round2-f/receipt-v${v}.json`,'utf8')))).ok).toBe(true)
})
