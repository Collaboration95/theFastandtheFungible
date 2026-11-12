import { z } from 'zod'
import type { Answer, ContentEnvelope, Grant, PurchaseIntent, Receipt } from './contracts/index.js'
import { sameSource, sourceKey, citationIdentity } from './source-identity.js'

export const ContributionsSchema = z.object({
  version: z.literal('structural-v1'), semanticStatus: z.literal('not independently verified'),
  purchases: z.array(z.object({
    intentId: z.string(), sourceKey: z.string(), status: z.string(), grossMinor: z.number().int(), refundMinor: z.number(), netMinor: z.number(), refundStatus: z.string(),
    assessment: z.literal('not assessed'), structuralUse: z.enum(['cited', 'none']),
    links: z.array(z.object({ answerVersion: z.number().int(), claimId: z.string(), claim: z.string(), citation: z.string(), spanId: z.string(), passage: z.string(), manifestRoot: z.string(), grantIntentId: z.string(), retained: z.boolean() })),
  })),
})
type Evidence = { answers: Answer[]; sources: ContentEnvelope[]; intents: PurchaseIntent[]; grants: Grant[]; receipts: Receipt[] }
/** Observable citation use only. Missing semantic assessment is never zero fact gain. */
export function contributions(b: Evidence): z.infer<typeof ContributionsSchema> {
  const final = b.answers.at(-1)
  return { version: 'structural-v1', semanticStatus: 'not independently verified', purchases: b.receipts.map(receipt => {
    const i = b.intents.find(i => i.intentId === receipt.intentId)!
    const grant = b.grants.find(g => g.intentId === i.intentId && sameSource(g, i))
    const source = b.sources.find(s => sameSource(s, i))
    const links = i.status === 'VERIFIED' && grant && source ? b.answers.flatMap(a => a.claims.flatMap(c => [...new Map(c.citations.filter(ref => sameSource(ref, i)).map(ref => [citationIdentity(ref), ref])).values()].flatMap(ref => {
      const span = source.spans.find(s => s.id === ref.spanId)
      return span ? [{ answerVersion: a.version, claimId: c.id, claim: c.text, citation: citationIdentity(ref), spanId: span.id, passage: span.text, manifestRoot: grant.contentDigest, grantIntentId: grant.intentId, retained: !!final?.claims.some(fc => fc.id === c.id && fc.text === c.text && fc.citations.some(r => citationIdentity(r) === citationIdentity(ref))) }] : []
    }))) : []
    const holdback = i.escrow?.holdback
    const refundMinor = i.refund?.amountMinor ?? (holdback?.state === 'refunded' ? holdback.amountMinor : 0)
    return { intentId: i.intentId, sourceKey: sourceKey(i), status: i.status, grossMinor: receipt.amountMinor, refundMinor, netMinor: receipt.amountMinor - refundMinor,
      refundStatus: i.refund ? 'recorded verified refund' : holdback?.state === 'refunded' ? 'recorded verified holdback refund' : holdback?.state === 'pending' || i.refundCandidate || i.status === 'CHALLENGED' ? 'pending' : i.status === 'CHALLENGE_REFUSED' || i.status === 'CHALLENGE_REJECTED' ? 'refused' : 'none',
      assessment: 'not assessed', structuralUse: links.some(l => l.answerVersion === final?.version) ? 'cited' : 'none', links }
  }) }
}
/** Same-row semantic arithmetic; caller must supply independently declared assessment rows. */
export function assessedSpend(rows: { spentMinor: number; purchases: { proof: string; priceMinor: number; gainedFacts: string[] }[]; final: { supported: string[] } }[]) {
  const denominatorMinor = rows.reduce((sum, r) => sum + r.spentMinor, 0)
  const numeratorMinor = rows.reduce((sum, r) => sum + r.purchases.filter(p => p.proof === 'PASS' && p.gainedFacts.some(f => r.final.supported.includes(f))).reduce((n, p) => n + p.priceMinor, 0), 0)
  return { numeratorMinor, denominatorMinor, usedSpendPct: denominatorMinor ? 100 * numeratorMinor / denominatorMinor : null }
}
