import type { CSSProperties } from 'react'
import { type PurchaseIntent, type Receipt, type RunSnapshot } from '../../shared/contracts/index.js'
import { candidateOf, money, shortHash } from '../format'
import { purchaseState } from '../runState'
import PendingTime from './PendingTime'

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
  const { failed, notSettled, ok, quarantined, line, fill, title, rail, phase, pendingSince } = purchaseState(run, intent)
  const receipts = run.receipts.filter(item => item.intentId === intent.intentId)
  const refund = run.events.find(event => event.type === 'REFUND' && event.data?.intentId === intent.intentId)
  const refundLabel = String(refund?.data?.label ?? run.labels.settlement)
  const outcome = OUTCOME[intent.status]
  const amount = money(intent.amountMinor)
  return <section className={`ra-panel ra-buy${failed || quarantined ? ' is-failed' : ''}`} aria-label={`Purchase: ${source?.publisher ?? intent.resourceId}`}>
    <div className="ra-panel-h"><h2>{title} · {source?.publisher ?? intent.resourceId}</h2><span className="ra-price">{amount} · {rail}</span></div>
    <p className={`ra-buyline${ok ? ' is-ok' : failed || quarantined || notSettled ? ' is-fail' : ''}`} style={{ '--p': `${fill}%` } as CSSProperties}>{line}</p>
    {phase === 'submitted' && <PendingTime since={pendingSince} />}
    {run.stopped && <p className="ra-note">Payment started before Stop; it cannot be undone by stopping research.</p>}
    {quarantined && intent.status !== 'CLAIM_FAILED' && <ol className="ra-challenge" aria-label="Challenge and refund">
      <li><b>Challenged</b></li>
      {outcome && <li className={intent.status === 'REFUNDED' ? 'is-ok' : 'is-fail'}><b>{outcome[0]}{intent.refund ? ` ${money(intent.refund.amountMinor)}` : ''}</b><span>{outcome[1]} {intent.refund && <Tx hash={intent.refund.txHash} url={explorer(refund?.data?.explorerUrl)} label={refundLabel} />} {intent.status === 'REFUNDED' && <span className="ra-chip is-sim">{refundLabel.startsWith('XRPL') ? 'XRPL TESTNET' : 'SIMULATED'}</span>}</span></li>}
    </ol>}
    {failed && <div className="ra-fail" role="alert"><b>Paid, but delivery failed.</b>Retrying won’t charge you again.<button type="button" className="ra-btn ra-btn-pay" onClick={() => onRetry(intent.intentId)}>Retry delivery</button></div>}
    {receipts.map(receipt => <div className="ra-rcpt" key={receipt.receiptId}><span>Receipt</span><button type="button" className="ra-link" onClick={() => onReceipt(receipt)}>View</button></div>)}
  </section>
}
