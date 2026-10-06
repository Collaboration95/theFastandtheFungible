import { useEffect, useState, type CSSProperties } from 'react'
import { XRPL_LABEL, type PurchaseIntent, type Receipt, type RunSnapshot } from '../../shared/contracts/index.js'
import { candidateOf, money, shortHash } from '../format'
import ProofBadge from './ProofBadge'

const LEVEL: Record<PurchaseIntent['status'], number> = { DECIDED: 0, QUOTED: 1, RESERVED: 2, SUBMITTING: 2, SETTLED: 3, DELIVERY_PENDING: 4, VERIFIED: 5, DELIVERY_FAILED: 3, FAILED_NOT_SETTLED: 2, SKIPPED: 0, CLAIM_FAILED: 4, CHALLENGED: 4, REFUNDED: 4, CHALLENGE_REJECTED: 4, CHALLENGE_REFUSED: 4 }

/** A digest scrambles, then locks left to right (once, when it first appears). */
function Digest({ value }: { value: string }) {
  const [text, setText] = useState(value)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const hex = '0123456789abcdef', t0 = performance.now() + 300
    let frame = requestAnimationFrame(function step(now) {
      const p = Math.max(0, Math.min(1, (now - t0) / 900))
      const lock = Math.floor(value.length * p)
      setText(value.slice(0, lock) + Array.from({ length: value.length - lock }, () => hex[Math.floor(Math.random() * 16)]).join(''))
      if (p < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <code aria-label={`manifest root ${value}`}>{text}</code>
}

const QUARANTINE = ['CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED']
const OUTCOME: Partial<Record<PurchaseIntent['status'], [string, string]>> = {
  REFUNDED: ['Refunded', 'The writer paid it back; the source stays quarantined.'],
  CHALLENGE_REJECTED: ['Rejected', 'The writer says the claim holds; the source stays quarantined.'],
  CHALLENGE_REFUSED: ['Refused', 'No answer within 30 s: the writer is delisted.'],
}
const explorer = (url: unknown) => typeof url === 'string' && url.startsWith('https://testnet.xrpl.org/') ? url : undefined
/** A Testnet explorer link, or the hash labelled SIMULATED. */
function Tx({ hash, url, label }: { hash?: string; url?: string; label: string }) {
  if (!hash) return null
  return url ? <a href={url} target="_blank" rel="noreferrer">tx {shortHash(hash)} ↗</a> : <span title={label}>tx {shortHash(hash)} · SIMULATED</span>
}

export default function Purchase({ run, intent, onRetry, onReceipt }: { run: RunSnapshot; intent: PurchaseIntent; onRetry: (intentId: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const source = candidateOf(run, intent)
  const level = LEVEL[intent.status]
  const failed = intent.status === 'DELIVERY_FAILED', notSettled = intent.status === 'FAILED_NOT_SETTLED'
  const ok = intent.status === 'VERIFIED'
  const quarantined = QUARANTINE.includes(intent.status)
  const grant = run.grants.find(item => item.intentId === intent.intentId)
  const receipts = run.receipts.filter(item => item.intentId === intent.intentId)
  const xrpl = run.labels.settlement === XRPL_LABEL
  const nodes: [string, string, string, boolean][] = [
    ['402', 'payment required', 'w402', true],
    [notSettled ? '✕' : 'Pay', notSettled ? 'not settled' : `${money(intent.amountMinor)} · ${xrpl ? 'XRPL Testnet' : 'simulated'}`, notSettled ? 'wfail' : '', level >= 2 || notSettled],
    [failed ? '✕' : '200', failed ? 'delivery failed' : 'delivered', failed ? 'wfail' : 'wok', level >= 4 || failed],
    [quarantined ? '✗' : 'Proof', quarantined ? 'claim failed' : ok ? 'verified' : 'checking', quarantined ? 'wfail' : 'wok', ok || quarantined],
  ]
  const fill = ok || quarantined ? 75 : level >= 4 ? 50 : level >= 2 ? 25 : 0
  const refund = run.events.find(event => event.type === 'REFUND' && event.data?.intentId === intent.intentId)
  const refundLabel = String(refund?.data?.label ?? run.labels.settlement)
  const paidTx = receipts[0]?.xrpl
  const outcome = OUTCOME[intent.status]
  const title = ok ? 'Bought' : quarantined ? 'Proof failed' : failed ? 'Paid, not delivered' : notSettled ? 'Not bought' : 'Buying'
  return <section className={`ra-panel ra-buy${failed || quarantined ? ' is-failed' : ''}`} aria-label={`Purchase: ${source?.publisher ?? intent.resourceId}`}>
    <div className="ra-panel-h"><h2>{title} · {source?.publisher ?? intent.resourceId}</h2><ProofBadge run={run} intent={intent} /><span className="ra-price">{money(intent.amountMinor)}</span></div>
    <ol className="ra-wire" aria-label="402, pay, delivery, proof"><span className="ra-wire-fill" style={{ '--p': `${fill}%` } as CSSProperties} />
      {nodes.map(([label, sub, cls, on], index) => <li key={index} className={`${cls}${on ? ' on' : ''}`}><i>{label}</i><span>{sub}</span></li>)}
    </ol>
    {ok && grant && <div className="ra-hash"><span>manifest root</span><Digest value={grant.contentDigest} /><b>✓ match</b></div>}
    {quarantined && <ol className="ra-challenge" aria-label="Challenge and refund">
      <li className="is-fail"><b>Proof failed</b><span>Quarantined: never cited. <Tx hash={paidTx?.txHash ?? intent.txHash} url={explorer(paidTx?.explorerUrl)} label={run.labels.settlement} /></span></li>
      {intent.status !== 'CLAIM_FAILED' && <li><b>Challenged</b><span>POST /challenge with the passage and its salt</span></li>}
      {outcome && <li className={intent.status === 'REFUNDED' ? 'is-ok' : 'is-fail'}><b>{outcome[0]}{intent.refund ? ` ${money(intent.refund.amountMinor)}` : ''}</b><span>{outcome[1]} {intent.refund && <Tx hash={intent.refund.txHash} url={explorer(refund?.data?.explorerUrl)} label={refundLabel} />} {intent.status === 'REFUNDED' && <span className="ra-chip is-sim">{refundLabel.startsWith('XRPL') ? 'XRPL TESTNET' : 'SIMULATED'}</span>}</span></li>}
    </ol>}
    {failed && <div className="ra-fail" role="alert"><b>Paid, but the delivery failed.</b>Your receipt is kept. Retrying fetches the same paid copy and can’t charge you again.<button type="button" className="ra-btn ra-btn-pay" onClick={() => onRetry(intent.intentId)}>Retry delivery</button></div>}
    {notSettled && <p className="ra-note">The payment didn’t settle, so nothing was charged.</p>}
    {receipts.map(receipt => <div className="ra-rcpt" key={receipt.receiptId}><span>Receipt {shortHash(receipt.receiptId)}</span><span>{failed ? 'same receipt on retry · ' : ''}charged {receipts.length === 1 ? 'once' : `${receipts.length}×`} {receipt.xrpl && <a href={receipt.xrpl.explorerUrl} target="_blank" rel="noreferrer">tx ↗</a>} <button type="button" className="ra-link" onClick={() => onReceipt(receipt)}>View</button></span></div>)}
  </section>
}
