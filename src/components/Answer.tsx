import { findingText } from '../../shared/finding-text.js'
import { summarizeAnswer } from '../../shared/answer-summary.js'
import { declineSummary } from '../../shared/decline.js'
import { keywordCoverage, searchWords } from '../../publisher/search-text.js'
import AnchorStatus from './AnchorStatus'
import ShareProof from './ShareProof'
import { sameSource } from '../../shared/source-identity.js'
/* eslint-disable react-refresh/only-export-components -- Shared validation for impact/report components. */
import type { ReactNode } from 'react'
import { AnswerSchema, type Answer as AnswerData, type Citation, type Claim, type RunSnapshot } from '../../shared/contracts/index.js'
import { getAccessibleContent } from './Sources'
import { articleCount, candidateOf, citationKey, plainVerdict } from '../format'
import Icon from './Icon'
import { VERDICT_WORDS } from '../../shared/refusal-proof.js'
import { VERDICT_LABEL } from '../copy'
import { answerBoilerplate, leadFinding, remainingClaims } from '../../shared/lead-finding.js'
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
  return claims.length === parsed.data.claims.length ? parsed.data : { ...parsed.data, lead: undefined, claims, conclusion: 'Some claims were withheld because their evidence could not be verified.', openGaps: [] }
}
/** Every validated answer, oldest first. */
export function validatedAnswers(run: RunSnapshot): AnswerData[] {
  const draft = run.events.find(event => event.type === 'FREE_DRAFT')?.data?.answer
  const parsed = AnswerSchema.safeParse(draft)
  const answers = run.answers.length ? run.answers : parsed.success ? [parsed.data] : []
  return [...answers].sort((a, b) => a.version - b.version)
    .map(item => getValidatedAnswer(run, item)).filter((item): item is AnswerData => !!item)
}

/** Citations numbered 1…n by first appearance in the claims as they are shown (lead first, then the lists), so a one-source
    answer reads 1, never 10 or 11 because an earlier draft cited other passages. */
export function citationNumbersFor(claims: Claim[]): Map<string, number> {
  const numbers = new Map<string, number>()
  for (const claim of claims) for (const citation of claim.citations) if (!numbers.has(citationKey(citation))) numbers.set(citationKey(citation), numbers.size + 1)
  return numbers
}
export const citationNumbers = (answers: AnswerData[]): Map<string, number> => citationNumbersFor(answers.flatMap(answer => answer.claims))
/** A finding ends in terminal punctuation, so the superscript that follows never reads as an exponent (58.5%¹). */
const finding = (text: string) => /[.!?…]["')\]”’]*$/.test(text.trim()) ? text.trim() : `${text.trim()}.`

const GROUPS: [Claim['stance'], string][] = [['SUPPORTS', 'Supports'], ['CHALLENGES', 'Disputes'], ['UNCERTAIN', 'Cited findings']]

export interface AnswerProps { run: RunSnapshot; onCitation?: (citation: Citation) => void; view: 'latest' | 'baseline'; onView: (view: 'latest' | 'baseline') => void; compare: boolean; onCompare: () => void; report?: ReactNode }
export default function Answer({ run, onCitation, view, compare, onCompare, report }: AnswerProps) {
  const answers = validatedAnswers(run), baseline = answers[0], answer = view === 'baseline' ? baseline : answers.at(-1)
  if (!answer && run.phase === 'DONE') {
    const considered = run.decisions.flatMap(round => round.rows.map((row, i) => ({ key: `${round.round}-${i}`, row })))
    // The status line above says "Done in …"; this block carries the one plain sentence for the outcome, then the reasons.
    return <section className="ra-verdict" aria-label="Research answer"><div className="ra-answer-heading"><h2 className="ra-caption">Answer</h2>{report}</div><p>{run.receipts.length ? 'No verified answer is available from these purchases.' : declineSummary(run)}</p>{considered.length > 0 && <details className="ra-why-not" open={considered.length <= 6 || undefined}><summary><span>Why nothing was bought</span><span className="ra-why-count"> · {articleCount(considered.length)} considered</span></summary><ul>{considered.map(({ key, row }) => <li key={key}><b>{row.candidate.title}</b><span className="ra-why-verdict">{plainVerdict(row, run).stamp === 'Would buy' ? 'Would buy' : VERDICT_WORDS[row.verdict] ?? VERDICT_LABEL[row.verdict] ?? row.verdict}</span><p>{row.reason}</p></li>)}</ul></details>}<AnchorStatus run={run} /><ShareProof run={run} /><a href="https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/publishing.md">Write about this topic →</a></section>
  }
  if (!answer) return <section className="ra-verdict" aria-label="Research answer" aria-busy={!['FAILED','STOPPED'].includes(run.phase)}><h2 className="ra-caption">Answer</h2>{['FAILED','STOPPED'].includes(run.phase) ? <p>No verified answer is available. Ask again to begin a new run.</p> : <div className="ra-vtext is-skel" aria-hidden="true"><i /><i /><i /></div>}</section>
  const delivered = run.candidates.flatMap(candidate => { const content = getAccessibleContent(run, candidate); return content ? [content] : [] })
  const summary = answer.lead ? answer : summarizeAnswer(run.question, answer, delivered.filter(c => answer.claims.some(claim => claim.citations.some(ref => sameSource(c, ref)))), run.candidates)
  const lead = summary.lead ?? []
  const leadText = lead.map(item => item.text).join(' ')
  const context = summary.conclusion.startsWith(leadText) ? summary.conclusion.slice(leadText.length).trim() : summary.conclusion
  const added = answer.claims.filter(c => !baseline?.claims.some(b => b.text === c.text))
  const dropped = baseline?.claims.filter(c => !answer.claims.some(b => b.text === c.text)) ?? []
  const hasPaidEvidence = answer.claims.some(claim => claim.citations.some(ref => candidateOf(run, ref)?.tier === 'PAID'))
  const draft = !['DONE', 'STOPPED', 'FAILED'].includes(run.phase)
  const groups: [string, Claim[]][] = compare ? [['Added', added], ['Dropped', dropped]] : GROUPS.map(([stance, label]) => [label, remainingClaims(run.question, answer.claims, lead, delivered, run.candidates).filter(c => c.stance === stance && !answerBoilerplate(c.text) && (!/^(?:I |My |Here |Speaking |Let me)/.test(c.text) && keywordCoverage(run.question, searchWords([c.text, ...c.citations.flatMap(ref => { const source = candidateOf(run, ref); return source ? [source.title, source.preview] : [] })].join(' '))) >= 0.5))])
  const numbers = citationNumbersFor([...lead.map(item => item.claim), ...groups.flatMap(([, items]) => items)])
  const cites = (claim: Claim) => claim.citations.map(citation => {
    const number = numbers.get(citationKey(citation))
    const source = candidateOf(run, citation)
    return <sup key={citationKey(citation)}><button className="ra-cite" type="button" disabled={!onCitation} aria-label={`Citation${number ? ` ${number}` : ''}: ${source?.title ?? citation.resourceId}, exact passage`} onClick={() => onCitation?.(citation)}>{number ?? <Icon name="external" size={16} />}</button></sup>
  })
  return <>
    <section className="ra-verdict" aria-label="Research answer">
      <div className="ra-answer-heading"><h2 className="ra-caption">{run.phase === 'STOPPED' ? 'Partial answer · stopped' : run.phase === 'FAILED' ? 'Partial answer · interrupted' : draft ? hasPaidEvidence ? 'Draft · verified evidence' : 'Draft · free sources only' : 'Lead finding'}</h2>{report}</div>
      {lead.length ? <p className="ra-vtext">{lead.map(item => <span key={item.text}>{finding(findingText(item.text))}{cites(item.claim)}{' '}</span>)}</p> : <p>No concise finding could be selected from the verified evidence.</p>}
      {context && <p>{findingText(context)}</p>}
      <AnchorStatus run={run} />
    </section>
    <details className="ra-answer-work" open={compare || undefined}><summary>Claims and gaps</summary>
      {hasPaidEvidence && <details className="ra-answer-update"><summary>Updated with paid evidence</summary><p>{added.length} added claims, {dropped.length} removed. Only verified passages are included.</p><button type="button" className="ra-link" onClick={onCompare}>See what changed after the purchase</button></details>}
      {answer.openGaps.length > 0 && <details className="ra-answer-context"><summary>Still unanswered ({answer.openGaps.length})</summary><ul>{answer.openGaps.map(gap => <li key={gap.text}>{gap.text}</li>)}</ul></details>}

    {!compare && <RequestedFacts run={run} version={answer.version} />}
    {compare && <button type="button" className="ra-link" onClick={onCompare}>Back to answer</button>}
    <section className="ra-claims" aria-label={compare ? 'What changed after the purchase' : 'Claims'}>{groups.map(([name, items]) => items.length ? <div className="ra-group" key={name}><h3>{name} ({items.length})</h3><ul>{items.map(claim => <li key={claim.id} className="ra-claim"><p>{finding(findingText(leadFinding(run.question, [claim], delivered, undefined, run.candidates)[0]?.text ?? claim.text))}{cites(claim)}</p></li>)}</ul></div> : null)}{compare && !added.length && !dropped.length && <p>The cited claims are unchanged.</p>}</section>
    </details>
  </>
}

function RequestedFacts({ run, version }: { run: RunSnapshot; version: number }) {
  const summary = factsSummary(run, version)
  if (!summary) return null
  return <details className="ra-facts" aria-label="Requested facts"><summary>{summary.line}</summary><ul>{summary.facts.map(fact => <li key={fact.id} className={`f-${fact.status}`}><span>{FACT_STATUS[fact.status]}</span>{fact.text}</li>)}</ul></details>
}
