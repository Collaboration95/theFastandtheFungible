import { lazy, Suspense, useState } from 'react'
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
export function PurchaseStepper({ run, intent }: { run: RunSnapshot; intent: PurchaseIntent }) {
  const [expanded, setExpanded] = useState(false)
  const e = intent.escrow!
  const testnet = run.labels.settlement.startsWith('XRPL')
  const cancelled = e.state === 'CANCELLED', released = e.state === 'RELEASED'
  const qualityRefund = !cancelled && intent.status === 'REFUNDED'
  const delivered = released && e.decryptVerified === true
  const pending = !cancelled && !qualityRefund && !delivered && e.decryptVerified !== false
  const published = released && (testnet ? hashOf(e.finishHash) : !!e.finishHash)
  const locked = e.state !== 'PREPARED'
  const title = candidateOf(run, intent)?.title ?? intent.resourceId
  const state = cancelled ? 'Refunded: escrow cancelled after the deadline' : qualityRefund ? 'Quality refund: writer-signed' : delivered ? 'Unlocked' : e.decryptVerified === false ? 'Delivery could not be unlocked' : published ? 'Key published · checking delivery' : locked ? 'Locked · waiting for the writer’s key' : 'Creating escrow'
  return <details className={`ra-payment-stepper${pending ? ' is-pending' : ''}`} open={pending || expanded}>
    <summary onClick={event => { event.preventDefault(); if (!pending) setExpanded(!expanded) }} aria-disabled={pending || undefined} title={title}>
      <Icon name={cancelled || qualityRefund ? 'refund' : delivered ? 'check' : 'circle'} size={20} />
      <span><b>{state}</b><small>{money(intent.amountMinor)} · {title}</small></span>
      <Icon name="down" size={16} />
    </summary>
    <div className="ra-payment-steps-body">
      <p className="ra-step-title">{title}</p>
      <ol aria-label={`Payment steps: ${title}`}>
        <li className={locked ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name="lock" size={20} /></span><div><b>Locked</b><p>{money(intent.amountMinor)} · {locked ? 'Escrow created' : 'Awaiting escrow confirmation'}</p><Tx hash={e.createHash} label="EscrowCreate" testnet={testnet} /></div></li>
        <li className={published ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name="key" size={20} /></span><div><b>Key published</b><p>{published ? 'The writer published the key' : cancelled ? 'The writer did not publish the key' : 'Waiting for the writer’s EscrowFinish'}</p><Tx hash={e.finishHash} label="EscrowFinish" testnet={testnet} /></div></li>
        <li className={delivered ? 'is-complete' : ''}><span className="ra-step-icon"><Icon name={delivered ? "unlock" : "lock"} size={20} /></span><div><b>Unlocked</b><p>{qualityRefund ? 'Passage rejected · not used in the answer' : delivered ? 'Passage delivered' : e.decryptVerified === false ? 'The passage could not be unlocked · not used' : cancelled ? 'No passage delivered' : 'Passage stays locked until the key arrives'}</p>
          {published && testnet && <Suspense fallback={<p role="status">Loading key check…</p>}><KeyRevealLifecycle escrow={e} testnet checkOnly /></Suspense>}
        </div></li>
      </ol>
      {pending && <p className="ra-step-note">If the writer never publishes the key, funds return after the deadline and a confirmed cancellation.</p>}
      {cancelled && <p className="ra-step-refund"><Icon name="refund" size={20} /><b>Refunded: escrow cancelled after the deadline</b><Tx hash={e.cancelHash} label="EscrowCancel" testnet={testnet} /></p>}
      {qualityRefund && <p className="ra-step-refund"><Icon name="refund" size={20} /><b>Quality refund: writer-signed</b><span>{money(intent.refund?.amountMinor ?? 0)} returned</span><Tx hash={intent.refund?.txHash} label="Refund transaction" testnet={testnet} /></p>}
      <details className="ra-step-technical"><summary>Technical details</summary><p>{run.labels.settlement}</p><p>Decisions: {run.labels.decision}</p><p>Escrow: {e.state} · CancelAfter: {e.cancelAfter}</p></details>
    </div>
  </details>
}
export default function PaymentStepper({ run }: { run: RunSnapshot }) {
  const purchases = run.intents.filter(i => i.escrow?.mode === 'key-reveal')
  return purchases.length ? <section className="ra-payment-journey" aria-label="Payment and delivery">{purchases.map(intent => <PurchaseStepper key={intent.intentId} run={run} intent={intent} />)}</section> : null
}
