import { useEffect, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
export default function FaultDemo({ run }: { run?: RunSnapshot }) {
  const [available, setAvailable] = useState(false)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    void fetch('/api/health').then(r => r.json()).then(data => { if (!cancelled) setAvailable(data.faults === true) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const failed = run?.intents.some(i => i.status === 'DELIVERY_FAILED')
  useEffect(() => { if (failed) setArmed(false) }, [failed])
  if (!available) return null
  const active = !!run && !['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
  const arm = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/demo/faults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ failNextDelivery: true }) })
      if (!response.ok) throw new Error('Fault control unavailable')
      setArmed(true)
    } catch { setError('The local fault could not be armed. Start with PUBLISHER_FAULTS=1.') }
    finally { setBusy(false) }
  }
  return <div className="ra-fault-demo"><button type="button" className="ra-text-button" disabled={busy || armed || active} onClick={() => void arm()}>{armed ? 'Next paid delivery will fail once' : busy ? 'Arming fault…' : 'Fail next delivery'}</button><span className="ra-muted"> Dev fault · simulated</span>{error && <p role="status" className="ra-error">{error}</p>}</div>
}
