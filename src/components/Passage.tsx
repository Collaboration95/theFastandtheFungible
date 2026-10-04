import { useEffect, useId, useRef } from 'react'
import type { Citation, ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'
import { canDisplayPassage } from './Sources'
export interface PassageProps { candidate?: PublicCandidate; content?: ContentEnvelope; citation?: Citation; onClose: () => void }
export default function Passage({ candidate, content, citation, onClose }: PassageProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const mark = useRef<HTMLElement>(null)
  const id = useId()
  const open = !!candidate
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const element = dialog.current
    element?.showModal()
    close.current?.focus()
    return () => { element?.close(); if (previous?.isConnected) previous.focus() }
  }, [open])
  const accessible = candidate && content && canDisplayPassage(candidate, content) ? content : undefined
  const span = citation && accessible && citation.resourceId === accessible.resourceId && citation.version === accessible.version ? accessible.spans.find(item => item.id === citation.spanId && item.text.length > 0 && accessible.body.includes(item.text)) : undefined
  const offset = accessible && span ? accessible.body.indexOf(span.text) : -1
  useEffect(() => { if (span) mark.current?.scrollIntoView({ block: 'center' }) }, [span])
  if (!candidate) return null
  return <dialog ref={dialog} className="ra-passage" aria-labelledby={`${id}-title`} aria-describedby={`${id}-access`} onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="ra-section-heading"><span className="ra-eyebrow">Exact source passage</span><button className="ra-text-button" ref={close} type="button" onClick={onClose} aria-label="Close source passage">Close ×</button></header>
    <h2 id={`${id}-title`}>{candidate.title}</h2><p className="ra-muted">{candidate.publisher} · {candidate.version} · synthetic corpus</p>
    <p id={`${id}-access`} className="ra-badge">{accessible ? candidate.tier === 'PAID' ? 'Verified delivery · full source' : 'Free source · full text' : 'Public preview only'}</p>
    {accessible ? <>{citation && !span && <p className="ra-error" role="status">This citation could not be verified. No substitute passage is highlighted.</p>}<div className="ra-passage-body">{span && offset >= 0 ? <>{accessible.body.slice(0, offset)}<mark ref={mark}>{span.text}</mark>{accessible.body.slice(offset + span.text.length)}</> : accessible.body}</div></> : <><p>{candidate.preview}</p><div className="ra-open-gap">{candidate.tier === 'PAID' ? 'Premium text stays locked until this run has a verified delivery grant.' : 'Full text has not been retrieved yet.'}</div></>}
    <footer className="ra-muted">{candidate.license.kind} · {candidate.license.attribution}</footer>
  </dialog>
}
