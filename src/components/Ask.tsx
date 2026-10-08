import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
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
/** The demo questions slide out once per visit to the app, not on every return to Home. */
let introPlayed = false
/** Home: the question, the budget (the only spending authorisation) and Ask. */
export default function Ask({ onAsk, busy = false, settlement, above, universalMinor, onSettings, draft = '', onDraft, picked = BUDGET.initialMinor, onPick }: AskProps) {
  const id = useId()
  // Starts empty: the presets below fill it in one click.
  const [question, setQuestionNow] = useState(draft)
  const setQuestion = (text: string) => { setQuestionNow(text); onDraft?.(text) }
  const [chosen, setChosen] = useState<number>(picked)
  const setBudget = (minor: number) => { setChosen(minor); onPick?.(minor) }
  const budgetMinor = universalMinor ?? chosen
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const disabled = busy || submitting
  // While the box sits empty, one demo question hops and its "?" shakes now and then, so something moves at the edge of the eye.
  const idle = !question && !disabled
  const [nudge, setNudge] = useState(-1)
  useEffect(() => {
    if (!idle) return
    let next = 0, off: ReturnType<typeof setTimeout> | undefined
    const tick = () => { if (document.visibilityState !== 'visible') return; setNudge(next); next = (next + 1) % DEMO_QUESTIONS.length; clearTimeout(off); off = setTimeout(() => setNudge(-1), 1100) }
    const first = setTimeout(tick, 3500), every = setInterval(tick, 7000)
    return () => { clearTimeout(first); clearInterval(every); clearTimeout(off) }
  }, [idle])
  const [intro] = useState(() => { const first = !introPlayed; introPlayed = true; return first })
  return <section className="ra-home" aria-label="Ask a research question">
    <h1 className="ra-hero">Ask a question. <em>Give it a budget.</em></h1>
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
    <div className={`ra-presets${intro ? ' is-intro' : ''}`} role="group" aria-label="Demo questions">
      <p className="ra-presets-h" aria-hidden="true">Not sure what to ask? Try one</p>
      {DEMO_QUESTIONS.map((preset, index) => <button key={preset.id} type="button" className={`ra-preset${question === preset.text ? ' is-on' : ''}${idle && nudge === index ? ' is-nudge' : ''}`} style={{ '--i': index } as CSSProperties} aria-pressed={question === preset.text} title={preset.text} disabled={disabled} onClick={() => setQuestion(preset.text)}>
        <i aria-hidden="true">?</i><b>{PRESET_LABEL[preset.id] ?? preset.id}</b><span>{preset.text}</span></button>)}
    </div>
  </section>
}
