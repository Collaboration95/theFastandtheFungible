import { useEffect, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts'
import { candidateOf, money } from '../format'
import { deriveRunState } from '../runState'

export default function RunActivity({ run, onStop, stopping, onShowWork }: { run: RunSnapshot; onStop: () => void; stopping: boolean; onShowWork: () => void }) {
  const state = deriveRunState(run), done = state.terminal
  const labels = { searching: 'Searching free sources…', deciding: 'Choosing an article…', buying: 'Paying the writer…', verifying: 'Checking the article…', writing: 'Updating the answer…', refunding: 'Refunding…', recovering: 'Recovering', failed: 'Failed', stopped: 'Stopped', done: 'Done', idle: 'Ready', planning: 'Planning', clarifying: 'Clarifying' }
  const [spinning, setSpinning] = useState(false)
  useEffect(() => { if (done) return; const timer = setTimeout(() => setSpinning(true), 400); return () => clearTimeout(timer) }, [done])
  const [expanded, setExpanded] = useState(!done)
  const bought = run.receipts.length
  const elapsed = run.events.length > 1 ? Math.max(0, (Date.parse(run.events.at(-1)!.at) - Date.parse(run.events[0].at)) / 1000) : 0
  return <section className="ra-run-activity" aria-label="Run activity"><div className="ra-run-status"><p role="status">{!done && spinning && <i className="ra-spinner" aria-hidden="true" />}{labels[state.phase]}{state.phase === 'done' && ` · ${bought ? `${bought} article${bought === 1 ? '' : 's'} bought${run.intents.some(i => i.status === 'REFUNDED') ? ` · ${run.intents.filter(i => i.status === 'REFUNDED').length} refunded` : ''} · net ${money(run.spentMinor - (run.refundedMinor ?? 0))}` : 'answered from free sources · S$0.00'} · ${elapsed.toFixed(1)} s`}</p>{!done && <button className="ra-link" disabled={stopping} onClick={onStop}>Stop buying ⌘.</button>}<button className="ra-link" onClick={onShowWork}>Show work</button></div>
    <details className="ra-activity-details" open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}><summary>Activity</summary><ol className="ra-activity-list">{state.rows.filter(row => ['search', 'read', 'answer', 'decide', 'buy', 'rewrite', 'refund', 'proof'].includes(row.kind)).map((row, index, rows) => {
      const next = rows[index + 1]?.event?.at
      const seconds = row.event && next ? Math.max(0, (Date.parse(next) - Date.parse(row.event.at)) / 1000).toFixed(1) : undefined
      const intent = run.intents.find(i => i.intentId === row.event?.data?.intentId || i.resourceId === row.event?.data?.resourceId)
      const purchaseIndex = rows.slice(0, index + 1).filter(r => r.kind === 'buy').length - 1
      const paid = intent ?? run.intents[purchaseIndex]
      const source = paid && candidateOf(run, paid)
      const name = source?.publisher ?? 'the article'
      const roundIndex = rows.slice(0,index + 1).filter(r => r.kind === 'decide').length - 1
      const round = run.decisions[roundIndex]
      const chosen = round?.rows.find(r => r.verdict === 'BUY')?.candidate.publisher
      const title = row.kind === 'answer' ? 'Drafted an answer from free sources' : row.kind === 'rewrite' ? 'Updated the answer with verified evidence' : row.kind === 'buy' ? `${paid && run.receipts.some(r => r.intentId === paid.intentId) ? 'Paid' : 'Paying'} ${name} ${paid ? money(paid.amountMinor) : ''}` : row.kind === 'refund' ? `Refunded ${name}` : row.kind === 'proof' ? `Checked ${name} against the writer’s promises` : row.kind === 'decide' ? chosen ? `Selected ${chosen} from ${round.rows.length} paid articles` : `Considered ${round?.rows.length ?? 0} paid articles; none selected` : row.kind === 'search' ? `Searched writers · ${run.candidates.length} sources` : row.kind === 'read' ? `Read ${run.contents.filter(c => run.candidates.some(s => s.resourceId === c.resourceId && s.tier === 'FREE')).length} free sources` : row.title

      return <li key={row.key}><span>{row.state === 'now' ? '○' : '✓'} {title}</span><small>{seconds && `${seconds} s`}</small></li>
    })}</ol></details>
  </section>
}
