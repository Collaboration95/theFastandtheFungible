import { useEffect, useState } from 'react'
import { ledgerReceiptLine } from '../../shared/ledger-receipt'
import { readLedgerReceipt, type ReadReceipt } from '../ledger-check'
import { LedgerReadStamp } from './LedgerCheck'
import './ledger-check.css'

export default function LedgerReceipt(props: { create: string; finish: string; read?: typeof readLedgerReceipt }) {
  return <Receipt key={`${props.create}:${props.finish}`} {...props} />
}
function Receipt({ create, finish, read = readLedgerReceipt }: { create: string; finish: string; read?: typeof readLedgerReceipt }) {
  const [state, setState] = useState<ReadReceipt | 'unavailable'>(), [attempt, retry] = useState(0)
  useEffect(() => {
    let active = true
    void read(create, finish).then(value => { if (active) setState(value) }, () => { if (active) setState('unavailable') })
    return () => { active = false }
  }, [create, finish, read, attempt])
  return <div className="ra-ledger-receipt" role="status">
    <b>What the ledger did</b>
    {state && state !== 'unavailable' ? <>
      <p>{ledgerReceiptLine(state.fields)}</p>
      <LedgerReadStamp value={{ network: 'XRPL Testnet', ledger: state.fields.finishLedger, readAt: state.readAt, text: '' }} />
      <small>Create ledger {state.fields.createLedger} · historical ledger facts, read-only · no real value</small>
    </> : state === 'unavailable' ? <p>couldn’t read the ledger right now. <button type="button" className="ra-btn" onClick={() => { setState(undefined); retry(n => n + 1) }}>Retry</button></p> : <p>Reading the purchase on XRPL Testnet…</p>}
  </div>
}
