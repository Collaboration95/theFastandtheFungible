import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { ApiError, createRefusalProof, getRefusalProof, type RefusalProof, type RefusalStatus } from '../api'
import { useHosted } from '../hosted'
import './share-proof.css'

/** Reasons worth saying out loud in the decline view. Everything else (a purchase, a free answer) is not this feature's business. */
const SAYS = new Set(['no_budget', 'near_match', 'simulated', 'anchor_pending', 'anchor_missing', 'private_question', 'too_large', 'verification_failed'])
const POLL_MS = 3000, POLL_LIMIT = 40
const ERRORS: Record<string, string> = { proof_limit: 'You’ve shared as many proofs as this session allows today.' }

const HELD = <svg className="ra-share-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M7.5 12h9" /></svg>

/**
 * "Share proof of refusal" in the decline view (lane W1). The question becomes public only after an explicit second
 * step that says so; the server decides whether the run may be shared and writes the immutable snapshot.
 */
export default function ShareProof({ run }: { run: RunSnapshot }) {
  const hosted = !!useHosted()
  const [status, setStatus] = useState<RefusalStatus>()
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy'>('idle')
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const restoreFocus = useRef(false)

  useEffect(() => {
    // The server's answer, re-read while the ledger anchor is still arriving (the same bounded wait as the anchor line).
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined, polls = 0
    const read = async () => {
      try {
        const next = await getRefusalProof(run.runId, abort.signal)
        if (abort.signal.aborted) return
        setStatus(next)
        if (!next.eligible && next.code === 'anchor_pending' && ++polls < POLL_LIMIT) timer = setTimeout(() => { void read() }, POLL_MS)
      } catch { /* no server for this (a replay, offline): the feature is simply absent */ }
    }
    void read()
    return () => { abort.abort(); clearTimeout(timer) }
    // Also re-read when the anchor lands, so "opens once the answer is anchored" never sits beside "Anchored on XRPL" (H8-16).
  }, [run.runId, run.ledgerAnchor?.txHash])
  useEffect(() => {
    if (step === 'confirm') heading.current?.focus()
    else if (step === 'idle' && restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus() }
  }, [step])
  const close = () => { restoreFocus.current = true; setStep('idle') }

  const create = useCallback(async () => {
    setStep('busy'); setError(undefined)
    try {
      const proof = await createRefusalProof(run.runId)
      setStatus(current => ({ ...(current ?? { eligible: true }), eligible: true, proof }))
      setStep('idle')
    } catch (failure) {
      if (failure instanceof ApiError && failure.code && ERRORS[failure.code]) setError(ERRORS[failure.code])
      // Any other reason the server gave is its own plain sentence: show it, never the generic line.
      else if (failure instanceof ApiError && failure.detail) { setError(failure.detail); void getRefusalProof(run.runId).then(setStatus, () => undefined) }
      else {
        // Ask the server why, so the visitor reads its words rather than a status code.
        try { const again = await getRefusalProof(run.runId); setStatus(again); setError(again.eligible ? 'The proof page could not be created. Nothing was published; try again.' : again.message) }
        catch { setError('The proof page could not be created. Nothing was published; try again.') }
      }
      setStep('idle')
    }
  }, [run.runId])

  if (!status) return null
  if (status.proof) return <Shared proof={status.proof} hosted={hosted} copied={copied} onCopy={() => setCopied(true)} />
  if (!status.eligible) return status.code && SAYS.has(status.code)
    ? <div className="ra-share"><p className="ra-share-why" aria-live="polite">{HELD}<span><b>Proof of refusal</b> · {status.message}</span></p></div>
    : null
  if (step === 'idle') return <div className="ra-share">
    <button ref={trigger} type="button" className="ra-btn ra-share-btn" onClick={() => setStep('confirm')}>{HELD}Share proof of refusal</button>
    {error && <p className="ra-err" role="alert">{error}</p>}
  </div>
  return <div className="ra-share">
    <section className="ra-share-confirm" aria-labelledby={titleId} onKeyDown={event => { if (event.key === 'Escape' && step === 'confirm') close() }}>
      <h3 id={titleId} ref={heading} tabIndex={-1}>{hosted ? 'Publish this proof?' : 'Create this proof?'}</h3>
      {hosted ? <>
        <p>This makes a public page that <b>anyone with the link</b> can open. It shows:</p>
        <ul>
          <li>your question: <q>{run.question}</q></li>
          <li>the paid articles found and why none was bought</li>
          <li>S$0.00 spent, with the XRPL Testnet record and the receipts to check it</li>
        </ul>
        <p className="ra-note">No article text and no account details are included. The page can’t be edited, and it stays up through 21 November 2026. Clearing your history won’t take it down.</p>
      </> : <>
        <p>This creates a proof page on this computer, and a card you can download and send. Nothing is uploaded.</p>
        <p className="ra-note">The card shows your question: <q>{run.question}</q>, the paid articles found, S$0.00 spent, and the XRPL Testnet record. It carries no article text.</p>
      </>}
      <div className="ra-share-actions">
        <button type="button" className="ra-btn ra-btn-pen" disabled={step === 'busy'} onClick={() => { void create() }}>{step === 'busy' ? 'Creating…' : hosted ? 'Publish proof page' : 'Create proof page'}</button>
        <button type="button" className="ra-btn" disabled={step === 'busy'} onClick={close}>Cancel</button>
      </div>
    </section>
  </div>
}

function Shared({ proof, hosted, copied, onCopy }: { proof: RefusalProof; hosted: boolean; copied: boolean; onCopy: () => void }) {
  const url = new URL(proof.path, window.location.href).href
  const copy = async () => { try { await navigator.clipboard.writeText(url); onCopy() } catch { /* the link below is selectable */ } }
  // Only a hosted proof has a link someone else can open. Here (the Mac app, a local run) the address is this computer's
  // alone, so it is neither shown nor copyable: the card is what you send.
  return <div className="ra-share">
    <section className="ra-share-done" aria-label="Proof of refusal">
      <p className="ra-share-head">{HELD}<b>Proof page ready</b></p>
      <p className="ra-note">{hosted ? 'Anyone with this link can open it and check the ledger themselves.' : 'Open it here, or download the card to send it. Anyone can check the ledger from it.'}</p>
      {hosted && <p className="ra-share-url"><a href={proof.path} target="_blank" rel="noopener noreferrer">{url}</a></p>}
      <div className="ra-share-actions">
        <a className="ra-btn ra-btn-pen" href={proof.path} target="_blank" rel="noopener noreferrer">Open proof page</a>
        {hosted && <button type="button" className="ra-btn" onClick={() => { void copy() }}>Copy link</button>}
        <a className="ra-btn" href={`${proof.path}/card.html`} download>Download proof card</a>
      </div>
      <p className="ra-note" aria-live="polite">{copied ? 'Link copied.' : ''}</p>
    </section>
  </div>
}
