import type { RunSnapshot, TraceEvent } from '../../shared/contracts/index.js'
import { candidateOf, money } from '../format'
import { isTerminal, runEvents } from '../stage'

type State = 'done' | 'now' | 'fail' | 'skip' | 'todo'
interface Row { key: string; title: string; meta: string; state: State; event?: TraceEvent; kind: string }

// Final-push events (D8, D4, D5, D6): the server's label is the meta line; it never carries premium text.
const NOTES: Record<string, string> = { CLARIFY: 'Clarify', PLAN: 'Plan', MANIFEST_DROPPED: 'Manifest dropped', PROOF: 'Proof check', CHALLENGE: 'Challenge', REFUND: 'Refund', REPUTATION: 'Reputation' }
const noteState = (event: TraceEvent): State => event.type === 'MANIFEST_DROPPED' ? 'skip'
  : (event.type === 'PROOF' && event.data?.ok === false) || (event.type === 'CHALLENGE' && /REJECTED|REFUSED/.test(String(event.data?.status ?? ''))) || (event.type === 'REPUTATION' && event.data?.after && (event.data.after as { status?: string }).status !== 'active') ? 'fail' : 'done'
const clock = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${(ms % 60000 / 1000).toFixed(1).padStart(4, '0')}`

const SHORT: Record<string, string> = { 'Read free sources': 'Read', 'Write answer v1': 'Answer', 'Rewrite answer': 'Rewrite', 'Choose what to buy': 'Choose', 'Check again': 'Check', 'Stopped by you': 'Stopped', 'Proof check': 'Proof', 'Manifest dropped': 'Dropped' }
/** Proof, challenge, refund and trust updates, and a later round's repeat steps, sit in the bar as slim, unlabelled segments; the now line narrates them. */
const SUBSTEPS = new Set(['manifest_dropped', 'proof', 'challenge', 'refund', 'reputation'])
/** One segment per step: repeats in a row (a challenge and its outcome, two trust updates) share a segment; a failure wins. */
const segments = (rows: Row[]) => rows.reduce<Row[]>((list, row) => {
  const last = list.at(-1)
  if (last?.title === row.title) list[list.length - 1] = { ...row, state: last.state === 'fail' ? 'fail' : row.state }
  else list.push(row)
  return list
}, [])

/** The run as steps. Built from the trace, so a second purchase round adds rows. */
function tapeRows(run: RunSnapshot): Row[] {
  const rows: Row[] = []
  const terminal = isTerminal(run)
  const answers = [...run.answers].sort((a, b) => a.version - b.version)
  let answerN = 0, decideN = 0, buyN = 0
  for (const event of runEvents(run)) {
    const key = `${event.type}-${event.id}`
    const searched = event.type === 'SEARCH' ? rows.find(row => row.kind === 'search') : undefined
    // The server's second SEARCH event carries the hit counts: it details the one Search step instead of adding another.
    if (searched) searched.meta = event.label
    else if (event.type === 'SEARCH') rows.push({ key, kind: 'search', event, title: 'Search', state: 'now', meta: run.candidates.length ? `${run.candidates.length} sources found` : 'Searching publisher profiles…' })
    else if (event.type === 'READ_FREE') {
      const free = run.candidates.filter(item => item.tier === 'FREE').length
      rows.push({ key, kind: 'read', event, title: 'Read free sources', state: 'now', meta: `${free} free · ${run.candidates.length - free} paywalled` })
    } else if (event.type === 'ANSWER') {
      const answer = answers[answerN++]
      const gap = answer?.openGaps[0]?.tags?.[0]?.replace(/-/g, ' ')
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
        : intent.status === 'VERIFIED' ? `${source?.publisher ?? intent.resourceId} · ${amount} · proof ✓`
          : intent.status === 'REFUNDED' ? `${source?.publisher ?? intent.resourceId} · ${amount} · proof ✗ · refunded`
            : ['CLAIM_FAILED', 'CHALLENGED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'].includes(intent.status) ? `${source?.publisher ?? intent.resourceId} · ${amount} · proof ✗ · quarantined`
          : intent.status === 'DELIVERY_FAILED' ? 'Paid · delivery failed'
            : intent.status === 'FAILED_NOT_SETTLED' ? 'Not settled · nothing charged'
              : intent.status === 'SETTLED' || intent.status === 'DELIVERY_PENDING' ? `Settled ${amount} · checking delivery…`
                : intent.status === 'RESERVED' || intent.status === 'SUBMITTING' ? `Holding ${amount}` : `402 → quote ${amount}`
      rows.push({ key, kind: 'buy', event, title: 'Buy', state: intent?.status === 'VERIFIED' ? 'done' : intent && ['DELIVERY_FAILED', 'FAILED_NOT_SETTLED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'].includes(intent.status) ? 'fail' : 'now', meta })
    } else if (NOTES[event.type]) rows.push({ key, kind: event.type.toLowerCase(), event, title: NOTES[event.type], state: noteState(event), meta: event.label })
    else if (event.type === 'DONE') rows.push({ key, kind: 'done', event, title: 'Done', state: 'done', meta: `${money(run.spentMinor)} of ${money(run.budgetMinor)} spent` })
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

/** The run as one line along the bottom: what it is doing now, the steps, the clock, Stop buying and Show work. */
export default function RunTape({ run, replaying, realDone = false, onStop, stopping, onShowWork }: { run: RunSnapshot; replaying: boolean; realDone?: boolean; onStop: () => void; stopping: boolean; onShowWork: () => void }) {
  const rows = tapeRows(run)
  const events = runEvents(run)
  const at = (event?: TraceEvent) => event ? Date.parse(event.at) : NaN
  const elapsed = events.length ? at(events.at(-1)) - at(events[0]) : 0
  const terminal = isTerminal(run)
  // The step in progress, else the latest step: an earlier failed proof doesn't stick once the run has moved on.
  const now = rows.find(row => row.state === 'now') ?? [...rows].reverse().find(row => row.state !== 'todo') ?? rows[0]
  return <section className="ra-runbar" aria-label="Run progress">
    <div className={`ra-runbar-now is-${now?.state ?? 'now'}`} aria-live="polite"><i className="ra-node" aria-hidden="true" /><div><b>{now?.title ?? 'Starting'}</b><span>{replaying ? 'Replaying the recorded run · ' : ''}{now?.meta ?? 'Opening the run…'}</span></div></div>
    <ol className="ra-runbar-steps" aria-label="Steps">{segments(rows).map((row, index, all) => <li key={row.key} className={`is-${row.state}${SUBSTEPS.has(row.kind) || all.slice(0, index).some(prior => prior.kind === row.kind) ? ' is-sub' : ''}`} title={`${row.title}${row.meta ? ` · ${row.meta}` : ''}`}><i aria-hidden="true" /><span>{SHORT[row.title] ?? row.title}</span></li>)}</ol>
    <span className="ra-runbar-clock mono" title="Real time from the first to the last event">{clock(Math.max(0, elapsed))}</span>
    <button type="button" className="ra-stop" onClick={onStop} disabled={terminal || stopping}>{run.stopped || run.phase === 'STOPPED' ? 'Stopped · no new purchases' : terminal ? 'Run finished' : stopping ? 'Stopping…' : replaying && realDone ? 'Skip to the end' : 'Stop buying'}</button>
    <button type="button" className="ra-showwork" onClick={onShowWork}><span>Show work</span><kbd>W</kbd></button>
  </section>
}
