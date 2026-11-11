import { money, shortTx, xrpAmount as xrp, whenSGT } from '../../shared/presentation'
import { keyRevealLabel } from '../format'
import { useEffect, useRef, useState } from 'react'
import { XRPL_LABEL, type LedgerView, type RunSnapshot } from '../../shared/contracts/index.js'
import { settlementAssetLabel } from '../format'
import { getLedger } from '../api'
import { deriveRunState } from '../runState'

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** Testnet ledger: who paid whom in this run, and every wallet's live balance. Public data only. */
export default function Ledger({ run }: { run: RunSnapshot }) {
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [updated, setUpdated] = useState<Date>()
  const [view, setView] = useState<LedgerView>()
  const previous = useRef(new Map<string, string | null>())
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const model = deriveRunState(run)
  const onLedger = model.rail === 'XRPL TESTNET'
  const active = !model.terminal
  const paid = model.purchases.filter(item => item.receipt?.xrpl).length
  useEffect(() => {
    if (!onLedger) return
    let live = true
    const load = () => getLedger().then(next => {
      if (!live || next.rail !== 'xrpl-testnet') return
      // Briefly highlight balances that changed since the last poll.
      setMoved(new Set(next.wallets.filter(w => previous.current.has(w.address) && previous.current.get(w.address) !== w.balanceDrops).map(w => w.address)))
      previous.current = new Map(next.wallets.map(w => [w.address, w.balanceDrops]))
      setView(next); setError(false); setUpdated(new Date())
    }).catch(() => { if (live) setError(true) })
    void load()
    const timer = active ? setInterval(load, 4000) : undefined
    return () => { live = false; if (timer) clearInterval(timer) }
  }, [onLedger, active, paid, attempt])
  if (!onLedger) return null
  const payments = model.payments.filter(item => item.xrpl)
  const steps = run.events.filter(event => event.type === 'XRPL' && event.runId === run.runId)
  const nameOf = (address: string) => view?.rail === 'xrpl-testnet' ? view.wallets.find(w => w.address === address)?.name ?? short(address) : short(address)
  return <section className="ra-panel ra-ledger" aria-label="XRPL Testnet ledger">
    <h2>Ledger · XRPL Testnet</h2>
    <p className="ra-muted">{XRPL_LABEL} · Fixed demo rates: S$0.01 = 1,000 XRP drops; S$1.00 = 1 issued test unit</p>
    <h3>Payments this run</h3>
    {payments.length === 0 ? <p>No ledger payment yet.</p> : <ol className="ra-ledger-payments">
      {payments.map(receipt => <li key={receipt.receiptId}>
        <span className="ra-ledger-flow"><span>{nameOf(receipt.xrpl!.payer)}</span><span aria-hidden="true"> → </span><strong>{nameOf(receipt.xrpl!.payTo)}</strong></span>
        <span>{money(receipt.amountMinor)} = {receipt.xrpl!.asset && receipt.xrpl!.asset !== 'XRP' ? `${receipt.xrpl!.amountDrops} ${settlementAssetLabel(receipt.xrpl!.asset)}` : xrp(receipt.xrpl!.amountDrops)} · ledger {receipt.xrpl!.ledgerIndex}</span>
        {receipt.escrow?.mode === 'key-reveal' && <span>{keyRevealLabel(receipt.escrow)}</span>}
        <a href={receipt.xrpl!.explorerUrl} title={receipt.xrpl!.txHash} target="_blank" rel="noreferrer">tx <span className="mono">{shortTx(receipt.xrpl!.txHash)}</span> on the explorer</a>
      </li>)}
    </ol>}
    {steps.length > 0 && <ol className="ra-ledger-steps" aria-label="Payment steps">
      {steps.map(step => <li key={step.id}><time dateTime={step.at}>{whenSGT(step.at)}</time> {step.label}</li>)}
    </ol>}
    <h3>Wallets</h3>
    {error && <p role="status">Couldn’t load balances. {view && updated && `Last updated ${whenSGT(updated.toISOString())}. `}<button className="ra-btn" onClick={() => { setError(false); setAttempt(n => n + 1) }}>Retry balances</button></p>}
    {view?.rail !== 'xrpl-testnet' ? <p>{error ? 'Balances unavailable.' : 'Loading Testnet balances…'}</p> : <table className="ra-ledger-wallets">
      <thead><tr><th scope="col">Wallet</th><th scope="col">Balance</th><th scope="col">XRP received from ResearchAgent</th></tr></thead>
      <tbody>{view.wallets.map(wallet => <tr key={wallet.address} className={moved.has(wallet.address) ? 'ra-ledger-moved' : undefined}>
        <th scope="row">{wallet.name}<br /><a href={`${view.accountExplorer}/${wallet.address}`} target="_blank" rel="noreferrer"><code>{short(wallet.address)}</code></a></th>
        <td>{xrp(wallet.balanceDrops)}</td>
        <td>{wallet.role === 'buyer' ? `${wallet.payments} payments sent` : `${xrp(wallet.receivedDrops)} · ${wallet.payments} payments`}</td>
      </tr>)}</tbody>
    </table>}
  </section>
}
