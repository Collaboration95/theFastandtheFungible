import Icon from './Icon'
import { REFUND_LABEL } from '../copy'
import KeyRevealLifecycle from './KeyRevealLifecycle'
import { keyRevealLabel } from '../format'
import type { PurchaseIntent, Receipt, RunSnapshot } from '../../shared/contracts'
import { candidateOf, compactAssetMoney, shortHash, settlementAssetLabel } from '../format'
import { purchaseState } from '../runState'
import { saveReceipts } from '../download'
import PendingTime from './PendingTime'
import Verification from './Verification'

export default function PaymentRow({ run, intent, onRetry, onReceipt }: { run: RunSnapshot; intent: PurchaseIntent; onRetry: (id: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const money = (minor: number) => compactAssetMoney(minor, intent.quote?.payment?.asset)
  const source = candidateOf(run, intent), state = purchaseState(run, intent)
  const refunded = intent.status === 'REFUNDED', testnet = run.labels.settlement.startsWith('XRPL')
  const receipt = run.receipts.find(r => r.intentId === intent.intentId)
  const status = refunded ? `${REFUND_LABEL.refunded} ${money(intent.refund?.amountMinor ?? 0)}` : intent.status === 'CHALLENGE_REFUSED' ? `${REFUND_LABEL.refused} · writer declined` : intent.status === 'CHALLENGE_REJECTED' ? `${REFUND_LABEL.refused} · request did not pass verification` : intent.status === 'CHALLENGED' ? `${REFUND_LABEL.pending} · awaiting confirmation` : intent.escrow?.mode === 'key-reveal' ? keyRevealLabel(intent.escrow) : state.ok ? 'Verified' : state.failed ? `Paid ${money(intent.amountMinor)} but the article didn’t arrive. Retrying won’t charge you again.` : state.notSettled ? 'Not settled · nothing charged' : state.quarantined ? 'Promise check failed' : state.level >= 3 ? 'Paid · checking' : state.level === 2 ? 'Paying…' : `Quoted ${money(intent.amountMinor)}`
  const refundEvent = run.events.find(e => e.type === 'REFUND' && e.data?.intentId === intent.intentId)
  const refundUrl = refundEvent?.data?.explorerUrl
  const start = run.events.find(e => e.type === 'BUY' && e.data?.intentId === intent.intentId)?.at
  const elapsed = start && receipt ? Math.max(0, (Date.parse(receipt.settledAt) - Date.parse(start)) / 1000) : undefined
  return <section className="ra-payment" aria-label={`Payment: ${source?.publisher ?? intent.resourceId}`}>
    <div className="ra-payment-heading"><b><Icon name={refunded ? 'refund' : state.ok ? 'check' : state.failed ? 'close' : 'circle'} size={16} /> {source?.publisher.split(' · ')[0] ?? intent.resourceId}</b><span>{money(intent.amountMinor)}</span></div>
    {source?.publisher.includes(' · ') && <details className="ra-writer-details"><summary>Writer details</summary><p>{source.publisher}</p></details>}
    <p className="ra-payment-title">{source?.title ?? intent.resourceId}</p>
    {intent.purchaseKind && <p>{intent.purchaseKind}</p>}
    {testnet && intent.quote?.payment?.asset && intent.quote.payment?.asset !== 'XRP' && <p>{settlementAssetLabel(intent.quote.payment?.asset)}</p>}
    <p style={intent.escrow?.mode === 'key-reveal' ? { overflowWrap: 'anywhere' } : undefined} key={intent.status} className={`ra-payment-status${intent.escrow?.mode === 'key-reveal' && !refunded ? ' ra-key-line' : ''}${state.ok ? ' is-ok' : state.failed || state.quarantined && !refunded ? ' is-bad' : ''}`}>{status}{refunded && <span className="ra-refund-rail"> · {testnet ? settlementAssetLabel(intent.quote?.payment?.asset) : 'simulated'}</span>}{elapsed !== undefined && state.ok && ` · ${elapsed.toFixed(1)} s`}</p>
    {state.phase === 'submitted' && <PendingTime since={state.pendingSince} />}
    {state.failed && <button className="ra-btn ra-btn-go" onClick={() => onRetry(intent.intentId)}>Retry delivery</button>}
    {intent.escrow?.mode === 'key-reveal' && <KeyRevealLifecycle escrow={intent.escrow} />}
    {/* Escrow → key first, then the writer-signed refund it led to; promise checks follow. */}
    {intent.escrow?.mode === 'key-reveal' && intent.refund && <div className="ra-refund-detail"><p>Refund signed by the writer. This demo writer agrees to refund; a real writer could refuse.</p><p>The writer’s trust score drops.</p><button className="ra-link" onClick={() => { void saveReceipts(run.runId, 'fraud-proof.json', b => (b.fraudProofs as { intentId: string }[] | undefined)?.find(p => p.intentId === intent.intentId)) }}>Download evidence</button></div>}
    <Verification run={run} intent={intent} />
    <p className="ra-payment-links">{[
      testnet && typeof refundUrl === 'string' && refundUrl.startsWith('https://testnet.xrpl.org/') && <a key="refund" href={refundUrl} target="_blank" rel="noreferrer">Refund tx {shortHash(intent.refund?.txHash ?? '')} <Icon name="external" size={16} /></a>,
      testnet && intent.escrow?.mode !== 'key-reveal' && /^[A-Fa-f0-9]{64}$/.test(intent.txHash ?? '') && <a key="paid" href={`https://testnet.xrpl.org/transactions/${intent.txHash}`} target="_blank" rel="noreferrer">{refunded ? 'Payment transaction' : 'Transaction'} <Icon name="external" size={16} /></a>,
    ].filter(Boolean).flatMap((link, i) => i ? [' · ', link] : [link])}</p>
    {receipt && <button className="ra-link ra-receipt-link" onClick={() => onReceipt(receipt)}>Receipt <Icon name="right" size={16} /></button>}
  </section>
}
