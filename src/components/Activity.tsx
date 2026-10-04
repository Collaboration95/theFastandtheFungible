import { useState } from 'react'
import { stop } from '../api.js'
import type { RunSnapshot } from '../../shared/contracts/index.js'

export default function Activity({ run }: { run: RunSnapshot }) {
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState(false)
  const terminal = run.stopped || ['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
  async function stopRun() {
    setStopping(true)
    setStopError(false)
    try { await stop(run.runId) }
    catch { setStopError(true) }
    finally { setStopping(false) }
  }
  return <section className="ra-panel ra-activity" aria-label="Agent activity">
    <h2>Activity</h2>
    <button type="button" onClick={stopRun} disabled={stopping || terminal}>{stopping ? 'Stopping…' : 'Stop'}</button>
    {stopError && <p role="alert">Stop request failed. Try Stop again.</p>}
    <p role="status">{run.phase} · round {run.round}{run.stopped ? ' · stopped' : ''}</p>
    {run.events.length === 0 ? <p>Waiting for the first trace event.</p> : <ol aria-label="Durable run trace">
      {run.events.map(event => <li key={`${event.runId}:${event.id}`}>
        <time dateTime={event.at}>{event.at}</time> <strong>{event.type}</strong> · {event.label}
      </li>)}
    </ol>}
    {run.error && <p role="alert">{run.error}</p>}
    {run.phase === 'FAILED' && <p>Last good answer retained. Retry failed delivery or start a new ask.</p>}
  </section>
}
