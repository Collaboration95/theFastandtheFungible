import { contributions } from '../shared/contribution.js'
import { sameSource } from '../shared/source-identity.js'
import type { RunSnapshot } from '../shared/contracts/run.js'
import { articleUrl } from '../shared/contracts/manifest.js'

const corpusLabel = 'Registry-labelled writers · credential identity requires online check'

export function presentRun(run: RunSnapshot, publisherUrl: string) {
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

export type PresentedRun = ReturnType<typeof presentRun>
