import { lazy, Suspense, useState } from 'react'
import './sandbox-numbers.css'

// Static replays have no hosted store; keep the public scoreboard out of that build.
const Numbers = import.meta.env.MODE === 'browser-demo' ? undefined : lazy(() => import('./SandboxNumbersPanel').catch(() => ({ default: () => <p role="status">Sandbox numbers are unavailable. Reload the page to try again.</p> })))

// The panel is fetched and rendered only when opened; it consumes no hosted question or admission.
export default function SandboxNumbers() {
  const [open,setOpen] = useState(false)
  if (!Numbers) return null
  return <details className="ra-sandbox" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Sandbox scoreboard</summary>
    {open && <Suspense fallback={<p role="status">Loading sandbox numbers…</p>}><Numbers /></Suspense>}
  </details>
}
