import { useEffect, useId, useRef } from 'react'
import type { Citation, ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'
import { articleUrl } from '../../shared/contracts/manifest.js'
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
    <header className="ra-dr-h">
      <div className="ra-dr-top"><span>{span ? 'EXACT PASSAGE' : accessible ? 'SOURCE' : 'PUBLIC PREVIEW'}</span><button className="ra-btn" ref={close} type="button" onClick={onClose} aria-label="Close source passage">×</button></div>
      <h2 id={`${id}-title`}>{candidate.title}</h2>
      <p className="ra-dr-chips"><span className="ra-chip">{candidate.publisher}</span><span id={`${id}-access`} className={`ra-chip${accessible && candidate.tier === 'PAID' ? ' is-pen' : ''}`}>{accessible ? candidate.tier === 'PAID' ? 'Purchased' : 'Free' : candidate.tier === 'PAID' ? `Locked · S$${(candidate.price.amountMinor / 100).toFixed(2)} to read` : 'Public preview only'}</span></p>
    </header>
    <div className="ra-dr-b">{accessible ? <>{citation && !span && <p className="ra-err" role="status">Couldn’t verify this citation.</p>}<div className="ra-passage-body">{span && offset >= 0 ? <>{accessible.body.slice(0, offset)}<mark ref={mark}>{span.text}</mark>{accessible.body.slice(offset + span.text.length)}</> : accessible.body}</div></> : <><p>{candidate.preview}</p><p className="ra-locked">{candidate.tier === 'PAID' ? `Locked · S$${(candidate.price.amountMinor / 100).toFixed(2)} to read` : 'Not read yet.'}</p></>}</div>
    <footer className="ra-dr-f"><span>{candidate.license.kind} · {candidate.license.attribution}</span>{candidate.tier === 'FREE' && candidate.publisherSlug && <a href={articleUrl(candidate.publisherSlug, candidate.resourceId, citation?.spanId)} target="_blank" rel="noopener">open on the writer's site</a>}<span>synthetic corpus</span></footer>
  </dialog>
}
