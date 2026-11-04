import { keywordCoverage, searchWords } from '../../publisher/search-text.js'
import AnchorStatus from './AnchorStatus'
import { sameSource } from '../../shared/source-identity.js'
/* eslint-disable react-refresh/only-export-components -- Shared validation for impact/report components. */
import type { ReactNode } from 'react'
import { AnswerSchema, type Answer as AnswerData, type Citation, type Claim, type RunSnapshot } from '../../shared/contracts/index.js'
import { getAccessibleContent } from './Sources'
import { candidateOf, citationKey } from '../format'
import { leadFinding } from '../../shared/lead-finding.js'
import { FACT_STATUS, factsSummary } from '../../shared/coverage.js'

export function getValidatedAnswer(run: RunSnapshot, answer?: AnswerData): AnswerData | undefined {
  const parsed = AnswerSchema.safeParse(answer)
  if (!parsed.success) return undefined
  const claims = parsed.data.claims.filter(claim => claim.citations.every(citation => {
    const candidate = run.candidates.find(item => sameSource(item, citation))
    const content = candidate && getAccessibleContent(run, candidate)
    const span = content?.spans.find(item => item.id === citation.spanId)
    return !!span && !!content?.body.includes(span.text)
  }))
  if (!claims.length) return undefined
  // Never retain unsupported synthesis after dropping an invalid claim.
  return claims.length === parsed.data.claims.length ? parsed.data : { ...parsed.data, claims, conclusion: 'Some claims were withheld because their evidence could not be verified.', openGaps: [] }
}
/** Every validated answer, oldest first. */
export function validatedAnswers(run: RunSnapshot): AnswerData[] {
  const draft = run.events.find(event => event.type === 'FREE_DRAFT')?.data?.answer
  const parsed = AnswerSchema.safeParse(draft)
  const answers = run.answers.length ? run.answers : parsed.success ? [parsed.data] : []
  return [...answers].sort((a, b) => a.version - b.version)
    .map(item => getValidatedAnswer(run, item)).filter((item): item is AnswerData => !!item)
}

/** One citation number per passage for the whole run, so v2 keeps v1's numbers (the PDF should match). */
export function citationNumbers(answers: AnswerData[]): Map<string, number> {
  const numbers = new Map<string, number>()
  for (const answer of answers) for (const claim of answer.claims) for (const citation of claim.citations) if (!numbers.has(citationKey(citation))) numbers.set(citationKey(citation), numbers.size + 1)
  return numbers
}

const GROUPS: [Claim['stance'], string][] = [['SUPPORTS', 'Supports'], ['CHALLENGES', 'Disputes'], ['UNCERTAIN', 'Unclear']]

export interface AnswerProps { run: RunSnapshot; onCitation?: (citation: Citation) => void; view: 'latest' | 'baseline'; onView: (view: 'latest' | 'baseline') => void; compare: boolean; onCompare: () => void; report?: ReactNode }
export default function Answer({ run, onCitation, view, compare, onCompare, report }: AnswerProps) {
  const answers = validatedAnswers(run), baseline = answers[0], answer = view === 'baseline' ? baseline : answers.at(-1)
  const numbers = citationNumbers(answers)
  const cites = (claim: Claim) => claim.citations.map(citation => {
    const number = numbers.get(citationKey(citation)) ?? 0
    const source = candidateOf(run, citation)
    return <sup key={citationKey(citation)}><button className="ra-cite" type="button" disabled={!onCitation} aria-label={`Citation ${number}: ${source?.title ?? citation.resourceId}, exact passage`} onClick={() => onCitation?.(citation)}>{number}</button></sup>
  })
  if (!answer) return <section className="ra-verdict" aria-label="Research answer" aria-busy={!['FAILED','STOPPED'].includes(run.phase)}><h2 className="ra-caption">Answer</h2>{['FAILED','STOPPED'].includes(run.phase) ? <p>No verified answer is available. Ask again to begin a new run.</p> : <div className="ra-vtext is-skel" aria-hidden="true"><i /><i /><i /></div>}</section>
  const lead = leadFinding(run.question, answer.claims)
  const added = answer.claims.filter(c => !baseline?.claims.some(b => b.text === c.text))
  const dropped = baseline?.claims.filter(c => !answer.claims.some(b => b.text === c.text)) ?? []
  const hasPaidEvidence = answer.claims.some(claim => claim.citations.some(ref => candidateOf(run, ref)?.tier === 'PAID'))
  const draft = run.phase !== 'DONE'
  const groups: [string, Claim[]][] = compare ? [['Added', added], ['Dropped', dropped]] : GROUPS.map(([stance, label]) => [label, answer.claims.filter(c => c.stance === stance && (stance !== 'UNCERTAIN' || keywordCoverage(run.question, searchWords([c.text, ...c.citations.flatMap(ref => { const source = candidateOf(run, ref); return source ? [source.title, source.preview] : [] })].join(' '))) >= 0.5))])
  return <>
    <section className="ra-verdict" aria-label="Research answer">
      <div className="ra-answer-heading"><h2 className="ra-caption">{draft ? hasPaidEvidence ? 'Draft · verified evidence' : 'Draft · free sources only' : 'Lead finding'}</h2>{report}</div>
      {lead.length ? <p className="ra-vtext">{lead.map(item => <span key={item.text}>{item.text}{cites(item.claim)}{' '}</span>)}</p> : <p>No concise finding could be selected from the verified evidence.</p>}
      {hasPaidEvidence && <details className="ra-answer-update"><summary>Updated with paid evidence</summary><p>{added.length} added claims, {dropped.length} removed. Only verified passages are included.</p><button type="button" className="ra-link" onClick={onCompare}>See what changed after the purchase</button></details>}
      {answer.openGaps.length > 0 && <details className="ra-answer-context"><summary>Still unanswered ({answer.openGaps.length})</summary><ul>{answer.openGaps.map(gap => <li key={gap.text}>{gap.text}</li>)}</ul></details>}
      <AnchorStatus run={run} />
    </section>
    {!compare && <RequestedFacts run={run} version={answer.version} />}
    {compare && <button type="button" className="ra-link" onClick={onCompare}>Back to answer</button>}
    <section className="ra-claims" aria-label={compare ? 'What changed after the purchase' : 'Claims'}>{groups.map(([name, items]) => items.length ? <div className="ra-group" key={name}><h3>{name} ({items.length})</h3><ul>{items.map(claim => <li key={claim.id} className="ra-claim"><p>{leadFinding(run.question, [claim])[0]?.text ?? claim.text}{cites(claim)}</p></li>)}</ul></div> : null)}{compare && !added.length && !dropped.length && <p>The cited claims are unchanged.</p>}</section>
  </>
}

function RequestedFacts({ run, version }: { run: RunSnapshot; version: number }) {
  const summary = factsSummary(run, version)
  if (!summary) return null
  return <details className="ra-facts" aria-label="Requested facts"><summary>{summary.line}</summary><ul>{summary.facts.map(fact => <li key={fact.id} className={`f-${fact.status}`}><span>{FACT_STATUS[fact.status]}</span>{fact.text}</li>)}</ul></details>
}
