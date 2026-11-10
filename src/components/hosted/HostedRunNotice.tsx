import type { RunSnapshot } from '../../../shared/contracts'
import { isTerminal } from '../../stage'
import { stopLine } from '../../stopLine'
import type { Hosted } from '../../hosted'

/** Hosted run screen: the queue position while another visitor's run holds the demo, and Stop's outcome per purchase. */
export default function HostedRunNotice({ hosted, run, onCancel, stopping }: { hosted: Hosted; run: RunSnapshot; onCancel: () => void; stopping: boolean }) {
  const queued = hosted.status.queue?.find(item => item.runId === run.runId)
  const started = run.events.some(event => !['SNAPSHOT', 'PROGRESS', 'CLARIFY', 'PLAN'].includes(event.type))
  const stopped = run.stopped || run.phase === 'STOPPED'
  if (queued && (queued.position ?? 0) > 0 && !stopped && !isTerminal(run)) return <section className="ra-hqueue" role="status" aria-label="Waiting for a turn">
    <span className="ra-spin" aria-hidden="true" />
    <p><b>Waiting for a turn · {queued.position === 1 ? 'next in line' : `number ${queued.position} in line`}</b><span>Another visitor’s question is running on the shared demo. Yours starts automatically; nothing is spent while it waits (at most 90 seconds).</span></p>
    <button type="button" className="ra-btn" disabled={stopping} onClick={onCancel}>Cancel</button>
  </section>
  if (!stopped) return null
  const lines = run.intents.map(intent => ({ id: intent.intentId, ...stopLine(run, intent) }))
  const settling = lines.some(line => line.tone === 'pending')
  return <section className="ra-hstop" role="status" aria-label="After Stop">
    <h2>{!started ? 'Stopped before it started' : settling ? 'Stopped · settling what was already under way' : 'Stopped · no new purchases'}</h2>
    {!lines.length ? <p>{started ? 'No purchase was made for this question. Nothing was charged.' : 'This question didn’t start, so nothing was spent. Ask again when you’re ready.'}</p>
      : <ul>{lines.map(line => <li key={line.id} className={`is-${line.tone}`}><i aria-hidden="true" />{line.text}</li>)}</ul>}
  </section>
}
