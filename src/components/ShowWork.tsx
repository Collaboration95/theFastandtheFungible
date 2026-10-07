import { useEffect, useRef, useState } from 'react'
import { XRPL_LABEL, type ModeLabels, type RunSnapshot } from '../../shared/contracts/index.js'
import Activity from './Activity'
import Wire from './Wire'
import DecisionTable from './DecisionTable'
import Ledger from './Ledger'
import Modes from './Modes'
import { candidateOf, money, shortHash } from '../format'

type Tab = 'Trace' | 'Wire' | 'Policy' | 'Receipts' | 'Models' | 'Ledger'

/** Press W: the raw persisted events, HTTP exchange, full policy table and receipts.
    Nothing here is needed to follow the answer; it is where the engine's own words live. */
export default function ShowWork({ run, configured, onClose }: { run: RunSnapshot; configured?: ModeLabels; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<Tab>('Trace')
  const tabs: Tab[] = ['Trace', 'Wire', 'Policy', 'Receipts', 'Models', ...(run.labels.settlement === XRPL_LABEL ? ['Ledger' as Tab] : [])]
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const receipts = run.receipts.filter(item => item.runId === run.runId)
  return <dialog ref={dialog} className="ra-sheet" aria-label="Show work" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="ra-sheet-h">
      <h2>Show work</h2>
      <div className="ra-seg" role="tablist" aria-label="Show work views">{tabs.map(name => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
      <span className="ra-note">Raw, persisted records · nothing here is needed to understand the answer</span>
      <button type="button" className="ra-btn" onClick={onClose} aria-label="Close show work">Esc ×</button>
    </div>
    <div className="ra-sheet-b" role="tabpanel" aria-label={tab}>
      {tab === 'Trace' && <Activity run={run} />}
      {tab === 'Wire' && <Wire run={run} />}
      {tab === 'Policy' && <DecisionTable run={run} />}
      {tab === 'Receipts' && (receipts.length === 0 ? <p>No receipts in this run.</p> : <ol className="ra-receipt-list">{receipts.map(receipt => <li key={receipt.receiptId}>
        <b>{candidateOf(run, receipt)?.publisher ?? receipt.resourceId}</b> · {money(receipt.amountMinor)} · {receipt.label}<br />
        <span className="mono">receipt {receipt.receiptId} · intent {shortHash(receipt.intentId)} · settled {receipt.settledAt}</span>
      </li>)}</ol>)}
      {tab === 'Models' && <div className="ra-models"><Modes labels={run.labels} configured={configured} /></div>}
      {tab === 'Ledger' && <Ledger run={run} />}
    </div>
  </dialog>
}
