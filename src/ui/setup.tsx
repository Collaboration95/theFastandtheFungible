import { useState } from 'react'
import { QuestionComposer } from './index'
import { isResearchPlanArtifact } from '../research-plan'
import type { ResearchPlanArtifact } from '../domain'

export type SetupStep = 'question' | 'sources' | 'budget'
export type SetupStepWithReview = SetupStep | 'review'

export type SetupDraft = {
  version: 1
  question: string
  selectedPublishers: string[]
  budgetXrp: number
  step: SetupStep
  updatedAt: string
  /** Full unsent review state; kept local until the server approves the plan. */
  planDraft?: ResearchPlanArtifact
}

export const SETUP_DRAFT_KEY = 'researchagent.setup-draft.v1'

export function loadSetupDraft(): SetupDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SETUP_DRAFT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SetupDraft>
    if (value.version !== 1 || typeof value.question !== 'string' || !Array.isArray(value.selectedPublishers) || typeof value.budgetXrp !== 'number' || !Number.isFinite(value.budgetXrp) || !['question', 'sources', 'budget'].includes(String(value.step))) return null
    return {
      version: 1,
      question: value.question,
      selectedPublishers: value.selectedPublishers.filter((item): item is string => typeof item === 'string'),
      budgetXrp: value.budgetXrp,
      step: value.step as SetupStep,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
      ...(isResearchPlanArtifact(value.planDraft) ? { planDraft: value.planDraft } : {}),
    }
  } catch {
    return null
  }
}

export function persistSetupDraft(draft: SetupDraft) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft)) } catch { /* private browsing/storage limits do not block setup */ }
}

export function clearSetupDraft() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(SETUP_DRAFT_KEY) } catch { /* storage is optional */ }
}

type PublisherOption = { id: string; label: string; example: string }

type GuidedSetupProps = {
  step: SetupStep
  firstRun: boolean
  resumeAvailable: boolean
  question: string
  selectedPublishers: string[]
  budgetXrp: number
  publisherOptions: readonly PublisherOption[]
  canonicalQuestion: string
  currentBalanceXrp: number
  minBudgetXrp: number
  maxBudgetXrp: number
  budgetToCents: (value: number) => number
  money: (cents: number) => string
  formatXrp: (value: number) => string
  onQuestionChange: (value: string) => void
  onTogglePublisher: (id: string) => void
  onBudgetChange: (value: number) => void
  onUseExample: () => void
  onResumeDraft: () => void
  onDiscardDraft: () => void
  onContinue: () => void
  onBack: () => void
  onSaveDraft: () => void
}

const steps: { id: SetupStepWithReview; label: string }[] = [
  { id: 'question', label: 'Question' },
  { id: 'sources', label: 'Sources' },
  { id: 'budget', label: 'Budget' },
  { id: 'review', label: 'Review' },
]

export function GuidedStepProgress({ current }: { current: SetupStepWithReview }) {
  const currentIndex = steps.findIndex((step) => step.id === current)
  return <nav className="guided-progress" aria-label="Research setup progress">
    <ol>
      {steps.map((step, index) => <li key={step.id} className={`${index < currentIndex ? 'is-complete' : ''} ${step.id === current ? 'is-current' : ''}`}>
        <span aria-hidden="true">{index < currentIndex ? '✓' : index + 1}</span>
        <strong>{step.label}</strong>
      </li>)}
    </ol>
  </nav>
}

function SetupActions({ step, onBack, onSaveDraft, onContinue }: { step: SetupStep; onBack: () => void; onSaveDraft: () => void; onContinue: () => void }) {
  return <div className="setup-actions">
    <button type="button" className="small-button" onClick={onBack} disabled={step === 'question'}>Back</button>
    <div className="setup-actions-primary"><button type="button" className="small-button" onClick={onSaveDraft}>Save draft</button><button type="button" className="primary-button" onClick={onContinue}>{step === 'question' ? 'Continue to sources' : step === 'sources' ? 'Continue to budget' : 'Continue to review'} <span className="icon" aria-hidden="true">↗</span></button></div>
  </div>
}

export function GuidedSetup(props: GuidedSetupProps) {
  const [sourceError, setSourceError] = useState('')
  const { step, firstRun, resumeAvailable, question, selectedPublishers, budgetXrp, publisherOptions } = props

  if (resumeAvailable) return <section className="guided-setup guided-resume" aria-labelledby="resume-title">
    <span className="kicker">Welcome back</span>
    <h1 id="resume-title">Resume your saved research setup.</h1>
    <p>Your local draft keeps the question, approved source profiles, and spending cap. Nothing has been searched, purchased, or charged.</p>
    <div className="resume-summary"><div><span className="kicker">Question</span><strong>{question || 'No question entered yet'}</strong></div><div><span className="kicker">Sources</span><strong>{selectedPublishers.length} profiles selected</strong></div><div><span className="kicker">Maximum research spend</span><strong>{props.formatXrp(budgetXrp)} · ≈ {props.money(props.budgetToCents(budgetXrp))}</strong></div></div>
    <div className="setup-actions"><span /><div className="setup-actions-primary"><button type="button" className="small-button" onClick={props.onDiscardDraft}>Discard draft</button><button type="button" className="primary-button" onClick={props.onResumeDraft}>Resume setup <span className="icon" aria-hidden="true">↗</span></button></div></div>
  </section>

  return <section className="guided-setup" aria-labelledby="setup-title">
    <GuidedStepProgress current={step} />
    {step === 'question' && <>
      <div className="setup-intro"><span className="kicker">{firstRun ? 'First research setup' : 'Research setup'}</span><h1 id="setup-title">{firstRun ? 'Start with a question worth investigating.' : 'Shape the question before research starts.'}</h1><p>One decision at a time: define the question, choose the source profiles the agent may read, set a spending cap, then review the plan.</p></div>
      <div className="setup-example"><span className="kicker">Grounded fixture example</span><p>{props.canonicalQuestion}</p><button type="button" className="outline-button" onClick={props.onUseExample}>Use this example</button></div>
      <QuestionComposer value={question} onChange={props.onQuestionChange} onSubmit={props.onContinue} placeholder="Ask a question worth investigating…" />
      <p className="setup-safety-note">This fixture demo searches only its approved synthetic corpus. A cap is authority, not a charge.</p>
      <SetupActions step={step} onBack={props.onBack} onSaveDraft={props.onSaveDraft} onContinue={props.onContinue} />
    </>}
    {step === 'sources' && <>
      <div className="setup-intro"><span className="kicker">Step 2 · sources</span><h1 id="setup-title">Choose what the agent may read.</h1><p>These named profiles define the allowed fixture search boundary. They do not grant access to premium bodies or approve a purchase.</p></div>
      <fieldset className="setup-source-fieldset" aria-describedby={sourceError ? 'source-selection-error' : 'source-selection-help'}><legend>Allowed-to-read source profiles <span className="picker-count">{selectedPublishers.length} / {publisherOptions.length} selected</span></legend><p id="source-selection-help" className="setup-help">Select at least one profile. You can change this scope before plan approval.</p><div className="setup-source-grid">{publisherOptions.map((option) => { const selected = selectedPublishers.includes(option.id); return <button key={option.id} type="button" className={`setup-source-option ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => { setSourceError(''); props.onTogglePublisher(option.id) }}><span className="setup-source-check" aria-hidden="true">{selected ? '✓' : ''}</span><span><strong>{option.label}</strong><small>{option.example}</small></span></button> })}</div>{sourceError && <p id="source-selection-error" className="setup-error" role="alert">{sourceError}</p>}</fieldset>
      <SetupActions step={step} onBack={props.onBack} onSaveDraft={props.onSaveDraft} onContinue={() => { if (selectedPublishers.length === 0) { setSourceError('Choose at least one allowed-to-read source profile before continuing.'); return } props.onContinue() }} />
    </>}
    {step === 'budget' && <>
      <div className="setup-intro"><span className="kicker">Step 3 · budget</span><h1 id="setup-title">Set the maximum research spend.</h1><p>Choose the authority limit for this run. The cap is not your wallet balance, a source price, a charge, or purchase consent.</p></div>
      <label className="setup-budget-field" htmlFor="maximum-research-spend"><span className="setup-label-row"><strong>Maximum research spend</strong><span className="mono">{props.formatXrp(budgetXrp)} · ≈ {props.money(props.budgetToCents(budgetXrp))}</span></span><input id="maximum-research-spend" type="range" min={props.minBudgetXrp} max={props.maxBudgetXrp} step="0.01" value={budgetXrp} onChange={(event) => props.onBudgetChange(Number(event.target.value))} aria-valuetext={`${props.formatXrp(budgetXrp)}, approximately ${props.money(props.budgetToCents(budgetXrp))}`} /><span className="setup-budget-number"><input type="number" min={props.minBudgetXrp} max={props.maxBudgetXrp} step="0.01" value={budgetXrp} onChange={(event) => props.onBudgetChange(Number(event.target.value))} aria-label="Maximum research spend in XRP" /><span>XRP</span></span></label>
      <dl className="budget-explanation"><div><dt>Authority cap</dt><dd>{props.formatXrp(budgetXrp)} maximum for this run.</dd></div><div><dt>Current balance</dt><dd>{props.formatXrp(props.currentBalanceXrp)} demo balance; it is not charged.</dd></div><div><dt>Fixture conversion</dt><dd>1 XRP ≈ S$10.00 for this fixture display only.</dd></div><div><dt>Consent</dt><dd>Premium articles still need a separate exact-quote approval.</dd></div></dl>
      <p className="setup-safety-note">Prices and remaining authority stay visible during research. Setting this cap does not transfer XRP or pay a publisher.</p>
      <SetupActions step={step} onBack={props.onBack} onSaveDraft={props.onSaveDraft} onContinue={props.onContinue} />
    </>}
  </section>
}

export type { PublisherOption }
