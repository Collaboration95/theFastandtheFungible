import { useEffect, useRef, useState } from 'react'
import { XRPL_LABEL, type LedgerView, type RunSnapshot } from '../../shared/contracts/index.js'
import { getLedger } from '../api'

const xrp = (drops: string | null) => drops === null ? '—' : `${(Number(drops) / 1_000_000).toLocaleString('en-SG', { maximumFractionDigits: 6 })} XRP`
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** Testnet ledger: who paid whom in this run, and every wallet's live balance. Public data only. */
export default function Ledger({ run }: { run: RunSnapshot }) {
  const [view, setView] = useState<LedgerView>()
  const previous = useRef(new Map<string, string | null>())
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const onLedger = run.labels.settlement === XRPL_LABEL
  const active = !['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
  const paid = run.receipts.filter(receipt => receipt.runId === run.runId && receipt.xrpl).length
  useEffect(() => {
    if (!onLedger) return
    let live = true
    const load = () => getLedger().then(next => {
      if (!live || next.rail !== 'xrpl-testnet') return
      // Briefly highlight balances that changed since the last poll.
      setMoved(new Set(next.wallets.filter(w => previous.current.has(w.address) && previous.current.get(w.address) !== w.balanceDrops).map(w => w.address)))
      previous.current = new Map(next.wallets.map(w => [w.address, w.balanceDrops]))
      setView(next)
    }).catch(() => { /* keep the last good view */ })
    void load()
    const timer = active ? setInterval(load, 4000) : undefined
    return () => { live = false; if (timer) clearInterval(timer) }
  }, [onLedger, active, paid])
  if (!onLedger) return null
  const payments = run.receipts.filter(receipt => receipt.runId === run.runId && receipt.xrpl)
  const steps = run.events.filter(event => event.type === 'XRPL' && event.runId === run.runId)
  const nameOf = (address: string) => view?.rail === 'xrpl-testnet' ? view.wallets.find(w => w.address === address)?.name ?? short(address) : short(address)
  return <section className="ra-panel ra-ledger" aria-label="XRPL Testnet ledger">
    <h2>Ledger · XRPL Testnet</h2>
    <p className="ra-muted">{XRPL_LABEL} · S$0.01 = 1,000 drops (fixed demo rate)</p>
    <h3>Payments this run</h3>
    {payments.length === 0 ? <p>No ledger payment yet.</p> : <ol className="ra-ledger-payments">
      {payments.map(receipt => <li key={receipt.receiptId}>
        <span className="ra-ledger-flow"><span>{nameOf(receipt.xrpl!.payer)}</span><span aria-hidden="true"> → </span><strong>{nameOf(receipt.xrpl!.payTo)}</strong></span>
        <span>S${(receipt.amountMinor / 100).toFixed(2)} = {xrp(receipt.xrpl!.amountDrops)} · ledger {receipt.xrpl!.ledgerIndex}</span>
        <a href={receipt.xrpl!.explorerUrl} target="_blank" rel="noreferrer">tx {receipt.xrpl!.txHash.slice(0, 10)}… on the explorer</a>
      </li>)}
    </ol>}
    {steps.length > 0 && <ol className="ra-ledger-steps" aria-label="Payment steps">
      {steps.map(step => <li key={step.id}><time dateTime={step.at}>{step.at.slice(11, 19)}</time> {step.label}</li>)}
    </ol>}
    <h3>Wallets</h3>
    {view?.rail !== 'xrpl-testnet' ? <p>Loading Testnet balances…</p> : <table className="ra-ledger-wallets">
      <thead><tr><th scope="col">Wallet</th><th scope="col">Balance</th><th scope="col">Received from ResearchAgent</th></tr></thead>
      <tbody>{view.wallets.map(wallet => <tr key={wallet.address} className={moved.has(wallet.address) ? 'ra-ledger-moved' : undefined}>
        <th scope="row">{wallet.name}<br /><a href={`${view.accountExplorer}/${wallet.address}`} target="_blank" rel="noreferrer"><code>{short(wallet.address)}</code></a></th>
        <td>{xrp(wallet.balanceDrops)}</td>
        <td>{wallet.role === 'buyer' ? `${wallet.payments} payments sent` : `${xrp(wallet.receivedDrops)} · ${wallet.payments} payments`}</td>
      </tr>)}</tbody>
    </table>}
  </section>
}
