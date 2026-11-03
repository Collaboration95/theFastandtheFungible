import type { RunSnapshot } from '../shared/contracts/run.js'
import { articleUrl } from '../shared/contracts/manifest.js'

const corpusLabel = 'SYNTHETIC · fictional writers and articles'

export function presentRun(run: RunSnapshot, publisherUrl: string) {
  const answer = run.answers.at(-1) ?? null
  const citations = answer?.claims.flatMap(claim => claim.citations.map(citation => {
    const content = run.contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version && c.spans.some(p => p.id === citation.spanId))
    if (!content) throw new Error('Citation has no delivered passage')
    const candidate = run.candidates.find(c => c.profileId === content.profileId && c.resourceId === content.resourceId && c.version === content.version)
    const grant = run.grants.find(g => g.resourceId === content.resourceId && g.version === content.version && run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))
    if (!candidate || (candidate.tier !== 'FREE' && !grant)) throw new Error('Citation has no verified grant')
    return { ...citation, untrusted: true as const, claimId: claim.id, writer: content.publisher, passage: content.spans.find(p => p.id === citation.spanId)!.text, url: new URL(articleUrl(content.profileId, content.resourceId, citation.spanId), publisherUrl).href, grantIntentId: grant?.intentId ?? null }
  })) ?? []
  return { run_id: run.runId, phase: run.phase, corpusLabel, untrusted: true as const, labels: run.labels, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, answer, citations,
    purchases: run.intents.map(intent => {
      const receipt = run.receipts.find(r => r.intentId === intent.intentId)
      return { intentId: intent.intentId, resourceId: intent.resourceId, writer: run.candidates.find(c => c.profileId === intent.profileId && c.resourceId === intent.resourceId)?.publisher ?? intent.profileId,
        priceMinor: intent.amountMinor, status: intent.status, verified: intent.status === 'VERIFIED', refunded: intent.status === 'REFUNDED', txHash: receipt?.xrpl?.txHash ?? null, explorerUrl: receipt?.xrpl?.explorerUrl ?? null, label: receipt?.label ?? run.labels.settlement }
    }) }
}

export type PresentedRun = ReturnType<typeof presentRun>
