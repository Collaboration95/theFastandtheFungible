import type { RunSnapshot } from '../../shared/contracts/index.js'
import { runEvents } from '../stage'
/* eslint-disable react-refresh/only-export-components -- A pure label helper shared with its test. */

/** A trace line in words a reader can follow: the retired H and C pairs read as one Trust move (trust = H × C), and the
    on-ledger invoice mechanics stay in Show work → Wire. The persisted label is untouched. */
export function traceLabel(label: string): string {
  return label
    .replace(/ · H (\d+(?:\.\d+)?)→(\d+(?:\.\d+)?) · C (\d+(?:\.\d+)?)→(\d+(?:\.\d+)?)/, (_all, h0: string, h1: string, c0: string, c1: string) => ` · Trust ${(Number(h0) * Number(c0)).toFixed(2)} → ${(Number(h1) * Number(c1)).toFixed(2)}`)
    .replace(/ · InvoiceID = (?:sha256\(invoiceId\)|original tx)/, '')
}

/** The raw persisted trace, with times relative to the first event. Lives in Show work. */
export default function Activity({ run }: { run: RunSnapshot }) {
  const events = runEvents(run)
  const t0 = Date.parse(events[0]?.at ?? '')
  return <section className="ra-activity" aria-label="Agent activity">
    <p role="status" className="ra-note">{run.phase} · round {run.round}{run.stopped ? ' · stopped' : ''} · {events.length} {events.length === 1 ? 'event' : 'events'}</p>
    {events.length === 0 ? <p>Waiting for the first trace event.</p> : <ol className="ra-log" aria-label="Durable run trace">
      {events.map(event => <li key={`${event.runId}:${event.id}`}>
        <time dateTime={event.at}>+{((Date.parse(event.at) - t0) / 1000).toFixed(2)} s</time>
        <span className={`ra-tag t-${event.type.toLowerCase()}`}>{event.type}</span>
        <span>{traceLabel(event.label)}</span>
      </li>)}
    </ol>}
    {run.error && <p role="alert">{run.error}</p>}
  </section>
}
