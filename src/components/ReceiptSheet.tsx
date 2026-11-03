import { contributions } from '../../shared/contribution'
import { useEffect, useRef, useState } from 'react'
import type { Receipt, RunSnapshot } from '../../shared/contracts'
import { candidateOf, money, shortHash, settlementAssetLabel } from '../format'
import Verification from './Verification'

export default function ReceiptSheet({ run, receipt, onClose }: { run: RunSnapshot; receipt: Receipt; onClose: () => void }) {
  const [royalty, setRoyalty] = useState('Not assessed; separate hire receipts record payouts')
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/runs/${encodeURIComponent(run.runId)}/receipts.json`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(b => {
      if (!b || controller.signal.aborted) return
      const rows = b.payments as {kind: string; status: string; amountDrops: string; policyVersion: string}[]
      const payouts = rows.filter(r => r.kind === 'royalty')
      setRoyalty(payouts.length ? payouts.map(r => `${r.status} · ${r.amountDrops} drops · ${r.policyVersion}`).join('; ') + ' (recorded status; not checked on ledger here)' : rows.some(r => r.kind === 'inbound') ? 'Pending or unresolved; no payout receipt' : 'Not applicable · direct research')
    }).catch(() => { /* Unavailable is not zero or confirmed. */ })
    return () => controller.abort()
  }, [run.runId])
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close() }, [])
  const source = candidateOf(run, receipt), intent = run.intents.find(i => i.intentId === receipt.intentId)
  const refund = intent?.refund?.amountMinor ?? 0, testnet = run.labels.settlement.startsWith('XRPL')
  const use = contributions({ ...run, sources: run.contents }).purchases.find(p => p.intentId === receipt.intentId)
  const tx = receipt.xrpl
  const refundUrl = run.events.find(e => e.type === 'REFUND' && e.data?.intentId === intent?.intentId)?.data?.explorerUrl
  const invoice = intent?.quote?.quoteHash
  return <dialog ref={dialog} className="ra-receipt-sheet" style={{animation: 'none'}} aria-label="Receipt" onCancel={e => { e.preventDefault(); onClose() }}>
    <header><h2>Receipt</h2><button className="ra-btn" onClick={onClose} aria-label="Close receipt">×</button></header>
    <p className="ra-net" style={{animation: 'none'}}>{money(receipt.amountMinor)}</p><p>{refund ? 'Refunded' : intent?.status === 'VERIFIED' ? 'Verified' : 'Paid'} · {new Date(receipt.settledAt).toLocaleString('en-SG')}</p>
    <dl><dt>Writer</dt><dd>{source?.publisher ?? '—'}</dd>{source?.source && <><dt>Origin</dt><dd>{source.source.origin} · unverified writer</dd></>}<dt>Article</dt><dd>{source?.title ?? receipt.resourceId}</dd><dt>Rail</dt><dd>{testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'simulated'}</dd><dt>Gross paid</dt><dd>{money(receipt.amountMinor)}</dd>{refund > 0 && <><dt>Refunded</dt><dd>{money(refund)}<span className="ra-refund-rail"> · {testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'simulated'}</span></dd></>}<dt>Net cost</dt><dd>{money(receipt.amountMinor - refund)}</dd><dt>Charges</dt><dd>{run.receipts.filter(r => r.intentId === receipt.intentId).length}</dd>
    {invoice && <><dt>Invoice</dt><dd><button className="ra-link mono" title={invoice} onClick={() => void navigator.clipboard.writeText(invoice)}>{shortHash(invoice)} ⧉</button></dd></>}
    <dt>Transaction</dt><dd>{testnet && tx?.explorerUrl.startsWith('https://testnet.xrpl.org/') ? <a href={tx.explorerUrl} target="_blank" rel="noreferrer"><span className="mono">{shortHash(tx.txHash)}</span> View on XRPL Testnet ↗</a> : testnet ? 'Awaiting validation' : 'None (simulated)'}</dd>
    {refund > 0 && <><dt>Refund tx</dt><dd>{testnet && typeof refundUrl === 'string' && refundUrl.startsWith('https://testnet.xrpl.org/') ? <a href={refundUrl} target="_blank" rel="noreferrer"><span className="mono">{shortHash(intent?.refund?.txHash ?? '')}</span> View on XRPL Testnet ↗</a> : testnet ? 'Recorded refund · ledger lookup not run here' : 'None (simulated)'}</dd></>}</dl>
    <section aria-label="What your money bought"><h3>What your money bought</h3>
      <p>{use?.structuralUse === 'cited' ? 'Cited in the final answer' : 'No final citation use'}</p>
      <p>Semantic contribution: not assessed · not independently verified</p>
      <p>Refund status: {use?.refundStatus ?? 'none'}</p>
      <p>Royalty: {royalty}</p>
      {use?.links.map((link, n) => <details key={n}><summary>Claim {n + 1} · {link.retained ? 'retained' : 'removed'} · answer v{link.answerVersion}</summary><p>{link.claim}</p><blockquote>{link.passage}</blockquote><p>Exact delivered passage · {link.spanId}</p><details><summary>Verify this link</summary><p className="mono" style={{overflowWrap:'anywhere'}}>Claim {link.claimId}<br/>Grant {link.grantIntentId}<br/>Manifest root {link.manifestRoot}</p></details></details>)}
    </section>
    {intent && <Verification run={run} intent={intent} />}<footer>{testnet ? 'XRPL Testnet · test funds, no value' : 'Simulated payment · no ledger entry'}</footer>
  </dialog>
}
