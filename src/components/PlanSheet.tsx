import { useEffect, useRef, useState } from 'react'
import { money } from '../format'
import { PlanSchema, BUDGET, MAX_ROUNDS, type Plan } from '../../shared/contracts/index.js'
import { useHosted } from '../hosted'
import { rememberConfirmedPlan } from '../planCheck'

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
export default function PlanSheet({ plan, writers, budgetMinor = BUDGET.initialMinor, capMinor = BUDGET.capMinor, onGo, onCancel }: ActionModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const start = useRef<HTMLButtonElement>(null)
  useEffect(() => { dialog.current?.showModal(); start.current?.focus(); const el = dialog.current; return () => el?.close() }, [])
  const [editing, setEditing] = useState(false)
  const [paused, setPaused] = useState(() => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches))
  const [remaining, setRemaining] = useState(5)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { if (media.matches) setPaused(true) }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  // The hosted gateway plans the search itself from the question, so an edited search would not be used: no Edit there.
  const hosted = useHosted()
  const editable = import.meta.env.MODE !== 'browser-demo' && !hosted
  const [subqueries, setSubqueries] = useState(plan.subqueries)
  const fired = useRef(false)
  const go = () => {
    if (fired.current) return
    fired.current = true
    const edited = PlanSchema.safeParse({ ...plan, subqueries: subqueries.map(q => q.trim()).filter(Boolean) })
    const confirmed = edited.success ? edited.data : plan
    rememberConfirmedPlan(confirmed) // Show work compares this with the plan the run records ("Ran the plan you confirmed")
    // Release the modal focus trap before App moves focus to the run or the preserved question.
    dialog.current?.close()
    onGo(confirmed)
  }
  const cancel = () => { if (!fired.current) { fired.current = true; dialog.current?.close(); onCancel() } }
  const latest = useRef({ go, cancel })
  useEffect(() => { latest.current = { go, cancel } })
  useEffect(() => {
    if (editing || paused) return
    const deadline = Date.now() + PLAN_MS
    const tick = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 200)
    const timer = setTimeout(() => latest.current.go(), PLAN_MS)
    return () => { clearTimeout(timer); clearInterval(tick) }
  }, [editing, paused])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editable && event.key.toLowerCase() === 'e' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); setEditing(true) }
      if (event.key === 'Escape') { event.preventDefault(); latest.current.cancel() }
      else if (event.key === 'Enter' && !event.shiftKey && ((event.metaKey || event.ctrlKey) || !(event.target instanceof HTMLButtonElement))) { event.preventDefault(); latest.current.go() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editable])
  const who = writers ? `${writers} writer${writers === 1 ? '' : 's'}` : 'every listed writer'
  return <dialog ref={dialog} className={`ra-plan${editing || paused ? ' is-editing' : ''}`} aria-label="Search plan" aria-describedby="ra-plan-what" onCancel={event => { event.preventDefault(); cancel() }}>
    <h2>Review your plan</h2><p className="ra-plan-question">{plan.restatement}</p>
    <p className="ra-caption">Plan</p><ol className="ra-plan-steps">
      <li id="ra-plan-what">{`Search ${who} for your question`}</li>
      <li>Read free sources and draft an answer</li>
      <li>{`Buy at most one article per round, up to ${MAX_ROUNDS} rounds, only if it fills a gap`}</li>
      <li>A new writer may get one test purchase (up to S$0.30)</li>
      <li>Check the article against the writer’s promises. If one is broken, request an eligible refund. A refund is complete only after verification.</li>
    </ol>
    {editing && <ol className="ra-plan-edit">{subqueries.map((query, index) => <li key={index}><input aria-label={`Search ${index + 1}`} value={query} maxLength={160} onChange={event => setSubqueries(list => list.map((item, i) => i === index ? event.target.value : item))} /></li>)}</ol>}
    <p>Budget <strong>{money(budgetMinor)}</strong> · up to {money(capMinor)} per article</p>
    <p className="ra-note">Nothing is spent until step 3, and never more than {money(budgetMinor)}.</p>
    <p role="timer" aria-live="off" aria-label={editing ? 'Paused while you edit' : paused ? 'Automatic start paused. Choose Start now when ready.' : `Starting in ${remaining} seconds`}>{editing ? 'Paused while you edit.' : paused ? 'Automatic start paused. Choose Start now when ready.' : `Starting in ${remaining} s`}</p>
    <div className="ra-plan-bar" aria-hidden="true"><i /></div>
    <div className="ra-plan-act">{!paused && !editing && <button className="ra-btn" onClick={() => setPaused(true)}>Pause countdown</button>}{editing ? <span>Paused while you edit.</span> : (editable || import.meta.env.MODE === 'browser-demo') && <button className="ra-btn" disabled={!editable} onClick={() => setEditing(true)}>Edit</button>}<button className="ra-btn" onClick={cancel}>Cancel</button><button ref={start} className="ra-btn ra-btn-go" onClick={go}>Start now</button></div>
  </dialog>
}
