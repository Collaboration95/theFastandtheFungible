import { ENV, whenSGT, xrpAmount, dropsAmount } from '../../shared/presentation'
import Icon from './Icon'
import { REFUND_LABEL } from '../copy'
import KeyRevealLifecycle from './KeyRevealLifecycle'
import AnchorStatus from './AnchorStatus'
import { WriterVerification } from './WriterVerification.js'
import { contributions } from '../../shared/contribution'
import { useEffect, useRef, useState } from 'react'
import type { Receipt, RunSnapshot } from '../../shared/contracts'
import { candidateOf, compactAssetMoney, shortHash, settlementAssetLabel } from '../format'
import Verification from './Verification'

type Use = ReturnType<typeof contributions>['purchases'][number]
type Tone = 'ok' | 'pending' | 'none' | 'bad' | 'recorded'
type Royalty = { tone: Tone; label: string; short: string; detail: string }
type Payout = { status: string; amountDrops: string; policyVersion: string }
/** Only a recorded CONFIRMED status earns the green dot; every other status stays pending. */
function royaltyOf(payouts: Payout[], inbound: boolean): Royalty {
  if (payouts.length) {
    const confirmed = payouts.every(r => r.status === 'CONFIRMED')
    return { tone: confirmed ? 'ok' : 'pending', label: confirmed ? 'Confirmed · recorded' : 'Pending', short: confirmed ? 'confirmed (recorded)' : 'pending',
      detail: payouts.map(r => `${r.status} · ${r.amountDrops} drops · ${r.policyVersion}`).join('; ') + ' (recorded status; not checked on ledger here)' }
  }
  return inbound ? { tone: 'pending', label: 'Pending', short: 'pending', detail: 'Pending or unresolved; no payout receipt' }
    : { tone: 'none', label: 'Not applicable', short: 'n/a', detail: 'Direct research · no inbound hire' }
}
const NOT_ASSESSED: Royalty = { tone: 'none', label: 'Not assessed', short: 'not assessed', detail: 'Separate hire receipts record payouts' }
/** Direct research has no inbound hire, so there is no royalty to report: the row and its words stay out of the receipt. */
const hasRoyalty = (royalty?: Royalty): royalty is Royalty => !!royalty && royalty.label !== 'Not applicable'
const summary = (use: Use | undefined, royalty?: Royalty) => {
  const cited = use?.links.filter(l => l.retained).length ?? 0
  const first = use?.structuralUse === 'cited' ? cited ? `Cited in ${cited} claim${cited === 1 ? '' : 's'}` : 'Cited in the final answer' : 'Not cited in the final answer'
  return `${first} · Refund ${use?.refundStatus === 'recorded verified refund' ? 'recorded' : use?.refundStatus ?? 'none'}${hasRoyalty(royalty) ? ` · Royalty ${royalty.short}` : ''}`
}
const refundTone = (status: string): Tone => status === 'none' ? 'none' : status === 'pending' ? 'pending' : status === 'refused' ? 'bad' : 'recorded'
function Status({ tone, children }: { tone: Tone; children: string }) { return <span className={`ra-st tone-${tone}`}><i aria-hidden="true" />{children}</span> }
function Row({ label, tone, value, note }: { label: string; tone: Tone; value: string; note?: string }) {
  return <div><dt>{label}</dt><dd><Status tone={tone}>{value}</Status>{note && <small>{note}</small>}</dd></div>
}
function Claims({ links }: { links: Use['links'] }) {
  const [open, setOpen] = useState<number | null>(null), [verify, setVerify] = useState<number | null>(null)
  return <><h4>Claims <span>{links.length}</span></h4><ul className="ra-bcs">{links.map((link, n) => {
    const id = `ra-bc-${n}`, expanded = open === n
    return <li key={n}><button className="ra-bc" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(expanded ? null : n)}>
      <span className="ra-bc-n" aria-hidden="true">{n + 1}</span><span className="ra-bc-text"><span className="ra-sr">Claim {n + 1}: </span>{link.claim}</span>
      <span className="ra-bc-state"><Status tone={link.retained ? 'ok' : 'none'}>{link.retained ? 'Retained' : 'Removed'}</Status></span>
      <svg className="ra-bc-chev" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m5 6.5 3 3 3-3" /></svg></button>
      {expanded && <div id={id} className="ra-bc-body"><blockquote>{link.passage}</blockquote><p className="ra-bc-cap">Exact delivered passage · <span className="mono">{link.spanId}</span></p>
        <button className="ra-btn-sm" aria-expanded={verify === n} onClick={() => setVerify(verify === n ? null : n)}>Technical details</button>
        {verify === n && <dl className="ra-bc-proof mono"><div><dt>Promise</dt><dd>{link.claimId}</dd></div><div><dt>Delivery record</dt><dd>{link.grantIntentId}</dd></div><div><dt>Promise list fingerprint</dt><dd>{link.manifestRoot}</dd></div></dl>}</div>}
    </li>
  })}</ul></>
}

export default function ReceiptSheet({ run, receipt, onClose }: { run: RunSnapshot; receipt: Receipt; onClose: () => void }) {
  const [copyStatus, setCopyStatus] = useState('')
  const [royalty, setRoyalty] = useState<Royalty>()
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/runs/${encodeURIComponent(run.runId)}/receipts.json`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(b => {
      if (controller.signal.aborted) return
      if (!b) { setRoyalty(NOT_ASSESSED); return }
      const rows = b.payments as {kind: string; status: string; amountDrops: string; policyVersion: string}[]
      const payouts = rows.filter(r => r.kind === 'royalty')
      setRoyalty(royaltyOf(payouts, rows.some(r => r.kind === 'inbound')))
    }).catch(() => { if (!controller.signal.aborted) setRoyalty(NOT_ASSESSED) /* Unavailable is not zero or confirmed. */ })
    return () => controller.abort()
  }, [run.runId])
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close() }, [])
  const source = candidateOf(run, receipt), intent = run.intents.find(i => i.intentId === receipt.intentId)
  const h = intent?.escrow?.holdback
  const refund = intent?.refund?.amountMinor ?? (h?.state === 'refunded' && receipt.amountMinor > 0 ? h.amountMinor : 0), testnet = run.labels.settlement.startsWith('XRPL')
  const use = contributions({ ...run, sources: run.contents }).purchases.find(p => p.intentId === receipt.intentId)
  const tx = receipt.xrpl
  const refundHash = intent?.refund?.txHash ?? h?.cancelHash
  const refundUrl = h?.cancelHash ? `https://testnet.xrpl.org/transactions/${h.cancelHash}` : run.events.find(e => e.type === 'REFUND' && e.data?.intentId === intent?.intentId)?.data?.explorerUrl
  const invoice = intent?.quote?.quoteHash
  return <dialog ref={dialog} className="ra-receipt-sheet" aria-label="Receipt" onCancel={e => { e.preventDefault(); onClose() }}>
    <header><h2>Receipt</h2><button className="ra-btn" onClick={onClose} aria-label="Close receipt"><Icon name="close" /></button></header>
    {intent?.purchaseKind && <p>{intent.purchaseKind}</p>}
    <p className="ra-net">{compactAssetMoney(receipt.amountMinor, receipt.xrpl?.asset)}</p><p>{refund ? h ? 'Holdback refunded' : 'Refunded' : intent?.status === 'VERIFIED' ? 'Receipt checked' : 'Paid'} · <time dateTime={receipt.settledAt}>{whenSGT(receipt.settledAt)}</time></p>
    {receipt.escrow?.mode === 'key-reveal' && <KeyRevealLifecycle escrow={receipt.escrow} />}
    <dl><dt>Writer</dt><dd>{source?.publisher ?? '—'}</dd><dt>Writer identity</dt><dd>{source?.verification?.status === 'verified' ? <WriterVerification value={source.verification} /> : source?.verification?.status === 'check_failed' ? 'Check unavailable' : 'Not checked'}</dd>{source?.source && <><dt>Origin</dt><dd>{source.source.origin}</dd></>}<dt>Article</dt><dd>{source?.title ?? receipt.resourceId}</dd><dt>Network</dt><dd>{testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'Simulated'}</dd><dt>Gross paid</dt><dd>{compactAssetMoney(receipt.amountMinor, receipt.xrpl?.asset)}</dd>{refund > 0 && <><dt>Refunded</dt><dd>{compactAssetMoney(refund, receipt.xrpl?.asset)}<span className="ra-refund-rail"> · {testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'Simulated'}</span></dd></>}<dt>Net cost</dt><dd>{compactAssetMoney(receipt.amountMinor - refund, receipt.xrpl?.asset)}</dd>{testnet && tx && (!tx.asset || tx.asset === 'XRP') && <><dt>On the ledger</dt><dd>{xrpAmount(tx.amountDrops)} ({dropsAmount(tx.amountDrops)} drops)</dd></>}<dt>Charges</dt><dd>{run.receipts.filter(r => r.intentId === receipt.intentId).length}</dd>
    {invoice && <><dt>Invoice</dt><dd><button className="ra-link mono" title={invoice} onClick={async () => { setCopyStatus(''); try { await navigator.clipboard.writeText(invoice); setCopyStatus('Invoice copied') } catch { setCopyStatus('Couldn’t copy the invoice. Try again.') } }}>{shortHash(invoice)} <Icon name="copy" size={16} /></button></dd></>}
    <dt>Transaction</dt><dd>{testnet && tx?.explorerUrl.startsWith('https://testnet.xrpl.org/') ? <a href={tx.explorerUrl} title={tx.txHash} target="_blank" rel="noreferrer"><span className="mono">{shortHash(tx.txHash)}</span> View on XRPL Testnet <Icon name="external" size={16} /></a> : testnet ? 'Awaiting validation' : 'None (simulated)'}</dd>
    {refund > 0 && <><dt>Refund tx</dt><dd>{testnet && typeof refundUrl === 'string' && refundUrl.startsWith('https://testnet.xrpl.org/') ? <a href={refundUrl} title={refundHash} target="_blank" rel="noreferrer"><span className="mono">{shortHash(refundHash ?? '')}</span> View on XRPL Testnet <Icon name="external" size={16} /></a> : testnet ? 'Recorded refund · ledger lookup not run here' : 'None (simulated)'}</dd></>}</dl>
    {copyStatus && <p role="status">{copyStatus}</p>}
    <section className="ra-bought" aria-label="What this payment bought"><h3>What this payment bought</h3>
      <p className="ra-bought-sum">{summary(use, royalty)}</p>
      <dl className="ra-bought-rows">
        <Row label="Final answer" tone={use?.structuralUse === 'cited' ? 'ok' : 'none'} value={use?.structuralUse === 'cited' ? 'Cited in the final answer' : 'No final citation use'} />
        <Row label="Usefulness" tone="none" value="Not assessed" note="Not independently verified" />
        <Row label="Refund" tone={refundTone(use?.refundStatus ?? 'none')} value={use?.refundStatus === 'recorded verified holdback refund' ? 'Holdback refunded' : use?.refundStatus === 'recorded verified refund' ? REFUND_LABEL.refunded : use?.refundStatus === 'pending' ? REFUND_LABEL.pending : use?.refundStatus === 'refused' ? REFUND_LABEL.refused : 'None'} />
        {hasRoyalty(royalty) && <Row label="Royalty" tone={royalty.tone} value={royalty.label} note={`Share paid onward to the original writer. ${royalty.detail}`} />}
      </dl>
      {!!use?.links.length && <Claims links={use.links} />}
    </section>
    {intent && <Verification run={run} intent={intent} />}<AnchorStatus run={run} /><footer>{testnet ? ENV.testnet : ENV.simulatedReceipt}</footer>
  </dialog>
}
