import { lazy, Suspense, useState, useEffect } from 'react'
import type { PurchaseIntent, RunSnapshot } from '../../shared/contracts'
import { candidateOf, money } from '../format'
import Icon from './Icon'
import './payment-stepper.css'
const KeyRevealLifecycle = lazy(() => import('./KeyRevealLifecycle'))
const hashOf = (value?: string): value is string => !!value && /^[a-f0-9]{64}$/i.test(value)

function Tx({ hash, label, testnet }: { hash?: string; label: string; testnet: boolean }) {
  return testnet && hashOf(hash) ? <a href={`https://testnet.xrpl.org/transactions/${hash}`} target="_blank" rel="noopener noreferrer" aria-label={label} title={`${label} on the XRPL Testnet explorer`}>{label}<Icon name="external" size={16} /></a> : null
}

/** Financial truth comes from the current SSE snapshot, never a timer or an inferred successful purchase. */
export function PurchaseStepper({ run, intent, clockAt }: { run: RunSnapshot; intent: PurchaseIntent; clockAt?: number }) {
  const [expanded, setExpanded] = useState(false)
  const e = intent.escrow!
  const timing = intent.timing, marks = timing?.phases
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (clockAt !== undefined || !timing || marks?.unlocked || ['CANCELLED', 'RELEASED'].includes(e.state)) return
    const refresh = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearTimeout(refresh); window.clearInterval(timer) }
  }, [clockAt, timing, marks?.unlocked, e.state])
  const observed = (phase: 'createValidated' | 'finishValidated' | 'unlocked', previous?: 'createValidated' | 'finishValidated') => {
    if (!timing) return null
    const mark = marks?.[phase], start = previous ? marks?.[previous]?.elapsedMs : 0
    if (mark && start === undefined) return mark.ledgerIndex ? <small className="ra-step-time">Ledger {mark.ledgerIndex}</small> : null
    if (start === undefined) return null
    if (mark) {
      const elapsed = Math.max(0, mark.elapsedMs - start)
      return <small className="ra-step-time">{elapsed > 0 && elapsed < 100 ? '<0.1' : (elapsed / 1000).toFixed(1)} s{mark.ledgerIndex ? ` · Ledger ${mark.ledgerIndex}` : ''}</small>
    }
    if (['CANCELLED', 'RELEASED'].includes(e.state)) return null
    const observedNow = clockAt ?? now
    if (!Number.isFinite(observedNow)) return null
    return <small className="ra-step-time">{(Math.max(0, observedNow - Date.parse(timing.startedAt) - start) / 1000).toFixed(0)} s elapsed</small>
  }
  const testnet = run.labels.settlement.startsWith('XRPL')
  const cancelled = e.state === 'CANCELLED', released = e.state === 'RELEASED'
  const qualityRefund = !cancelled && intent.status === 'REFUNDED'
  const rejected = released && e.proofOk === false
  const delivered = released && e.decryptVerified === true && !rejected
  const pending = !cancelled && !qualityRefund && !delivered && e.decryptVerified !== false && !rejected
  const published = (!!marks?.finishValidated || released) && (testnet ? hashOf(marks?.finishValidated?.txHash ?? e.finishHash) : !!e.finishHash)
  const locked = !!marks?.createValidated || e.state !== 'PREPARED'
  const title = candidateOf(run, intent)?.title ?? intent.resourceId
  const state = cancelled ? e.holdback ? 'Key-release escrow refunded' : 'Refunded: escrow cancelled after the deadline' : qualityRefund ? 'Quality refund: writer-signed' : delivered ? 'Unlocked' : e.decryptVerified === false ? 'Delivery could not be unlocked' : rejected ? 'Passage did not pass verification' : published ? 'Key published · checking delivery' : locked ? 'Locked · waiting for the writer’s key' : 'Creating escrow'
  return <details className={`ra-payment-stepper${pending ? ' is-pending' : ''}`} open={pending || expanded}>
    <summary onClick={event => { event.preventDefault(); if (!pending) setExpanded(!expanded) }} aria-disabled={pending || undefined} title={title}>
      <Icon name={cancelled || qualityRefund ? 'refund' : delivered ? 'check' : 'circle'} size={20} />
      <span><b>{state}</b><small>{money(intent.amountMinor)} · {title}</small></span>
      <Icon name="down" size={16} />
    </summary>
    <div className="ra-payment-steps-body">
      <p className="ra-step-title">{title}</p>
      <ol aria-label={`Payment steps: ${title}`}>
        <li className={locked ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name="lock" size={20} /></span><div><b>Locked</b><p>{money(intent.amountMinor)} · {locked ? e.holdback ? 'Two escrows created' : 'Escrow created' : 'Awaiting escrow confirmation'}</p>{observed('createValidated')}<Tx hash={e.holdback?.batchHash ?? (timing ? marks?.createValidated?.txHash ?? (locked ? e.createHash : undefined) : e.createHash)} label={e.holdback ? "Batch" : "EscrowCreate"} testnet={testnet} /></div></li>
        <li className={published ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name="key" size={20} /></span><div><b>Key published</b><p>{published ? 'The writer published the key' : cancelled ? 'The writer did not publish the key' : 'Waiting for the writer’s EscrowFinish'}</p>{observed('finishValidated', 'createValidated')}<Tx hash={timing ? marks?.finishValidated?.txHash ?? (released ? e.finishHash : undefined) : e.finishHash} label="EscrowFinish" testnet={testnet} /></div></li>
        <li className={delivered ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name={delivered ? "unlock" : "lock"} size={20} /></span><div><b>Unlocked</b><p>{qualityRefund || rejected ? 'Passage rejected · not used in the answer' : delivered ? 'Passage delivered' : e.decryptVerified === false ? 'The passage could not be unlocked · not used' : cancelled ? 'No passage delivered' : 'Passage stays locked until the key arrives'}</p>
          {observed('unlocked', 'finishValidated')}
          {published && testnet && <Suspense fallback={<p role="status">Loading key check…</p>}><KeyRevealLifecycle escrow={e} testnet checkOnly /></Suspense>}
        </div></li>
        {e.holdback && <li className={e.holdback.state !== 'pending' ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name={e.holdback.state === 'refunded' ? 'refund' : 'lock'} size={20} /></span><div><b>{e.holdback.state === 'released' ? 'Holdback released' : e.holdback.state === 'refunded' ? 'Holdback refunded' : 'Holdback pending'}</b><p>{Number.isInteger(e.holdback.amountMinor) ? money(e.holdback.amountMinor) : `${e.holdback.amountMinor} cents`} · {e.holdback.state === 'pending' ? 'Held while delivery promises are checked' : e.holdback.state === 'refunded' ? 'Returned by buyer policy after the deadline' : 'Delivery promises checked'}</p><Tx hash={e.holdback.finishHash ?? e.holdback.cancelHash ?? e.holdback.batchHash} label={e.holdback.finishHash ? 'EscrowFinish' : e.holdback.cancelHash ? 'EscrowCancel' : 'Batch'} testnet={testnet} /></div></li>}
      </ol>
      {pending && <p className="ra-step-note">If the writer never publishes the key, funds return after the deadline and a confirmed cancellation.</p>}
      {cancelled && <p className="ra-step-refund"><Icon name="refund" size={20} /><b>{e.holdback ? 'Key-release escrow cancelled after the deadline' : 'Refunded: escrow cancelled after the deadline'}</b><Tx hash={e.cancelHash} label="EscrowCancel" testnet={testnet} /></p>}
      {qualityRefund && <p className="ra-step-refund"><Icon name="refund" size={20} /><b>Quality refund: writer-signed</b><span>{money(intent.refund?.amountMinor ?? 0)} returned</span><Tx hash={intent.refund?.txHash} label="Refund transaction" testnet={testnet} /></p>}
      {timing && <details className="ra-step-technical"><summary>Timing breakdown</summary><p>Observed elapsed time; writer times are reported by the writer.</p><dl className="ra-timing-breakdown">{([
        ['quote', 'Quote'], ['createSubmitted', 'Create submitted'], ['createValidated', 'Create validated'], ['lockProven', 'Lock proven and grant'], ['finishSubmitted', 'Writer finish submitted'], ['finishValidated', 'Finish validated'], ['unlocked', 'Key checked and body unlocked'],
      ] as const).map(([phase, label]) => { const mark = marks?.[phase]; return <div key={phase}><dt>{label}</dt><dd>{mark ? `${(mark.elapsedMs / 1000).toFixed(2)} s since start${mark.ledgerIndex ? ` · Ledger ${mark.ledgerIndex}` : ''}${mark.source === 'writer' ? ' · writer-reported' : ''}` : 'Not recorded'}</dd></div> })}</dl></details>}
      <details className="ra-step-technical"><summary>Technical details</summary><p>{run.labels.settlement}</p><p>Decisions: {run.labels.decision}</p><p>Escrow: {e.state} · CancelAfter: {e.cancelAfter}</p></details>
    </div>
  </details>
}
export default function PaymentStepper({ run, clockAt }: { run: RunSnapshot; clockAt?: number }) {
  const purchases = run.intents.filter(i => i.escrow?.mode === 'key-reveal')
  return purchases.length ? <section className="ra-payment-journey" aria-label="Payment and delivery">{purchases.map(intent => <PurchaseStepper key={intent.intentId} run={run} intent={intent} clockAt={clockAt} />)}</section> : null
}
