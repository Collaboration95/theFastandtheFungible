import { useId, useState } from 'react'
import { AskSchema, type Ask as AskInput } from '../../shared/contracts/index.js'
import { DEMO_QUESTION } from '../../shared/contracts/examples.js'
export interface AskProps { onAsk: (input: AskInput) => void | Promise<void>; busy?: boolean }
export default function Ask({ onAsk, busy = false }: AskProps) {
  const id = useId()
  const [question, setQuestion] = useState(DEMO_QUESTION)
  const [budgetMinor, setBudget] = useState<AskInput['budgetMinor']>(200)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const disabled = busy || submitting
  return <section className="ra-panel ra-ask" aria-label="Ask a research question">
    <p className="ra-eyebrow">Research with a budget</p><h1>A better answer starts with evidence.</h1>
    <p>Ask a question. Read the free answer. Let the agent acquire evidence within your budget.</p>
    <form onSubmit={async event => {
      event.preventDefault()
      if (disabled) return
      const result = AskSchema.safeParse({ question, budgetMinor })
      if (!result.success) { setError('Enter a question of 1–2,000 characters.'); return }
      setError(''); setSubmitting(true)
      try { await onAsk(result.data) } catch { setError('The question could not be sent. Please try again.') } finally { setSubmitting(false) }
    }}>
      <label htmlFor={`${id}-question`}>Your question</label>
      <textarea id={`${id}-question`} value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={3} required disabled={disabled} aria-describedby={`${id}-budget-note`} />
      <fieldset disabled={disabled}><legend>Budget for this question</legend><div className="ra-budget-chips">{([0, 100, 200, 500] as const).map(value => <label className="ra-budget-chip" key={value}><input type="radio" name={`${id}-budget`} value={value} checked={budgetMinor === value} onChange={() => setBudget(value)} /><span>S${value / 100}</span></label>)}</div></fieldset>
      <p id={`${id}-budget-note`} className="ra-muted">Your budget is the only spending authorization. The agent buys automatically within it, with a default S$1.00 cap per source. S$0 uses free sources only.</p>
      <div className="ra-section-heading"><span className="ra-muted">SIMULATED SGD · no real funds</span><button className="ra-button" type="submit" disabled={disabled || !question.trim()}>{disabled ? 'Researching…' : 'Ask →'}</button></div>
      {error && <p className="ra-error" role="alert">{error}</p>}
    </form>
  </section>
}
