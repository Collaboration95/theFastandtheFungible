import Icon from './Icon'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { XRPL_LABEL, type ModeLabels, type RunSnapshot } from '../../shared/contracts/index.js'
import Activity from './Activity'
import ModelLabels from './ModelLabels'
import { candidateOf, money, shortHash } from '../format'
import { planCheck, type ConfirmedPlan } from '../planCheck'
import './key-check.css'

// Detailed views are loaded on demand to keep the initial application within its byte budget.
const Wire = lazy(() => import('./Wire'))
const DecisionTable = lazy(() => import('./DecisionTable'))
const Ledger = lazy(() => import('./Ledger'))

type Tab = 'Trace' | 'Wire' | 'Policy' | 'Receipts' | 'Models' | 'Ledger'

/** Press W: the recorded events, HTTP exchange, full policy table and receipts.
    Nothing here is needed to follow the answer; it is where recorded details are explained. */
export default function ShowWork({ run, configured, onClose, confirmed }: { run: RunSnapshot; configured?: ModeLabels; onClose: () => void; /** The plan the visitor confirmed; by default the one this browser recorded just before the run began. */ confirmed?: Pick<ConfirmedPlan, 'subqueries'> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<Tab>('Trace')
  const tabs: Tab[] = ['Trace', 'Wire', 'Policy', 'Receipts', 'Models', ...(run.labels.settlement === XRPL_LABEL ? ['Ledger' as Tab] : [])]
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const receipts = run.receipts.filter(item => item.runId === run.runId)
  const plan = planCheck(run, confirmed)
  return <dialog ref={dialog} className="ra-sheet" aria-label="Show work" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="ra-sheet-h">
      <h2>Show work</h2>
      <div className="ra-seg" role="tablist" aria-label="Show work views">{tabs.map(name => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
      <button type="button" className="ra-btn" onClick={onClose} aria-label="Close show work">Esc <Icon name="close" size={16} /></button>
    </div>
    <div className="ra-sheet-b" role="tabpanel" aria-label={tab} tabIndex={0}>
      <p className="ra-note">{{ Trace: 'What the agent did, in order.', Wire: 'The requests and responses behind this run.', Policy: 'Why each article was bought or skipped.', Receipts: 'The payment records saved with this run.', Models: 'The providers and substitutions used in this run.', Ledger: 'The transactions on XRPL Testnet.' }[tab]}</p>
      {tab === 'Trace' && plan && <p className={`ra-plan-check ${plan.ok ? 'is-ok' : 'is-changed'}`}>{!plan.ok && <Icon name="info" size={16} />}{plan.text}</p>}
      {tab === 'Trace' && <Activity run={run} />}
      {tab === 'Wire' && <Suspense fallback={<p role="status">Loading requests…</p>}><Wire run={run} /></Suspense>}
      {tab === 'Policy' && <Suspense fallback={<p role="status">Loading policy…</p>}><DecisionTable run={run} /></Suspense>}
      {tab === 'Receipts' && (receipts.length === 0 ? <p>No receipts in this run.</p> : <ol className="ra-receipt-list">{receipts.map(receipt => <li key={receipt.receiptId}>
        <b>{candidateOf(run, receipt)?.publisher ?? receipt.resourceId}</b> · {money(receipt.amountMinor)} · {receipt.label}{run.intents.find(i => i.intentId === receipt.intentId)?.purchaseKind && ` · ${run.intents.find(i => i.intentId === receipt.intentId)!.purchaseKind}`}<br />
        <span className="mono">receipt {receipt.receiptId} · intent {shortHash(receipt.intentId)} · settled {receipt.settledAt}</span>
      </li>)}</ol>)}
      {tab === 'Models' && <div className="ra-models"><ModelLabels labels={run.labels} configured={configured} events={run.events} /></div>}
      {tab === 'Ledger' && <Suspense fallback={<p role="status">Loading ledger…</p>}><Ledger run={run} /></Suspense>}
    </div>
  </dialog>
}
