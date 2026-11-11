import { lazy, Suspense, useState } from 'react'
import './sandbox-numbers.css'

const Numbers = lazy(() => import('./SandboxNumbersPanel').catch(() => ({ default: () => <p role="status">Sandbox numbers are unavailable. Reload the page to try again.</p> })))

// The panel is fetched and rendered only when opened; it consumes no hosted question or admission.
export default function SandboxNumbers() {
  const [open,setOpen] = useState(false)
  return <details className="ra-sandbox" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Sandbox scoreboard · aggregate numbers and gate audit</summary>
    {open && <Suspense fallback={<p role="status">Loading sandbox numbers…</p>}><Numbers /></Suspense>}
  </details>
}
