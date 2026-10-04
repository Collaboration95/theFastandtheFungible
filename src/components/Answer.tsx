/* eslint-disable react-refresh/only-export-components -- Shared validation for impact/report components. */
import { useState } from 'react'
import { AnswerSchema, type Answer as AnswerData, type Citation, type RunSnapshot } from '../../shared/contracts/index.js'
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
  const citations = answer?.claims.flatMap(claim => claim.citations).filter((citation, index, all) => all.findIndex(item => item.resourceId === citation.resourceId && item.version === citation.version && item.spanId === citation.spanId) === index) ?? []
  return <section className="ra-panel ra-answer" aria-label="Research answer" aria-busy={run.phase === 'ANSWER'}>
    <div className="ra-section-heading"><h2>Your answer{answer ? ` · v${answer.version}` : ''}</h2>{answers.length > 1 && <div className="ra-toggle" aria-label="Answer version"><button type="button" aria-pressed={view === 'baseline'} onClick={() => setView('baseline')}>Free answer · v{answers[0]?.version}</button><button type="button" aria-pressed={view === 'latest'} onClick={() => setView('latest')}>Latest answer</button></div>}</div>
    {!answer ? <p role="status">{run.phase === 'FAILED' || run.phase === 'STOPPED' ? 'No verified answer is available. Ask again to begin a new run.' : 'Gathering evidence. Verified claims will appear here as the run progresses.'}</p> : <>
      <p className="ra-eyebrow">{answer.provider === 'fixture' ? 'Fixture' : 'Groq'} · {answer.model}</p>
      <p className="ra-conclusion">{answer.conclusion}</p>
      <ol className="ra-claims">{answer.claims.map(claim => <li key={claim.id}><span className="ra-stance">{claim.stance.toLowerCase()}</span><p>{claim.text} {claim.citations.map(citation => {
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
