import { useEffect, useRef } from 'react'
import type { Receipt as ReceiptData, RunSnapshot } from '../../shared/contracts/index.js'
import { candidateOf, money, shortHash } from '../format'

/** A paper receipt: one charge per intent, labelled simulated (or Testnet). */
export default function Receipt({ run, receipt, onClose }: { run: RunSnapshot; receipt: ReceiptData; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const source = candidateOf(run, receipt)
  const intent = run.intents.find(item => item.intentId === receipt.intentId)
  const grant = run.grants.find(item => item.intentId === receipt.intentId)
  const charges = run.receipts.filter(item => item.intentId === receipt.intentId).length
  return <dialog ref={dialog} className="ra-receipt" aria-label="Receipt" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === dialog.current) onClose() }}>
    <h2>RECEIPT</h2><p className="sub">ResearchAgent · run {shortHash(run.runId)}</p>
    <dl>
      <dt>Item</dt><dd>{source?.title ?? receipt.resourceId}</dd>
      <dt>Publisher</dt><dd>{source?.publisher ?? '—'}</dd>
      {intent?.quote && <><dt>Quote</dt><dd>{shortHash(intent.quote.quoteHash)}</dd></>}
      <dt>Settled</dt><dd>{receipt.settledAt.slice(11, 19)}</dd>
      <dt>Delivered</dt><dd>{grant ? `sha-256 ${shortHash(grant.contentDigest)} ✓` : 'not yet verified'}</dd>
      {receipt.xrpl && <><dt>Ledger</dt><dd><a href={receipt.xrpl.explorerUrl} target="_blank" rel="noreferrer">tx {shortHash(receipt.xrpl.txHash)}</a></dd></>}
      <dt>Charges</dt><dd>{charges} (retries can’t add more)</dd>
    </dl>
    <div className="tot"><span>Total</span><span>{money(receipt.amountMinor)}</span></div>
    <div className="sim">{receipt.label}</div>
    <button type="button" className="ra-btn" onClick={onClose}>Close</button>
  </dialog>
}
