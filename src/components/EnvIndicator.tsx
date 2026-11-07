import { useEffect, useRef, useState } from 'react'
import type { ModeLabels } from '../../shared/contracts'
import { useDismiss } from '../useDismiss'

export default function EnvIndicator({ labels, recording = false }: { labels?: ModeLabels; recording?: boolean }) {
  const [open, setOpen] = useState(false)
  const interacted = useRef(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const testnet = labels?.settlement.startsWith('XRPL') ?? false
  const close = () => { setOpen(false); trigger.current?.focus(); try { localStorage.setItem('researchagent.environment-seen', '1') } catch { /* private mode */ } }
  useDismiss(open, box, close)
  // Health labels may arrive after the user has started typing or chosen a preset.
  // Do not open onboarding over that interaction when the response arrives late.
  useEffect(() => {
    const started = () => { interacted.current = true }
    document.addEventListener('pointerdown', started, true)
    document.addEventListener('keydown', started, true)
    return () => {
      document.removeEventListener('pointerdown', started, true)
      document.removeEventListener('keydown', started, true)
    }
  }, [])
  useEffect(() => {
    if (recording || !labels) return
    try { if (!localStorage.getItem('researchagent.environment-seen')) { const timer = setTimeout(() => { if (!interacted.current && (!document.activeElement || document.activeElement === document.body)) setOpen(true) }, 0); return () => clearTimeout(timer) } } catch { /* private mode */ }
  }, [labels, recording])
  return <div className="ra-env" ref={box}>
    <button ref={trigger} className="ra-env-trigger" aria-expanded={open} aria-controls="environment-details" onClick={() => open ? close() : setOpen(true)}><i aria-hidden="true" /><span className="ra-env-full">{testnet ? 'XRPL Testnet · test funds' : 'Demo · simulated payments'}</span><span className="ra-env-short">{testnet ? 'Testnet' : 'Demo'}</span></button>
    {open && <section id="environment-details" className="ra-env-pop" aria-label="What's real here">
      <h2>What's real here</h2><p>{testnet ? 'Test funds have no value. Built-in writers are fictional; local notes carry their own provenance.' : 'Built-in writers are fictional and payments are simulated. Local notes carry their own provenance. No real money moves.'}</p>
      <dl><dt>Writers</dt><dd>Built-in: Fictional (synthetic corpus). Local: author-labelled.</dd><dt>Payments</dt><dd>{testnet ? 'XRPL Testnet, test funds with no value' : 'Simulated, no ledger entry'}</dd><dt>Search</dt><dd>{labels?.search?.startsWith('hybrid') ? 'Hybrid' : 'Keyword only (embeddings unavailable)'}</dd><dt>Models</dt><dd>{labels?.research.startsWith('fixture') ? 'Offline extracts' : labels?.research ?? 'Connecting…'}<br />{labels?.decision.startsWith('fixture') ? 'Offline rules' : labels?.decision ?? 'Connecting…'}</dd></dl>
      <button className="ra-btn" onClick={close}>Got it</button>
    </section>}
  </div>
}
