import Icon from './Icon'
import { useRef } from 'react'
import type { Receipt, RunSnapshot } from '../../shared/contracts'
import { money } from '../format'
import SpendPanel from './SpendPanel'
export default function MobileSpend({ run, onRetry, onReceipt }: { run: RunSnapshot; onRetry: (id: string) => void; onReceipt: (receipt: Receipt) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return <div className="ra-mobile-spend"><button type="button" className="ra-link" onClick={() => dialog.current?.showModal()}>Net cost {money(Math.max(0, run.spentMinor - (run.refundedMinor ?? 0)))} · {money(Math.max(0, run.budgetMinor - run.spentMinor - run.reservedMinor))} budget left{run.reservedMinor > 0 && ` · ${money(run.reservedMinor)} held in escrow`} · {run.receipts.length} payment{run.receipts.length === 1 ? '' : 's'} <Icon name="right" size={16} /></button><dialog ref={dialog} className="ra-receipt-sheet ra-mobile-spend-sheet" aria-label="Spend and payments"><header><h2>Spend</h2><button className="ra-btn" aria-label="Close spend" onClick={() => dialog.current?.close()}><Icon name="close" /></button></header><SpendPanel run={run} onRetry={onRetry} onReceipt={receipt => { dialog.current?.close(); onReceipt(receipt) }} /></dialog></div>
}
