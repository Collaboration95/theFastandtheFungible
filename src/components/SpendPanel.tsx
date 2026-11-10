import type { Receipt, RunSnapshot } from '../../shared/contracts'
import { money } from '../format'
import PaymentRow from './PaymentRow'

const considered = (run: RunSnapshot) => { const n = run.decisions[0]?.rows.length ?? 0; return `${n} paid article${n === 1 ? '' : 's'} considered; none bought.` }

export default function SpendPanel({ run, onRetry, onReceipt }: { run: RunSnapshot; onRetry: (id: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const refunded = run.refundedMinor ?? run.intents.reduce((sum, i) => sum + (i.refund?.amountMinor ?? 0), 0)
  const net = Math.max(0, run.spentMinor - refunded)
  const pct = (amount: number) => `${run.budgetMinor ? Math.min(100, amount / run.budgetMinor * 100) : 0}%`
  const would = run.decisions.flatMap(r => r.rows).filter(r => r.wouldBuy)
  return <section className="ra-spend" aria-label="Spend">
    <div className="ra-spend-summary"><h2>Net cost</h2><p className="ra-net" key={net}>{money(net)}</p><div className="ra-spend-bar" role="img" aria-label={`Paid ${money(run.spentMinor)}, held in escrow ${money(run.reservedMinor)}, refunded ${money(refunded)}, budget left ${money(Math.max(0, run.budgetMinor - run.spentMinor - run.reservedMinor))}` }><i style={{ width: pct(net) }} /><i className="is-refunded" style={{ width: pct(refunded) }} /><i className="is-reserved" style={{ width: pct(run.reservedMinor) }} /></div><p>{money(run.budgetMinor)} budget · {money(Math.max(0, run.budgetMinor - run.spentMinor - run.reservedMinor))} budget left · refunds don't restore budget</p>{run.reservedMinor > 0 && <p className="ra-reserved">Held in escrow <strong>{money(run.reservedMinor)}</strong></p>}<p className="ra-note">Paid {money(run.spentMinor)} · Refunded {money(refunded)}</p></div>
    <div className="ra-payments"><h3>Payments</h3>{run.intents.map(i => <PaymentRow key={i.intentId} run={run} intent={i} onRetry={onRetry} onReceipt={onReceipt} />)}{!run.intents.length && <p className="ra-note">{run.phase !== 'DONE' ? 'No purchases yet.' : run.budgetMinor === 0 && would.length ? `Would have bought 1 article (${money(would[0].candidate.price.amountMinor)}). Raise the budget to allow it.` : run.answers.some(a => a.claims.length) ? `Answered from free sources. ${considered(run)}` : run.candidates.length ? `Nothing bought. ${considered(run)}` : 'No purchases.'}</p>}</div>
  </section>
}
