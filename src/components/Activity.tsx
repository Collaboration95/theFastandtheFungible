import type { RunSnapshot } from '../../shared/contracts/index.js'
import { runEvents } from '../stage'
import { EVENT_LABELS, eventPresentation, traceLabel } from '../../shared/trace-labels.js'
import './trace-labels.css'
/* eslint-disable react-refresh/only-export-components -- A pure label helper shared with its test. */

export { traceLabel } from '../../shared/trace-labels.js'

/** Display labels over the persisted trace, with times relative to the first event. */
export default function Activity({ run }: { run: RunSnapshot }) {
  const events = runEvents(run)
  const t0 = Date.parse(events[0]?.at ?? '')
  return <section className="ra-activity" aria-label="Agent activity">
    <p role="status" className="ra-note">{EVENT_LABELS[run.phase] ?? 'In progress'} · round {run.round}{run.stopped ? ' · stopped' : ''} · {events.length} {events.length === 1 ? 'event' : 'events'}</p>
    {events.length === 0 ? <p>Waiting for the first trace event.</p> : <ol className="ra-log" aria-label="Durable run trace">
      {events.map(event => {
        const display = eventPresentation(event)
        return <li key={`${event.runId}:${event.id}`} className={display.warning ? 'is-warning' : undefined}>
        <time dateTime={event.at}>+{((Date.parse(event.at) - t0) / 1000).toFixed(2)} s</time>
        <span className={`ra-tag t-${event.type.toLowerCase()}`}>{display.title}</span>
        <span>{display.detail}</span>
      </li>})}
    </ol>}
    {run.error && <p role="alert">{traceLabel(run.error)}</p>}
  </section>
}
