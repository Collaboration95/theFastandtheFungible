/* eslint-disable react-refresh/only-export-components -- Shared validation for impact/report components. */
import type { CSSProperties, ReactNode } from 'react'
import { AnswerSchema, providerLabels, type Answer as AnswerData, type Citation, type Claim, type RunSnapshot } from '../../shared/contracts/index.js'
import { getAccessibleContent } from './Sources'
import { candidateOf, citationKey, leadSentence, money } from '../format'
import { FACT_STATUS, factsSummary } from '../../shared/coverage.js'

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
/** Every validated answer, oldest first. */
export const validatedAnswers = (run: RunSnapshot) => [...run.answers].sort((a, b) => a.version - b.version).map(item => getValidatedAnswer(run, item)).filter((item): item is AnswerData => !!item)

/** One citation number per passage for the whole run, so v2 keeps v1's numbers (the PDF should match). */
export function citationNumbers(answers: AnswerData[]): Map<string, number> {
  const numbers = new Map<string, number>()
  for (const answer of answers) for (const claim of answer.claims) for (const citation of claim.citations) if (!numbers.has(citationKey(citation))) numbers.set(citationKey(citation), numbers.size + 1)
  return numbers
}

const PEN = <svg className="ra-pen" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength={1} d="M14 30 C 16 10, 80 3, 120 5 C 170 7, 197 18, 193 33 C 189 51, 120 58, 78 55 C 34 52, 4 44, 9 27 C 13 16, 34 9, 58 8" /></svg>
/** The paid evidence's effect on the free answer, as a flat tag (the explanation is its tooltip). */
const IMPACT = { STRENGTHENS: 'Strengthens the free answer', QUALIFIES: 'Qualifies the free answer', CONTRADICTS: 'Contradicts the free answer', UNCHANGED: 'Leaves the free answer unchanged' } as const
const GROUPS: [Claim['stance'], string, string][] = [['CHALLENGES', 'Challenges', '▼'], ['SUPPORTS', 'Supports', '▲'], ['UNCERTAIN', 'Uncertain', '◆']]

export interface AnswerProps { run: RunSnapshot; onCitation?: (citation: Citation) => void; view: 'latest' | 'baseline'; onView: (view: 'latest' | 'baseline') => void; compare: boolean; onCompare: () => void; report?: ReactNode }
export default function Answer({ run, onCitation, view, onView, compare, onCompare, report }: AnswerProps) {
  const answers = validatedAnswers(run)
  const numbers = citationNumbers(answers)
  const baseline = answers[0]
  const latest = answers.at(-1)
  const answer = view === 'baseline' ? baseline : latest
  const raw = (version?: number) => run.answers.find(item => item.version === version)
  // Impact is shown only when neither version lost claims to citation validation.
  const impact = baseline && latest && baseline.version !== latest.version && run.impact && baseline.claims.length === raw(baseline.version)?.claims.length && latest.claims.length === raw(latest.version)?.claims.length ? run.impact : undefined
  const showLatest = answer === latest && answers.length > 1
  const changed = new Set(showLatest ? impact?.claimChanges.filter(change => change.change === 'ADDED' || change.change === 'REVISED').map(change => change.toClaimId) : [])
  const removed = showLatest && impact ? impact.claimChanges.filter(change => change.change === 'REMOVED' && change.fromClaimId).map(change => baseline.claims.find(claim => claim.id === change.fromClaimId)).filter((claim): claim is Claim => !!claim) : []
  const firstKeys = new Set(baseline?.claims.flatMap(claim => claim.citations.map(citationKey)))
  const chip = (citation: Citation) => {
    const number = numbers.get(citationKey(citation)) ?? 0
    const source = candidateOf(run, citation)
    return <button className={`ra-cite${firstKeys.has(citationKey(citation)) ? '' : ' is-new'}`} type="button" key={citationKey(citation)} disabled={!onCitation} title={source ? `${source.publisher} · ${source.title}` : undefined} aria-label={`Citation ${number}: ${source?.title ?? citation.resourceId}, exact passage`} onClick={() => onCitation?.(citation)}>{number}</button>
  }
  const cites = (claim: Claim) => claim.citations.map(chip)

  if (!answer) return <section className="ra-verdict" aria-label="Research answer" aria-busy="true">
    <div className="ra-vlabel"><h2>Short answer</h2><span className="ra-ver">{run.phase === 'FAILED' || run.phase === 'STOPPED' ? 'no verified answer' : 'reading free sources'}</span></div>
    <div className="ra-vtext is-skel" aria-hidden="true"><i style={{ width: '92%' }} /><i style={{ width: '84%' }} /><i style={{ width: '46%' }} /></div>
    {(run.phase === 'FAILED' || run.phase === 'STOPPED') && <p className="ra-vnote" role="status">No verified answer is available. Ask again to begin a new run.</p>}
  </section>

  const lead = leadSentence(answer.conclusion)
  // The rest of the conclusion, minus sentences the claims below already say.
  const said = new Set(answer.claims.map(claim => claim.text.trim()))
  // Split only where punctuation is followed by a space and a capital, as leadSentence does, so "55.2%" stays whole.
  const rest = answer.conclusion.slice(lead.length).split(/(?<=[.!?])\s+(?=[A-Z])/).map(item => item.trim()).filter(item => item && !said.has(item)).join(' ')
  const leadClaims = answer.claims.filter(claim => claim.text.trim() === lead.trim() || lead.includes(claim.text.trim()))
  const words = lead.split(/(\s+)/)
  const highlight = showLatest && leadClaims.some(claim => changed.has(claim.id))
  const gap = gapCard(run, answers)
  const list = compare && showLatest ? [...answer.claims, ...removed.map(claim => ({ ...claim, gone: true }))] : answer.claims
  return <>
    <section className={`ra-verdict${impact && showLatest ? ' has-impact' : ''}`} aria-label="Research answer" key={`v${answer.version}`}>
      <div className="ra-vlabel"><h2>Short answer</h2></div>
      {answers.length > 1 && <div className="ra-vswitch" role="group" aria-label="Answer version">{answers.map(item => <button type="button" key={item.version} aria-pressed={item === answer} onClick={() => onView(item === latest ? 'latest' : 'baseline')}>v{item.version}</button>).filter((_, index) => index === 0 || index === answers.length - 1)}</div>}
      <p className={`ra-vtext${highlight ? ' is-hl' : ''}`}><span className="ra-lead">{words.map((word, index) => /^\s+$/.test(word) ? word : <span className="w" key={index} style={{ '--d': `${index * 22}ms` } as CSSProperties}>{word}</span>)}</span>{leadClaims.flatMap(cites)}</p>
      {rest && <p className="ra-vrest">{rest}</p>}
      {impact && showLatest && <p className={`ra-impact i-${impact.classification.toLowerCase()}`} title={impact.explanation}>{IMPACT[impact.classification]}</p>}
      <div className="ra-vfoot">{report}{answers.length > 1 && <button type="button" className="ra-btn" aria-pressed={compare} onClick={onCompare}>{compare ? `Back to v${latest!.version}` : `Compare v1 → v${latest!.version}`}</button>}{answer.provider === 'fixture' && <span className="ra-hint">{providerLabels[answer.provider]} · {answer.model}</span>}</div>
    </section>
    {!compare && <RequestedFacts run={run} version={answer.version} />}
    {!compare && gap}
    <section className="ra-claims" aria-label="Claims">
      {GROUPS.map(([stance, name, glyph]) => {
        const items = list.filter(claim => claim.stance === stance)
        if (!items.length) return null
        return <div className="ra-group" key={stance}><h3>{name} <em>{items.length}</em></h3><ul>{items.map(claim => {
          const gone = 'gone' in claim
          return <li key={claim.id + (gone ? '-gone' : '')} className={`ra-claim${changed.has(claim.id) ? ' is-new' : ''}${gone ? ' is-gone' : ''}`}><span className={`ra-sg s-${stance.toLowerCase()}`} aria-hidden="true">{glyph}</span><p>{changed.has(claim.id) && <span className="ra-new">NEW</span>}{gone && <span className="ra-new">REMOVED</span>}{claim.text}{cites(claim)}</p></li>
        })}</ul></div>
      })}
      {!compare && removed.length > 0 && <p className="ra-dropped">{removed.length} claim{removed.length === 1 ? '' : 's'} from v1 {removed.length === 1 ? 'was' : 'were'} dropped. <button type="button" className="ra-link" onClick={onCompare}>Compare v1 → v{latest!.version}</button></p>}
    </section>
  </>
}

/** Requested facts (#208, #209): one line ("2 of 3 answered"), the per-fact list on demand. */
function RequestedFacts({ run, version }: { run: RunSnapshot; version: number }) {
  const summary = factsSummary(run, version)
  if (!summary) return null
  return <details className="ra-facts" aria-label="Requested facts">
    <summary>{summary.line}</summary>
    <ul>{summary.facts.map(fact => <li key={fact.id} className={`f-${fact.status}`}><span>{FACT_STATUS[fact.status]}</span>{fact.text}</li>)}</ul>
  </details>
}

/** The gap is the hinge: circled in v1, priced by the decision model, filled in v2. */
function gapCard(run: RunSnapshot, answers: AnswerData[]): ReactNode {
  const first = answers[0], latest = answers.at(-1)
  const gap = first?.openGaps[0]
  if (!first || !latest || !gap) return null
  const facet = (gap.tags?.[0] ?? gap.text).replace(/-/g, ' ')
  const bought = run.intents.filter(item => item.runId === run.runId && item.status === 'VERIFIED').map(item => candidateOf(run, item)?.publisher ?? item.resourceId)
  if (answers.length > 1 && !latest.openGaps.some(item => item.text === gap.text)) {
    const spent = run.intents.filter(item => item.runId === run.runId && item.status === 'VERIFIED').reduce((sum, item) => sum + item.amountMinor, 0)
    return <section className="ra-gap is-closed" aria-label="Gap closed"><span className="ra-gap-k">GAP CLOSED</span><p className="ra-gap-t"><mark className="ra-hl">{facet[0].toUpperCase() + facet.slice(1)}</mark> is now covered{bought.length ? ` by ${bought.join(' and ')}` : ''}.</p>
      <span className="ra-gap-s">{bought.length ? `Bought for ${money(spent)}` : 'Found free on a focused search'}</span></section>
  }
  const intent = run.intents.filter(item => item.runId === run.runId).at(-1)
  const source = intent && candidateOf(run, intent)
  const would = run.decisions[0]?.rows.find(row => row.wouldBuy)
  // Outcomes only: the run bar already narrates what is happening.
  const sub = intent?.status === 'DELIVERY_FAILED' ? 'Paid, waiting on delivery.'
    : intent?.status === 'FAILED_NOT_SETTLED' ? 'Payment didn’t settle. Nothing was charged.'
      : intent?.status === 'VERIFIED' && answers.length > 1 ? `Bought ${source?.publisher ?? 'a source'}, but the gap is still open.`
        : intent ? undefined
          : run.budgetMinor === 0 && would ? `${would.candidate.publisher} (${money(would.candidate.price.amountMinor)}) would close it. Budget is S$0.`
            : run.decisions.length ? 'Nothing paywalled was worth buying. The free answer stands.' : undefined
  const at = gap.text.toLowerCase().indexOf(facet)
  return <section className="ra-gap" aria-label="Open gap"><span className="ra-gap-k">OPEN GAP</span>
    <p className="ra-gap-t">{at < 0 ? gap.text : <>{gap.text.slice(0, at)}<span className="ra-circ">{gap.text.slice(at, at + facet.length)}{PEN}</span>{gap.text.slice(at + facet.length)}</>}</p>
    {sub && <span className="ra-gap-s">{sub}</span>}</section>
}
