import type { RunSnapshot } from '../../shared/contracts/index.js'
import { deriveRunState, segments, SUBSTEPS } from '../runState'

/** The run as one line along the bottom: what it is doing now, the steps, the clock, Stop buying and Show work. */
export default function RunTape({ run, realDone = false, onStop, stopping, onShowWork }: { run: RunSnapshot; realDone?: boolean; onStop: () => void; stopping: boolean; onShowWork: () => void }) {
  const model = deriveRunState(run)
  const { rows, terminal } = model
  // The step in progress, else the latest step: an earlier failed proof doesn't stick once the run has moved on.
  const now = model.now
  return <section className="ra-runbar" aria-label="Run progress">
    <div className={`ra-runbar-now is-${now?.state ?? 'now'}`} aria-live="polite"><i className="ra-node" aria-hidden="true" /><div><b>{now?.title ?? 'Starting'}</b><span>{model.phase === 'stopped' ? model.stopMessage : now?.meta ?? 'Opening the run…'}</span></div></div>
    <ol className="ra-runbar-steps" aria-label="Steps">{segments(rows).map((row, index, all) => <li key={row.key} className={`is-${row.state}${SUBSTEPS.has(row.kind) || all.slice(0, index).some(prior => prior.kind === row.kind) ? ' is-sub' : ''}`} title={`${row.title}${row.meta ? ` · ${row.meta}` : ''}`}><i role="img" aria-label={`${row.title}: ${row.state}`} /></li>)}</ol>
    {/* Nothing once the run is over; "Skip to the end" lives in the Presenter menu. */}
    {!terminal && !realDone && <button type="button" className="ra-stop" onClick={onStop} disabled={stopping}>{stopping ? 'Stopping…' : 'Stop'}</button>}
    <button type="button" className="ra-showwork" onClick={onShowWork}><span>Show work</span><kbd>W</kbd></button>
  </section>
}
