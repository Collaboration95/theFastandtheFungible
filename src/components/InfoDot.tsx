import { useCallback, useId, useRef, useState } from 'react'
import { useDismiss } from '../useDismiss'

/** Gate 5 on the money: a small yellow "i" that says nothing here is real money. The settlement label stays as its accessible name; the note stays in the page, hidden until opened. */
export default function InfoDot({ label, side = 'down' }: { label: string; side?: 'up' | 'down' }) {
  const id = useId(), box = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, box, close)
  const testnet = /XRPL/i.test(label)
  return <span className="ra-info" ref={box}>
    <button type="button" className="ra-info-dot" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25" /><path d="M10 9v5" /><circle cx="10" cy="6.2" r=".6" /></svg>
    </button>
    <span id={id} role="note" className={`ra-info-pop is-${side}`} hidden={!open}>
      <b>No real money</b>
      <span>{testnet ? 'Simulated on the XRPL Testnet.' : 'Simulated payments. Nothing settles on a real ledger.'}</span>
    </span>
  </span>
}
