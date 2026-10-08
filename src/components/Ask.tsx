import { useId, useState, type ReactNode } from 'react'
import { AskSchema, BUDGET, type Ask as AskInput } from '../../shared/contracts/index.js'
import { DEMO_QUESTIONS } from '../../shared/contracts/examples.js'
import { money } from '../format'
import BudgetSlider from './BudgetSlider'

export interface AskProps {
  onAsk: (input: AskInput) => void | Promise<void>
  busy?: boolean
  settlement: string
  /** Clarify chips or the plan card, directly above the input bar. */
  above?: ReactNode
  /** A universal budget from Settings: every question uses it and the slider gives way to a chip that opens Settings. */
  universalMinor?: number
  onSettings?: () => void
}
/** Short names for the demo question chips; the full question fills the box and shows on hover. */
const PRESET_LABEL: Record<string, string> = { UC1: 'Bank of Japan decision', UC2: 'Kestrel–TSMC outlook', UC3: 'Malaysia packaging lead times' }
/** Home: the question, the budget (the only spending authorisation) and Ask. */
export default function Ask({ onAsk, busy = false, settlement, above, universalMinor, onSettings }: AskProps) {
  const id = useId()
  // Starts empty: the presets below fill it in one click.
  const [question, setQuestion] = useState('')
  const [chosen, setBudget] = useState<number>(BUDGET.initialMinor)
  const budgetMinor = universalMinor ?? chosen
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const disabled = busy || submitting
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
      try { await onAsk(result.data) } catch { setError('Couldn’t send the question. Try again.') } finally { setSubmitting(false) }
    }}>
      <div className="ra-presets" role="group" aria-label="Demo questions">{DEMO_QUESTIONS.map(preset => <button key={preset.id} type="button" className={`ra-chip-opt${question === preset.text ? ' is-on' : ''}`} aria-pressed={question === preset.text} title={preset.text} disabled={disabled} onClick={() => setQuestion(preset.text)}>{PRESET_LABEL[preset.id] ?? preset.id}</button>)}</div>
      <label className="ra-sr" htmlFor={`${id}-q`}>Your question</label>
      <textarea id={`${id}-q`} className="ra-qbox" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} required disabled={disabled} placeholder="Ask about a company, a market or a claim…"
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
      <div className="ra-comp-row">
        {universalMinor === undefined
          ? <BudgetSlider value={chosen} onChange={setBudget} disabled={disabled} />
          : <button type="button" className="ra-budget-chip" onClick={onSettings} title="Universal budget · change it in Settings">{universalMinor === 0 ? 'Free sources only' : `${money(universalMinor)} budget`}</button>}
        <span className="ra-chip is-sim">{settlement}</span>
        <button className="ra-ask" type="submit" disabled={disabled || !question.trim()}>{disabled ? 'Starting…' : budgetMinor === 0 ? 'Ask free' : 'Ask'}</button>
      </div>
      {error && <div className="ra-comp-foot"><span className="ra-err" role="alert">{error}</span></div>}
    </form>
  </section>
}
