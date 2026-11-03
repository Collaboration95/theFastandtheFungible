import { useEffect, useRef } from 'react'
import type { Receipt, RunSnapshot } from '../../shared/contracts'
import { candidateOf, money, shortHash, settlementAssetLabel } from '../format'
import Verification from './Verification'

export default function ReceiptSheet({ run, receipt, onClose }: { run: RunSnapshot; receipt: Receipt; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close() }, [])
  const source = candidateOf(run, receipt), intent = run.intents.find(i => i.intentId === receipt.intentId)
  const refund = intent?.refund?.amountMinor ?? 0, testnet = run.labels.settlement.startsWith('XRPL')
  const tx = receipt.xrpl
  const refundUrl = run.events.find(e => e.type === 'REFUND' && e.data?.intentId === intent?.intentId)?.data?.explorerUrl
  const invoice = intent?.quote?.quoteHash
  return <dialog ref={dialog} className="ra-receipt-sheet" aria-label="Receipt" onCancel={e => { e.preventDefault(); onClose() }}>
    <header><h2>Receipt</h2><button className="ra-btn" onClick={onClose} aria-label="Close receipt">×</button></header>
    <p className="ra-net">{money(receipt.amountMinor)}</p><p>{refund ? 'Refunded' : intent?.status === 'VERIFIED' ? 'Verified' : 'Paid'} · {new Date(receipt.settledAt).toLocaleString('en-SG')}</p>
    <dl><dt>Writer</dt><dd>{source?.publisher ?? '—'}</dd><dt>Article</dt><dd>{source?.title ?? receipt.resourceId}</dd><dt>Rail</dt><dd>{testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'simulated'}</dd><dt>Paid</dt><dd>{money(receipt.amountMinor)}</dd>{refund > 0 && <><dt>Refunded</dt><dd>{money(refund)}<span className="ra-refund-rail"> · {testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'simulated'}</span></dd></>}<dt>Net cost</dt><dd>{money(receipt.amountMinor - refund)}</dd><dt>Charges</dt><dd>{run.receipts.filter(r => r.intentId === receipt.intentId).length}</dd>
    {invoice && <><dt>Invoice</dt><dd><button className="ra-link mono" title={invoice} onClick={() => void navigator.clipboard.writeText(invoice)}>{shortHash(invoice)} ⧉</button></dd></>}
    <dt>Transaction</dt><dd>{testnet && tx?.explorerUrl.startsWith('https://testnet.xrpl.org/') ? <a href={tx.explorerUrl} target="_blank" rel="noreferrer"><span className="mono">{shortHash(tx.txHash)}</span> View on XRPL Testnet ↗</a> : testnet ? 'Awaiting validation' : 'None (simulated)'}</dd>
    {refund > 0 && <><dt>Refund tx</dt><dd>{testnet && typeof refundUrl === 'string' && refundUrl.startsWith('https://testnet.xrpl.org/') ? <a href={refundUrl} target="_blank" rel="noreferrer"><span className="mono">{shortHash(intent?.refund?.txHash ?? '')}</span> View on XRPL Testnet ↗</a> : testnet ? 'Awaiting validation' : 'None (simulated)'}</dd></>}</dl>
    {intent && <Verification run={run} intent={intent} />}<footer>{testnet ? 'XRPL Testnet · test funds, no value' : 'Simulated payment · no ledger entry'}</footer>
  </dialog>
}
