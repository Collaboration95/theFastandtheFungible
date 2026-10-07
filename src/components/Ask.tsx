import { useId, useState, type ReactNode } from 'react'
import { AskSchema, type Ask as AskInput } from '../../shared/contracts/index.js'
import { DEMO_QUESTIONS } from '../../shared/contracts/examples.js'
import { Mark } from '../format'

const BUDGETS = [0, 100, 200, 500] as const
const CONSEQUENCE: Record<AskInput['budgetMinor'], [string, string]> = {
  0: ['Free sources only.', 'You’ll still see what it would have bought.'],
  100: ['Up to S$1.00, at most S$1.00 per source.', 'Enough for one source under the cap.'],
  200: ['Up to S$2.00, at most S$1.00 per source.', 'It buys only sources that clear the bar.'],
  500: ['Up to S$5.00, at most S$1.00 per source.', 'Room for several rounds of buying.'],
}

export interface AskProps {
  onAsk: (input: AskInput) => void | Promise<void>
  busy?: boolean
  settlement: string
  notify: boolean
  onNotify: (on: boolean) => void
  /** Clarify chips or the plan card, directly above the input bar. */
  above?: ReactNode
}
/** Home: the question, the budget (the only spending authorisation) and Ask. */
export default function Ask({ onAsk, busy = false, settlement, notify, onNotify, above }: AskProps) {
  const id = useId()
  // Starts empty: the presets below fill it in one click.
  const [question, setQuestion] = useState('')
  const [budgetMinor, setBudget] = useState<AskInput['budgetMinor']>(200)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const disabled = busy || submitting
  const [lead, rest] = CONSEQUENCE[budgetMinor]
  return <section className="ra-home" aria-label="Ask a research question">
    <h1 className="ra-hero">Ask a question.<br /><em>Give it a budget.</em></h1>
    <p className="ra-hero-sub">It reads free sources first, then pays only for evidence worth the price.</p>
    {above}
    <form className="ra-composer" onSubmit={async event => {
      event.preventDefault()
      if (disabled) return
      const result = AskSchema.safeParse({ question, budgetMinor })
      if (!result.success) { setError('Type a question first. Up to 2,000 characters.'); return }
      setError(''); setSubmitting(true)
      try { await onAsk(result.data) } catch { setError('The question could not be sent. Please try again.') } finally { setSubmitting(false) }
    }}>
      <div className="ra-presets" role="group" aria-label="Demo questions">{DEMO_QUESTIONS.map(preset => <button key={preset.id} type="button" className={`ra-chip-opt${question === preset.text ? ' is-on' : ''}`} aria-pressed={question === preset.text} title={preset.text} disabled={disabled} onClick={() => setQuestion(preset.text)}>{preset.id} · {preset.text.length > 44 ? `${preset.text.slice(0, 42).trimEnd()}…` : preset.text}</button>)}</div>
      <label className="ra-sr" htmlFor={`${id}-q`}>Your question</label>
      <textarea id={`${id}-q`} className="ra-qbox" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} required disabled={disabled} placeholder="Ask about a company, a market or a claim…" aria-describedby={`${id}-consq`}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
      <div className="ra-comp-row">
        <fieldset className="ra-coins" disabled={disabled}><legend className="ra-sr">Budget for this question</legend>
          {BUDGETS.map(value => <label className="ra-coin" key={value}><input type="radio" name={`${id}-budget`} value={value} checked={budgetMinor === value} onChange={() => setBudget(value)} /><span>S${value / 100}</span></label>)}
        </fieldset>
        <p className="ra-consq" id={`${id}-consq`} aria-live="polite"><b>{lead}</b>{rest}</p>
        <button className="ra-ask" type="submit" disabled={disabled || !question.trim()}>{disabled ? 'Starting…' : budgetMinor === 0 ? 'Ask free' : 'Ask'} <kbd aria-hidden="true">↵</kbd></button>
      </div>
      <div className="ra-comp-foot">
        {error ? <span className="ra-err" role="alert">{error}</span> : <span>Your budget is the only spending authorisation. <span className="ra-chip is-sim">{settlement}</span></span>}
        <label className="ra-check"><input type="checkbox" checked={notify} onChange={event => onNotify(event.target.checked)} /> Tell me when it’s done</label>
      </div>
    </form>
    <div className="ra-how">
      <div><span className="ic ic-read" aria-hidden="true">Aa</span><b>An LLM writes</b><p>Reads free sources and drafts a cited answer that names its gap.</p></div>
      <div><span className="ic ic-bars" aria-hidden="true"><i style={{ height: '40%' }} /><i style={{ height: '90%' }} /><i style={{ height: '25%' }} /><i style={{ height: '60%' }} /></span><b>A decision model chooses</b><p>Scores each paywalled source: does it close the gap, is it original, is it credible.</p></div>
      <div><span className="ic" aria-hidden="true"><Mark /></span><b>Code pays</b><p>Buys the best value per S$ inside your budget. Text in an article can’t spend.</p></div>
    </div>
  </section>
}
