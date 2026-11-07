import KeyRevealLifecycle from './KeyRevealLifecycle'
import AnchorStatus from './AnchorStatus'
import { WriterVerification } from './WriterVerification.js'
import { contributions } from '../../shared/contribution'
import { useEffect, useRef, useState } from 'react'
import type { Receipt, RunSnapshot } from '../../shared/contracts'
import { candidateOf, assetMoney, shortHash, settlementAssetLabel } from '../format'
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
const summary = (use: Use | undefined, royalty: Royalty) => {
  const cited = use?.links.filter(l => l.retained).length ?? 0
  const first = use?.structuralUse === 'cited' ? cited ? `Cited in ${cited} claim${cited === 1 ? '' : 's'}` : 'Cited in the final answer' : 'Not cited in the final answer'
  return `${first} · Refund ${use?.refundStatus === 'recorded verified refund' ? 'recorded' : use?.refundStatus ?? 'none'} · Royalty ${royalty.short}`
}
const refundTone = (status: string): Tone => status === 'none' ? 'none' : status === 'pending' ? 'pending' : status === 'refused' ? 'bad' : 'recorded'
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
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
      <span className="ra-bc-state"><Status tone={link.retained ? 'ok' : 'none'}>{link.retained ? 'Retained' : 'Removed'}</Status><small>answer v{link.answerVersion}</small></span>
      <svg className="ra-bc-chev" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m5 6.5 3 3 3-3" /></svg></button>
      {expanded && <div id={id} className="ra-bc-body"><blockquote>{link.passage}</blockquote><p className="ra-bc-cap">Exact delivered passage · <span className="mono">{link.spanId}</span></p>
        <button className="ra-btn-sm" aria-expanded={verify === n} onClick={() => setVerify(verify === n ? null : n)}>Verify this link</button>
        {verify === n && <dl className="ra-bc-proof mono"><div><dt>Claim</dt><dd>{link.claimId}</dd></div><div><dt>Grant</dt><dd>{link.grantIntentId}</dd></div><div><dt>Manifest root</dt><dd>{link.manifestRoot}</dd></div></dl>}</div>}
    </li>
  })}</ul></>
}

export default function ReceiptSheet({ run, receipt, onClose }: { run: RunSnapshot; receipt: Receipt; onClose: () => void }) {
  const [royalty, setRoyalty] = useState<Royalty>({ tone: 'none', label: 'Not assessed', short: 'not assessed', detail: 'Separate hire receipts record payouts' })
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/runs/${encodeURIComponent(run.runId)}/receipts.json`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(b => {
      if (!b || controller.signal.aborted) return
      const rows = b.payments as {kind: string; status: string; amountDrops: string; policyVersion: string}[]
      const payouts = rows.filter(r => r.kind === 'royalty')
      setRoyalty(royaltyOf(payouts, rows.some(r => r.kind === 'inbound')))
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
    <p className="ra-net" style={{animation: 'none'}}>{assetMoney(receipt.amountMinor, receipt.xrpl?.asset)}</p><p>{refund ? 'Refunded' : intent?.status === 'VERIFIED' ? 'Verified' : 'Paid'} · {new Date(receipt.settledAt).toISOString()}</p>
    {receipt.escrow?.mode === 'key-reveal' && <KeyRevealLifecycle escrow={receipt.escrow} />}
    <dl><dt>Writer</dt><dd>{source?.publisher ?? '—'} <WriterVerification value={source?.verification} /></dd>{source?.source && <><dt>Origin</dt><dd>{source.source.origin}</dd></>}<dt>Article</dt><dd>{source?.title ?? receipt.resourceId}</dd><dt>Rail</dt><dd>{testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'simulated'}</dd><dt>Gross paid</dt><dd>{assetMoney(receipt.amountMinor, receipt.xrpl?.asset)}</dd>{refund > 0 && <><dt>Refunded</dt><dd>{assetMoney(refund, receipt.xrpl?.asset)}<span className="ra-refund-rail"> · {testnet ? settlementAssetLabel(receipt.xrpl?.asset) : 'simulated'}</span></dd></>}<dt>Net cost</dt><dd>{assetMoney(receipt.amountMinor - refund, receipt.xrpl?.asset)}</dd><dt>Charges</dt><dd>{run.receipts.filter(r => r.intentId === receipt.intentId).length}</dd>
    {invoice && <><dt>Invoice</dt><dd><button className="ra-link mono" title={invoice} onClick={() => void navigator.clipboard.writeText(invoice)}>{shortHash(invoice)} ⧉</button></dd></>}
    <dt>Transaction</dt><dd>{testnet && tx?.explorerUrl.startsWith('https://testnet.xrpl.org/') ? <a href={tx.explorerUrl} target="_blank" rel="noreferrer"><span className="mono">{shortHash(tx.txHash)}</span> View on XRPL Testnet ↗</a> : testnet ? 'Awaiting validation' : 'None (simulated)'}</dd>
    {refund > 0 && <><dt>Refund tx</dt><dd>{testnet && typeof refundUrl === 'string' && refundUrl.startsWith('https://testnet.xrpl.org/') ? <a href={refundUrl} target="_blank" rel="noreferrer"><span className="mono">{shortHash(intent?.refund?.txHash ?? '')}</span> View on XRPL Testnet ↗</a> : testnet ? 'Recorded refund · ledger lookup not run here' : 'None (simulated)'}</dd></>}</dl>
    <section className="ra-bought" aria-label="What your money bought"><h3>What your money bought</h3>
      <p className="ra-bought-sum">{summary(use, royalty)}</p>
      <dl className="ra-bought-rows">
        <Row label="Final answer" tone={use?.structuralUse === 'cited' ? 'ok' : 'none'} value={use?.structuralUse === 'cited' ? 'Cited in the final answer' : 'No final citation use'} />
        <Row label="Semantic contribution" tone="none" value="Not assessed" note="Not independently verified" />
        <Row label="Refund" tone={refundTone(use?.refundStatus ?? 'none')} value={sentence(use?.refundStatus ?? 'none')} />
        <Row label="Royalty" tone={royalty.tone} value={royalty.label} note={royalty.detail} />
      </dl>
      {!!use?.links.length && <Claims links={use.links} />}
    </section>
    {intent && <Verification run={run} intent={intent} />}<AnchorStatus run={run} /><footer>{testnet ? 'XRPL Testnet · test funds, no value' : 'Simulated payment · no ledger entry'}</footer>
  </dialog>
}
