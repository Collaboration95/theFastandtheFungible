import { useEffect, useState } from 'react'
import { ledgerKind, ledgerReadTime, readLedgerFact, readPayer, type LedgerFact, type LedgerKind, type PayerFact } from '../ledger-check'
import './ledger-check.css'

type ReadState<T> = { value?: T; failed?: boolean }
function useRead<T>(read: () => Promise<T>) {
  const [state, setState] = useState<ReadState<T>>({}), [attempt, retry] = useState(0)
  useEffect(() => {
    let active = true
    void read().then(value => { if (active) setState({ value }) }, () => { if (active) setState({ failed: true }) })
    return () => { active = false }
  }, [read, attempt])
  return { ...state, retry: () => { setState({}); retry(n => n + 1) } }
}
const isDesktop = () => typeof window !== 'undefined' && Boolean((window as unknown as { desktop?: unknown }).desktop)
function ReadFailure({ retry }: { retry: () => void }) {
  return <p>couldn’t read the ledger right now. <button type="button" className="ra-btn" onClick={retry}>Retry</button></p>
}
export function LedgerReadStamp({ value }: { value: LedgerFact }) {
  return <ReadStamp key={value.readAt} value={value} />
}
function ReadStamp({ value }: { value: LedgerFact }) {
  const [recent, setRecent] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setRecent(false), 60000)
    return () => clearTimeout(timer)
  }, [])
  return <small>{value.network}{recent ? ' · read just now' : ''} · validated ledger {value.ledger} · read <time dateTime={value.readAt}>{ledgerReadTime(value.readAt)}</time></small>
}
export default function LedgerCheck({ question }: { question: string }) {
  const kind = ledgerKind(question)
  if (!kind || isDesktop()) return null
  return <Check key={kind} kind={kind} />
}
function Check({ kind }: { kind: LedgerKind }) {
  const [reader] = useState(() => () => readLedgerFact(kind))
  const state = useRead(reader)
  return <aside className="ra-ledger-check" aria-label="Check it on the ledger now">
    <h2>Check it on the ledger now</h2>
    <p className="ra-ledger-label">Live ledger read · read-only · not part of the paid answer</p>
    <div role="status">{state.value ? <><p>{state.value.text}</p><LedgerReadStamp value={state.value} /></> : state.failed ? <ReadFailure retry={state.retry} /> : <p>Reading the public ledger…</p>}</div>
  </aside>
}
export function SharedPayer({ read = readPayer }: { read?: () => Promise<PayerFact> }) {
  if (isDesktop()) return null
  return <Payer read={read} />
}
function Payer({ read }: { read: () => Promise<PayerFact> }) {
  const state = useRead(read)
  return <div className="ra-ledger-payer" role="status">{state.value ? <><p>{state.value.text}</p><LedgerReadStamp value={state.value} /></> : state.failed ? <ReadFailure retry={state.retry} /> : <p>Reading the shared Testnet payer…</p>}</div>
}
