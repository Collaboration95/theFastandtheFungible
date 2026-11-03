import { useEffect, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts'
import { money } from '../format'
import { deriveRunState } from '../runState'

export default function RunActivity({ run, onStop, stopping, onShowWork }: { run: RunSnapshot; onStop: () => void; stopping: boolean; onShowWork: () => void }) {
  const state = deriveRunState(run), done = state.terminal
  const labels = { searching: 'Searching free sources…', deciding: 'Choosing an article…', buying: 'Paying the writer…', verifying: 'Checking the article…', writing: 'Updating the answer…', refunding: 'Refunding…', recovering: 'Recovering', failed: 'Failed', stopped: 'Stopped', done: 'Done', idle: 'Ready', planning: 'Planning', clarifying: 'Clarifying' }
  const [spinning, setSpinning] = useState(false)
  useEffect(() => { if (done) return; const timer = setTimeout(() => setSpinning(true), 400); return () => clearTimeout(timer) }, [done])
  const [expanded, setExpanded] = useState(!done)
  const bought = run.receipts.length
  const elapsed = run.events.length > 1 ? Math.max(0, (Date.parse(run.events.at(-1)!.at) - Date.parse(run.events[0].at)) / 1000) : 0
  return <section className="ra-run-activity" aria-label="Run activity"><div className="ra-run-status"><p role="status">{!done && spinning && <i className="ra-spinner" aria-hidden="true" />}{labels[state.phase]}{state.phase === 'done' && ` · ${bought ? `${bought} article${bought === 1 ? '' : 's'} bought · net ${money(run.spentMinor - (run.refundedMinor ?? 0))}` : 'answered from free sources · S$0.00'} · ${elapsed.toFixed(1)} s`}</p>{!done && <button className="ra-link" disabled={stopping} onClick={onStop}>Stop buying ⌘.</button>}<button className="ra-link" onClick={onShowWork}>Show work</button></div>
    <details className="ra-activity-details" open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}><summary>Activity</summary><ol className="ra-activity-list">{state.rows.filter(row => ['search', 'read', 'answer', 'decide', 'buy', 'rewrite'].includes(row.kind)).map((row, index, rows) => {
      const next = rows[index + 1]?.event?.at
      const seconds = row.event && next ? Math.max(0, (Date.parse(next) - Date.parse(row.event.at)) / 1000).toFixed(1) : undefined
      const title = row.kind === 'answer' ? 'Drafted an answer from free sources' : row.kind === 'rewrite' ? 'Updated the answer' : row.kind === 'buy' ? 'Paid for an article' : row.title
      return <li key={row.key}><span>{row.state === 'now' ? '○' : '✓'} {title}</span><small>{seconds && `${seconds} s`}</small></li>
    })}</ol></details>
  </section>
}
