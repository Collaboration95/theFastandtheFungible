import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'
import { ManifestSchema } from '../shared/contracts/manifest.js'
import { reportStamp } from '../publisher/writers/ledger-analytics/freshness.js'
import { LEDGER_REPORT_POLICY } from '../shared/ledger-report.js'

for (const file of ['ledger-analytics-sample','testnet-activity','testnet-purchase']) it(`authenticates the retained ${file} evidence`, () => {
  const evidence = JSON.parse(readFileSync(`docs/evidence/content/${file}.json`, 'utf8'))
  const manifest = ManifestSchema.parse(evidence.manifest)
  const content = evidence.article ?? evidence.delivery.content
  const passages = content.passages ?? content.spans
  const salts = evidence.salts ?? evidence.delivery.salts
  expect(verifyManifestSignature(manifest)).toBe(true)
  expect(verifyDelivery(content.body, passages, salts, manifest).ok).toBe(true)
  const stamp = reportStamp(content.body)
  expect(stamp.ledgerHash).toMatch(/^[A-F0-9]{64}$/)
  expect(stamp.computedAt).toBe(manifest.publishedAt)
  if (evidence.stamp) expect(stamp).toEqual(evidence.stamp)
  if (evidence.receipt) {
    expect(evidence.receipt.xrpl.payTo).toBe(manifest.wallet)
    expect(evidence.receipt.amountMinor).toBe(manifest.priceMinor)
    expect(evidence.intent.status).toBe('VERIFIED')
    expect(evidence.receipt.version).toBe(manifest.version)
  }
})

it('authenticates live background prewarm and periodic-refresh snapshots with explicit signed bounds',()=>{
  const evidence=JSON.parse(readFileSync('docs/evidence/content/prewarm-snapshots.json','utf8'))
  expect([...new Set(evidence.results.map((r:{topic:string})=>r.topic))].sort()).toEqual(['amm','project-activity','rlusd'])
  for(const result of evidence.results) {
    const manifest=ManifestSchema.parse(result.manifest),freshness=manifest.ledgerFreshness!
    expect(verifyManifestSignature(manifest)).toBe(true)
    expect(verifyDelivery(result.article.body,result.article.passages,result.salts,manifest).ok).toBe(true)
    expect(freshness.maxLedgerLag).toBe(LEDGER_REPORT_POLICY[freshness.topic].maxLedgerLag)
    expect(freshness).toEqual({topic:result.topic,...reportStamp(result.article.body)})
    expect(result.computeTimeMs).toBeGreaterThan(0)
    expect(manifest.wallet).toBe('rPcGTrh6sBaNhXNJyQjMZzrevnAp3p5hvf')
  }
})
