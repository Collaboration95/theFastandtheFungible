import { expect, it } from 'vitest'
import { presentRun } from '../../sdk/present.js'
import { receiptView, modeDisclosure, money, assetMoney, railLabel } from '../../shared/presentation.js'
import { ucRuns } from './run.js'
import { contributions } from '../../shared/contribution.js'
import { sameSource } from '../../shared/source-identity.js'
import type { RunSnapshot } from '../../shared/contracts/run.js'
import { articleUrl } from '../../shared/contracts/manifest.js'

const corpusLabel = 'Registry-labelled writers · credential identity requires online check'

export function originalPresentRun(run: RunSnapshot, publisherUrl: string) {
  const answer = run.answers.at(-1) ?? null
  const citations = answer?.claims.flatMap(claim => claim.citations.map(citation => {
    const content = run.contents.find(c => sameSource(c, citation) && c.spans.some(p => p.id === citation.spanId))
    if (!content) throw new Error('Citation has no delivered passage')
    const candidate = run.candidates.find(c => c.profileId === content.profileId && sameSource(c, content))
    const grant = run.grants.find(g => sameSource(g, content) && run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))
    if (!candidate || (candidate.tier !== 'FREE' && !grant)) throw new Error('Citation has no verified grant')
    return { ...citation, untrusted: true as const, claimId: claim.id, writer: content.publisher, writerVerification: candidate.verification ?? { status: 'unverified' }, credentialNotice: 'unsigned advisory; requires online check', passage: content.spans.find(p => p.id === citation.spanId)!.text, url: new URL(articleUrl(content.profileId, content.resourceId, citation.spanId), content.source?.origin ?? publisherUrl).href, grantIntentId: grant?.intentId ?? null }
  })) ?? []
  return { contributions: contributions({ ...run, sources: run.contents }), run_id: run.runId, phase: run.phase, corpusLabel, untrusted: true as const, labels: run.labels, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, answer, citations,
    purchases: run.intents.map(intent => {
      const receipt = run.receipts.find(r => r.intentId === intent.intentId)
      return { source: intent.source, intentId: intent.intentId, resourceId: intent.resourceId, writer: run.candidates.find(c => c.profileId === intent.profileId && sameSource(c,intent))?.publisher ?? intent.profileId,
        writerVerification: run.candidates.find(c => c.profileId === intent.profileId && sameSource(c, intent))?.verification ?? { status: 'unverified' }, credentialNotice: 'unsigned advisory; requires online check', asset: receipt?.xrpl?.asset ?? intent.quote?.payment?.asset ?? 'XRP', settlementAmount: receipt?.xrpl?.amountDrops ?? null, escrow: intent.escrow ?? null, priceMinor: intent.amountMinor, status: intent.status, verified: intent.status === 'VERIFIED', refunded: intent.status === 'REFUNDED', txHash: receipt?.xrpl?.txHash ?? null, explorerUrl: receipt?.xrpl?.explorerUrl ?? null, label: receipt?.label ?? run.labels.settlement }
    }) }
}



it('preserves complete SDK disclosure, receipt identity and citation output for every recorded fixture', () => {
  for (const run of Object.values(ucRuns)) {
    expect(presentRun(run, 'http://127.0.0.1:1')).toEqual(originalPresentRun(run, 'http://127.0.0.1:1'))
    for (const intent of run.intents) {
      const receipt = run.receipts.find(r => r.intentId === intent.intentId)
      const candidate = run.candidates.find(c => c.profileId === intent.profileId && sameSource(c, intent))
      const view = receiptView(intent, receipt, candidate, run.labels.settlement)
      expect(view.source).toBe(intent.source)
      expect(view.escrow).toBe(intent.escrow ?? null)
      if (candidate?.verification) expect(view.writerVerification).toBe(candidate.verification)
    }
  }
  expect(modeDisclosure('settlement')).toBe('SIMULATED SGD · no real funds')
  expect(money(90)).toBe('S$0.90'); expect(assetMoney(90)).toBe('S$0.90')
  expect(railLabel()).toBe('SIMULATED')
})

it('keeps Testnet and substitute asset disclosures exact', async () => {
  const { settlementAssetLabel } = await import('../../shared/presentation.js')
  const { RLUSD_CURRENCY, RLUSD_TESTNET_ISSUER, TEST_SGD_LABEL } = await import('../../shared/contracts/asset.js')
  const testSgd = { currency: 'SGT' as const, issuer: RLUSD_TESTNET_ISSUER, label: TEST_SGD_LABEL } as const
  const rlusd = { currency: RLUSD_CURRENCY, issuer: RLUSD_TESTNET_ISSUER, label: 'RLUSD (Testnet)' } as const
  expect(assetMoney(90, testSgd)).toBe('TEST-SGD 0.90 · stand-in for RLUSD · no real value')
  expect(assetMoney(90, rlusd)).toBe('S$0.90')
  expect(assetMoney(90, 'XRP')).toBe('S$0.90')
  expect(settlementAssetLabel(testSgd)).toBe('RLUSD (Testnet)') // Preserve the existing issuer-based label exactly.
  expect(settlementAssetLabel({ ...testSgd, issuer: 'synthetic-issuer' })).toBe(TEST_SGD_LABEL)
  expect(settlementAssetLabel(rlusd)).toBe('RLUSD (Testnet)')
  expect(settlementAssetLabel()).toBe('XRPL Testnet')
  expect(settlementAssetLabel('XRP')).toBe('XRPL Testnet')
})
