import type { RunSnapshot, TraceEvent } from '../../shared/contracts/index.js'
import { candidateOf, money } from '../format'
import { isTerminal, runEvents } from '../stage'

type State = 'done' | 'now' | 'fail' | 'skip' | 'todo'
interface Row { key: string; title: string; meta: string; state: State; event?: TraceEvent; kind: string }

const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)} s`
const clock = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${(ms % 60000 / 1000).toFixed(1).padStart(4, '0')}`

/** The run as steps. Built from the trace, so a second purchase round adds rows. */
function tapeRows(run: RunSnapshot): Row[] {
  const rows: Row[] = []
  const terminal = isTerminal(run)
  const answers = [...run.answers].sort((a, b) => a.version - b.version)
  let answerN = 0, decideN = 0, buyN = 0
  for (const event of runEvents(run)) {
    const key = `${event.type}-${event.id}`
    if (event.type === 'SEARCH') rows.push({ key, kind: 'search', event, title: 'Search', state: 'now', meta: run.candidates.length ? `${run.candidates.length} sources found` : 'Searching publisher profiles…' })
    else if (event.type === 'READ_FREE') {
      const free = run.candidates.filter(item => item.tier === 'FREE').length
      rows.push({ key, kind: 'read', event, title: 'Read free sources', state: 'now', meta: `${free} free · ${run.candidates.length - free} paywalled` })
    } else if (event.type === 'ANSWER') {
      const answer = answers[answerN++]
      const gap = answer?.openGaps[0]?.facet.replace(/-/g, ' ')
      rows.push(answerN === 1
        ? { key, kind: 'answer', event, title: 'Write answer v1', state: 'now', meta: answer ? `${answer.claims.length} cited claims${gap ? ` · gap: ${gap}` : ''}` : 'Writing…' }
        : { key, kind: 'rewrite', event, title: 'Rewrite answer', state: 'now', meta: answer ? `v${answer.version}${run.impact ? ` · ${run.impact.classification.toLowerCase()}` : ''}` : 'Writing…' })
    } else if (event.type === 'DECIDE') {
      const round = run.decisions[decideN++]
      const buys = round?.rows.filter(row => row.verdict === 'BUY').length ?? 0
      const would = round?.rows.filter(row => row.wouldBuy).length ?? 0
      const meta = !round ? 'Scoring paywalled sources…' : run.budgetMinor === 0 && would ? `Would buy ${would} · S$0 budget` : buys ? `${buys} of ${round.rows.length} clears the bar` : 'Nothing clears the bar'
      rows.push({ key, kind: 'decide', event, title: decideN === 1 ? 'Choose what to buy' : 'Check again', state: 'now', meta })
    } else if (event.type === 'BUY') {
      const intent = run.intents[buyN++]
      const source = intent && candidateOf(run, intent)
      const amount = intent ? money(intent.amountMinor) : ''
      const meta = !intent ? 'Starting a purchase…'
        : intent.status === 'VERIFIED' ? `${source?.publisher ?? intent.resourceId} · ${amount} · sha-256 ✓`
          : intent.status === 'DELIVERY_FAILED' ? 'Paid · delivery failed'
            : intent.status === 'FAILED_NOT_SETTLED' ? 'Not settled · nothing charged'
              : intent.status === 'SETTLED' || intent.status === 'DELIVERY_PENDING' ? `Settled ${amount} · checking delivery…`
                : intent.status === 'RESERVED' || intent.status === 'SUBMITTING' ? `Holding ${amount}` : `402 → quote ${amount}`
      rows.push({ key, kind: 'buy', event, title: 'Buy', state: intent?.status === 'VERIFIED' ? 'done' : intent?.status === 'DELIVERY_FAILED' || intent?.status === 'FAILED_NOT_SETTLED' ? 'fail' : 'now', meta })
    } else if (event.type === 'DONE') rows.push({ key, kind: 'done', event, title: 'Done', state: 'done', meta: `${money(run.spentMinor)} of ${money(run.budgetMinor)} spent` })
    else if (event.type === 'STOPPED') rows.push({ key, kind: 'done', event, title: 'Stopped by you', state: 'skip', meta: 'No new purchases will start' })
    else if (event.type === 'FAILED') rows.push({ key, kind: 'done', event, title: 'Paused', state: 'fail', meta: run.intents.some(item => item.status === 'DELIVERY_FAILED') ? 'Retry the delivery to continue' : 'Last good answer kept' })
  }
  // Everything before the last row has finished, unless it failed or stays open.
  rows.forEach((row, index) => { if (row.state === 'now' && (index < rows.length - 1 || terminal)) row.state = row.kind === 'buy' ? row.state : 'done' })
  if (!terminal) {
    const has = (kind: string) => rows.some(row => row.kind === kind)
    const todo: [string, string][] = [['search', 'Search'], ['read', 'Read free sources'], ['answer', 'Write answer v1'], ['decide', 'Choose what to buy']]
    if (run.budgetMinor > 0) todo.push(['buy', 'Buy'], ['rewrite', 'Rewrite answer'])
    todo.push(['done', 'Done'])
    for (const [kind, title] of todo) if (!has(kind)) rows.push({ key: `todo-${kind}`, kind, title, meta: '', state: 'todo' })
  }
  return rows
}

export default function RunTape({ run, replaying, realDone = false, onStop, stopping, onShowWork }: { run: RunSnapshot; replaying: boolean; realDone?: boolean; onStop: () => void; stopping: boolean; onShowWork: () => void }) {
  const rows = tapeRows(run)
  const events = runEvents(run)
  const at = (event?: TraceEvent) => event ? Date.parse(event.at) : NaN
  const elapsed = events.length ? at(events.at(-1)) - at(events[0]) : 0
  const terminal = isTerminal(run)
  return <aside className="ra-rail" aria-label="Run steps">
    <div className="ra-rail-h"><span>Run</span>{terminal && <span className="mono" title="Real time from the first to the last event">{clock(Math.max(0, elapsed))}</span>}</div>
    {replaying && <p className="ra-pace" title="Replaying the recorded run with a minimum time per step. Change it in the presenter menu (.)">Stage pace · replaying the recorded run</p>}
    <ol className="ra-tape" aria-live="polite">{rows.map((row, index) => {
      const next = rows.slice(index + 1).find(item => item.event)?.event
      const took = row.state === 'done' && row.event && next ? at(next) - at(row.event) : NaN
      return <li key={row.key} className={`is-${row.state}`}><i className="ra-node" aria-hidden="true" /><div><b>{row.title}</b>{row.meta && <span>{row.meta}</span>}</div><time>{Number.isFinite(took) ? secs(took) : ''}</time></li>
    })}</ol>
    <div className="ra-rail-foot">
      <button type="button" className="ra-stop" onClick={onStop} disabled={terminal || stopping}>{run.stopped || run.phase === 'STOPPED' ? 'Stopped · no new purchases' : terminal ? 'Run finished' : stopping ? 'Stopping…' : replaying && realDone ? 'Skip to the end' : 'Stop buying'}</button>
      <button type="button" className="ra-showwork" onClick={onShowWork}><span>Show work</span><kbd>W</kbd></button>
    </div>
  </aside>
}
