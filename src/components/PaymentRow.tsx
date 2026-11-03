import { keyRevealLabel } from '../format'
import type { PurchaseIntent, Receipt, RunSnapshot } from '../../shared/contracts'
import { candidateOf, money, shortHash, settlementAssetLabel } from '../format'
import { purchaseState } from '../runState'
import PendingTime from './PendingTime'
import Verification from './Verification'

export default function PaymentRow({ run, intent, onRetry, onReceipt }: { run: RunSnapshot; intent: PurchaseIntent; onRetry: (id: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const source = candidateOf(run, intent), state = purchaseState(run, intent)
  const refunded = intent.status === 'REFUNDED', testnet = run.labels.settlement.startsWith('XRPL')
  const receipt = run.receipts.find(r => r.intentId === intent.intentId)
  const status = intent.escrow?.mode === 'key-reveal' ? keyRevealLabel(intent.escrow) : refunded ? `Refunded ${money(intent.refund?.amountMinor ?? 0)}` : state.ok ? 'Verified' : state.failed ? `Paid ${money(intent.amountMinor)} · delivery failed. You won't be charged again.` : state.notSettled ? 'Not settled · nothing charged' : state.quarantined ? intent.status === 'CHALLENGED' ? 'Refunding…' : 'Promise broken' : state.level >= 3 ? 'Paid · checking' : state.level === 2 ? 'Paying…' : `Quoted ${money(intent.amountMinor)}`
  const refundEvent = run.events.find(e => e.type === 'REFUND' && e.data?.intentId === intent.intentId)
  const refundUrl = refundEvent?.data?.explorerUrl
  const start = run.events.find(e => e.type === 'BUY' && e.data?.intentId === intent.intentId)?.at
  const elapsed = start && receipt ? Math.max(0, (Date.parse(receipt.settledAt) - Date.parse(start)) / 1000) : undefined
  return <section className="ra-payment" aria-label={`Purchase: ${source?.publisher ?? intent.resourceId}`}>
    <div className="ra-payment-heading"><b>{refunded ? '↩' : state.ok ? '✓' : state.failed ? '✕' : '○'} {source?.publisher ?? intent.resourceId}</b><span>{money(intent.amountMinor)}</span></div>
    <p className="ra-payment-title">{source?.title ?? intent.resourceId}</p>
    {testnet && intent.quote?.payment?.asset && intent.quote.payment?.asset !== 'XRP' && <p>{settlementAssetLabel(intent.quote.payment?.asset)}</p>}
    <p key={intent.status} className={`ra-payment-status${state.ok ? ' is-ok' : state.failed || state.quarantined && !refunded ? ' is-bad' : ''}`}>{status}{refunded && <span className="ra-refund-rail"> · {testnet ? settlementAssetLabel(intent.quote?.payment?.asset) : 'simulated'}</span>}{elapsed !== undefined && state.ok && ` · ${elapsed.toFixed(1)} s`}</p>
    {state.phase === 'submitted' && <PendingTime since={state.pendingSince} />}
    {state.failed && <button className="ra-btn ra-btn-go" onClick={() => onRetry(intent.intentId)}>Retry delivery</button>}
    <Verification run={run} intent={intent} />
    {testnet && typeof refundUrl === 'string' && refundUrl.startsWith('https://testnet.xrpl.org/') && <a href={refundUrl} target="_blank" rel="noreferrer">Refund tx {shortHash(intent.refund?.txHash ?? '')} ↗</a>}
    {receipt && <button className="ra-link ra-receipt-link" onClick={() => onReceipt(receipt)}>Receipt ›</button>}
  </section>
}
