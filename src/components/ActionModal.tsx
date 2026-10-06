import { useEffect, useRef, useState } from 'react'
import { PlanSchema, type Plan } from '../../shared/contracts/index.js'

const PLAN_MS = 5000

export interface ActionModalProps {
  plan: Plan
  /** How many writers the search fans out to, when the server says. */
  writers?: number
  onGo: (plan: Plan) => void
  onCancel: () => void
}
/** The 5-second plan card above the input bar (D8). It confirms WHAT to search, before anything happens.
    It is not a purchase approval: the budget stays the only spending authorization (gate 2). */
export default function ActionModal({ plan, writers, onGo, onCancel }: ActionModalProps) {
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
      if (event.key === 'Escape') { event.preventDefault(); latest.current.cancel() }
      else if (event.key === 'Enter' && !event.shiftKey && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); latest.current.go() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const who = writers ? `${writers} writer${writers === 1 ? '' : 's'}` : 'every listed writer'
  return <section className={`ra-plan${editing ? ' is-editing' : ''}`} role="dialog" aria-label="Search plan" aria-describedby="ra-plan-what">
    <p className="ra-plan-what" id="ra-plan-what">I’ll search {who} for: {editing ? '' : <em>{subqueries.join(', ')}</em>}</p>
    {editing && <ol className="ra-plan-edit">{subqueries.map((query, index) => <li key={index}>
      <input aria-label={`Search ${index + 1}`} value={query} maxLength={160} onChange={event => setSubqueries(list => list.map((item, i) => i === index ? event.target.value : item))} />
    </li>)}</ol>}
    <div className="ra-plan-bar" aria-hidden="true"><i /></div>
    <div className="ra-plan-act">
      <span className="ra-plan-hint">{editing ? 'Paused while you edit.' : 'Starts in 5 s.'} Enter = go · Esc = cancel</span>
      {!editing && <button type="button" className="ra-btn" onClick={() => setEditing(true)}>Edit</button>}
      <button type="button" className="ra-btn" onClick={cancel}>Cancel</button>
      <button type="button" className="ra-btn ra-btn-go" onClick={go}>Go now</button>
    </div>
  </section>
}
