import { modeDisclosure } from '../../shared/presentation.js'
import { useEffect, useState } from 'react'
import type { ModeLabels, TraceEvent } from '../../shared/contracts/index.js'
import { eventPresentation, searchLabel } from '../../shared/trace-labels.js'
import { useHosted } from '../hosted'

/** Provider identities and explicit substitutions, with search status in plain words. */
export default function ModelLabels({ labels, configured, events = [] }: { labels?: ModeLabels; configured?: ModeLabels; events?: TraceEvent[] }) {
  const [paused, setPaused] = useState(false)
  // The owner wallet status is not a hosted route; the hosted pause shows in the header indicator instead.
  const hosted = !!useHosted()
  useEffect(() => {
    if (hosted) return
    let active = true
    const poll = () => { void fetch('/api/wallet/status').then(r => r.json()).then(s => { if (active) setPaused(s.paused === true) }).catch(() => {}) }
    poll(); const timer = setInterval(poll, 2000)
    return () => { active = false; clearInterval(timer) }
  }, [hosted])
  const pauseLabel = paused && <li className="ra-chip is-fallback" role="status">Wallet · spending paused</li>
  const research = labels?.research ?? configured?.research ?? modeDisclosure('research')
  const decision = labels?.decision ?? configured?.decision ?? modeDisclosure('decision')
  const fallback = (now: string, planned?: string) => !!planned && !planned.startsWith('fixture') && now.startsWith('fixture')
  const substitute = events.filter(event => event.type === 'MODEL_FALLBACK').at(-1)
  const researchDown = fallback(research, configured?.research) && (!substitute || eventPresentation(substitute).warning)
  const planDown = !!labels?.plan && fallback(labels.plan, configured?.research)
  return <ul className="ra-modes" aria-label="Provider and simulation labels">{pauseLabel}
    <li className={`ra-chip${researchDown ? ' is-fallback' : ''}`}><i aria-hidden="true" />Research · {research}{fallback(research, configured?.research) ? ' (fallback)' : ''}</li>
    <li className={`ra-chip${fallback(decision, configured?.decision) ? ' is-fallback' : ''}`}><i aria-hidden="true" />Decide · {decision}{fallback(decision, configured?.decision) ? ' (fallback)' : ''}</li>
    {labels?.plan && <li className={`ra-chip${planDown ? ' is-fallback' : ''}`}><i aria-hidden="true" />Plan · {labels.plan}</li>}
    {labels?.search && <li className="ra-chip"><i aria-hidden="true" />Search · {searchLabel(labels.search)}</li>}
    <li className="ra-chip"><i aria-hidden="true" />Publisher · {labels?.publisher ?? configured?.publisher ?? modeDisclosure('publisher')}</li>
    <li className="ra-chip is-sim">{labels?.settlement ?? configured?.settlement ?? modeDisclosure('settlement')}</li>
  </ul>
}
