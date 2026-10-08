import { useState } from 'react'
import type { Pace } from '../stage'

/** Press "." for stage controls. Dev-only switches live here, not in the product header. */
export interface PresenterProps { pace: Pace; onPace: (pace: Pace) => void; faults: boolean; busy: boolean; onClose: () => void; clarifyNever?: boolean; onClarifyNever?: (on: boolean) => void; onResetReputation?: () => Promise<void>; onSkip?: () => void }
export default function Presenter({ pace, onPace, faults, busy, onClose, clarifyNever = false, onClarifyNever, onResetReputation, onSkip }: PresenterProps) {
  const [reset, setReset] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')
  const [armed, setArmed] = useState(false)
  const [arming, setArming] = useState(false)
  const [error, setError] = useState('')
  const arm = async () => {
    setArming(true); setError('')
    try {
      const response = await fetch('/api/demo/faults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ failNextDelivery: true }) })
      if (!response.ok) throw new Error('Fault control unavailable')
      setArmed(true)
    } catch { setError('The local fault could not be armed. Start with PUBLISHER_FAULTS=1.') }
    finally { setArming(false) }
  }
  return <section className="ra-presenter" role="dialog" aria-label="Presenter menu">
    <div className="ra-presenter-h"><h2>Presenter</h2><button type="button" className="ra-btn" onClick={onClose} aria-label="Close presenter menu"><kbd>.</kbd> ×</button></div>
    <div className="ra-pr-row"><span className="ra-pr-label" id="ra-pace">Pace</span>
      <div className="ra-seg" role="radiogroup" aria-labelledby="ra-pace">{([['real', 'Real'], ['stage', 'Stage 1×'], ['slow', 'Stage 0.5×']] as [Pace, string][]).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={pace === value} onClick={() => onPace(value)}>{label}</button>)}</div>
      <p className="ra-note">Stage pace holds each step of the run on screen for a minimum time. Applies to the next question.</p></div>
    {onSkip && <div className="ra-pr-row"><span className="ra-pr-label">Replay</span>
      <button type="button" className="ra-btn" onClick={onSkip}>Skip to the end</button></div>}
    {onClarifyNever && <div className="ra-pr-row"><span className="ra-pr-label">Clarifying questions</span>
      <label className="ra-check"><input type="checkbox" checked={clarifyNever} onChange={event => onClarifyNever(event.target.checked)} /> Skip them (clarify=never)</label>
      <p className="ra-note">The 5 s plan card still shows. Applies to the next question.</p></div>}
    {onResetReputation && <div className="ra-pr-row"><span className="ra-pr-label">Writer reputation</span>
      <button type="button" className="ra-btn" disabled={busy || reset === 'busy'} onClick={() => { setReset('busy'); onResetReputation().then(() => setReset('done'), () => setReset('failed')) }}>{reset === 'busy' ? 'Resetting…' : reset === 'done' ? 'Reset · every writer starts at H 0.80' : 'Reset reputation'}</button>
      {reset === 'failed' && <p className="ra-err" role="status">Reputation reset failed.</p>}</div>}
    <div className="ra-pr-row"><span className="ra-pr-label">Fail next paid delivery</span>
      {faults ? <button type="button" className="ra-btn" disabled={arming || armed || busy} onClick={() => void arm()}>{armed ? 'Armed · next paid delivery fails once' : arming ? 'Arming…' : 'Arm the fault'}</button>
        : <p className="ra-note">Start the demo with <code>PUBLISHER_FAULTS=1</code> to enable.</p>}
      {error && <p className="ra-err" role="status">{error}</p>}</div>
  </section>
}
