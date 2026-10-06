import type { ModeLabels } from '../../shared/contracts/index.js'

/** Gate 5: the research model, decision provider, publisher and settlement rail are always on screen.
    A chip turns amber when a live provider was configured but this run fell back to a fixture. */
export default function Modes({ labels, configured }: { labels?: ModeLabels; configured?: ModeLabels }) {
  const research = labels?.research ?? configured?.research ?? 'fixture · extractive-fixture'
  const decision = labels?.decision ?? configured?.decision ?? 'fixture · metadata-fixture'
  const fallback = (now: string, planned?: string) => !!planned && !planned.startsWith('fixture') && now.startsWith('fixture')
  return <ul className="ra-modes" aria-label="Provider and simulation labels">
    <li className={`ra-chip${fallback(research, configured?.research) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Research · {research}{fallback(research, configured?.research) ? ' (fallback)' : ''}</li>
    <li className={`ra-chip${fallback(decision, configured?.decision) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Decide · {decision}{fallback(decision, configured?.decision) ? ' (fallback)' : ''}</li>
    <li className="ra-chip"><i aria-hidden="true" />Publisher · {labels?.publisher ?? configured?.publisher ?? 'local'}</li>
    <li className="ra-chip is-sim">{labels?.settlement ?? configured?.settlement ?? 'SIMULATED SGD · no real funds'}</li>
  </ul>
}
