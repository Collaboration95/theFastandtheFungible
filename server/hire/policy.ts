import type { RunSnapshot } from '../../shared/contracts/run.js'
import { DROPS_PER_MINOR } from '../../shared/contracts/index.js'

export const SERVICE_FEE_MINOR = 20
export const ROYALTY_MINOR = 5 // fixed 25% of the service fee, never model supplied
export type ChainPayment = { id: string; kind: 'royalty' | 'change'; payTo: string; amountDrops: string }
export function royaltyPlan(run: RunSnapshot, addresses: Record<string, string>): ChainPayment[] {
  const slugs = [...new Set(run.answers.at(-1)?.claims.flatMap(c => c.citations.map(citation => {
    const content = run.contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version && c.spans.some(s => s.id === citation.spanId))
    if (!content) throw new Error('Citation has no accessible content')
    return content.profileId
  })) ?? [])].sort()
  const pool = ROYALTY_MINOR * DROPS_PER_MINOR
  if (slugs.length > pool) throw new Error('Too many writers for one-drop minimum')
  return slugs.map((slug, i) => {
    const payTo = addresses[slug]
    if (!payTo) throw new Error(`Cited writer ${slug} has no payable Testnet address`)
    return { id: `${run.runId}:royalty:${slug}`, kind: 'royalty', payTo,
      amountDrops: String(Math.floor(pool / slugs.length) + (i < pool % slugs.length ? 1 : 0)) }
  })
}
export function changePlan(run: RunSnapshot, quotedBudgetMinor: number, payer: string): ChainPayment[] {
  if (run.reservedMinor || run.intents.some(i => ['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(i.status))) throw new Error('Purchases must finish before change')
  const change = (quotedBudgetMinor - run.spentMinor) * DROPS_PER_MINOR
  if (change < 0) throw new Error('Over budget')
  return change ? [{ id: `${run.runId}:change`, kind: 'change', payTo: payer, amountDrops: String(change) }] : []
}
