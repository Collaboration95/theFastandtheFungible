import type { RunSnapshot } from '../../shared/contracts/index.js'
import { runEvents } from '../stage'

/** The raw persisted trace, with times relative to the first event. Lives in Show work. */
export default function Activity({ run }: { run: RunSnapshot }) {
  const events = runEvents(run)
  const t0 = Date.parse(events[0]?.at ?? '')
  return <section className="ra-activity" aria-label="Agent activity">
    <p role="status" className="ra-note">{run.phase} · round {run.round}{run.stopped ? ' · stopped' : ''} · {events.length} events</p>
    {events.length === 0 ? <p>Waiting for the first trace event.</p> : <ol className="ra-log" aria-label="Durable run trace">
      {events.map(event => <li key={`${event.runId}:${event.id}`}>
        <time dateTime={event.at}>+{((Date.parse(event.at) - t0) / 1000).toFixed(2)} s</time>
        <span className={`ra-tag t-${event.type.toLowerCase()}`}>{event.type}</span>
        <span>{event.label}</span>
      </li>)}
    </ol>}
    {run.error && <p role="alert">{run.error}</p>}
  </section>
}
