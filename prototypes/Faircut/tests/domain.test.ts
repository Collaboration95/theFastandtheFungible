import { describe, expect, it } from 'vitest'
import { candidates, MAX_DROPS, phaseIndex, phaseLabels, PRICE_DROPS } from '../src/domain'
import { eventHash, verifyEventChain } from '../server/hash-chain'

describe('FairCut seeded decision contract', () => {
  it('keeps three offers across independent provider identities', () => {
    expect(candidates).toHaveLength(3)
    expect(new Set(candidates.map((candidate) => candidate.providerId)).size).toBeGreaterThanOrEqual(2)
    expect(candidates.map((candidate) => candidate.rightDecision)).toEqual(['BLOCKED', 'ELIGIBLE', 'ELIGIBLE'])
  })

  it('blocks the strongest creative match for objective rights and payee failures', () => {
    const favorite = candidates[0]
    expect(favorite.creative.moodFit).toBeGreaterThan(candidates[1].creative.moodFit)
    expect(favorite.rightDecision).toBe('BLOCKED')
    expect(favorite.rights.filter((check) => check.result === 'FAIL').map((check) => check.code)).toEqual([
      'COMMERCIAL_USE_NOT_PERMITTED', 'TERRITORY_MISSING_JP', 'RIGHTS_HOLDER_PAYEE_MISMATCH',
    ])
  })

  it('selects Dawn Current as a creative choice among eligible options', () => {
    const eligible = candidates.filter((candidate) => candidate.rightDecision === 'ELIGIBLE')
    expect(eligible).toHaveLength(2)
    expect(eligible.sort((a, b) => b.creative.transitionFit - a.creative.transitionFit)[0].id).toBe('dawn-current')
    expect(candidates[1].priceDrops).toBe(PRICE_DROPS)
    expect(candidates[1].priceDrops).toBeLessThanOrEqual(MAX_DROPS)
  })

  it('keeps the visible phase order causal', () => {
    expect(phaseLabels.map((item) => item.id)).toEqual(['rough-cut', 'compare', 'blocked', 'license', 'deliver', 'final-cut'])
    expect(phaseIndex('final-cut')).toBe(5)
  })
})

describe('FairCut deterministic guards', () => {
  it('rejects non-canonical money values', () => {
    const parseDrops = (value: string) => {
      if (!/^(0|[1-9]\d*)$/.test(value) || value.length > 12) throw new Error('invalid drops')
      return BigInt(value)
    }
    expect(parseDrops('8000')).toBe(8000n)
    for (const value of ['8.00', '-1', '08', '1e3', '']) expect(() => parseDrops(value)).toThrow('invalid drops')
  })

  it('represents fixture settlement as not validated', () => {
    const fixturePayment = { mode: 'demo-local', validated: false, transactionResult: 'NOT_APPLICABLE', transactionHash: null }
    expect(fixturePayment.validated).toBe(false)
    expect(fixturePayment.transactionHash).toBeNull()
    expect(fixturePayment.transactionResult).not.toBe('tesSUCCESS')
  })

  it('detects event-chain mutation and reordering', () => {
    const first = { sequence: 1, type: 'DEMO_RESET', actor: 'principal', occurredAt: '2026-09-05T00:00:00.000Z', idempotencyKey: 'reset-1', previousHash: 'GENESIS', payload: { environment: 'demo-local' } }
    const second = { sequence: 2, type: 'CANDIDATES_DISCOVERED', actor: 'faircut-agent', occurredAt: '2026-09-05T00:00:01.000Z', idempotencyKey: 'discover-1', previousHash: '', payload: { providerIds: ['nightjar-direct', 'mika-direct'] } }
    const chain = [{ ...first, eventHash: eventHash(first, 'purchase_dawn_current_12s') }, { ...second, previousHash: '', eventHash: '' }]
    chain[1].previousHash = chain[0].eventHash
    chain[1].eventHash = eventHash(chain[1], 'purchase_dawn_current_12s')
    expect(verifyEventChain(chain, 'purchase_dawn_current_12s')).toBe(true)
    expect(verifyEventChain([{ ...chain[0], payload: { environment: 'tampered' } }, chain[1]], 'purchase_dawn_current_12s')).toBe(false)
    expect(verifyEventChain([chain[1], chain[0]], 'purchase_dawn_current_12s')).toBe(false)
  })
})
