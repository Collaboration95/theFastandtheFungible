import { useId, useRef, useState, type ReactNode } from 'react'
import { AskSchema, BUDGET, type Ask as AskInput } from '../../shared/contracts/index.js'
import { exampleQuestions } from '../../shared/contracts/examples.js'
import { money } from '../format'
import BudgetPopover from './BudgetPopover'
import AgentSprite from './AgentSprite'
import { BUDGET_LABEL } from '../copy'
import { useHosted } from '../hosted'
import './writer-provenance.css'
import { HostedJudgesCorner } from './hosted/HostedHome'

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
  /** Hosted demo: its own orientation instead of the local heading, the server's per-question cap, and notes in the flow. */
  intro?: ReactNode
  budgetMax?: number
  /** Under the composer row, e.g. the allowance and privacy line. */
  composerNote?: ReactNode
  /** Between the composer and the examples: the first-visit environment note or a hosted state. */
  note?: ReactNode
  placeholder?: string
  realCorpus?: boolean
  examplesLabel?: string
  askLabel?: string
  /** The hosted demo can't take a question (paused, ended, used up, on hold, offline): only the intro and its state card show, with no composer or examples to tempt a click. */
  closed?: boolean
}
/** Home: the question, the budget (the only spending authorisation) and Ask. */
export default function Ask({ onAsk, busy = false, settlement, above, universalMinor, onSettings, draft = '', onDraft, picked = BUDGET.initialMinor, onPick, intro, budgetMax, composerNote, note, placeholder, examplesLabel = 'Try an example', realCorpus = false, askLabel, closed = false }: AskProps) {
  const browserDemo = import.meta.env.MODE === 'browser-demo'
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
  // Hosted proof and builder tools follow the examples. A closed demo has no
  // composer, so there the hosted intro carries it instead.
  const hosted = useHosted()
  const corner = useRef<HTMLDetailsElement>(null)
  const verifyRecorded = () => {
    if (!corner.current) return
    corner.current.open = true
    corner.current.scrollIntoView({ block: 'start', behavior: 'instant' })
    corner.current.querySelector<HTMLElement>('summary')?.focus()
  }
  return <section className="ra-home" aria-label="Ask a research question">
    {intro ?? <><AgentSprite animation="idle" still /><h1 className="ra-hero">Research with a wallet.</h1>
    <p className="ra-home-description">Free sources first. Pay writers for missing evidence, within your budget.</p></>}
    {browserDemo && <p className="ra-note">Recorded budget: S$2.00. The Kestrel–TSMC replay covers pricing &amp; margins.</p>}
    {above && <p className="ra-pending-question">{question}</p>}
    {above}
    {!above && !closed && <form className="ra-composer" onSubmit={async event => {
      event.preventDefault()
      if (disabled) return
      const result = AskSchema.safeParse({ question, budgetMinor })
      if (!result.success) { setError('Enter a question (up to 2,000 characters).'); return }
      setError(''); setSubmitting(true)
      try { await onAsk(result.data) } catch { /* App owns the one network-error notice. */ } finally { setSubmitting(false) }
    }}>
      <label className="ra-sr" htmlFor={`${id}-q`}>Your question</label>
      <textarea id={`${id}-q`} className="ra-qbox" value={question} onChange={event => setQuestion(event.target.value)} readOnly={browserDemo} maxLength={2000} rows={2} required disabled={disabled} placeholder={placeholder ?? (browserDemo ? "Choose a recorded question below, or press ⌘K…" : (settlement.startsWith('XRPL') ? "Ask about XRPL, x402 or agent payments…" : "Ask about a company, a market or a claim…"))}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
      <div className="ra-comp-row">
        {universalMinor === undefined
          ? <BudgetPopover value={chosen} onChange={setBudget} disabled={disabled || browserDemo} max={budgetMax} />
          : <button type="button" className="ra-budget-chip" onClick={onSettings} title={`${BUDGET_LABEL.default} · change it in Settings`}>{universalMinor === 0 ? 'Free' : money(universalMinor)}</button>}
        <button className="ra-ask" type="submit" disabled={disabled || !question.trim()}>{askLabel ?? (budgetMinor === 0 ? 'Ask free' : 'Ask')}</button>
        {hosted && <button type="button" className="ra-btn ra-home-verify" onClick={verifyRecorded}>Verify a recorded run</button>}
      </div>
      {composerNote}
      {error && <div className="ra-comp-foot"><span className="ra-err" role="alert">{error}</span></div>}
    </form>}
    {!above && !closed && note}
    {/* The demo questions sit under the composer, one per row; a click fills the box. */}
    {!above && !closed && <div className="ra-presets" role="group" aria-label="Demo questions">
      <p className="ra-presets-h" aria-hidden="true">{examplesLabel}</p>
      {exampleQuestions(import.meta.env.MODE === 'browser-demo' ? undefined : settlement, realCorpus).map((preset) => <button key={preset.id} type="button" className={`ra-preset${question === preset.text ? ' is-on' : ''}`} aria-pressed={question === preset.text} title={preset.text} disabled={disabled} onClick={() => setQuestion(preset.text)}>
        <i aria-hidden="true">?</i><b>{preset.label}</b><span>{preset.text}</span></button>)}
    </div>}
    {!above && !closed && hosted && <HostedJudgesCorner hosted={hosted} detailsRef={corner} />}
  </section>
}
