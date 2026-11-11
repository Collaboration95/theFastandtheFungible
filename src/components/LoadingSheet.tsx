import { useEffect, useRef } from 'react'

/** Match the final sheet's overlay and reserve its body while the optional code loads. */
export default function LoadingSheet({ label, className, onClose }: { label: string; className: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className={className} aria-label={label} style={{ minHeight: 'min(420px, 80dvh)' }} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2>{label}</h2><button type="button" className="ra-btn" onClick={onClose} aria-label={`Close ${label.toLowerCase()}`}>Close</button></header>
    <p role="status">Loading {label.toLowerCase()}…</p>
  </dialog>
}
