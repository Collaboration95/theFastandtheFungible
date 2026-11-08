import { useEffect, useRef, useState } from 'react'
import { money } from '../format'
import { PlanSchema, PURCHASE_RULE, type Plan } from '../../shared/contracts/index.js'

const PLAN_MS = 5000

export interface ActionModalProps {
  plan: Plan
  /** How many writers the search fans out to, when the server says. */
  writers?: number
  budgetMinor?: number
  capMinor?: number
  onGo: (plan: Plan) => void
  onCancel: () => void
}
/** The 5-second plan card above the input bar (D8). It confirms WHAT to search, before anything happens.
    It is not a purchase approval: the budget stays the only spending authorization (gate 2). */
export default function PlanSheet({ plan, writers, budgetMinor = 200, capMinor = 100, onGo, onCancel }: ActionModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const start = useRef<HTMLButtonElement>(null)
  useEffect(() => { dialog.current?.showModal(); start.current?.focus(); const el = dialog.current; return () => el?.close() }, [])
  const [editing, setEditing] = useState(false)
  const [subqueries, setSubqueries] = useState(plan.subqueries)
  const fired = useRef(false)
  const go = () => {
    if (fired.current) return
    fired.current = true
    const edited = PlanSchema.safeParse({ ...plan, subqueries: subqueries.map(q => q.trim()).filter(Boolean) })
    onGo(edited.success ? edited.data : plan)
  }
  const cancel = () => { if (!fired.current) { fired.current = true; onCancel() } }
  const latest = useRef({ go, cancel })
  useEffect(() => { latest.current = { go, cancel } })
  useEffect(() => {
    if (editing) return
    const timer = setTimeout(() => latest.current.go(), PLAN_MS)
    return () => clearTimeout(timer)
  }, [editing])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (import.meta.env.MODE !== 'browser-demo' && event.key.toLowerCase() === 'e' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); setEditing(true) }
      if (event.key === 'Escape') { event.preventDefault(); latest.current.cancel() }
      else if (event.key === 'Enter' && !event.shiftKey && ((event.metaKey || event.ctrlKey) || !(event.target instanceof HTMLButtonElement))) { event.preventDefault(); latest.current.go() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const who = writers ? `${writers} writer${writers === 1 ? '' : 's'}` : 'every listed writer'
  return <dialog ref={dialog} className={`ra-plan${editing ? ' is-editing' : ''}`} aria-label="Search plan" aria-describedby="ra-plan-what" onCancel={event => { event.preventDefault(); cancel() }}>
    <h2>Ready to start</h2><p className="ra-plan-question">{plan.restatement}</p>
    <p className="ra-caption">Plan</p><ol className="ra-plan-steps">
      <li id="ra-plan-what">Search {who} for “{subqueries.join(', ')}”</li>
      <li>Read free sources and draft an answer</li><li>Buy only if an article fills a gap: {PURCHASE_RULE}</li><li>Check it against the writer's promises; request an eligible refund if one is broken (shown as refunded only after verification)</li>
    </ol>
    {editing && <ol className="ra-plan-edit">{subqueries.map((query, index) => <li key={index}><input aria-label={`Search ${index + 1}`} value={query} maxLength={160} onChange={event => setSubqueries(list => list.map((item, i) => i === index ? event.target.value : item))} /></li>)}</ol>}
    <p>Budget <strong>{money(budgetMinor)}</strong> · up to {money(capMinor)} per article</p>
    <p className="ra-note">Nothing is spent until step 3, and never more than {money(budgetMinor)}.</p>
    <div className="ra-plan-bar" role="timer" aria-label="Starting in 5 seconds"><i /></div>
    <div className="ra-plan-act">{editing ? <span>Paused while you edit.</span> : <button className="ra-btn" disabled={import.meta.env.MODE === 'browser-demo'} onClick={() => setEditing(true)}>Edit</button>}<button className="ra-btn" onClick={cancel}>Cancel</button><button ref={start} className="ra-btn ra-btn-go" onClick={go}>Start now</button></div>
  </dialog>
}
