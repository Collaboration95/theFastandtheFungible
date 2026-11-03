import { useEffect, useState } from 'react'
import type { ModeLabels } from '../../shared/contracts/index.js'

/** Verbatim engine labels, retained exclusively in Show work. */
export default function ModelLabels({ labels, configured }: { labels?: ModeLabels; configured?: ModeLabels }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    let active = true
    const poll = () => { void fetch('/api/wallet/status').then(r => r.json()).then(s => { if (active) setPaused(s.paused === true) }).catch(() => {}) }
    poll(); const timer = setInterval(poll, 2000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  const pauseLabel = paused && <li className="ra-chip is-fallback" role="status">Wallet · spending paused</li>
  const research = labels?.research ?? configured?.research ?? 'fixture · extractive-fixture'
  const decision = labels?.decision ?? configured?.decision ?? 'fixture · metadata-fixture'
  const fallback = (now: string, planned?: string) => !!planned && !planned.startsWith('fixture') && now.startsWith('fixture')
  // Live search embeds the query; keyword-only means the embedding call failed (gate 5). A fixture plan means the planner fell back.
  const searchDown = !!labels?.search?.startsWith('keyword') && configured?.research !== undefined && !configured.research.startsWith('fixture')
  const planDown = !!labels?.plan && fallback(labels.plan, configured?.research)
  return <ul className="ra-modes" aria-label="Provider and simulation labels">{pauseLabel}
    <li className={`ra-chip${fallback(research, configured?.research) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Research · {research}{fallback(research, configured?.research) ? ' (fallback)' : ''}</li>
    <li className={`ra-chip${fallback(decision, configured?.decision) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Decide · {decision}{fallback(decision, configured?.decision) ? ' (fallback)' : ''}</li>
    {labels?.plan && <li className={`ra-chip${planDown ? ' is-fallback' : ''}`}><i aria-hidden="true" />Plan · {labels.plan}</li>}
    {labels?.search && <li className={`ra-chip${searchDown ? ' is-fallback' : ''}`}><i aria-hidden="true" />Search · {labels.search}</li>}
    <li className="ra-chip"><i aria-hidden="true" />Publisher · {labels?.publisher ?? configured?.publisher ?? 'local'}</li>
    <li className="ra-chip is-sim">{labels?.settlement ?? configured?.settlement ?? 'SIMULATED SGD · no real funds'}</li>
  </ul>
}
