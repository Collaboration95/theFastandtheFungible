import { useId, useState, type ReactNode } from 'react'
import { AskSchema, BUDGET, type Ask as AskInput } from '../../shared/contracts/index.js'
import { DEMO_QUESTIONS } from '../../shared/contracts/examples.js'
import { money } from '../format'
import BudgetPopover from './BudgetPopover'
import InfoDot from './InfoDot'

export interface AskProps {
  onAsk: (input: AskInput) => void | Promise<void>
  busy?: boolean
  settlement: string
  /** Clarify chips or the plan card, directly above the input bar. */
  above?: ReactNode
  /** A universal budget from Settings: every question uses it and the slider gives way to a chip that opens Settings. */
  universalMinor?: number
  onSettings?: () => void
  /** A half-typed question kept by the app, so it survives a trip to Settings. */
  draft?: string
  onDraft?: (question: string) => void
  /** The budget picked on Home, kept the same way. */
  picked?: number
  onPick?: (minor: number) => void
}
/** Short names for the demo question chips; the full question fills the box and shows on hover. */
const PRESET_LABEL: Record<string, string> = { UC1: 'Bank of Japan decision', UC2: 'Kestrel–TSMC outlook', UC3: 'Malaysia packaging lead times', UC4: 'Penang plant power' }
/** Home: the question, the budget (the only spending authorisation) and Ask. */
export default function Ask({ onAsk, busy = false, settlement, above, universalMinor, onSettings, draft = '', onDraft, picked = BUDGET.initialMinor, onPick }: AskProps) {
  const id = useId()
  // Starts empty: the presets below fill it in one click.
  const [localQuestion, setLocalQuestion] = useState(draft)
  const question = onDraft ? draft : localQuestion
  const setQuestion = (text: string) => { setLocalQuestion(text); onDraft?.(text) }
  const [chosen, setChosen] = useState<number>(picked)
  const setBudget = (minor: number) => { setChosen(minor); onPick?.(minor) }
  const budgetMinor = universalMinor ?? chosen
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const disabled = busy || submitting
  return <section className="ra-home" aria-label="Ask a research question">
    <h1 className="ra-hero">Ask a question. <em>Give it a budget.</em></h1>
    <p className="ra-home-description">Research with cited evidence. Policy code buys sources within your budget.</p>
    {above}
    <form className="ra-composer" onSubmit={async event => {
      event.preventDefault()
      if (disabled) return
      const result = AskSchema.safeParse({ question, budgetMinor })
      if (!result.success) { setError('Type a question first. Up to 2,000 characters.'); return }
      setError(''); setSubmitting(true)
      try { await onAsk(result.data) } catch { setError('Couldn’t send the question. Try again.') } finally { setSubmitting(false) }
    }}>
      <label className="ra-sr" htmlFor={`${id}-q`}>Your question</label>
      <textarea id={`${id}-q`} className="ra-qbox" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} required disabled={disabled} placeholder="Ask about a company, a market or a claim…"
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
      <div className="ra-comp-row">
        {universalMinor === undefined
          ? <BudgetPopover value={chosen} onChange={setBudget} disabled={disabled} />
          : <button type="button" className="ra-budget-chip" onClick={onSettings} title="Universal budget · change it in Settings">{universalMinor === 0 ? 'Free' : money(universalMinor)}</button>}
        <InfoDot label={settlement} side="up" />
        <button className="ra-ask" type="submit" disabled={disabled || !question.trim()}>{disabled ? 'Starting…' : budgetMinor === 0 ? 'Ask free' : 'Ask'}</button>
      </div>
      {error && <div className="ra-comp-foot"><span className="ra-err" role="alert">{error}</span></div>}
    </form>
    {/* The demo questions sit under the composer, one per row; a click fills the box. */}
    <div className="ra-presets" role="group" aria-label="Demo questions">
      <p className="ra-presets-h" aria-hidden="true">Not sure what to ask? Try one</p>
      {DEMO_QUESTIONS.slice(0, 3).map((preset) => <button key={preset.id} type="button" className={`ra-preset${question === preset.text ? ' is-on' : ''}`} aria-pressed={question === preset.text} title={preset.text} disabled={disabled} onClick={() => setQuestion(preset.text)}>
        <i aria-hidden="true">?</i><b>{PRESET_LABEL[preset.id] ?? preset.id}</b><span>{preset.text}</span></button>)}
    </div>
  </section>
}
