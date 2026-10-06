import { useEffect, useState, type CSSProperties } from 'react'
import { XRPL_LABEL, type PurchaseIntent, type Receipt, type RunSnapshot } from '../../shared/contracts/index.js'
import { candidateOf, money, shortHash } from '../format'

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
  return <code aria-label={`sha-256 ${value}`}>{text}</code>
}

export default function Purchase({ run, intent, onRetry, onReceipt }: { run: RunSnapshot; intent: PurchaseIntent; onRetry: (intentId: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const source = candidateOf(run, intent)
  const level = LEVEL[intent.status]
  const failed = intent.status === 'DELIVERY_FAILED', notSettled = intent.status === 'FAILED_NOT_SETTLED'
  const ok = intent.status === 'VERIFIED'
  const grant = run.grants.find(item => item.intentId === intent.intentId)
  const receipts = run.receipts.filter(item => item.intentId === intent.intentId)
  const xrpl = run.labels.settlement === XRPL_LABEL
  const nodes: [string, string, string, boolean][] = [
    ['402', 'Payment required', 'w402', true],
    ['Quote', intent.status === 'RESERVED' || intent.status === 'SUBMITTING' ? `${money(intent.amountMinor)} held` : `${money(intent.amountMinor)} quoted`, '', level >= 1],
    [notSettled ? '✕' : 'Settle', notSettled ? 'not settled' : xrpl ? 'XRPL Testnet' : 'simulated', notSettled ? 'wfail' : '', level >= 3 || notSettled],
    [failed ? '✕' : '200', failed ? 'delivery failed' : 'delivered', failed ? 'wfail' : 'wok', level >= 4 || failed],
    ['sha-256', ok ? 'matches' : 'checked', 'wok', ok],
  ]
  const fill = ok ? 80 : failed ? 60 : level >= 4 ? 60 : level >= 3 ? 40 : level >= 1 ? 20 : 0
  return <section className={`ra-panel ra-buy${failed ? ' is-failed' : ''}`} aria-label={`Purchase: ${source?.publisher ?? intent.resourceId}`}>
    <div className="ra-panel-h"><h2>{ok ? 'Bought' : failed ? 'Paid, not delivered' : notSettled ? 'Not bought' : 'Buying'} · {source?.publisher ?? intent.resourceId}</h2><span className="ra-price">{money(intent.amountMinor)}</span></div>
    <ol className="ra-wire" aria-label="402, quote, settle, delivery, digest"><span className="ra-wire-fill" style={{ '--p': `${fill}%` } as CSSProperties} />
      {nodes.map(([label, sub, cls, on], index) => <li key={index} className={`${cls}${on ? ' on' : ''}`}><i>{label}</i><span>{sub}</span></li>)}
    </ol>
    {ok && grant && <div className="ra-hash"><span>sha-256</span><Digest value={grant.contentDigest} /><b>✓ match</b></div>}
    {failed && <div className="ra-fail" role="alert"><b>Paid, but the delivery failed.</b>Your receipt is kept. Retrying fetches the same paid copy and can’t charge you again.<button type="button" className="ra-btn ra-btn-pay" onClick={() => onRetry(intent.intentId)}>Retry delivery</button></div>}
    {notSettled && <p className="ra-note">The payment didn’t settle, so nothing was charged.</p>}
    {receipts.map(receipt => <div className="ra-rcpt" key={receipt.receiptId}><span>Receipt {shortHash(receipt.receiptId)}</span><span>{failed ? 'same receipt on retry · ' : ''}charged {receipts.length === 1 ? 'once' : `${receipts.length}×`} {receipt.xrpl && <a href={receipt.xrpl.explorerUrl} target="_blank" rel="noreferrer">tx ↗</a>} <button type="button" className="ra-link" onClick={() => onReceipt(receipt)}>View</button></span></div>)}
  </section>
}
