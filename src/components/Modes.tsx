import type { ModeLabels } from '../../shared/contracts/index.js'

/** Gate 5: every provider and the settlement rail are labelled. `quiet` (the header) shows a chip only when a live
    provider fell back to a fixture, in amber; the full list lives in Show work → Models, and SIMULATED SGD sits on the money. */
export default function Modes({ labels, configured, quiet = false }: { labels?: ModeLabels; configured?: ModeLabels; quiet?: boolean }) {
  const research = labels?.research ?? configured?.research ?? 'fixture · extractive-fixture'
  const decision = labels?.decision ?? configured?.decision ?? 'fixture · metadata-fixture'
  const fallback = (now: string, planned?: string) => !!planned && !planned.startsWith('fixture') && now.startsWith('fixture')
  if (quiet) {
    const down = [fallback(research, configured?.research) && 'Research', fallback(decision, configured?.decision) && 'Decide'].filter(Boolean)
    if (!down.length) return null
    return <ul className="ra-modes" aria-label="Provider substitution"><li className="ra-chip is-fallback"><i aria-hidden="true" />Fixture fallback · {down.join(' + ')}</li></ul>
  }
  return <ul className="ra-modes" aria-label="Provider and simulation labels">
    <li className={`ra-chip${fallback(research, configured?.research) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Research · {research}{fallback(research, configured?.research) ? ' (fallback)' : ''}</li>
    <li className={`ra-chip${fallback(decision, configured?.decision) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Decide · {decision}{fallback(decision, configured?.decision) ? ' (fallback)' : ''}</li>
    <li className="ra-chip"><i aria-hidden="true" />Publisher · {labels?.publisher ?? configured?.publisher ?? 'local'}</li>
    <li className="ra-chip is-sim">{labels?.settlement ?? configured?.settlement ?? 'SIMULATED SGD · no real funds'}</li>
  </ul>
}
