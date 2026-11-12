import Icon from './Icon'
import WriterProvenance from './WriterProvenance'
import { REFUND_LABEL } from '../copy'
import { sameSource, sourceKey } from '../../shared/source-identity.js'
import { useEffect, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts'
import { articleCount, candidateOf, money, purchaseCounts } from '../format'
import { deriveRunState } from '../runState'

/** Steps that have not started read as plans, not results. */
const UPCOMING: Record<string, string> = { search: 'Search writers', read: 'Read free sources', answer: 'Draft an answer from free sources', decide: 'Choose an article worth buying', buy: 'Pay the writer, only if an article helps', proof: 'Check the article against the writer’s promises', rewrite: 'Update the answer with verified evidence' }
/** The step in progress reads in the present tense. Purchases keep their own Paying/Paid wording. */
const ACTIVE: Record<string, string> = { search: 'Searching writers…', read: 'Reading free sources…', answer: 'Drafting an answer from free sources…', decide: 'Choosing an article…', rewrite: 'Updating the answer…' }

export default function RunActivity({ run, actualTerminal, onStop, stopping, onShowWork }: { run: RunSnapshot; actualTerminal?: boolean; onStop: () => void; stopping: boolean; onShowWork: () => void }) {
  const state = deriveRunState(run), done = state.terminal
  const labels = { searching: 'Searching free sources…', deciding: 'Choosing an article…', buying: 'Paying the writer…', verifying: 'Checking the article…', writing: 'Updating the answer…', refunding: REFUND_LABEL.pending, recovering: 'Finishing after a restart…', failed: 'Couldn’t finish', stopped: 'Stopped', done: 'Done', idle: 'Ready', planning: 'Planning', clarifying: 'Clarifying' }
  const [spinning, setSpinning] = useState(false)
  useEffect(() => { if (done) return; const timer = setTimeout(() => setSpinning(true), 400); return () => clearTimeout(timer) }, [done])
  const activity = state.rows.filter(row => ['search','read','answer','decide','buy','rewrite','proof','refund'].includes(row.kind))
  if (run.budgetMinor > 0 && !activity.some(row => row.kind === 'proof')) {
    const buyIndex = activity.findIndex(row => row.kind === 'buy')
    if (buyIndex >= 0) activity.splice(buyIndex + 1, 0, { key: 'todo-proof', kind: 'proof', title: 'Check the article against the writer’s promises', state: 'todo', meta: '' })
  }
  const { paid: bought, refunded, cancelled } = purchaseCounts(run)
  const firstDraft = run.events.find(e => e.type === 'FREE_DRAFT' && typeof e.data?.elapsedMs === 'number')
  const start = firstDraft ? Date.parse(firstDraft.at) - Number(firstDraft.data!.elapsedMs) : run.events[0] ? Date.parse(run.events[0].at) : undefined
  // The run ends at its DONE (or STOPPED) event. Anchoring on the ledger lands seconds later and is reported by its own line, so the time
  // reads the same live and after a reload ("Done in 16.3 s" never becomes "24.6 s", R8 H8-14).
  const ended = [...run.events].reverse().find(event => event.type === 'DONE' || event.type === 'STOPPED') ?? run.events.at(-1)
  const elapsed = start !== undefined && ended ? Math.max(0, (Date.parse(ended.at) - start) / 1000) : 0
  const took = import.meta.env.MODE === 'browser-demo' && elapsed > 120 ? 'a replay with the 2 min wait skipped' : elapsed >= 1 ? `${elapsed.toFixed(1)} s` : elapsed > 0 ? 'under 1 s' : 'an unrecorded duration'
  // "Paid for" is the same count as "bought" in the sources strip (purchaseCounts). The net cost drops out on a phone, where the spend line above already says it.
  const net = money(Math.max(0, run.spentMinor - (run.refundedMinor ?? 0)))
  // A run that bought nothing says so once, in the answer below ("Nothing was bought: …"); the status line only reports the time.
  const outcome = bought ? <>{`Paid for ${articleCount(bought)}${refunded ? `, ${refunded} refunded` : ''}.`}<span className="ra-net-cost">{` Net cost ${net}.`}</span></> : run.answers.some(a => a.claims.length) ? 'Answered from free sources. Nothing spent.' : undefined
  const summary = state.phase !== 'done' ? labels[state.phase] : <>{`Done in ${took}.`}{outcome && ' '}{outcome}{cancelled > 0 && ` ${cancelled} attempt${cancelled === 1 ? '' : 's'} cancelled, funds returned.`}</>
  return <section className={`ra-run-activity${done ? ' is-done' : ''}`} aria-label="Run activity"><div className="ra-run-status"><p role="status">{!done && spinning && <i className="ra-spinner" aria-hidden="true" />}{summary}</p>{!done && !actualTerminal && <button className="ra-link" disabled={stopping} onClick={onStop}>Stop buying ⌘.</button>}<button className="ra-link ra-show-work" onClick={onShowWork}>Show work</button></div>
    <details key={run.runId} className="ra-activity-details" open={!done}><summary>Activity</summary><ol className="ra-activity-list">{activity.map((row, index, rows) => {
      const next = rows[index + 1]?.event?.at
      const span = row.event && next ? Math.max(0, (Date.parse(next) - Date.parse(row.event.at)) / 1000) : 0
      // Sub-0.1 s steps (offline fixtures) read as "0.0 s"; show only durations a reader can feel.
      const seconds = span >= 0.1 ? span.toFixed(1) : undefined
      const intent = run.intents.find(i => row.event?.data?.intentId ? i.intentId === row.event.data.intentId : !i.source && i.resourceId === row.event?.data?.resourceId)
      const purchaseIndex = rows.slice(0, index + 1).filter(r => r.kind === 'buy').length - 1
      const paid = intent ?? run.intents[purchaseIndex]
      const source = paid && candidateOf(run, paid)
      const name = source?.publisher.split(' · ')[0] ?? 'the article'
      const roundIndex = rows.slice(0,index + 1).filter(r => r.kind === 'decide').length - 1
      const round = run.decisions[roundIndex]
      const chosen = round?.rows.find(r => round.selectedSourceKey ? sourceKey(r.candidate) === round.selectedSourceKey : r.verdict === 'BUY')?.candidate.publisher.split(' · ')[0]
      const freeRead = run.contents.filter(c => c.spans.length > 0 && run.candidates.some(s => sameSource(s,c) && s.tier === 'FREE')).length
      // A step in progress reads as such until its result exists (no "Searched · 0 sources" mid-search).
      const inProgress = row.state === 'now' && (row.kind === 'decide' ? !round : row.kind === 'search' ? !run.candidates.length : row.kind === 'read' ? !freeRead : true)
      const cancelledAttempt = paid && (paid.escrow?.state === 'CANCELLED' || paid.status === 'FAILED_NOT_SETTLED')
      const title = row.state === 'todo' && UPCOMING[row.kind] ? UPCOMING[row.kind] : inProgress && ACTIVE[row.kind] ? ACTIVE[row.kind] : row.state === 'now' && row.kind === 'proof' ? `Checking ${name} against the writer’s promises` : row.kind === 'answer' ? freeRead ? 'Drafted an answer from free sources' : 'No free evidence found; checking paid previews' : row.kind === 'rewrite' ? 'Updated the answer with verified evidence' : row.kind === 'buy' ? cancelledAttempt ? `Attempt cancelled${paid?.escrow?.state === 'CANCELLED' ? ', funds returned' : ' · nothing charged'} · ${name}` : `${paid && run.receipts.some(r => r.intentId === paid.intentId) ? 'Paid' : 'Paying'} ${name} ${paid ? money(paid.amountMinor) : ''}` : row.kind === 'refund' ? `${intent?.status === 'REFUNDED' ? 'Refunded' : intent?.status === 'CHALLENGE_REFUSED' ? 'Refund refused for' : intent?.status === 'CHALLENGE_REJECTED' ? `${REFUND_LABEL.refused} for` : `${REFUND_LABEL.pending} for`} ${name}` : row.kind === 'proof' ? row.state === 'todo' ? 'Check the article against the writer’s promises' : `Checked ${name} against the writer’s promises` : row.kind === 'decide' ? chosen ? `Chose ${chosen} from ${round.rows.length} paid article${round.rows.length === 1 ? '' : 's'}` : `Considered ${round?.rows.length ?? 0} paid article${round?.rows.length === 1 ? '' : 's'}; none bought` : row.kind === 'search' ? `Searched writers · ${run.candidates.length} source${run.candidates.length === 1 ? '' : 's'}` : row.kind === 'read' ? freeRead ? `Read ${freeRead} free source${freeRead === 1 ? '' : 's'}` : 'No free evidence found; checking paid previews' : row.title

      // Upcoming steps never wear a check mark: nothing is paid or checked until its event arrives.
      return <li key={row.key} className={`is-${row.state}`}><span><i aria-hidden="true"><Icon name={row.state === 'todo' ? 'circle' : row.state === 'now' ? 'clock' : 'check'} size={16} /></i>{row.state === 'todo' && <span className="ra-sr">Next: </span>}<span>{title}{row.kind === 'buy' && source && <WriterProvenance nameShown publisher={source.publisher} testnet={run.labels.settlement.startsWith('XRPL')} />}</span></span><small>{seconds && `${seconds} s`}</small></li>
    })}</ol></details>
  </section>
}
