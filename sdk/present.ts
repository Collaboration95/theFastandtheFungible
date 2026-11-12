import { summarizeAnswer } from '../shared/answer-summary.js'
import { receiptView, modeDisclosure } from '../shared/presentation.js'
import { contributions } from '../shared/contribution.js'
import { sameSource } from '../shared/source-identity.js'
import type { RunSnapshot } from '../shared/contracts/run.js'
import { articleUrl } from '../shared/contracts/manifest.js'

const corpusLabel = modeDisclosure('corpus')

export function presentRun(run: RunSnapshot, publisherUrl: string) {
  const accessible = run.contents.filter(c => run.candidates.some(m => sameSource(m, c) && (m.tier === 'FREE' || run.grants.some(g => sameSource(g, c) && run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED')))))
  const raw = run.answers.at(-1)
  const summary = raw ? raw.lead ? raw : summarizeAnswer(run.question, raw, accessible, run.candidates) : null
  const answer = summary ? { ...summary, claims: raw!.claims } : null
  const citedClaims = answer ? [...answer.claims, ...(answer.lead ?? []).map(l => l.claim).filter(l => !answer.claims.some(c => c.citations.some(r => l.citations.some(ref => sameSource(r, ref) && r.spanId === ref.spanId))))] : []
  const citations = citedClaims.flatMap(claim => claim.citations.map(citation => {
    const content = run.contents.find(c => sameSource(c, citation) && c.spans.some(p => p.id === citation.spanId))
    if (!content) throw new Error('Citation has no delivered passage')
    const candidate = run.candidates.find(c => c.profileId === content.profileId && sameSource(c, content))
    const grant = run.grants.find(g => sameSource(g, content) && run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))
    if (!candidate || (candidate.tier !== 'FREE' && !grant)) throw new Error('Citation has no verified grant')
    return { ...citation, untrusted: true as const, claimId: claim.id, writer: content.publisher, writerVerification: candidate.verification ?? { status: 'unverified' }, credentialNotice: 'unsigned advisory; requires online check', passage: content.spans.find(p => p.id === citation.spanId)!.text, url: content.spans.find(p => p.id === citation.spanId)?.url ?? new URL(articleUrl(content.profileId, content.resourceId, citation.spanId), content.source?.origin ?? publisherUrl).href, grantIntentId: grant?.intentId ?? null }
  })) ?? []
  return { answer, run_id: run.runId, phase: run.phase, corpusLabel, untrusted: true as const, labels: run.labels, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, citations, contributions: contributions({ ...run, sources: run.contents }),
    purchases: run.intents.map(intent => {
      const receipt = run.receipts.find(r => r.intentId === intent.intentId)
      return receiptView(intent, receipt, run.candidates.find(c => c.profileId === intent.profileId && sameSource(c, intent)), run.labels.settlement)
    }) }
}

export type PresentedRun = ReturnType<typeof presentRun>
