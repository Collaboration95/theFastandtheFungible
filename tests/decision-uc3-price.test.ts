// UC3 under a judge that cannot be fooled (#204, owner 8 Oct): The Fab Floor's Penang lead-time article is a
// S$0.40 data deep-dive and AlphaLeak stays S$0.30, so AlphaLeak wins round 1 on price even when both public
// promises score the same; after its failed proof and quarantine, round 2 buys The Fab Floor within the S$1 cap.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CandidateJudgment, PublicCandidate, ReputationSummary } from '../shared/contracts/index.js'
import { decide, type DecisionProvider } from '../server/agents/decision.js'

type BibleArticle = { articleId: string; publisherSlug: string; tier: 'FREE' | 'PAID'; priceMinor: number; family: string; derivedFrom?: string; title: string; tags: string[]; expectedRelevance?: number }
type UseCase = { id: string; question: string; articles: BibleArticle[]; expectedPicks: { round1: string; round2: string } }
const uc3 = (JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { useCases: UseCase[] }).useCases.find(u => u.id === 'UC3')!
const ALPHA = uc3.expectedPicks.round1, FAB = uc3.expectedPicks.round2
const WALLETS: Record<string, string> = { alphaleak: 'rGhpLNe5FR5GmPapPhLCxgi2h7fefhUVkp', 'the-fab-floor': 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe' }
const candidates: PublicCandidate[] = uc3.articles.map(a => ({
  profileId: a.publisherSlug, resourceId: a.articleId, version: 'v1', title: a.title, publisher: a.publisherSlug, preview: a.title, price: { amountMinor: a.priceMinor, currency: 'SGD' },
  ...(WALLETS[a.publisherSlug] ? { wallet: WALLETS[a.publisherSlug] } : {}), family: a.family, ...(a.derivedFrom ? { derivedFrom: a.derivedFrom } : {}), facets: a.tags, authority: 1, tier: a.tier,
  license: { kind: 'SYNTHETIC', attribution: a.publisherSlug }, publisherSlug: a.publisherSlug, relevance: a.expectedRelevance ?? 0.5,
}))
const readSources = candidates.filter(c => c.tier === 'FREE')

/** A judge that sees through the inflated relevance: both lead-time promises score the same (Fab Floor × `fabEdge`); everything else is off-gap. */
const judge = (fabEdge = 1): DecisionProvider => ({
  name: 'fixture', model: 'perfect-judge',
  judgeRound: async () => ({ gapMaterial: 0.9 }),
  judgeCandidate: async ({ candidate }): Promise<CandidateJudgment> => {
    const onGap = candidate.resourceId === ALPHA || candidate.resourceId === FAB
    return { addressesGap: onGap ? 0.7 * (candidate.resourceId === FAB ? fabEdge : 1) : 0.05, originality: { original: 0.9, rewrite: 0.05, overlap: 0.05 }, credibility: 1 }
  },
})
const round = (provider: DecisionProvider, reputation?: Record<string, ReputationSummary>, boughtResourceIds: string[] = []) => decide({
  question: uc3.question, conclusion: 'Penang Phase 2 lifted capacity; no free source states lead times.', gap: 'Lead times in weeks, and their trend.',
  candidates, readSources, budgetMinor: 200, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100, round: 1, provider, boughtResourceIds, ...(reputation ? { reputation } : {}),
})
const row = (r: Awaited<ReturnType<typeof round>>, id: string) => r.rows.find(x => x.candidate.resourceId === id)!

describe('UC3 prices (#204): AlphaLeak S$0.30, The Fab Floor S$0.40 deep-dive', () => {
  it('prices the two lead-time articles as the owner decided', () => {
    expect(candidates.find(c => c.resourceId === ALPHA)!.price.amountMinor).toBe(30)
    expect(candidates.find(c => c.resourceId === FAB)!.price.amountMinor).toBe(40)
  })

  it.each([
    ['equal public scores (a perfect judge)', 1],
    ['The Fab Floor scored 30% higher', 1.3],
  ])('round 1 buys AlphaLeak with %s: same value or close, lower price, more value per dollar', async (_name, edge) => {
    const first = await round(judge(edge))
    expect(first.selectedResourceId).toBe(ALPHA)
    expect(row(first, ALPHA).verdict).toBe('BUY')
    expect(row(first, FAB).verdict).toBe('BUY')
    expect(row(first, FAB).value).toBeGreaterThanOrEqual(row(first, ALPHA).value)
    expect(row(first, ALPHA).valuePerDollar).toBeGreaterThan(row(first, FAB).valuePerDollar)
  })

  it('round 2, after the failed proof quarantines AlphaLeak (D21), buys The Fab Floor within the S$1 per-source cap', async () => {
    const quarantined = { [WALLETS.alphaleak!]: { H: 0.4, C: 1, T: 0.4, status: 'quarantined' as const } }
    const second = await round(judge(), quarantined, [ALPHA])
    expect(row(second, ALPHA).verdict).toBe('SKIP_LOW_TRUST')
    expect(second.selectedResourceId).toBe(FAB)
    expect(row(second, FAB).candidate.price.amountMinor).toBeLessThanOrEqual(100)
  })
})
