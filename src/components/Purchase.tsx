import type { CSSProperties } from 'react'
import { type PurchaseIntent, type Receipt, type RunSnapshot } from '../../shared/contracts/index.js'
import { candidateOf, money, shortHash } from '../format'

const LEVEL: Record<PurchaseIntent['status'], number> = { DECIDED: 0, QUOTED: 1, RESERVED: 2, SUBMITTING: 2, SETTLED: 3, DELIVERY_PENDING: 4, VERIFIED: 5, DELIVERY_FAILED: 3, FAILED_NOT_SETTLED: 2, SKIPPED: 0, CLAIM_FAILED: 4, CHALLENGED: 4, REFUNDED: 4, CHALLENGE_REJECTED: 4, CHALLENGE_REFUSED: 4 }

const QUARANTINE = ['CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED']
const OUTCOME: Partial<Record<PurchaseIntent['status'], [string, string]>> = {
  REFUNDED: ['Refunded', 'The writer paid it back; never cited.'],
  CHALLENGE_REJECTED: ['Rejected', 'The writer says the claim holds; never cited.'],
  CHALLENGE_REFUSED: ['Refused', 'No answer in time: the writer is delisted.'],
}
const explorer = (url: unknown) => typeof url === 'string' && url.startsWith('https://testnet.xrpl.org/') ? url : undefined
/** A Testnet explorer link, or the hash labelled SIMULATED. */
function Tx({ hash, url, label }: { hash?: string; url?: string; label: string }) {
  if (!hash) return null
  return url ? <a href={url} target="_blank" rel="noreferrer">tx {shortHash(hash)} ↗</a> : <span title={label}>tx {shortHash(hash)}</span>
}

export default function Purchase({ run, intent, onRetry, onReceipt }: { run: RunSnapshot; intent: PurchaseIntent; onRetry: (intentId: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const source = candidateOf(run, intent)
  const level = LEVEL[intent.status]
  const failed = intent.status === 'DELIVERY_FAILED', notSettled = intent.status === 'FAILED_NOT_SETTLED'
  const ok = intent.status === 'VERIFIED'
  const quarantined = QUARANTINE.includes(intent.status)
  const receipts = run.receipts.filter(item => item.intentId === intent.intentId)
  const refund = run.events.find(event => event.type === 'REFUND' && event.data?.intentId === intent.intentId)
  const refundLabel = String(refund?.data?.label ?? run.labels.settlement)
  const outcome = OUTCOME[intent.status]
  const amount = money(intent.amountMinor)
  // One line per purchase; the HTTP exchange and the manifest root live in Show work.
  const line = ok ? `Paid ${amount} · delivered · verified`
    : quarantined ? `Paid ${amount} · delivered · ✗ claim failed`
      : failed ? `Paid ${amount} · delivery failed`
        : notSettled ? 'Not settled · nothing charged'
          : level >= 4 ? `Paid ${amount} · delivered · checking`
            : level === 3 ? `Paid ${amount} · checking delivery`
              : level === 2 ? `Paying ${amount}` : `Quoted ${amount}`
  const fill = ok || quarantined ? 100 : level >= 4 ? 75 : level >= 3 ? 50 : level >= 2 ? 25 : 0
  const title = ok ? 'Bought' : quarantined ? 'Proof failed' : failed ? 'Paid, not delivered' : notSettled ? 'Not bought' : 'Buying'
  return <section className={`ra-panel ra-buy${failed || quarantined ? ' is-failed' : ''}`} aria-label={`Purchase: ${source?.publisher ?? intent.resourceId}`}>
    <div className="ra-panel-h"><h2>{title} · {source?.publisher ?? intent.resourceId}</h2><span className="ra-price">{amount}</span></div>
    <p className={`ra-buyline${ok ? ' is-ok' : failed || quarantined || notSettled ? ' is-fail' : ''}`} style={{ '--p': `${fill}%` } as CSSProperties}>{line}</p>
    {quarantined && intent.status !== 'CLAIM_FAILED' && <ol className="ra-challenge" aria-label="Challenge and refund">
      <li><b>Challenged</b></li>
      {outcome && <li className={intent.status === 'REFUNDED' ? 'is-ok' : 'is-fail'}><b>{outcome[0]}{intent.refund ? ` ${money(intent.refund.amountMinor)}` : ''}</b><span>{outcome[1]} {intent.refund && <Tx hash={intent.refund.txHash} url={explorer(refund?.data?.explorerUrl)} label={refundLabel} />} {intent.status === 'REFUNDED' && <span className="ra-chip is-sim">{refundLabel.startsWith('XRPL') ? 'XRPL TESTNET' : 'SIMULATED'}</span>}</span></li>}
    </ol>}
    {failed && <div className="ra-fail" role="alert"><b>Paid, but delivery failed.</b>Retrying won’t charge you again.<button type="button" className="ra-btn ra-btn-pay" onClick={() => onRetry(intent.intentId)}>Retry delivery</button></div>}
    {receipts.map(receipt => <div className="ra-rcpt" key={receipt.receiptId}><span>Receipt</span><button type="button" className="ra-link" onClick={() => onReceipt(receipt)}>View</button></div>)}
  </section>
}
