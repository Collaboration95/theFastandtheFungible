/* eslint-disable react-refresh/only-export-components -- Shared validation for impact/report components. */
import { useState } from 'react'
import { AnswerSchema, providerLabels, type Answer as AnswerData, type Citation, type RunSnapshot } from '../../shared/contracts/index.js'
import { getAccessibleContent } from './Sources'

export function getValidatedAnswer(run: RunSnapshot, answer?: AnswerData): AnswerData | undefined {
  const parsed = AnswerSchema.safeParse(answer)
  if (!parsed.success) return undefined
  const claims = parsed.data.claims.filter(claim => claim.citations.every(citation => {
    const candidate = run.candidates.find(item => item.resourceId === citation.resourceId && item.version === citation.version)
    const content = candidate && getAccessibleContent(run, candidate)
    const span = content?.spans.find(item => item.id === citation.spanId)
    return !!span && !!content?.body.includes(span.text)
  }))
  if (!claims.length) return undefined
  // Never retain unsupported synthesis after dropping an invalid claim.
  return claims.length === parsed.data.claims.length ? parsed.data : { ...parsed.data, claims, conclusion: 'Some claims were withheld because their evidence could not be verified.', openGaps: [] }
}
export interface AnswerProps { run: RunSnapshot; onCitation?: (citation: Citation) => void }
export default function Answer({ run, onCitation }: AnswerProps) {
  const [view, setView] = useState<'latest' | 'baseline'>('latest')
  const answers = [...run.answers].sort((a, b) => a.version - b.version).map(item => getValidatedAnswer(run, item)).filter((item): item is AnswerData => !!item)
  const answer = getValidatedAnswer(run, view === 'baseline' ? answers[0] : answers.at(-1))
  const baseline = answers[0]
  const impact = view === 'latest' && baseline && answer && baseline.version !== answer.version && run.impact && baseline.claims.length === run.answers.find(item => item.version === baseline.version)?.claims.length && answer.claims.length === run.answers.find(item => item.version === answer.version)?.claims.length ? run.impact : undefined
  const changedIds = new Set(impact?.claimChanges.filter(change => change.change === 'ADDED' || change.change === 'REVISED').map(change => change.toClaimId))
  const orderedClaims = [...(answer?.claims ?? [])].sort((a, b) => Number(changedIds.has(b.id)) - Number(changedIds.has(a.id)))
  const lead = answer?.conclusion.match(/^.*?[.!?](?=\s+[A-Z]|$)/s)?.[0]
  const citations = answer?.claims.flatMap(claim => claim.citations).filter((citation, index, all) => all.findIndex(item => item.resourceId === citation.resourceId && item.version === citation.version && item.spanId === citation.spanId) === index) ?? []
  return <section className="ra-panel ra-answer" aria-label="Research answer" aria-busy={run.phase === 'ANSWER'}>
    <div className="ra-section-heading"><h2>Your answer{answer ? ` · v${answer.version}` : ''}</h2>{answers.length > 1 && <div className="ra-toggle" aria-label="Answer version"><button type="button" aria-pressed={view === 'baseline'} onClick={() => setView('baseline')}>Free answer · v{answers[0]?.version}</button><button type="button" aria-pressed={view === 'latest'} onClick={() => setView('latest')}>Latest answer</button></div>}</div>
    {!answer ? <p role="status">{run.phase === 'FAILED' || run.phase === 'STOPPED' ? 'No verified answer is available. Ask again to begin a new run.' : 'Gathering evidence. Verified claims will appear here as the run progresses.'}</p> : <>
      <p className="ra-eyebrow">{providerLabels[answer.provider]} · {answer.model}</p>
      {impact && <div className="ra-answer-impact"><span className={`ra-badge ra-impact-${impact.classification.toLowerCase()}`}>{impact.classification}</span><p>{impact.explanation}</p></div>}
      <details className="ra-findings"><summary>Full conclusion</summary><p>{answer.conclusion}</p></details>
      {lead && !answer.claims.some(claim => claim.text.includes(lead)) && <p className="ra-conclusion">{lead}</p>}
      <ol className="ra-claims">{orderedClaims.map(claim => <li key={claim.id} className={changedIds.has(claim.id) ? 'ra-claim-changed' : undefined}>{changedIds.has(claim.id) && <span className="ra-badge ra-badge-teal">New evidence</span>}<span className="ra-stance">{claim.stance.toLowerCase()}</span><p>{claim.text} {claim.citations.map(citation => {
        const number = citations.findIndex(item => item.resourceId === citation.resourceId && item.version === citation.version && item.spanId === citation.spanId) + 1
        const candidate = run.candidates.find(item => item.resourceId === citation.resourceId && item.version === citation.version)
        return <button className="ra-citation" type="button" key={JSON.stringify(citation)} disabled={!onCitation} aria-label={`Citation ${number}: ${candidate?.title ?? citation.resourceId}, exact passage`} onClick={() => onCitation?.(citation)}>{number}</button>
      })}</p></li>)}</ol>
      {answer.openGaps.length > 0 && <div className="ra-open-gap"><h3>What we still need to know</h3>{answer.openGaps.map((gap, index) => <p key={index}>{gap.text}</p>)}</div>}
    </>}
    <p className="ra-muted">Synthetic corpus · fictional findings. Only evidence-backed claims are displayed.</p>
    {run.phase === 'FAILED' && <p className="ra-error" role="status">Research paused after an error. The last verified answer is preserved; you can ask again.</p>}
    {run.phase === 'STOPPED' && <p className="ra-muted" role="status">Run stopped. No new purchases will be initiated.</p>}
  </section>
}
