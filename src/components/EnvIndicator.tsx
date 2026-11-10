import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ModeLabels } from '../../shared/contracts'
import { useDismiss } from '../useDismiss'

// `autoOpen` is false on deep links and run screens: the first-visit note only opens over an empty Home,
// so it can never sit on top of a result or a payment.
export default function EnvIndicator({ labels, recording = false, autoOpen = true }: { labels?: ModeLabels; recording?: boolean; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false)
  const interacted = useRef(false)
  const auto = useRef(false)
  const [top, setTop] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const testnet = labels?.settlement.startsWith('XRPL') ?? false
  const close = () => { auto.current = false; setOpen(false); trigger.current?.focus(); try { localStorage.setItem('researchagent.environment-seen', '1') } catch { /* private mode */ } }
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
    if (recording || !labels || !autoOpen) return
    try { if (!localStorage.getItem('researchagent.environment-seen')) { const timer = setTimeout(() => { if (!interacted.current && (!document.activeElement || document.activeElement === document.body)) auto.current = true; setOpen(true) }, 0); return () => clearTimeout(timer) } } catch { /* private mode */ }
  }, [labels, recording, autoOpen])
  // Leaving Home (a run opened, a deep link resolved) retires an auto-opened note without marking it seen.
  useEffect(() => { if (!autoOpen && auto.current) { auto.current = false; setOpen(false) } }, [autoOpen])
  // Sit below the pill and the Ask button. Layout keeps moving after first paint (web fonts swap, the heading
  // rewraps, health labels arrive), so follow the Ask button every frame while the note is open rather than
  // measuring once; setTop bails out when nothing moved.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => setTop(Math.max(trigger.current?.getBoundingClientRect().bottom ?? 0, document.querySelector('button.ra-ask')?.getBoundingClientRect().bottom ?? 0) + 12)
    place()
    let frame = requestAnimationFrame(function tick() { place(); frame = requestAnimationFrame(tick) })
    return () => cancelAnimationFrame(frame)
  }, [open])
  return <div className="ra-env" ref={box}>
    <button ref={trigger} className="ra-env-trigger" aria-expanded={open} aria-controls="environment-details" onClick={() => { if (open) close(); else { auto.current = false; setOpen(true) } }}><i aria-hidden="true" /><span className="ra-env-full">{testnet ? 'XRPL Testnet · test funds' : 'Demo · simulated payments'}</span><span className="ra-env-short">{testnet ? 'Testnet' : 'Demo'}</span></button>
    {open && <section id="environment-details" className="ra-env-pop" style={{ position: 'fixed', top, bottom: 'auto', right: 16, left: 'auto', width: 'min(360px, calc(100vw - 32px))', maxHeight: `calc(100dvh - ${top + 12}px)`, overflow: 'auto' }} aria-label="What's real here">
      <h2>What's real here</h2><p>{testnet ? 'Test funds have no value. Built-in writers are fictional; local notes carry their own provenance.' : 'Built-in writers are fictional and payments are simulated. Local notes carry their own provenance. No real money moves.'}</p>
      <dl style={{ color: 'var(--ink)' }}><dt style={{ color: 'var(--ink)' }}>Writers</dt><dd>Built-in: fictional demo writers and labelled team-authored notes. Local: author-labelled.</dd><dt style={{ color: 'var(--ink)' }}>Payments</dt><dd>{testnet ? 'XRPL Testnet, test funds with no value' : 'Simulated, no ledger entry'}</dd><dt style={{ color: 'var(--ink)' }}>Search</dt><dd>{labels?.search?.startsWith('hybrid') ? 'Hybrid' : 'Keyword only (embeddings unavailable)'}</dd><dt style={{ color: 'var(--ink)' }}>Models</dt><dd>{labels?.research.startsWith('fixture') ? 'Offline extracts' : labels?.research ?? 'Connecting…'}<br />{labels?.decision.startsWith('fixture') ? 'Offline rules' : labels?.decision ?? 'Connecting…'}</dd></dl>
      <button className="ra-btn" style={{ color: 'var(--ink)' }} onClick={close}>Got it</button>
    </section>}
  </div>
}
