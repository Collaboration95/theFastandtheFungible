import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CURRENT_XRP_BALANCE, DEFAULT_BUDGET_CENTS, MAX_BUDGET_CENTS, MIN_BUDGET_CENTS, QUESTION, XRP_TO_SGD_CENTS, type Claim, type Phase, type ResearchApproach, type ResearchConfig, type ResearchPlanArtifact, type RuntimeStatus, type Source } from './domain'
import { createResearchPlan } from './research-plan'

type Brief = { principal:string; audience:string; question:string; deliverable:string; budgetCents:number; autoBuyMaxPerSourceCents:number; sourceAboveThreshold:string; horizon:number; mode:string; sourcePolicy?:string; sourceAllowlist?: string[] }
type ServerState = { runId:string; phase:Phase; paused:boolean; cancelled:boolean; budgetCents:number; spentCents:number; remainingCents:number; rawSourceCount:number; familyCount:number; gap:{question:string; importance:string; state:string}; thesis:{open:string; afterNorthstar?:string; afterMeridian?:string; current:string}; claims:Claim[]; events:{id:string; type:string; label:string; at:string}[]; dossierReady:boolean; llm:{provider:string; status:string; model:string}; semanticStatus:string; runtime:RuntimeStatus; plan?:ResearchPlanArtifact; purchasePlan?:{sourceId:string; reason:string; gap:string; provider:'groq'|'fixture'; model:string; status:'LIVE'|'FALLBACK'}; config:ResearchConfig; sources:Source[] }
type PurchaseDecisionResponse = { action:NonNullable<ServerState['purchasePlan']>; state:ServerState }
type Scenario = { scenarioId:string; runtime:RuntimeStatus; brief:Brief; sources:Source[] }
type Dossier = { mode?:string; title:string; conclusion:string; changedAfterPaidResearch:{before:string; afterNorthstar?:string; after:string}; afterLabel?:string; claims:Claim[]; uncertainty:string; sourceLedger:{publisher:string; priceCents:number; decision:string; family:string; authority:string; originality:string; access:string}[]; method:string; provider?:string; model?:string; status?:string }
type SourceDetail = Source & { premium?:{status:string; protocol?:string; x402Version?:number; contentHash?:string; quoteHash?:string; invoiceId?:string; resourceId?:string; resourceVersionHash?:string; expiresAt?:string; network?:string; payTo?:string|null; amountCents?:number; amountDrops?:number; settlement?:string; runtimeLabel?:string} }
type SourceType = 'primary' | 'public' | 'independent' | 'specialist'
type PendingPurchase = { sourceId:string; source:Source; detail:SourceDetail }

const money = (cents:number) => `S$${(cents / 100).toFixed(2)}`
const formatXrp = (xrp:number) => `${xrp.toFixed(2)} XRP`
const xrpToCents = (xrp:number) => Math.round(xrp * XRP_TO_SGD_CENTS)
const centsToXrp = (cents:number) => cents / XRP_TO_SGD_CENTS
const normalizeBudgetXrp = (value:number) => Math.min(MAX_BUDGET_CENTS / XRP_TO_SGD_CENTS, Math.max(MIN_BUDGET_CENTS / XRP_TO_SGD_CENTS, Math.round((Number.isFinite(value) ? value : MIN_BUDGET_CENTS / XRP_TO_SGD_CENTS) * 100) / 100))
const DEFAULT_BUDGET_XRP = DEFAULT_BUDGET_CENTS / XRP_TO_SGD_CENTS
const landingHeadline = 'What economic question deserves a closer look?'
const presentationRuntimeLabel = (runtime?: RuntimeStatus) => runtime?.mode === 'live' ? 'XRPL RESEARCH' : 'RESEARCH MODE'
const presentationProviderLabel = (provider?: string) => provider === 'groq' ? 'Groq' : 'Research engine'
const presentationSemanticLabel = (status?: string) => status === 'precomputed' ? 'ranked evidence' : status ?? 'ranked evidence'
const api = async <T,>(path:string, options?:RequestInit):Promise<T> => {
  const response = await fetch(path, { headers:{ 'Content-Type':'application/json', ...(options?.headers ?? {}) }, ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Request failed')
  return data as T
}

const sourceTypeLabels: Record<SourceType, string> = {
  primary: 'Primary documents',
  public: 'Public data',
  independent: 'Independent reporting',
  specialist: 'Specialist research',
}
const sourceTypes: SourceType[] = ['primary', 'public', 'independent', 'specialist']
const publisherOptions = [
  { id:'financial-press', label:'Grid Operators Report', example:'grid reporting' },
  { id:'wire-services', label:'Northstar Wire', example:'supplier reporting' },
  { id:'public-data', label:'Public energy & buildout data', example:'open datasets' },
  { id:'specialist-research', label:'Technical Systems Review', example:'site constraints' },
  { id:'company-filings', label:'Vertex Compute filings', example:'company plans' },
  { id:'macro-research', label:'Buildout & market context', example:'market context' },
  { id:'infrastructure-press', label:'GridScope Asia', example:'queue benchmarks' },
] as const
type PublisherKey = typeof publisherOptions[number]['id']
const classifySource = (source:Source):SourceType => {
  if (source.familyId === 'family-company') return 'primary'
  if (source.familyId === 'family-energy' || source.kind === 'DATASET_QUERY') return 'public'
  if (source.familyId === 'family-northstar' || source.familyId === 'family-meridian') return 'independent'
  return 'specialist'
}

function Badge({ children, tone = 'neutral' }:{ children:ReactNode; tone?:string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Icon({ name }:{ name:'arrow'|'check'|'lock'|'send'|'plus'|'close' }) {
  const glyph = { arrow:'↗', check:'✓', lock:'▣', send:'↑', plus:'+', close:'×' }[name]
  return <span className={`icon icon-${name}`} aria-hidden="true">{glyph}</span>
}

function ChatBubble({ role, children }:{ role:'user'|'assistant'; children:ReactNode }) {
  return <div className={`chat-line chat-${role}`}><div className="chat-avatar" aria-hidden="true">{role === 'user' ? 'ET' : 'RA'}</div><div className="chat-copy"><span className="chat-label">{role === 'user' ? 'You' : 'ResearchAgent'}</span><div>{children}</div></div></div>
}

function Composer({ value, onChange, onSubmit, placeholder, disabled = false }:{ value:string; onChange:(value:string)=>void; onSubmit:()=>void; placeholder:string; disabled?:boolean }) {
  const submit = (event:FormEvent) => { event.preventDefault(); if (!disabled && value.trim()) onSubmit() }
  return <form className="composer" onSubmit={submit} noValidate>
    <label className="sr-only" htmlFor="research-question">Research question</label>
    <textarea id="research-question" className="resize-none" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(event) } }} placeholder={placeholder} rows={3} disabled={disabled} style={{ resize:'none' }} />
    <div className="composer-footer"><span>Enter to continue · Shift + Enter for a new line</span><button type="submit" className="send-button" disabled={disabled || !value.trim()} aria-label="Send research question"><Icon name="send" /></button></div>
  </form>
}

function PublisherPicker({ selected, onToggle, budgetXrp, onBudgetXrpChange, onStart, busy, showControls }:{ selected:PublisherKey[]; onToggle:(key:PublisherKey)=>void; budgetXrp:number; onBudgetXrpChange:(value:number)=>void; onStart:()=>void; busy:boolean; showControls:boolean }) {
  return <section className="publisher-picker" aria-labelledby="publisher-picker-title"><div className="publisher-picker-head"><div><span className="kicker">Search boundary</span><h2 id="publisher-picker-title">Select source profiles</h2></div><span className="picker-count mono">{selected.length} / {publisherOptions.length} selected</span></div><p className="publisher-picker-note">Choose the approved profiles the agent may read. Search access stays within this boundary.</p><div className="publisher-grid">{publisherOptions.map((option) => <button key={option.id} type="button" className={`publisher-option ${selected.includes(option.id) ? 'is-selected' : ''}`} aria-pressed={selected.includes(option.id)} onClick={() => onToggle(option.id)}><span className="publisher-check">{selected.includes(option.id) ? '✓' : ''}</span><span><strong>{option.label}</strong><small>{option.example}</small></span></button>)}</div>{showControls && <><BudgetControl value={budgetXrp} onChange={onBudgetXrpChange} /><div className="publisher-picker-footer"><span><span className="status-dot" /> {selected.length > 0 ? `${selected.length} source profiles · ${formatXrp(budgetXrp)} mandate · ≈ ${money(xrpToCents(budgetXrp))}` : 'Choose at least one source profile to continue'}</span><button type="button" className="primary-button" aria-busy={busy} onClick={onStart} disabled={busy || selected.length === 0}>{busy ? 'Building evidence map…' : 'Start research'} <Icon name="arrow" /></button></div></>}</section>
}

const approachOptions: { value:ResearchApproach; label:string; description:string }[] = [
  { value:'BALANCED_DILIGENCE', label:'Balanced diligence', description:'Collect support, challenges, and independent corroboration.' },
  { value:'THESIS_STRESS_TEST', label:'Thesis stress test', description:'Prioritize contradictory evidence and the risks that could break the thesis.' },
  { value:'BUDGET_FIRST_SCAN', label:'Budget-first scan', description:'Build an open baseline first and spend only when a material gap remains.' },
]

function PlanReview({ plan, onChange, onApprove, busy }:{ plan:ResearchPlanArtifact; onChange:(plan:ResearchPlanArtifact)=>void; onApprove:()=>void; busy:boolean }) {
  const updateConfig = (field:'question'|'decision'|'horizon'|'tokenLimit', value:string) => {
    onChange({ ...plan, config:{ ...plan.config, [field]:field === 'tokenLimit' ? Number(value) : value } })
  }
  const selectApproach = (approach:ResearchApproach) => {
    onChange(createResearchPlan(approach, plan.config))
  }
  const updateStep = (index:number, field:'title'|'objective', value:string) => {
    const steps = plan.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]:value } : step)
    onChange({ ...plan, steps })
  }
  const updateStopCondition = (index:number, field:'label'|'condition'|'outcome', value:string) => {
    const stopConditions = plan.stopConditions.map((condition, conditionIndex) => conditionIndex === index ? { ...condition, [field]:value } as typeof condition : condition)
    onChange({ ...plan, stopConditions })
  }
  const valid = Boolean(plan.config.question.trim() && plan.config.decision.trim() && plan.config.horizon.trim() && Number.isInteger(plan.config.tokenLimit) && plan.config.tokenLimit >= 8_000 && plan.config.tokenLimit <= 256_000 && plan.steps.every((step) => step.title.trim() && step.objective.trim()) && plan.stopConditions.every((condition) => condition.label.trim() && condition.condition.trim()))
  return <section className="plan-review workbench-card" aria-labelledby="plan-review-title">
    <div className="step-copy"><span className="kicker">Plan checkpoint · research has not started</span><h1 id="plan-review-title">Review the research plan</h1><p>The agent will not search, read, spend, or unlock evidence until you approve this plan. Choose the method, then edit the permitted research fields.</p></div>
    <fieldset className="plan-approaches"><legend>Research approach</legend><div className="publisher-grid">{approachOptions.map((option) => <label className={`publisher-option ${plan.approach === option.value ? 'is-selected' : ''}`} key={option.value}><input type="radio" name="research-approach" value={option.value} checked={plan.approach === option.value} onChange={() => selectApproach(option.value)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset>
    <div className="plan-fields">
      <label><span>Research question</span><textarea aria-label="Plan research question" value={plan.config.question} onChange={(event) => updateConfig('question', event.target.value)} rows={2} /></label>
      <label><span>Decision this supports</span><textarea aria-label="Plan decision" value={plan.config.decision} onChange={(event) => updateConfig('decision', event.target.value)} rows={2} /></label>
      <label><span>Research horizon</span><input aria-label="Plan research horizon" value={plan.config.horizon} onChange={(event) => updateConfig('horizon', event.target.value)} /></label>
      <label><span>Analysis token cap</span><input aria-label="Plan analysis token cap" type="number" min={8_000} max={256_000} step={1_000} value={plan.config.tokenLimit} onChange={(event) => updateConfig('tokenLimit', event.target.value)} /></label>
    </div>
    <div className="plan-boundary" aria-label="Research mandate guardrails"><div><span className="kicker">Server-owned guardrails</span><p>These mandate fields stay fixed for this run: {money(plan.config.budgetCents)} total budget, S$1.00 per-source ceiling, approved source profiles, and manual approval before every premium purchase.</p></div><div className="plan-strategy"><span className="kicker">Budget intent</span><strong>{plan.budgetIntent.strategy.replaceAll('_', ' ')}</strong><small>Over budget: {plan.budgetIntent.overBudget.toLowerCase()} · {plan.budgetIntent.premiumGate.replaceAll('_', ' ').toLowerCase()}</small></div></div>
    <section className="plan-section" aria-labelledby="plan-priorities-title"><div className="workbench-card-head"><div><span className="kicker">Evidence requirements</span><h2 id="plan-priorities-title">What this approach will look for</h2></div><span className="mono">{plan.evidencePriorities.length} priorities</span></div><ol>{plan.evidencePriorities.map((priority) => <li key={priority.id}><strong>{priority.label}</strong><p>{priority.rationale}</p><small>Signals: {priority.signals.join(' · ')} · minimum {priority.minimumIndependentFamilies} independent {priority.minimumIndependentFamilies === 1 ? 'family' : 'families'}</small></li>)}</ol></section>
    <section className="plan-section" aria-labelledby="plan-steps-title"><div className="workbench-card-head"><div><span className="kicker">Editable workflow</span><h2 id="plan-steps-title">Plan steps</h2></div><span className="mono">{plan.steps.length} steps</span></div><ol>{plan.steps.map((step, index) => <li key={step.id}><div><span className="mono">{String(step.order).padStart(2, '0')} · {step.kind.replaceAll('_', ' ')}</span><label><span>Step title</span><input aria-label={`Plan step ${step.order} title`} value={step.title} onChange={(event) => updateStep(index, 'title', event.target.value)} /></label><label><span>Objective</span><textarea aria-label={`Plan step ${step.order} objective`} value={step.objective} onChange={(event) => updateStep(index, 'objective', event.target.value)} rows={2} /></label></div><small>Guard: no access grant · no payment authorization</small></li>)}</ol></section>
    <section className="plan-section" aria-labelledby="plan-stops-title"><div className="workbench-card-head"><div><span className="kicker">Editable controls</span><h2 id="plan-stops-title">Stop conditions</h2></div><span className="mono">{plan.stopConditions.length} conditions</span></div><ol>{plan.stopConditions.map((condition, index) => <li key={condition.id}><label><span>Condition label</span><input aria-label={`Stop condition ${index + 1} label`} value={condition.label} onChange={(event) => updateStopCondition(index, 'label', event.target.value)} /></label><label><span>When this applies</span><textarea aria-label={`Stop condition ${index + 1} rule`} value={condition.condition} onChange={(event) => updateStopCondition(index, 'condition', event.target.value)} rows={2} /></label><label><span>Outcome</span><select aria-label={`Stop condition ${index + 1} outcome`} value={condition.outcome} onChange={(event) => updateStopCondition(index, 'outcome', event.target.value)}><option value="STOP_AND_REPORT">Stop and report</option><option value="STOP_BEFORE_PREMIUM_REVIEW">Stop before premium review</option><option value="CONTINUE_WITH_UNCERTAINTY">Continue with uncertainty</option></select></label></li>)}</ol></section>
    <div className="plan-review-footer"><p><strong>Approval is explicit.</strong> Approving validates this exact plan on the server and starts the evidence workflow. Premium article purchases remain a separate approval.</p><button type="button" className="primary-button" aria-busy={busy} onClick={onApprove} disabled={busy || !valid}>{busy ? 'Approving plan…' : 'Approve plan & start research'} <Icon name="arrow" /></button></div>
  </section>
}

function BudgetControl({ value, onChange }:{ value:number; onChange:(value:number)=>void }) {
  const cents = xrpToCents(value)
  const setBudget = (next:number) => onChange(normalizeBudgetXrp(next))
  return <label className="budget-control"><div className="budget-heading"><span>Research budget <small>Set before reading begins</small></span><span className="current-xrp"><small>Current XRP</small><strong>{formatXrp(CURRENT_XRP_BALANCE)}</strong></span></div><div className="budget-value-row"><input className="budget-range" type="range" min={MIN_BUDGET_CENTS / XRP_TO_SGD_CENTS} max={MAX_BUDGET_CENTS / XRP_TO_SGD_CENTS} step="0.01" value={value} onChange={(event) => setBudget(Number(event.target.value))} aria-label="Research budget in XRP" aria-valuetext={`${formatXrp(value)}, approximately ${money(cents)}`} /><div className="budget-number-input"><input type="number" min={MIN_BUDGET_CENTS / XRP_TO_SGD_CENTS} max={MAX_BUDGET_CENTS / XRP_TO_SGD_CENTS} step="0.01" value={value} onChange={(event) => setBudget(Number(event.target.value))} aria-label="Research budget in XRP" /><span>XRP</span></div><strong className="budget-sgd">≈ {money(cents)}</strong></div><small className="budget-rate">1 XRP ≈ S$10.00</small></label>
}

function SourceItem({ source, selected, onOpen, onAction }:{ source:Source; selected:boolean; onOpen:()=>void; onAction:(action:'BUY'|'SKIP'|'BLOCKED')=>void }) {
  const decision = source.decision
  const actionLabel = source.id === 'circuit-note' ? 'Skip' : source.id === 'gridscope-asia' ? 'Block' : 'Approve purchase'
  return <article className={`source-row ${selected ? 'is-selected' : ''}`}>
    <div className="source-rank">{String(Math.max(1, source.relevance)).padStart(2, '0')}</div>
    <button type="button" className="source-open" onClick={onOpen} aria-label={`Inspect ${source.publisher}: ${source.title}`}>
      <span className="source-title-line"><strong>{source.title}</strong><span className="source-publisher">{source.publisher}</span></span>
      <span className="source-preview">{source.preview}</span>
      <span className="source-meta"><span>{sourceTypeLabels[classifySource(source)]}</span><span>{source.familyLabel}</span><span>{source.authority.toLowerCase()} authority</span><span>{source.originality.toLowerCase()}</span></span>
    </button>
      <div className="source-metrics"><span className="metric-score"><b>{source.relevance}</b><small>match</small></span><span className="metric-price">{source.priceCents ? money(source.priceCents) : 'Free'}</span>{source.priceCents > 0 && <small className="metric-x402">x402 · {source.xrpDrops?.toLocaleString() ?? '—'} drops</small>}</div>
      <div className="source-actions">
      {decision === 'BUY' && <><Badge tone="success"><Icon name="check" /> Unlocked</Badge>{source.payment?.explorerUrl && <a className="source-receipt-link" href={source.payment.explorerUrl} target="_blank" rel="noreferrer">XRPL receipt ↗</a>}</>}
      {decision === 'SKIP' && <Badge tone="warning">Skipped · duplicate</Badge>}
      {decision === 'BLOCKED' && <Badge tone="danger"><Icon name="lock" /> Blocked</Badge>}
      {!decision && source.accessTier === 'OPEN' && <span className="open-label">Open source</span>}
      {!decision && source.accessTier === 'PREMIUM' && <button type="button" className={`text-action ${source.id === 'gridscope-asia' ? 'danger' : source.id === 'circuit-note' ? 'quiet' : ''}`} onClick={() => onAction(source.id === 'circuit-note' ? 'SKIP' : source.id === 'gridscope-asia' ? 'BLOCKED' : 'BUY')}>{actionLabel}{source.id === 'gridscope-asia' ? '' : ` ${money(source.priceCents)}`}</button>}
    </div>
  </article>
}

function EvidenceDrawer({ source, onClose }:{ source:SourceDetail; onClose:()=>void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousRef = useRef<HTMLElement|null>(null)
  useEffect(() => {
    previousRef.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    const onKeyDown = (event:KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previousRef.current?.focus() }
  }, [onClose])
  const locked = source.accessTier === 'PREMIUM' && source.decision !== 'BUY'
  const fixtureQuote = !source.premium?.network || source.premium.network === 'fixture'
  return <><button className="drawer-backdrop" type="button" aria-label="Close evidence drawer" onClick={onClose} /><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className="drawer-head"><div><span className="kicker">Evidence inspection</span><h2 id="drawer-title">{source.publisher}</h2></div><button ref={closeRef} type="button" className="icon-button light" onClick={onClose} aria-label="Close evidence drawer"><Icon name="close" /></button></div><div className="drawer-content"><Badge tone={locked ? 'warning' : source.accessTier === 'OPEN' ? 'neutral' : 'success'}>{source.accessTier === 'OPEN' ? 'Open evidence' : locked ? 'Premium preview' : 'Premium · unlocked'}</Badge><h3>{source.title}</h3><p className="drawer-preview">{source.preview}</p><dl className="detail-list"><div><dt>Evidence family</dt><dd>{source.familyLabel}<small>{source.originality} · {source.trustNote}</small></dd></div><div><dt>Retrieval score</dt><dd className="mono">{source.relevance} / 100<small>Price never affects relevance.</small></dd></div><div><dt>Gap match</dt><dd className="mono">{source.gapMatch} / 100<small>How directly this source answers the active gap.</small></dd></div><div><dt>Terms</dt><dd>{source.priceCents ? `${money(source.priceCents)} exact resource quote` : 'Open / no payment required'}<small>Access is governed by the terms shown here.</small></dd></div></dl>{locked && <div className="locked-evidence"><Icon name="lock" /><div><strong>Full text is protected</strong><p>Only metadata, preview, price, and terms are visible before purchase. This preview cannot be cited as read.</p><p className="mono">{fixtureQuote ? 'Quote · access pending' : 'x402 quote · XRPL Testnet'} · {source.xrpDrops?.toLocaleString() ?? '—'} drops · {fixtureQuote ? 'validated after purchase' : 'validated after purchase'}</p></div></div>}{source.evidenceSpans && <section className="span-section"><h3>Accessible evidence spans</h3>{source.evidenceSpans.map((span) => <blockquote key={span.id} id={span.id}><span className="kicker">{span.label} · {span.id}</span><p>“{span.text}”</p></blockquote>)}</section>}</div></aside></>
}

function PurchaseConfirmation({ pending, busy, onConfirm, onCancel }:{ pending:PendingPurchase; busy:boolean; onConfirm:()=>void; onCancel:()=>void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousRef = useRef<HTMLElement|null>(null)
  const quote = pending.detail.premium
  useEffect(() => {
    previousRef.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    const onKeyDown = (event:KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previousRef.current?.focus() }
  }, [busy, onCancel])
  const exact = (value:unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
  return <><button className="drawer-backdrop" type="button" aria-label="Cancel purchase confirmation" onClick={() => { if (!busy) onCancel() }} /><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="purchase-confirmation-title"><div className="drawer-head"><div><span className="kicker">Manual approval required</span><h2 id="purchase-confirmation-title">Confirm this purchase</h2></div><button ref={closeRef} type="button" className="icon-button light" onClick={onCancel} disabled={busy} aria-label="Cancel purchase confirmation"><Icon name="close" /></button></div><div className="drawer-content"><Badge tone="warning">Nothing has been purchased</Badge><h3>{pending.source.title}</h3><p className="drawer-preview">Review the exact quote binding below. Access is granted only after you explicitly confirm this purchase.</p><dl className="detail-list"><div><dt>Amount</dt><dd>{money(pending.source.priceCents)} · {exact(quote?.amountDrops ?? pending.source.xrpDrops)} drops</dd></div><div><dt>Invoice</dt><dd className="mono">{exact(quote?.invoiceId)}</dd></div><div><dt>Resource</dt><dd className="mono">{exact(quote?.resourceId)}</dd></div><div><dt>Payee</dt><dd className="mono">{exact(quote?.payTo)}<small>{quote?.payTo ? 'Exact destination in this quote.' : 'No external settlement in this mode.'}</small></dd></div><div><dt>Network</dt><dd className="mono">{exact(quote?.network)}</dd></div><div><dt>Resource version hash</dt><dd className="mono">{exact(quote?.resourceVersionHash)}</dd></div><div><dt>Expires</dt><dd className="mono">{exact(quote?.expiresAt)}</dd></div><div><dt>Quote hash</dt><dd className="mono">{exact(quote?.quoteHash)}</dd></div><div><dt>Protocol</dt><dd className="mono">{exact(quote?.protocol)} · version {exact(quote?.x402Version)}</dd></div></dl><div className="locked-evidence"><Icon name="lock" /><div><strong>Explicit confirmation is required</strong><p>This approval is bound to the invoice, resource, payee, network, resource version hash, expiry, and quote hash shown above.</p></div></div><div className="drawer-actions"><button type="button" className="small-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="primary-button" onClick={onConfirm} disabled={busy || !quote?.quoteHash}>{busy ? 'Confirming…' : `Confirm purchase ${money(pending.source.priceCents)}`} <Icon name="arrow" /></button></div></div></aside></>
}

function BudgetCard({ run }:{ run:ServerState }) {
  const spentPercent = Math.min(100, (run.spentCents / run.budgetCents) * 100)
  return <section className="side-card budget-card"><div className="side-card-heading"><span className="kicker">Research budget</span><span className="mono">{formatXrp(centsToXrp(run.remainingCents))} left</span></div><div className="budget-number"><strong>{formatXrp(centsToXrp(run.spentCents))}</strong><span>≈ {money(run.spentCents)} of {formatXrp(centsToXrp(run.budgetCents))}</span></div><div className="budget-bar"><i style={{ width:`${spentPercent}%` }} /></div><div className="budget-note">XRP is the working currency. Approximate SGD value uses 1 XRP ≈ S$10.00. The agent cannot exceed the mandate or buy a source above S$1.00.</div></section>
}

function BriefCard({ run }:{ run:ServerState }) {
  const allowlist = run.config.sourceAllowlist ?? []
  return <section className="workbench-card brief-card" aria-labelledby="brief-title"><div className="workbench-card-head"><div><span className="kicker">Research brief</span><h2 id="brief-title">The question in scope</h2></div><Badge tone="success">Confirmed</Badge></div><p className="brief-question">{run.config.question}</p><dl className="brief-details"><div><dt>Decision</dt><dd>{run.config.decision}</dd></div><div><dt>Horizon</dt><dd>{run.config.horizon}</dd></div><div><dt>Sources</dt><dd>{allowlist.length} source profiles</dd></div><div><dt>Access</dt><dd>Budget-controlled</dd></div><div><dt>Approval</dt><dd>Manual approval required</dd></div></dl><div className="brief-boundary"><span className="kicker">Search boundary</span><p>The agent can read only the approved source profiles, and every premium purchase requires explicit approval.</p><div className="brief-sites">{allowlist.map((key) => <span className="brief-site" key={key}>{publisherOptions.find((option) => option.id === key)?.label ?? key}</span>)}</div></div></section>
}

function EvidenceGapCard({ run }:{ run:ServerState }) {
  const stateTone = run.gap.state === 'RESOLVED' ? 'success' : run.gap.state === 'PARTIAL' ? 'warning' : 'neutral'
  return <section className="gap-card workbench-card" aria-labelledby="gap-title"><div className="workbench-card-head"><div><span className="kicker">Evidence gap</span><h2 id="gap-title">What could still change the answer</h2></div><Badge tone={stateTone}>{run.gap.state.toLowerCase()}</Badge></div><p>{run.gap.question}</p><div className="gap-detail"><span className="kicker">Importance</span><strong>{run.gap.importance}</strong></div></section>
}

function ActivityRail({ run, dossier, busy, onSynthesize }:{ run:ServerState; dossier:Dossier|null; busy:boolean; onSynthesize:()=>void }) {
  const source = run.sources.find((item) => item.id === run.purchasePlan?.sourceId)
  const hasPurchase = run.sources.some((item) => item.decision === 'BUY')
  const path = [
    { number:'1', label:'Search', detail:`${run.rawSourceCount} previews · ${run.familyCount} families`, state:'Complete', complete:true },
    { number:'2', label:'Purchase', detail:source?.decision === 'BUY' ? `${source.publisher} unlocked` : 'Awaiting an eligible source', state:hasPurchase ? 'Complete' : 'Waiting', complete:hasPurchase },
    { number:'3', label:'Answer', detail:dossier ? 'Cited memo is ready' : hasPurchase ? 'Ready to assemble' : 'Unlock evidence first', state:dossier ? 'Ready' : 'Next', complete:Boolean(dossier) },
  ]
  return <aside className="workbench-activity" aria-label="Research activity"><section className="activity-card" aria-labelledby="activity-title"><div className="workbench-card-head"><div><span className="kicker">Activity</span><h2 id="activity-title">Research path</h2></div><span className="mono activity-count">{run.events.length} events</span></div><ol className="activity-path">{path.map((item) => <li key={item.number} className={item.complete ? 'is-complete' : ''}><span className="activity-marker" aria-hidden="true">{item.number}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><span className="activity-state">{item.state}</span></li>)}</ol></section><BudgetCard run={run} /><section className="activity-card purchase-card" aria-labelledby="purchase-summary-title"><div className="workbench-card-head"><div><span className="kicker">Agent decision</span><h2 id="purchase-summary-title">Purchase checkpoint</h2></div><Badge tone={hasPurchase ? 'success' : 'warning'}>{hasPurchase ? 'Verified' : 'Waiting'}</Badge></div><AgentActionStep run={run} />{!dossier && <button type="button" className="primary-button activity-cta" onClick={onSynthesize} disabled={busy || !hasPurchase}>{busy ? 'Assembling…' : 'Assemble cited answer'} <Icon name="arrow" /></button>}</section><section className="activity-card event-card" aria-labelledby="event-title"><div className="workbench-card-head"><div><span className="kicker">Trace</span><h2 id="event-title">Latest activity</h2></div></div><ol className="event-list">{run.events.slice(-5).reverse().map((event) => <li key={event.id}><span className="event-dot" aria-hidden="true" /><span>{event.label}</span></li>)}</ol></section></aside>
}

function citationLabel(id:string) {
  const labels:Record<string,string> = { 'company-capex':'Vertex Compute', 'energy-dataset':'EMA data', 'northstar-wire':'Northstar Wire', 'meridian-ledger':'Grid Operators Report', 'gridscope-asia':'GridScope Asia', 'circuit-note':'Circuit Note', 'treasury-volatility':'Harbour Rates Wire', 'term-premium-desk':'Term Premium Desk', 'credit-spread-watch':'Credit Spread Watch', 'auction-absorption':'Auction Flow Review', 'real-yield-tracker':'Real Yield Tracker', 'fiscal-monitor':'Fiscal Monitor', 'central-bank-minutes':'Policy Archive', 'duration-allocator':'Allocator Notes' }
  return labels[id] ?? id
}

function Citations({ ids, onOpen }:{ ids:string[]; onOpen:(id:string)=>void }) {
  return <span className="inline-citations" aria-label="Citations">{ids.map((id) => <button type="button" key={id} onClick={() => onOpen(id)}>[{citationLabel(id)}]</button>)}</span>
}

function sourceQuote(sources:Source[], id:string) {
  const source = sources.find((item) => item.id === id)
  return source?.evidenceSpans?.[0]?.text ?? source?.preview ?? 'Excerpt available after the exact resource is unlocked.'
}

function QuoteStrip({ ids, sources, onOpen }:{ ids:string[]; sources:Source[]; onOpen:(id:string)=>void }) {
  return <div className="quote-strip">{ids.map((id) => <button type="button" key={id} onClick={() => onOpen(id)}><span>“{sourceQuote(sources, id)}”</span><small>{citationLabel(id)} · inspect excerpt ↗</small></button>)}</div>
}

function ClaimBlock({ claim, sources, onOpen }:{ claim:Claim; sources:Source[]; onOpen:(id:string)=>void }) {
  return <article className={`claim-block ${claim.stance.toLowerCase()}`}><p>{claim.text} <Citations ids={claim.sourceIds} onOpen={onOpen} /></p><QuoteStrip ids={claim.sourceIds} sources={sources} onOpen={onOpen} /><div className="claim-meta"><Badge tone={claim.stance === 'SUPPORTS' ? 'success' : claim.stance === 'CHALLENGES' ? 'danger' : 'warning'}>{claim.stance.toLowerCase()}</Badge><span>{claim.familyCount} independent {claim.familyCount === 1 ? 'family' : 'families'}</span></div></article>
}

function WorkingAnswer({ run, onOpenSource }:{ run:ServerState; onOpenSource:(id:string)=>void }) {
  const sentences = run.claims.length ? run.claims : [{ id:'working-thesis', text:run.thesis.current, stance:'UNCERTAIN' as const, materiality:'MATERIAL' as const, sourceIds:['company-capex','energy-dataset'], familyCount:2, spanIds:['company-capex','energy-dataset'] }]
  return <section className="answer-panel" aria-labelledby="answer-title"><div className="answer-head"><div><span className="kicker">Working answer</span><h2 id="answer-title">What the evidence says so far</h2></div><span className="answer-status mono">{run.dossierReady ? 'CITED MEMO READY' : 'OPEN-SOURCE BASELINE'}</span></div><div className="answer-copy">{sentences.map((claim) => <div className="answer-sentence" key={claim.id}><p>{claim.text} <Citations ids={claim.sourceIds} onOpen={onOpenSource} /></p><QuoteStrip ids={claim.sourceIds} sources={run.sources} onOpen={onOpenSource} /></div>)}</div><p className="answer-note">Each citation opens the source record. Paid excerpts are only available after the exact quote is accepted.</p></section>
}

function SynthesisStream({ text, streaming }:{ text:string; streaming:boolean }) {
  return <section className="synthesis-stream" aria-labelledby="synthesis-stream-title"><div className="answer-head"><div><span className="kicker">Groq live synthesis</span><h2 id="synthesis-stream-title">Drafting the cited dossier</h2></div><span className="answer-status mono">{streaming ? 'STREAMING' : 'COMPLETE'}</span></div><pre aria-live="polite">{text || 'Waiting for the first Groq token…'}</pre><small>Groq is streaming structured output from the question, budget, purchase decision, and accessible evidence spans. The final dossier is validated before it is published.</small></section>
}

function DossierPanel({ dossier, run, onOpenSource, onSynthesize, busy }:{ dossier:Dossier|null; run:ServerState; onOpenSource:(id:string)=>void; onSynthesize:()=>void; busy:boolean }) {
  if (!dossier) return null
  return <section className="dossier-panel" id="dossier"><div className="dossier-heading"><div><span className="kicker">Verified dossier · {presentationProviderLabel(dossier.provider)}</span><h2>{dossier.title}</h2></div><button type="button" className="small-button light" onClick={() => window.print()}>Print</button></div><div className="dossier-paper"><div className="dossier-kicker">RESEARCH DOSSIER · NOT INVESTMENT ADVICE</div><h3>{dossier.conclusion}</h3><div className="changed-callout"><span className="kicker">What changed after paid evidence</span><span className="change-line"><b>Open web</b>{dossier.changedAfterPaidResearch.before}</span>{dossier.changedAfterPaidResearch.afterNorthstar && <span className="change-line"><b>+ Northstar</b>{dossier.changedAfterPaidResearch.afterNorthstar}</span>}<span className="change-line final"><b>{dossier.afterLabel ?? '+ Grid report'}</b>{dossier.changedAfterPaidResearch.after}</span></div><div className="dossier-columns"><div><span className="kicker">Supports the thesis</span>{dossier.claims.filter((claim) => claim.stance === 'SUPPORTS').map((claim) => <ClaimBlock key={claim.id} claim={claim} sources={run.sources} onOpen={onOpenSource} />)}</div><div><span className="kicker">Challenges the thesis</span>{dossier.claims.filter((claim) => claim.stance !== 'SUPPORTS').map((claim) => <ClaimBlock key={claim.id} claim={claim} sources={run.sources} onOpen={onOpenSource} />)}</div></div><div className="dossier-footer"><div><span className="kicker">Key uncertainty</span><p>{dossier.uncertainty}</p></div><div><span className="kicker">Method & limitations</span><p>{dossier.method}</p></div></div></div></section>
}

function EvidenceStep({ run, sources, showAll, onShowAll, selectedId, onOpen, onAction }:{ run:ServerState; sources:Source[]; showAll:boolean; onShowAll:()=>void; selectedId:string|null; onOpen:(id:string)=>void; onAction:(sourceId:string, action:'BUY'|'SKIP'|'BLOCKED')=>void }) {
  const visible = showAll ? sources : sources.slice(0, 5)
  return <><div className="step-copy evidence-heading"><div><span className="kicker">Retrieved evidence</span><h2>{sources.length} previews from approved source profiles</h2><p>Only these approved sources were searched. Match score ranks relevance; price is considered separately.</p></div><span className="step-summary mono">{run.familyCount} evidence families</span></div><div className="source-filter"><span>Source profiles:</span>{(run.config.sourceAllowlist ?? []).map((key) => <span key={key} className="filter-chip"><i />{publisherOptions.find((option) => option.id === key)?.label ?? key}</span>)}</div>{sources.length === 0 ? <div className="evidence-empty" role="status"><strong>No approved sources matched this question.</strong><p>Broaden the source-profile allowlist or start a new research question to build another evidence map.</p></div> : <><div className="source-list">{visible.map((source) => <SourceItem key={source.id} source={source} selected={selectedId === source.id} onOpen={() => onOpen(source.id)} onAction={(action) => onAction(source.id, action)} />)}</div>{sources.length > visible.length && <button type="button" className="load-more" onClick={onShowAll}>Show {sources.length - visible.length} more sources <Icon name="arrow" /></button>}</>}</>
}

function AgentActionStep({ run }:{ run:ServerState }) {
  const source = run.sources.find((item) => item.id === run.purchasePlan?.sourceId)
  const paid = source?.decision === 'BUY'
  const runtime = run.runtime ?? { mode:'fixture' as const, label:'FIXTURE RESEARCH' }
  const provider = presentationProviderLabel(run.purchasePlan?.provider)
  return <div className="agent-action-step"><div><span className="kicker">Agent action · {provider}</span><h2>{paid ? 'Bought the report that closes the grid gap.' : 'No paid source was selected.'}</h2><p>{source ? <><strong>{source.title}</strong> from {source.publisher}. {run.purchasePlan?.reason}</> : 'The retrieved sources did not include an affordable premium report.'}</p><dl className="action-facts"><div><dt>Cost</dt><dd>{source?.priceCents ? `${formatXrp((source.xrpDrops ?? 0) / 1_000_000)} · ≈ ${money(source.priceCents)}` : 'No purchase'}</dd></div><div><dt>Budget left</dt><dd>{formatXrp(centsToXrp(run.remainingCents))} · ≈ {money(run.remainingCents)}</dd></div><div><dt>Result</dt><dd>{paid ? (runtime.mode === 'live' ? 'Validated and unlocked' : 'Quote accepted · unlocked') : 'Not purchased'}</dd></div></dl><small>{provider} compared the source metadata. The server enforced the budget and settlement rules.</small></div>{source?.payment?.explorerUrl && <a className="primary-button" href={source.payment.explorerUrl} target="_blank" rel="noreferrer">View transaction <Icon name="arrow" /></a>}</div>
}

function ResearchPath({ run, dossier, sources, showAll, onShowAll, selectedId, onOpenSource, onAction, onSynthesize, busy, synthesisText, synthesisStreaming }:{ run:ServerState; dossier:Dossier|null; sources:Source[]; showAll:boolean; onShowAll:()=>void; selectedId:string|null; onOpenSource:(id:string)=>void; onAction:(sourceId:string, action:'BUY'|'SKIP'|'BLOCKED')=>void; onSynthesize:()=>void; busy:boolean; synthesisText:string; synthesisStreaming:boolean }) {
  return <section className="workbench" aria-label="Evidence workspace" aria-busy={busy}><aside className="workbench-brief"><BriefCard run={run} /></aside><div className="workbench-main"><WorkingAnswer run={run} onOpenSource={onOpenSource} /><EvidenceGapCard run={run} />{synthesisStreaming && <SynthesisStream text={synthesisText} streaming={synthesisStreaming} />}<section className="evidence-panel" aria-labelledby="evidence-panel-title"><div className="evidence-panel-label"><span className="kicker">Search / evidence map</span><span className="mono">{run.phase === 'CANCELLED' ? 'STOPPED' : 'LIVE WORKSPACE'}</span></div><div id="evidence-panel-title"><EvidenceStep run={run} sources={sources} showAll={showAll} onShowAll={onShowAll} selectedId={selectedId} onOpen={onOpenSource} onAction={onAction} /></div></section>{dossier && <DossierPanel dossier={dossier} run={run} onOpenSource={onOpenSource} onSynthesize={onSynthesize} busy={busy} />}</div><ActivityRail run={run} dossier={dossier} busy={busy} onSynthesize={onSynthesize} /></section>
}

export default function App() {
  const [scenario, setScenario] = useState<Scenario|null>(null)
  const [run, setRun] = useState<ServerState|null>(null)
  const [planDraft, setPlanDraft] = useState<ResearchPlanArtifact|null>(null)
  const [question, setQuestion] = useState('')
  const [questionDraft, setQuestionDraft] = useState('')
  const [budgetXrp, setBudgetXrp] = useState(DEFAULT_BUDGET_XRP)
  const [selectedPublishers, setSelectedPublishers] = useState<PublisherKey[]>(publisherOptions.map((option) => option.id))
  const [chatStarted, setChatStarted] = useState(false)
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SourceDetail|null>(null)
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase|null>(null)
  const [dossier, setDossier] = useState<Dossier|null>(null)
  const [synthesisText, setSynthesisText] = useState('')
  const [synthesisStreaming, setSynthesisStreaming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Ready when you are.')
  const [showAllSources, setShowAllSources] = useState(false)
  const [typedHeadline, setTypedHeadline] = useState('')

  useEffect(() => {
    document.title = 'ResearchAgent — Deep research'
    api<Scenario>('/api/v1/scenarios/data-centre-2028').then(setScenario).catch(() => setMessage('Backend unavailable. Start the research service to continue.'))
  }, [])

  useEffect(() => {
    if (chatStarted || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedHeadline(landingHeadline)
      return
    }
    setTypedHeadline('')
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setTypedHeadline(landingHeadline.slice(0, index))
      if (index >= landingHeadline.length) window.clearInterval(timer)
    }, 28)
    return () => window.clearInterval(timer)
  }, [chatStarted])

  useEffect(() => {
    if (!run?.runId) return
    const stream = new EventSource(`/api/v1/research-runs/${run.runId}/stream`)
    const readPayload = (event:Event) => { try { return JSON.parse((event as MessageEvent<string>).data) as Record<string, unknown> } catch { return {} } }
    stream.addEventListener('PLAN_CREATED', () => setMessage('Scope accepted. I’m building the evidence map.'))
    stream.addEventListener('PURCHASE_BLOCKED', () => setMessage('GridScope blocked: S$1.40 exceeds the remaining S$1.00.'))
    stream.addEventListener('DOSSIER_SYNTHESIS_STARTED', () => { setSynthesisText(''); setSynthesisStreaming(true); setMessage('Groq is streaming the cited dossier…') })
    stream.addEventListener('DOSSIER_TOKEN', (event) => { const delta = readPayload(event).delta; if (typeof delta === 'string') { setSynthesisStreaming(true); setSynthesisText((current) => current + delta) } })
    stream.addEventListener('DOSSIER_SYNTHESIS_COMPLETED', () => { setSynthesisStreaming(false); setMessage('Groq dossier complete. Claims and evidence spans were validated.') })
    stream.addEventListener('DOSSIER_SYNTHESIS_FALLBACK', () => { setSynthesisStreaming(false); setMessage('Groq synthesis was unavailable; a cited fallback was used.') })
    stream.addEventListener('DOSSIER_READY', () => setMessage('Dossier ready. Claims point to accessible evidence spans.'))
    return () => stream.close()
  }, [run?.runId])

  useEffect(() => {
    if (run?.runId) window.scrollTo({ top:0, behavior:'auto' })
  }, [run?.runId])

  const resetToStart = async () => {
    if (busy) return
    const activeRun = run
    setBusy(Boolean(activeRun))
    try {
      if (activeRun) await api<ServerState>(`/api/v1/research-runs/${activeRun.runId}/reset`, { method:'POST', body:'{}' })
      setRun(null); setPlanDraft(null); setDossier(null); setSynthesisText(''); setSynthesisStreaming(false); setQuestion(''); setQuestionDraft(''); setBudgetXrp(DEFAULT_BUDGET_XRP); setSelectedPublishers(publisherOptions.map((option) => option.id)); setChatStarted(false); setSelectedId(null); setSelectedDetail(null); setPendingPurchase(null); setMessage('Ready when you are.'); window.scrollTo({ top:0, behavior:'smooth' })
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  const beginClarification = (value = questionDraft) => { const next = value.trim(); if (!next) return; setQuestion(next); setQuestionDraft(next); setChatStarted(true); setMessage('Question received. Choose your websites and budget before research starts.') }
  const togglePublisher = (key:PublisherKey) => setSelectedPublishers((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])

  const startResearch = async () => {
    if (busy || !question.trim() || selectedPublishers.length === 0) return
    setBusy(true)
    try {
      const created = await api<ServerState>('/api/v1/research-runs', { method:'POST', body:JSON.stringify({ question, decision:'Inform the next research decision', horizon:'Through 2028', tokenLimit:64000, budgetCents:xrpToCents(budgetXrp), sourceTypes, sourceAllowlist:selectedPublishers }) })
      setRun(created)
      const initialPlan = created.plan ?? createResearchPlan('BALANCED_DILIGENCE', { ...created.config, sourceAllowlist:selectedPublishers })
      setPlanDraft(initialPlan)
      setMessage('Research plan ready. Review and approve it before the agent starts.')
      window.scrollTo({ top:0, behavior:'auto' })
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const approvePlan = async () => {
    if (!run || !planDraft || busy) return
    setBusy(true)
    try {
      let next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/plan`, { method:'POST', body:JSON.stringify({ plan:planDraft }) })
      setRun(next)
      setMessage('Plan approved. Building the evidence map…')
      // The approval endpoint leaves the run in PLANNING. Five transitions
      // take it through discovery, ranking, open reading, gap analysis, and
      // purchase planning; no transition is possible before approval.
      for (let index = 0; index < 5; index += 1) next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/step`, { method:'POST', body:JSON.stringify({ action:'next' }) })
      const planned = await api<PurchaseDecisionResponse>(`/api/v1/research-runs/${run.runId}/purchase-decisions`, { method:'POST', body:'{}' })
      setRun(planned.state)
      setPlanDraft(null)
      setMessage(planned.action.sourceId ? `Evidence map ready. Review the recommendation, then explicitly approve or skip it.` : 'Evidence map ready. No affordable premium source was selected.')
      window.scrollTo({ top:0, behavior:'auto' })
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const act = async (action:string) => {
    if (!run || busy) return
    setBusy(true)
    try { const next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/step`, { method:'POST', body:JSON.stringify({ action }) }); setRun(next); setMessage(action === 'pause' ? 'Research paused.' : action === 'resume' ? 'Research resumed.' : message) } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const purchase = async (sourceId:string, action:'BUY'|'SKIP'|'BLOCKED') => {
    if (!run || busy) return
    if (action === 'BUY') {
      setBusy(true)
      try {
        const source = run.sources.find((item) => item.id === sourceId)
        if (!source) throw new Error('Source is outside this run scope')
        const detail = await api<SourceDetail>(`/api/v1/research-runs/${run.runId}/sources/${sourceId}`)
        if (detail.premium?.status !== 'PAYMENT_REQUIRED' || !detail.premium.quoteHash) throw new Error('The exact quote is no longer available. Inspect the source again before approving it.')
        setPendingPurchase({ sourceId, source, detail })
        setSelectedId(sourceId)
        setMessage('Exact quote loaded. Review every bound field before confirming the purchase.')
      } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
      return
    }
    setBusy(true)
    try {
      const next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/purchases`, { method:'POST', body:JSON.stringify({ sourceId, action, idempotencyKey:crypto.randomUUID() }) })
      setRun(next)
      const source = next.sources.find((item) => item.id === sourceId)
      setMessage(action === 'SKIP' ? 'Circuit Note skipped because it repeats Northstar Wire.' : 'GridScope blocked: S$1.40 exceeds the remaining S$1.00.')
      if (selectedId === sourceId && source) setSelectedDetail(source)
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const confirmPurchase = async () => {
    if (!run || !pendingPurchase || busy) return
    const quoteHash = pendingPurchase.detail.premium?.quoteHash
    if (!quoteHash) { setMessage('The exact quote is no longer available. Inspect the source again before approving it.'); setPendingPurchase(null); return }
    setBusy(true)
    try {
      const next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/purchases`, { method:'POST', body:JSON.stringify({ sourceId:pendingPurchase.sourceId, action:'BUY', approval:'APPROVED', quoteHash, idempotencyKey:crypto.randomUUID() }) })
      setRun(next)
      setPendingPurchase(null)
      const source = next.sources.find((item) => item.id === pendingPurchase.sourceId)
      setMessage(`${source?.publisher} unlocked. The working thesis can now change.`)
      if (selectedId === pendingPurchase.sourceId && source) setSelectedDetail(source)
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const openSource = async (sourceId:string) => {
    if (!run) return
    setSelectedId(sourceId)
    try { setSelectedDetail(await api<SourceDetail>(`/api/v1/research-runs/${run.runId}/sources/${sourceId}`)) } catch { setSelectedDetail(null) }
  }

  const synthesize = async () => {
    if (!run || busy) return
    setBusy(true)
    setSynthesisText('')
    setSynthesisStreaming(true)
    try {
      let next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/synthesize`, { method:'POST', body:'{}' })
      setRun(next)
      next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/step`, { method:'POST', body:JSON.stringify({ action:'next' }) })
      setRun(next); setDossier(await api<Dossier>(`/api/v1/research-runs/${run.runId}/dossier`)); setMessage('Dossier ready. Claims are linked to exact accessible spans.')
    } catch (error) { setSynthesisStreaming(false); setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const visibleSources = run?.sources.filter((source) => run.config.sourceTypes.includes(classifySource(source))) ?? []
  const suggestedQuestion = scenario?.brief.question ?? QUESTION

  return <div className="app-shell">
    <header className="topbar"><button type="button" className="brand-button" onClick={() => void resetToStart()} aria-label="Start a new ResearchAgent thread"><span className="brand-mark" aria-hidden="true">RA</span><span><strong>ResearchAgent</strong></span></button><div className="topbar-thread"><span className="topbar-label">{run ? 'Active thread' : 'Research desk'}</span><span className="topbar-query">{run?.config.question ?? 'A calm workbench for defensible research'}</span></div><div className="topbar-actions">{run && <span className="topbar-budget mono">{formatXrp(centsToXrp(run.remainingCents))} left</span>}<Badge tone="fixture">{presentationRuntimeLabel(run?.runtime ?? scenario?.runtime)}</Badge></div></header>
    <div className={`product-shell ${run ? 'has-sidebar' : ''}`}>
      {run && <aside className="sidebar" aria-label="Research workspace navigation"><button type="button" className="new-thread" onClick={() => void resetToStart()}><Icon name="plus" /> New research</button><nav className="side-nav" aria-label="Workspace sections"><span className="side-label">Workspace</span><button type="button" className="is-active" onClick={() => window.scrollTo({ top:0, behavior:'smooth' })}><span className="nav-icon" aria-hidden="true">⌁</span>Research desk<span aria-hidden="true">•</span></button><button type="button" onClick={() => document.getElementById('evidence-panel-title')?.scrollIntoView({ behavior:'smooth', block:'start' })}><span className="nav-icon" aria-hidden="true">≡</span>Evidence map<span className="mono">{run.rawSourceCount}</span></button><button type="button" disabled={!dossier} onClick={() => document.getElementById('dossier')?.scrollIntoView({ behavior:'smooth', block:'start' })}><span className="nav-icon" aria-hidden="true">◎</span>Cited dossier<span className="mono">{dossier ? 'ready' : '—'}</span></button></nav><div className="sidebar-bottom"><span className="kicker">Search boundary</span><p>The agent searches only approved source profiles, and every premium purchase requires explicit approval.</p><span className="sidebar-meta mono">{presentationProviderLabel(run.llm.provider)} · {presentationSemanticLabel(run.semanticStatus)}</span></div></aside>}
      <main className={`main-column ${run ? 'has-run' : ''}`}>
        {!run && <section className={`start-view ${chatStarted ? 'is-clarifying' : ''}`}>
          <div className="start-copy"><span className="kicker">ResearchAgent / Research desk</span><h1 aria-label={chatStarted ? 'Let’s make the question useful.' : landingHeadline}>{chatStarted ? 'Let’s make the question useful.' : <>{typedHeadline}<span className="typewriter-caret" aria-hidden="true" /></>}</h1>{chatStarted ? <p>I’ll search only the source profiles you approved, buy only when the evidence can change the answer, and cite the result sentence by sentence.</p> : <><p>For finance analysts deciding which paywalled research is worth buying. You control approved sources, the budget, and every purchase. Premium access requires explicit approval.</p><div className="start-steps" aria-label="Research workflow"><span>Question</span><span className="start-step-arrow" aria-hidden="true">→</span><span>Websites</span><span className="start-step-arrow" aria-hidden="true">→</span><span>Evidence</span></div></>}</div>
          <div className="start-layout"><div className="start-main"><div className="conversation"><ChatBubble role="assistant">{chatStarted ? <>Good starting point. I’ve captured the question. Choose the source profiles I can read and set the research budget before I start.</> : <>I’m useful when the question has a point of view. Try the data-centre sustainability brief, or a risk you need to disprove.</>}</ChatBubble>{chatStarted && <ChatBubble role="user">{question}</ChatBubble>}</div>{!chatStarted && <div className="suggested-starts"><span className="suggested-label">Try a starting point</span><button type="button" onClick={() => beginClarification(suggestedQuestion)}>{suggestedQuestion}<Icon name="arrow" /></button></div>}<Composer value={questionDraft} onChange={setQuestionDraft} onSubmit={() => beginClarification()} placeholder={chatStarted ? 'Add a sharper version of the question…' : 'Ask a question worth investigating…'} /></div><PublisherPicker selected={selectedPublishers} onToggle={togglePublisher} budgetXrp={budgetXrp} onBudgetXrpChange={setBudgetXrp} onStart={() => void startResearch()} busy={busy} showControls={chatStarted} /></div>
        </section>}
        {run && <section className="research-view">
          <div className="research-intro"><div><span className="kicker">Research thread · {run.config.horizon}</span><h1>{run.config.question}</h1><div className="intro-meta"><span>{run.rawSourceCount} retrieved previews · {run.familyCount} evidence families</span><span>{formatXrp(centsToXrp(run.budgetCents))} research budget</span></div></div><div className="intro-actions"><button type="button" className="small-button" onClick={() => void resetToStart()}>New research</button><button type="button" className="small-button" onClick={() => void act('cancel')} disabled={run.dossierReady || busy}>Stop</button></div></div>
          {planDraft ? <PlanReview plan={planDraft} onChange={setPlanDraft} onApprove={() => void approvePlan()} busy={busy} /> : <ResearchPath run={run} dossier={dossier} sources={visibleSources} showAll={showAllSources} onShowAll={() => setShowAllSources(true)} selectedId={selectedId} onOpenSource={(id) => void openSource(id)} onAction={(sourceId, action) => void purchase(sourceId, action)} onSynthesize={() => void synthesize()} busy={busy} synthesisText={synthesisText} synthesisStreaming={synthesisStreaming} />}
        </section>}
      </main>
    </div>
    <footer className={`statusbar ${/unavailable|failed|error/i.test(message) ? 'status-error' : /blocked|waiting|exceeds/i.test(message) ? 'status-warning' : /unlocked|ready|complete|paid/i.test(message) ? 'status-success' : ''}`}><span><span className="status-dot" /> {message}</span><span className="mono">{run ? `${run.events.length} events · ${presentationProviderLabel(run.llm.provider)} · ${presentationSemanticLabel(run.semanticStatus)}` : 'Evidence first · citations stay traceable'}</span></footer>
    {selectedDetail && <EvidenceDrawer source={selectedDetail} onClose={() => { setSelectedDetail(null); setSelectedId(null) }} />}
    {pendingPurchase && <PurchaseConfirmation pending={pendingPurchase} busy={busy} onConfirm={() => void confirmPurchase()} onCancel={() => { if (!busy) { setPendingPurchase(null); setMessage('Purchase review cancelled. No payment or access grant occurred.') } }} />}
    <div className="sr-live" aria-live="polite">{message}</div>
  </div>
}
