import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CURRENT_XRP_BALANCE, DEFAULT_BUDGET_CENTS, MAX_BUDGET_CENTS, MIN_BUDGET_CENTS, QUESTION, XRP_TO_SGD_CENTS, type Claim, type Phase, type ResearchApproach, type ResearchConfig, type ResearchPlanArtifact, type RuntimeStatus, type Source } from './domain'
import { createResearchPlan } from './research-plan'
import { ActivityFeed, ApprovalModal, BudgetSummary, Disclosure, EvidenceDrawer as EvidenceDrawerShell, ProgressPanel, SourceProfileList, SourceRow, StepHeader } from './ui'
import { clearSetupDraft, GuidedSetup, GuidedStepProgress, loadSetupDraft, persistSetupDraft, type SetupDraft, type SetupStep } from './ui/setup'

type Brief = { principal:string; audience:string; question:string; deliverable:string; budgetCents:number; autoBuyMaxPerSourceCents:number; sourceAboveThreshold:string; horizon:number; mode:string; sourcePolicy?:string; sourceAllowlist?: string[] }
type ScopeDecision = { status:'SUPPORTED'|'UNSUPPORTED'; label:string; question:string; supportedScope:string; message:string; safeNextAction:string }
type ServerState = { runId:string; phase:Phase; paused:boolean; cancelled:boolean; planApproved?:boolean; budgetCents:number; spentCents:number; remainingCents:number; rawSourceCount:number; familyCount:number; gap:{question:string; importance:string; state:string}; thesis:{open:string; afterNorthstar?:string; afterMeridian?:string; current:string}; claims:Claim[]; events:{id:string; type:string; label:string; at:string}[]; dossierReady:boolean; dossier?:Dossier; llm:{provider:string; status:string; model:string}; semanticStatus:string; runtime:RuntimeStatus; scope?:ScopeDecision; plan?:ResearchPlanArtifact; purchasePlan?:{sourceId:string; reason:string; gap:string; provider:'groq'|'fixture'; model:string; status:'LIVE'|'FIXTURE'|'FALLBACK'}; config:ResearchConfig; sources:Source[] }
type PurchaseDecisionResponse = { action:NonNullable<ServerState['purchasePlan']>; state:ServerState }
type Scenario = { scenarioId:string; runtime:RuntimeStatus; brief:Brief; sources:Source[] }
type Dossier = { mode?:string; title:string; conclusion:string; changedAfterPaidResearch:{before:string; afterNorthstar?:string; after:string}; afterLabel?:string; claims:Claim[]; uncertainty:string; sourceLedger:{publisher:string; priceCents:number; decision:string; family:string; authority:string; originality:string; access:string}[]; method:string; provider?:string; model?:string; status?:string }
type SourceDetail = Source & { premium?:{status:string; protocol?:string; x402Version?:number; contentHash?:string; quoteHash?:string; invoiceId?:string; resourceId?:string; resourceVersionHash?:string; expiresAt?:string; network?:string; payTo?:string|null; amountCents?:number; amountDrops?:number; settlement?:string; runtimeLabel?:string} }
type SourceType = 'primary' | 'public' | 'independent' | 'specialist'
type PendingPurchase = { sourceId:string; source:Source; detail:SourceDetail; budgetCents:number; spentCents:number; remainingCents:number }
type AnswerReadiness = { ready:boolean; reason:string; sources:Source[] }
type WorkspaceTab = 'overview' | 'sources' | 'activity'
type PurchaseOutcome = 'REVIEW' | 'EXPIRED' | 'BLOCKED' | 'UNKNOWN' | 'ACCESS_ERROR'

const money = (cents:number) => `S$${(cents / 100).toFixed(2)}`
const formatXrp = (xrp:number) => `${xrp.toFixed(2)} XRP`
const dropsToXrp = (drops:number) => drops / 1_000_000
const xrpToCents = (xrp:number) => Math.round(xrp * XRP_TO_SGD_CENTS)
const centsToXrp = (cents:number) => cents / XRP_TO_SGD_CENTS
const DEFAULT_BUDGET_XRP = DEFAULT_BUDGET_CENTS / XRP_TO_SGD_CENTS
const presentationRuntimeLabel = (runtime?: RuntimeStatus) => runtime?.mode === 'live' ? runtime.label : 'FIXTURE RESEARCH · SYNTHETIC CORPUS'
const presentationSettlementLabel = (runtime?: RuntimeStatus) => runtime?.mode === 'live' ? (runtime.settlement === 'VALIDATED' ? 'XRPL Testnet · validated transaction' : 'XRPL Testnet configured · not yet validated') : 'Fixture payment simulation · no real publisher payment'
const presentationProviderLabel = (provider?: string) => provider === 'groq' ? 'Groq synthesis' : 'Deterministic fixture synthesis'
const presentationSemanticLabel = (status?: string) => status === 'precomputed' ? 'precomputed deterministic ranking' : status ?? 'ranking unavailable'
class ApiRequestError extends Error {
  constructor(message:string, readonly data:Record<string, unknown>) { super(message) }
}
const api = async <T,>(path:string, options?:RequestInit):Promise<T> => {
  const response = await fetch(path, { headers:{ 'Content-Type':'application/json', ...(options?.headers ?? {}) }, ...options })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new ApiRequestError(typeof data.error === 'string' ? data.error : 'Request failed', data)
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

function accessibleEvidence(source:Source) {
  const spans = source.evidenceSpans?.filter((span) => Boolean(typeof span.id === 'string' && span.id.trim() && typeof span.text === 'string' && span.text.trim())) ?? []
  if (source.accessTier === 'OPEN') return spans
  if (source.decision === 'BUY') return spans
  return []
}

function answerReadiness(run:ServerState): AnswerReadiness {
  if (run.scope?.status === 'UNSUPPORTED') return { ready:false, reason:'This question is outside the supported fixture scope. No cited answer can be assembled.', sources:[] }
  if (run.cancelled || run.phase === 'CANCELLED') return { ready:false, reason:'This research run was stopped. Start a new run before assembling an answer.', sources:[] }
  if (!run.sources.length) return { ready:false, reason:'No approved sources are available, so there is no evidence to cite.', sources:[] }
  if (!run.thesis.current?.trim()) return { ready:false, reason:'The research thesis is incomplete, so no answer can be assembled yet.', sources:[] }
  const sources = run.sources.filter((source) => accessibleEvidence(source).length > 0)
  if (!sources.length) return { ready:false, reason:'No readable evidence spans are available yet. The premium previews remain protected until separately approved.', sources }
  if (run.dossierReady && !run.claims.length) return { ready:false, reason:'The answer has no cited claims. It remains limited until the synthesis provides grounded evidence.', sources }
  const knownIds = new Set(sources.map((source) => source.id))
  const claimsAreCitable = run.claims.every((claim) => Boolean(claim.text?.trim()) && claim.sourceIds.length > 0 && claim.sourceIds.every((sourceId) => knownIds.has(sourceId)) && claim.spanIds.length > 0 && claim.spanIds.every((spanId) => sources.some((source) => accessibleEvidence(source).some((span) => span.id === spanId))))
  if (!claimsAreCitable) return { ready:false, reason:'The current claims do not have complete, readable citations. The answer is limited until each claim is grounded in an accessible evidence span.', sources }
  return { ready:true, reason:'Readable evidence spans are available and can be cited.', sources }
}

function Badge({ children, tone = 'neutral' }:{ children:ReactNode; tone?:string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Icon({ name }:{ name:'arrow'|'check'|'lock'|'send'|'plus'|'close' }) {
  const glyph = { arrow:'↗', check:'✓', lock:'▣', send:'↑', plus:'+', close:'×' }[name]
  return <span className={`icon icon-${name}`} aria-hidden="true">{glyph}</span>
}

function ScopeNotice({ scope, onEdit, onUseCanonical }:{ scope:ScopeDecision; onEdit:(question:string)=>void; onUseCanonical:()=>void }) {
  const [value, setValue] = useState(scope.question)
  return <section className="workbench-card evidence-empty" role="alert" aria-labelledby="scope-notice-title"><span className="kicker">Question boundary</span><h1 id="scope-notice-title">{scope.label}</h1><p><strong>{scope.message}</strong></p><p className="brief-question">“{scope.question}”</p><dl className="detail-list"><div><dt>Supported fixture scope</dt><dd>{scope.supportedScope}</dd></div><div><dt>Safe next action</dt><dd>{scope.safeNextAction}</dd></div><div><dt>Corpus</dt><dd>Synthetic fixture corpus only; no live websites were searched.</dd></div></dl><label><span>Edit this question</span><textarea aria-label="Edit unsupported research question" value={value} onChange={(event) => setValue(event.target.value)} rows={3} /></label><div className="drawer-actions"><button type="button" className="small-button" onClick={() => onEdit(value)} disabled={!value.trim()}>Edit question</button><button type="button" className="primary-button" onClick={onUseCanonical}>Use supported fixture question <Icon name="arrow" /></button></div></section>
}

const approachOptions: { value:ResearchApproach; label:string; description:string }[] = [
  { value:'BALANCED_DILIGENCE', label:'Balanced diligence', description:'Collect support, challenges, and independent corroboration.' },
  { value:'THESIS_STRESS_TEST', label:'Thesis stress test', description:'Prioritize contradictory evidence and the risks that could break the thesis.' },
  { value:'BUDGET_FIRST_SCAN', label:'Budget-first scan', description:'Build an open baseline first and spend only when a material gap remains.' },
]

function PlanReview({ plan, onChange, onApprove, onBack, onSaveDraft, busy }:{ plan:ResearchPlanArtifact; onChange:(plan:ResearchPlanArtifact)=>void; onApprove:()=>void; onBack:()=>void; onSaveDraft:()=>void; busy:boolean }) {
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
    <GuidedStepProgress current="review" />
    <div className="step-copy"><span className="kicker">Step 4 · plan checkpoint</span><h1 id="plan-review-title">Review the research plan</h1><p>The agent will not search, read, spend, or unlock evidence until you approve this plan. Premium purchases remain a separate approval.</p></div>
    <section className="plan-summary" aria-label="Readable research plan summary"><div><span className="kicker">Question</span><strong>{plan.config.question}</strong></div><div><span className="kicker">Decision</span><strong>{plan.config.decision || 'Decision framing will be confirmed before synthesis.'}</strong></div><div><span className="kicker">Authority</span><strong>{money(plan.config.budgetCents)} maximum · {plan.config.sourceAllowlist?.length ?? 0} approved profiles</strong></div><p>Approving this plan starts research under the server-owned source boundary. It does not buy an article or grant premium access.</p></section>
    <fieldset className="plan-approaches"><legend>Research approach</legend><div className="publisher-grid">{approachOptions.map((option) => <label className={`publisher-option ${plan.approach === option.value ? 'is-selected' : ''}`} key={option.value}><input type="radio" name="research-approach" value={option.value} checked={plan.approach === option.value} onChange={() => selectApproach(option.value)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset>
    <Disclosure summary="Advanced plan fields and stop conditions">
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
    </Disclosure>
    <div className="plan-review-footer"><div><p><strong>Approval is explicit.</strong> This confirms the plan only. Premium article purchases require a separate exact-quote approval.</p><div className="setup-actions-primary"><button type="button" className="small-button" onClick={onBack} disabled={busy}>Back to budget</button><button type="button" className="small-button" onClick={onSaveDraft} disabled={busy}>Save draft</button></div></div><button type="button" className="primary-button" aria-busy={busy} onClick={onApprove} disabled={busy || !valid}>{busy ? 'Approving plan…' : 'Approve plan & start research'} <Icon name="arrow" /></button></div>
  </section>
}

function SourceItem({ source, selected, onOpen, onAction, busy }:{ source:Source; selected:boolean; onOpen:()=>void; onAction:(action:'BUY'|'SKIP'|'BLOCKED')=>void; busy:boolean }) {
  const decision = source.decision
  const actionLabel = source.id === 'circuit-note' ? 'Skip' : source.id === 'gridscope-asia' ? 'Block' : 'Approve purchase'
  return <SourceRow selected={selected}>
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
      {!decision && source.accessTier === 'PREMIUM' && <button type="button" className={`text-action ${source.id === 'gridscope-asia' ? 'danger' : source.id === 'circuit-note' ? 'quiet' : ''}`} onClick={() => onAction(source.id === 'circuit-note' ? 'SKIP' : source.id === 'gridscope-asia' ? 'BLOCKED' : 'BUY')} disabled={busy}>{actionLabel}{source.id === 'gridscope-asia' ? '' : ` ${money(source.priceCents)}`}</button>}
    </div>
  </SourceRow>
}

function EvidenceDrawerPanel({ source, focusSpanId, onClose }:{ source:SourceDetail; focusSpanId?:string|null; onClose:()=>void }) {
  const locked = source.accessTier === 'PREMIUM' && source.decision !== 'BUY'
  const fixtureQuote = !source.premium?.network || source.premium.network === 'fixture'
  const visibleSpans = focusSpanId ? source.evidenceSpans?.filter((span) => span.id === focusSpanId) : source.evidenceSpans
  return <EvidenceDrawerShell kicker="Evidence inspection" title={source.publisher} onClose={onClose} closeLabel="Close evidence drawer">
        <Badge tone={locked ? 'warning' : source.accessTier === 'OPEN' ? 'neutral' : 'success'}>{source.accessTier === 'OPEN' ? 'Open evidence' : locked ? 'Premium preview' : 'Premium · unlocked'}</Badge>
        <h3>{source.title}</h3><p className="drawer-preview">{source.preview}</p>
        <dl className="detail-list">
          <div><dt>Evidence family</dt><dd>{source.familyLabel}<small>{source.originality} · {source.trustNote}</small></dd></div>
          <div><dt>Corpus</dt><dd>Synthetic fixture corpus<small>Fixture evidence is not a claim that the source text is true.</small></dd></div>
          <div><dt>Retrieval score</dt><dd className="mono">{source.relevance} / 100<small>Price never affects relevance.</small></dd></div>
          <div><dt>Gap match</dt><dd className="mono">{source.gapMatch} / 100<small>How directly this source answers the active gap.</small></dd></div>
          <div><dt>Terms</dt><dd>{source.priceCents ? `${money(source.priceCents)} exact resource quote` : 'Open / no payment required'}<small>Access is governed by the terms shown here.</small></dd></div>
        </dl>
        {locked && <div className="locked-evidence"><Icon name="lock" /><div><strong>Full text is protected</strong><p>Only metadata, preview, price, and terms are visible before purchase. This preview cannot be cited as read.</p><p className="mono">{fixtureQuote ? 'Fixture quote · payment simulation only' : 'XRPL Testnet quote · validation required'} · {source.xrpDrops?.toLocaleString() ?? '—'} drops · {fixtureQuote ? 'No real publisher payment' : 'Validated only after a verified transaction'}</p></div></div>}
        <Disclosure summary="About fixture evidence"><p>Fixture evidence is a deterministic local corpus for this run. It is not a claim that the source text is true, and it cannot grant access to protected content.</p></Disclosure>
        {visibleSpans && <section className="span-section"><h3>{focusSpanId ? 'Cited evidence span' : 'Accessible evidence spans'}</h3>{visibleSpans.length ? visibleSpans.map((span) => <blockquote key={span.id} id={span.id}><span className="kicker">{span.label} · {span.id}</span><p>“{span.text}”</p></blockquote>) : <p role="alert">The requested citation span is not available for this source.</p>}</section>}
  </EvidenceDrawerShell>
}

function PurchaseConfirmation({ pending, busy, outcome, onConfirm, onCancel, onRecover }:{ pending:PendingPurchase; busy:boolean; outcome:PurchaseOutcome; onConfirm:()=>void; onCancel:()=>void; onRecover:()=>void }) {
  const quote = pending.detail.premium
  const exact = (value:unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
  const fixtureQuote = !quote?.network || quote.network === 'fixture'
  const outcomeCopy:Record<Exclude<PurchaseOutcome, 'REVIEW'>, { title:string; body:string }> = {
    EXPIRED: { title:'Quote expired', body:'This exact quote is no longer valid. No payment or access grant occurred. Close this review and inspect the source again for a fresh quote.' },
    BLOCKED: { title:'Purchase blocked', body:'The server blocked this purchase because it exceeds the remaining cap or the per-source ceiling. No payment or access grant occurred.' },
    UNKNOWN: { title:'Outcome pending — do not retry', body:'The request outcome could not be confirmed. Do not submit another payment. Close this review and inspect the source or receipt before taking any recovery action.' },
    ACCESS_ERROR: { title:'Access recovery required', body:'Settlement and protected access are separate. The source was not marked as readable here; inspect the purchase receipt before requesting recovery.' },
  }
  return <ApprovalModal kicker="Manual approval required" title="Confirm this purchase" onCancel={onCancel} busy={busy}>
       <Badge tone="warning">Nothing has been purchased</Badge><h3>{pending.source.title}</h3><p className="drawer-preview">Review the exact quote binding below. Access is granted only after you explicitly confirm this purchase.</p>
        {outcome !== 'REVIEW' && <div className={`purchase-outcome purchase-outcome-${outcome.toLowerCase()}`} role="alert"><strong>{outcomeCopy[outcome].title}</strong><p>{outcomeCopy[outcome].body}</p></div>}
        <dl className="detail-list">
          <div><dt>Exact amount</dt><dd>{formatXrp(dropsToXrp(Number(quote?.amountDrops ?? pending.source.xrpDrops ?? 0)))} · {money(Number(quote?.amountCents ?? pending.source.priceCents))}<small>Quote-bound XRP amount and SGD approximation.</small></dd></div>
          <div><dt>Budget after approval</dt><dd>{formatXrp(centsToXrp(pending.remainingCents - Number(quote?.amountCents ?? pending.source.priceCents)))} remaining · {money(pending.remainingCents - Number(quote?.amountCents ?? pending.source.priceCents))}<small>Current remaining {formatXrp(centsToXrp(pending.remainingCents))}; cap {formatXrp(centsToXrp(pending.budgetCents))}.</small></dd></div>
          <div><dt>Settlement mode</dt><dd>{fixtureQuote ? 'Fixture payment simulation' : 'XRPL Testnet validation'}<small>{fixtureQuote ? 'No real publisher payment will occur.' : 'Unlock follows only after a validated Testnet transaction.'}</small></dd></div>
          <div><dt>Invoice</dt><dd className="mono">{exact(quote?.invoiceId)}</dd></div><div><dt>Resource</dt><dd className="mono">{exact(quote?.resourceId)}</dd></div><div><dt>Payee</dt><dd className="mono">{exact(quote?.payTo)}<small>{quote?.payTo ? 'Exact destination in this quote.' : 'No external settlement in this mode.'}</small></dd></div><div><dt>Network</dt><dd className="mono">{exact(quote?.network)}</dd></div><div><dt>Resource version hash</dt><dd className="mono">{exact(quote?.resourceVersionHash)}</dd></div><div><dt>Expires</dt><dd className="mono">{exact(quote?.expiresAt)}</dd></div><div><dt>Quote hash</dt><dd className="mono">{exact(quote?.quoteHash)}</dd></div><div><dt>Protocol</dt><dd className="mono">{exact(quote?.protocol)} · version {exact(quote?.x402Version)}</dd></div>
        </dl>
        <div className="locked-evidence"><Icon name="lock" /><div><strong>Explicit confirmation is required</strong><p>This approval is bound to the invoice, resource, payee, network, resource version hash, expiry, and quote hash shown above.</p></div></div>
         <div className="drawer-actions"><button type="button" className="small-button" onClick={onCancel} disabled={busy}>Cancel</button>{outcome !== 'REVIEW' && <button type="button" className="small-button" onClick={onRecover} disabled={busy}>Inspect receipt / access status</button>}<button type="button" className="primary-button" onClick={onConfirm} disabled={busy || outcome !== 'REVIEW' || !quote?.quoteHash}>{busy ? 'Confirming…' : outcome === 'REVIEW' ? `Confirm purchase ${money(Number(quote?.amountCents ?? pending.source.priceCents))}` : 'Close and inspect status'} <Icon name="arrow" /></button></div>
   </ApprovalModal>
}

function BudgetCard({ run }:{ run:ServerState }) {
  const spentPercent = Math.min(100, (run.spentCents / run.budgetCents) * 100)
  return <BudgetSummary spentLabel={formatXrp(centsToXrp(run.spentCents))} totalLabel={`≈ ${money(run.spentCents)} of ${formatXrp(centsToXrp(run.budgetCents))}`} remainingLabel={formatXrp(centsToXrp(run.remainingCents))} percent={spentPercent} note={<>XRP is the working currency. Approximate SGD value uses 1 XRP ≈ S$10.00. The agent cannot exceed the mandate or buy a source above S$1.00.</>} />
}

function PersistentBudgetStrip({ run }:{ run:ServerState }) {
  const remaining = formatXrp(centsToXrp(run.remainingCents))
  return <section className="budget-strip" aria-label="Persistent research budget"><div><span className="kicker">Research budget</span><strong>Cap {formatXrp(centsToXrp(run.budgetCents))} · Spent {formatXrp(centsToXrp(run.spentCents))} · Remaining {remaining}</strong></div><span className="budget-strip-approx">≈ {money(run.remainingCents)} remaining · 1 XRP ≈ S$10.00</span></section>
}

function BriefCard({ run }:{ run:ServerState }) {
  const allowlist = run.config.sourceAllowlist ?? []
  return <section className="workbench-card brief-card" aria-labelledby="brief-title"><div className="workbench-card-head"><div><span className="kicker">Research brief</span><h2 id="brief-title">The question in scope</h2></div><Badge tone="success">Confirmed</Badge></div><p className="brief-question">{run.config.question}</p><dl className="brief-details"><div><dt>Decision</dt><dd>{run.config.decision}</dd></div><div><dt>Horizon</dt><dd>{run.config.horizon}</dd></div><div><dt>Sources</dt><dd>{allowlist.length} source profiles</dd></div><div><dt>Corpus</dt><dd>Synthetic fixture corpus</dd></div><div><dt>Runtime</dt><dd>{presentationRuntimeLabel(run.runtime)}</dd></div><div><dt>Settlement</dt><dd>{presentationSettlementLabel(run.runtime)}</dd></div><div><dt>Access</dt><dd>Budget-controlled</dd></div><div><dt>Approval</dt><dd>Manual approval required</dd></div></dl><div className="brief-boundary"><span className="kicker">Search boundary</span><p>The agent can read only the approved source profiles, and every premium purchase requires explicit approval.</p><div className="brief-sites">{allowlist.map((key) => <span className="brief-site" key={key}>{publisherOptions.find((option) => option.id === key)?.label ?? key}</span>)}</div></div></section>
}

function EvidenceGapCard({ run }:{ run:ServerState }) {
  const stateTone = run.gap.state === 'RESOLVED' ? 'success' : run.gap.state === 'PARTIAL' ? 'warning' : 'neutral'
  return <section className="gap-card workbench-card" aria-labelledby="gap-title"><div className="workbench-card-head"><div><span className="kicker">Evidence gap</span><h2 id="gap-title">What could still change the answer</h2></div><Badge tone={stateTone}>{run.gap.state.toLowerCase()}</Badge></div><p>{run.gap.question}</p><div className="gap-detail"><span className="kicker">Importance</span><strong>{run.gap.importance}</strong></div></section>
}

function ActivityRail({ run, dossier, busy, onSynthesize }:{ run:ServerState; dossier:Dossier|null; busy:boolean; onSynthesize:()=>void }) {
  const source = run.sources.find((item) => item.id === run.purchasePlan?.sourceId)
  const premiumUnlocked = run.sources.some((item) => item.accessTier === 'PREMIUM' && item.decision === 'BUY')
  const readiness = answerReadiness(run)
  const path = [
    { number:'1', label:'Search', detail:`${run.rawSourceCount} previews · ${run.familyCount} families`, state:'Complete', complete:true },
    { number:'2', label:'Premium option', detail:source?.decision === 'BUY' ? `${source.publisher} unlocked` : source ? `${source.publisher} remains optional` : 'No premium purchase required', state:premiumUnlocked ? 'Complete' : 'Optional', complete:premiumUnlocked },
    { number:'3', label:'Answer', detail:dossier ? 'Cited memo is ready' : readiness.ready ? 'Open evidence is ready' : 'Limited until evidence is citable', state:dossier ? 'Ready' : readiness.ready ? 'Ready' : 'Limited', complete:Boolean(dossier) },
  ]
  return <ActivityFeed><section className="activity-card" aria-labelledby="activity-title"><div className="workbench-card-head"><div><span className="kicker">Activity</span><h2 id="activity-title">Research path</h2></div><span className="mono activity-count">{run.events.length} events</span></div><ProgressPanel items={path} /></section><BudgetCard run={run} /><section className="activity-card purchase-card" aria-labelledby="purchase-summary-title"><div className="workbench-card-head"><div><span className="kicker">Agent decision</span><h2 id="purchase-summary-title">Premium recommendation</h2></div><Badge tone={premiumUnlocked ? 'success' : readiness.ready ? 'neutral' : 'warning'}>{premiumUnlocked ? 'Verified' : readiness.ready ? 'Optional' : 'Limited'}</Badge></div><AgentActionStep run={run} />{!dossier && <><button type="button" className="primary-button activity-cta" onClick={onSynthesize} disabled={busy || !readiness.ready}>{busy ? 'Assembling…' : 'Answer from available evidence'} <Icon name="arrow" /></button><p className="answer-readiness" role="status">{readiness.reason}</p></>}</section><section className="activity-card event-card" aria-labelledby="event-title"><div className="workbench-card-head"><div><span className="kicker">Trace</span><h2 id="event-title">Latest activity</h2></div></div><ol className="event-list">{run.events.slice(-5).reverse().map((event) => <li key={event.id}><span className="event-dot" aria-hidden="true" /><span>{event.label}</span></li>)}</ol></section></ActivityFeed>
}

function citationLabel(id:string) {
  const labels:Record<string,string> = { 'company-capex':'Vertex Compute', 'energy-dataset':'EMA data', 'northstar-wire':'Northstar Wire', 'meridian-ledger':'Grid Operators Report', 'gridscope-asia':'GridScope Asia', 'circuit-note':'Circuit Note', 'treasury-volatility':'Harbour Rates Wire', 'term-premium-desk':'Term Premium Desk', 'credit-spread-watch':'Credit Spread Watch', 'auction-absorption':'Auction Flow Review', 'real-yield-tracker':'Real Yield Tracker', 'fiscal-monitor':'Fiscal Monitor', 'central-bank-minutes':'Policy Archive', 'duration-allocator':'Allocator Notes' }
  return labels[id] ?? id
}

type CitationTarget = { sourceId:string; spanId:string }

function citationTargets(claim:Claim): CitationTarget[] {
  return claim.spanIds.map((spanId, index) => ({ sourceId: claim.sourceIds[index] ?? claim.sourceIds[0], spanId }))
}

function Citations({ targets, onOpen }:{ targets:CitationTarget[]; onOpen:(sourceId:string, spanId:string)=>void }) {
  return <span className="inline-citations" aria-label="Citations">{targets.map(({ sourceId, spanId }) => <button type="button" key={`${sourceId}:${spanId}`} aria-label={`Open citation: ${citationLabel(sourceId)} · ${spanId}`} onClick={() => onOpen(sourceId, spanId)}>[{citationLabel(sourceId)} · {spanId}]</button>)}</span>
}

function sourceQuote(sources:Source[], target:CitationTarget) {
  const source = sources.find((item) => item.id === target.sourceId)
  const span = source?.evidenceSpans?.find((item) => item.id === target.spanId)
  return span?.text ?? source?.preview ?? 'Excerpt available after the exact resource is unlocked.'
}

function QuoteStrip({ targets, sources, onOpen }:{ targets:CitationTarget[]; sources:Source[]; onOpen:(sourceId:string, spanId:string)=>void }) {
  return <div className="quote-strip">{targets.map((target) => { const source = sources.find((item) => item.id === target.sourceId); const accessible = Boolean(source?.evidenceSpans?.some((span) => span.id === target.spanId)); return <button type="button" key={`${target.sourceId}:${target.spanId}`} onClick={() => onOpen(target.sourceId, target.spanId)} aria-label={`${accessible ? 'Inspect cited evidence' : 'Inspect protected preview'}: ${citationLabel(target.sourceId)} · ${target.spanId}`}><span>{accessible ? `“${sourceQuote(sources, target)}”` : 'Protected preview; accessible text is unavailable until purchase.'}</span><small>{citationLabel(target.sourceId)} · {target.spanId} · {accessible ? 'inspect cited span ↗' : 'protected preview · inspect terms'}</small></button> })}</div>
}

function ClaimBlock({ claim, sources, onOpen }:{ claim:Claim; sources:Source[]; onOpen:(sourceId:string, spanId:string)=>void }) {
  const targets = citationTargets(claim)
  return <article className={`claim-block ${claim.stance.toLowerCase()}`}><p>{claim.text} <Citations targets={targets} onOpen={onOpen} /></p><QuoteStrip targets={targets} sources={sources} onOpen={onOpen} /><div className="claim-meta"><Badge tone={claim.stance === 'SUPPORTS' ? 'success' : claim.stance === 'CHALLENGES' ? 'danger' : 'warning'}>{claim.stance.toLowerCase()}</Badge><span>{claim.familyCount} independent {claim.familyCount === 1 ? 'family' : 'families'}</span></div></article>
}

function WorkingAnswer({ run, onOpenSource }:{ run:ServerState; onOpenSource:(sourceId:string, spanId?:string)=>void }) {
  const readiness = answerReadiness(run)
  if (!readiness.ready) return <section className="answer-panel evidence-empty" aria-labelledby="answer-title"><div className="answer-head"><div><span className="kicker">Working answer</span><h2 id="answer-title">Answer is limited</h2></div><span className="answer-status mono">NOT CITABLE</span></div><p>{readiness.reason}</p><p className="answer-note">Premium previews remain protected; an answer becomes available only when each claim can point to an accessible evidence span.</p></section>
  const fallbackSourceIds = readiness.sources.slice(0, 2).map((source) => source.id)
  const fallbackSpanIds = fallbackSourceIds.map((sourceId) => accessibleEvidence(run.sources.find((source) => source.id === sourceId)!).at(0)!.id)
  const sentences = run.claims.length ? run.claims : [{ id:'working-thesis', text:run.thesis.current, stance:'UNCERTAIN' as const, materiality:'MATERIAL' as const, sourceIds:fallbackSourceIds, familyCount:new Set(readiness.sources.slice(0, 2).map((source) => source.familyId)).size, spanIds:fallbackSpanIds }]
  return <section className="answer-panel" aria-labelledby="answer-title"><div className="answer-head"><div><span className="kicker">Working answer</span><h2 id="answer-title">What the evidence says so far</h2></div><span className="answer-status mono">{run.dossierReady ? 'CITED MEMO READY' : 'OPEN-SOURCE BASELINE'}</span></div><div className="answer-copy">{sentences.map((claim) => { const targets = citationTargets(claim); return <div className="answer-sentence" key={claim.id}><p>{claim.text} <Citations targets={targets} onOpen={onOpenSource} /></p><QuoteStrip targets={targets} sources={run.sources} onOpen={onOpenSource} /></div> })}</div><p className="answer-note">Each citation opens the exact bound evidence span. Premium excerpts are only available after the exact quote is accepted.</p></section>
}

function SynthesisStream({ text, streaming, provider }:{ text:string; streaming:boolean; provider:string }) {
  const live = provider === 'groq'
  return <section className="synthesis-stream" aria-labelledby="synthesis-stream-title"><div className="answer-head"><div><span className="kicker">{live ? 'Groq live synthesis' : 'Deterministic fixture synthesis'}</span><h2 id="synthesis-stream-title">Drafting the cited dossier</h2></div><span className="answer-status mono">{streaming ? (live ? 'STREAMING' : 'ASSEMBLING') : 'COMPLETE'}</span></div><pre aria-live="polite">{text || (live ? 'Waiting for the first Groq token…' : 'Assembling a deterministic answer from accessible synthetic evidence…')}</pre><small>{live ? 'Groq is streaming structured output from the accessible evidence packet.' : 'No external model or live web search is used in fixture synthesis.'} The final dossier is validated before it is published.</small></section>
}

function DossierPanel({ dossier, run, onOpenSource }:{ dossier:Dossier|null; run:ServerState; onOpenSource:(sourceId:string, spanId?:string)=>void }) {
  if (!dossier) return null
  const dossierRuntime = run.runtime.mode === 'live' ? 'XRPL TESTNET RESEARCH' : 'FIXTURE RESEARCH'
  const hasPaidEvidence = run.sources.some((source) => source.accessTier === 'PREMIUM' && source.decision === 'BUY')
  const synthesisLabel = dossier.status === 'FALLBACK' ? 'Provider unavailable · fixture fallback validated locally' : dossier.status === 'FIXTURE' ? 'Deterministic fixture synthesis · validated locally' : dossier.status === 'LIVE' ? 'Provider synthesis · server validated' : 'Validated cited answer'
  return <section className="dossier-panel" id="dossier"><div className="dossier-heading"><div><span className="kicker">Verified dossier · {presentationProviderLabel(dossier.provider)}</span><h2>{dossier.title}</h2><p className="dossier-status" role="status">{synthesisLabel} · citations resolve to accessible evidence spans.</p></div><button type="button" className="small-button light" onClick={() => window.print()}>Print</button></div><div className="dossier-paper"><div className="dossier-kicker">{dossierRuntime} · NOT INVESTMENT ADVICE</div><small>{presentationRuntimeLabel(run.runtime)} · {presentationSettlementLabel(run.runtime)}</small><h3>{dossier.conclusion}</h3><div className="changed-callout"><span className="kicker">{hasPaidEvidence ? 'What changed after paid evidence' : 'Open-source conclusion'}</span><span className="change-line"><b>Open web</b>{dossier.changedAfterPaidResearch.before}</span>{hasPaidEvidence && dossier.changedAfterPaidResearch.afterNorthstar && <span className="change-line"><b>+ Northstar</b>{dossier.changedAfterPaidResearch.afterNorthstar}</span>}<span className="change-line final"><b>{hasPaidEvidence ? (dossier.afterLabel ?? '+ Grid report') : 'Available evidence'}</b>{dossier.changedAfterPaidResearch.after}</span></div><div className="dossier-columns"><div><span className="kicker">Supports the thesis</span>{dossier.claims.filter((claim) => claim.stance === 'SUPPORTS').map((claim) => <ClaimBlock key={claim.id} claim={claim} sources={run.sources} onOpen={onOpenSource} />)}</div><div><span className="kicker">Challenges the thesis</span>{dossier.claims.filter((claim) => claim.stance !== 'SUPPORTS').map((claim) => <ClaimBlock key={claim.id} claim={claim} sources={run.sources} onOpen={onOpenSource} />)}</div></div><div className="dossier-footer"><div><span className="kicker">Key uncertainty</span><p>{dossier.uncertainty}</p></div><div><span className="kicker">Method & limitations</span><p>{dossier.method}</p></div></div></div></section>
}

function EvidenceStep({ run, sources, showAll, onShowAll, selectedId, onOpen, onAction, busy }:{ run:ServerState; sources:Source[]; showAll:boolean; onShowAll:()=>void; selectedId:string|null; onOpen:(id:string)=>void; onAction:(sourceId:string, action:'BUY'|'SKIP'|'BLOCKED')=>void; busy:boolean }) {
  const visible = showAll ? sources : sources.slice(0, 5)
  return <><StepHeader kicker="Retrieved evidence" title={`${sources.length} previews from approved fixture profiles`} description="Only these approved sources were searched. Match score ranks relevance; price is considered separately." summary={`${run.familyCount} evidence families`}><small>Synthetic fixture corpus · {presentationSettlementLabel(run.runtime)}</small></StepHeader><div className="source-filter"><span>Source profiles:</span>{(run.config.sourceAllowlist ?? []).map((key) => <span key={key} className="filter-chip"><i />{publisherOptions.find((option) => option.id === key)?.label ?? key}</span>)}</div>{sources.length === 0 ? <div className="evidence-empty" role="status"><strong>No approved sources matched this question.</strong><p>Broaden the source-profile allowlist or start a new research question to build another evidence map.</p></div> : <><SourceProfileList>{visible.map((source) => <SourceItem key={source.id} source={source} selected={selectedId === source.id} onOpen={() => onOpen(source.id)} onAction={(action) => onAction(source.id, action)} busy={busy} />)}</SourceProfileList>{sources.length > visible.length && <button type="button" className="load-more" onClick={onShowAll}>Show {sources.length - visible.length} more sources <Icon name="arrow" /></button>}</>}</>
}

function AgentActionStep({ run }:{ run:ServerState }) {
  const source = run.sources.find((item) => item.id === run.purchasePlan?.sourceId)
  const paid = source?.decision === 'BUY'
  const runtime = run.runtime ?? { mode:'fixture' as const, label:'FIXTURE RESEARCH' }
  const provider = presentationProviderLabel(run.purchasePlan?.provider)
  return <div className="agent-action-step"><div><span className="kicker">Agent action · {provider}</span><h2>{paid ? 'Bought the report that closes the grid gap.' : source ? 'Premium evidence is optional.' : 'Open evidence is the available baseline.'}</h2><p>{source ? <><strong>{source.title}</strong> from {source.publisher}. {run.purchasePlan?.reason} Review it separately if the open answer leaves a material gap.</> : 'No premium source was recommended for this run. The answer can use only accessible evidence.'}</p><dl className="action-facts"><div><dt>Cost</dt><dd>{source?.priceCents ? `${formatXrp((source.xrpDrops ?? 0) / 1_000_000)} · ≈ ${money(source.priceCents)}` : 'No purchase'}</dd></div><div><dt>Budget left</dt><dd>{formatXrp(centsToXrp(run.remainingCents))} · ≈ {money(run.remainingCents)}</dd></div><div><dt>Result</dt><dd>{paid ? (runtime.mode === 'live' ? 'XRPL Testnet payment validated · unlocked' : 'Fixture payment simulation · unlocked') : 'Not purchased'}</dd></div><div><dt>Runtime</dt><dd>{presentationRuntimeLabel(runtime)}</dd></div></dl><small>{provider} compared source metadata. The server enforced the budget, protected-evidence, and settlement rules. {presentationSettlementLabel(runtime)}</small></div>{source?.payment?.explorerUrl && <a className="primary-button" href={source.payment.explorerUrl} target="_blank" rel="noreferrer">View transaction <Icon name="arrow" /></a>}</div>
}

function ResearchPath({ run, dossier, sources, showAll, onShowAll, selectedId, onOpenSource, onAction, onSynthesize, busy, synthesisText, synthesisStreaming, activeTab, onTabChange }:{ run:ServerState; dossier:Dossier|null; sources:Source[]; showAll:boolean; onShowAll:()=>void; selectedId:string|null; onOpenSource:(sourceId:string, spanId?:string)=>void; onAction:(sourceId:string, action:'BUY'|'SKIP'|'BLOCKED')=>void; onSynthesize:()=>void; busy:boolean; synthesisText:string; synthesisStreaming:boolean; activeTab:WorkspaceTab; onTabChange:(tab:WorkspaceTab)=>void }) {
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement>>>({})
  const jumpTo = (tab:WorkspaceTab) => onTabChange(tab)
  const tabOrder:WorkspaceTab[] = ['overview', 'sources', 'activity']
  const moveTab = (current:WorkspaceTab, direction:number) => {
    const next = tabOrder[(tabOrder.indexOf(current) + direction + tabOrder.length) % tabOrder.length]
    onTabChange(next)
    // Roving tabindex alone changes selection but leaves focus on the old
    // button. Move focus after React commits the selected tab.
    window.setTimeout(() => tabRefs.current[next]?.focus(), 0)
  }
  const answerCta = <><button type="button" className="primary-button activity-cta" onClick={onSynthesize} disabled={busy || !answerReadiness(run).ready}>{busy ? 'Assembling…' : 'Answer from available evidence'} <Icon name="arrow" /></button><p className="answer-readiness" role="status">{answerReadiness(run).reason}</p></>
  return <section className="workbench" aria-label="Evidence workspace" aria-busy={busy}>
    <nav className="workspace-tabs" aria-label="Research workspace tabs" role="tablist" aria-orientation="horizontal">
      {tabOrder.map((tab) => <button key={tab} ref={(element) => { if (element) tabRefs.current[tab] = element }} id={`tab-${tab}`} type="button" role="tab" tabIndex={activeTab === tab ? 0 : -1} aria-controls={`${tab}-panel`} aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => jumpTo(tab)} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveTab(tab, 1) } if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); moveTab(tab, -1) } }}>{tab === 'overview' ? 'Overview' : tab === 'sources' ? `Sources (${sources.length})` : `Activity (${run.events.length})`}</button>)}
    </nav>
    <section id="overview-panel" role="tabpanel" aria-labelledby="tab-overview" tabIndex={0} hidden={activeTab !== 'overview'}>{activeTab === 'overview' && <><PersistentBudgetStrip run={run} /><div className="workspace-summary"><BriefCard run={run} /><EvidenceGapCard run={run} /></div><div className="workbench-main"><WorkingAnswer run={run} onOpenSource={onOpenSource} />{!dossier && <section className="overview-answer-cta" aria-label="Answer action">{answerCta}</section>}{synthesisStreaming && <SynthesisStream text={synthesisText} streaming={synthesisStreaming} provider={run.llm.provider} />}{dossier && <DossierPanel dossier={dossier} run={run} onOpenSource={onOpenSource} />}</div></>}</section>
    <section id="sources-panel" role="tabpanel" aria-labelledby="tab-sources" tabIndex={0} hidden={activeTab !== 'sources'}>{activeTab === 'sources' && <><PersistentBudgetStrip run={run} /><div className="workspace-summary"><BriefCard run={run} /><EvidenceGapCard run={run} /></div><div className="workbench-main"><section className="evidence-panel" id="evidence-panel" aria-labelledby="evidence-panel-title"><div className="evidence-panel-label"><span className="kicker">Search / evidence map</span><span className="mono">{run.phase === 'CANCELLED' ? 'STOPPED' : 'LIVE WORKSPACE'}</span></div><div id="evidence-panel-title"><EvidenceStep run={run} sources={sources} showAll={showAll} onShowAll={onShowAll} selectedId={selectedId} onOpen={onOpenSource} onAction={onAction} busy={busy} /></div></section><section className="sources-answer-cta" aria-label="Answer action">{answerCta}</section></div></>}</section>
    <section id="activity-panel" role="tabpanel" aria-labelledby="tab-activity" tabIndex={0} hidden={activeTab !== 'activity'}>{activeTab === 'activity' && <><PersistentBudgetStrip run={run} /><ActivityRail run={run} dossier={dossier} busy={busy} onSynthesize={onSynthesize} /></>}</section>
  </section>
}

export default function App() {
  const [savedDraft, setSavedDraft] = useState<SetupDraft|null>(() => loadSetupDraft())
  const initialSavedPlanDraft = useRef(savedDraft?.planDraft)
  const [draftActive, setDraftActive] = useState(() => savedDraft === null)
  const [setupStep, setSetupStep] = useState<SetupStep>(() => savedDraft?.step ?? 'question')
  const [scenario, setScenario] = useState<Scenario|null>(null)
  const [run, setRun] = useState<ServerState|null>(null)
  const [scopeRejection, setScopeRejection] = useState<ScopeDecision|null>(null)
  const [planDraft, setPlanDraft] = useState<ResearchPlanArtifact|null>(null)
  const [question, setQuestion] = useState(() => savedDraft?.question ?? '')
  const [questionDraft, setQuestionDraft] = useState(() => savedDraft?.question ?? '')
  const [budgetXrp, setBudgetXrp] = useState(() => savedDraft?.budgetXrp ?? DEFAULT_BUDGET_XRP)
  const [selectedPublishers, setSelectedPublishers] = useState<PublisherKey[]>(() => {
    const draftSelection = savedDraft?.selectedPublishers.filter((key): key is PublisherKey => publisherOptions.some((option) => option.id === key))
    return draftSelection?.length ? draftSelection : publisherOptions.map((option) => option.id)
  })
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [selectedSpanId, setSelectedSpanId] = useState<string|null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SourceDetail|null>(null)
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase|null>(null)
  const [dossier, setDossier] = useState<Dossier|null>(null)
  const [synthesisText, setSynthesisText] = useState('')
  const [synthesisStreaming, setSynthesisStreaming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Ready when you are.')
  const [showAllSources, setShowAllSources] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview')
  const [purchaseOutcome, setPurchaseOutcome] = useState<PurchaseOutcome>('REVIEW')
  const purchaseTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    document.title = 'ResearchAgent — Deep research'
    api<Scenario>('/api/v1/scenarios/data-centre-2028').then(setScenario).catch(() => setMessage('Backend unavailable. Start the research service to continue.'))
  }, [])

  // The server is the source of truth for an active run. A reload must either
  // restore that run or clearly return to setup; it must never silently create
  // a second run or discard a purchase/access decision.
  useEffect(() => {
    const runId = window.localStorage.getItem('researchagent.active-run.v1')
    if (!runId) return
    let disposed = false
    api<ServerState>(`/api/v1/research-runs/${runId}`).then((restored) => {
      if (disposed) return
      setRun(restored)
      // An unapproved plan may contain local edits that the server has not
      // received yet. Resume the complete saved draft when present, while
      // retaining the server plan as the safe fallback for older drafts.
      setPlanDraft(restored.planApproved ? null : initialSavedPlanDraft.current ?? restored.plan ?? null)
      setDossier(restored.dossier ?? null)
      setWorkspaceTab('overview')
      setMessage(restored.cancelled ? 'This research run is stopped and read-only.' : 'Research run restored from the server.')
    }).catch(() => window.localStorage.removeItem('researchagent.active-run.v1'))
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    if (!run?.runId) return
    const stream = new EventSource(`/api/v1/research-runs/${run.runId}/stream`)
    const readPayload = (event:Event) => { try { return JSON.parse((event as MessageEvent<string>).data) as Record<string, unknown> } catch { return {} } }
    stream.addEventListener('PLAN_CREATED', () => setMessage('Scope accepted. I’m building the evidence map.'))
    stream.addEventListener('PURCHASE_BLOCKED', () => setMessage('GridScope blocked: S$1.40 exceeds the remaining S$1.00.'))
    stream.addEventListener('DOSSIER_SYNTHESIS_STARTED', (event) => { const label = readPayload(event).label; setSynthesisText(''); setSynthesisStreaming(true); setMessage(typeof label === 'string' ? label : 'Cited dossier synthesis started…') })
    stream.addEventListener('DOSSIER_TOKEN', (event) => { const delta = readPayload(event).delta; if (typeof delta === 'string') { setSynthesisStreaming(true); setSynthesisText((current) => current + delta) } })
    stream.addEventListener('DOSSIER_SYNTHESIS_COMPLETED', (event) => { const label = readPayload(event).label; setSynthesisStreaming(false); setMessage(typeof label === 'string' ? label : 'Dossier complete. Claims and evidence spans were validated.') })
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
      clearSetupDraft()
       window.localStorage.removeItem('researchagent.active-run.v1'); setSavedDraft(null); setDraftActive(true); setSetupStep('question'); setRun(null); setScopeRejection(null); setPlanDraft(null); setDossier(null); setSynthesisText(''); setSynthesisStreaming(false); setQuestion(''); setQuestionDraft(''); setBudgetXrp(DEFAULT_BUDGET_XRP); setSelectedPublishers(publisherOptions.map((option) => option.id)); setSelectedId(null); setSelectedSpanId(null); setSelectedDetail(null); setPendingPurchase(null); setPurchaseOutcome('REVIEW'); setWorkspaceTab('overview'); setMessage('Ready when you are.'); window.scrollTo({ top:0, behavior:'smooth' })
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  const saveDraft = () => {
    const draft: SetupDraft = { version:1, question:question.trim(), selectedPublishers:[...selectedPublishers], budgetXrp, step:setupStep, updatedAt:new Date().toISOString(), ...(planDraft ? { planDraft } : {}) }
    persistSetupDraft(draft); setSavedDraft(draft); setDraftActive(true); setMessage('Draft saved locally. No research, purchase, or charge occurred.')
  }
  const resumeDraft = () => { setDraftActive(true); setMessage('Draft restored. Continue from the saved setup step.') }
  const discardDraft = () => { clearSetupDraft(); setSavedDraft(null); setDraftActive(true); setSetupStep('question'); setQuestion(''); setQuestionDraft(''); setBudgetXrp(DEFAULT_BUDGET_XRP); setSelectedPublishers(publisherOptions.map((option) => option.id)); setMessage('Saved draft discarded. Start a fresh setup when ready.') }
  const beginQuestion = (value = questionDraft) => { const next = value.trim(); if (!next) return; setQuestion(next); setQuestionDraft(next); setSetupStep('sources'); setDraftActive(true); setMessage('Question captured. Choose the source profiles the agent may read.') }
  const editUnsupportedQuestion = (value:string) => { const next = value.trim(); if (!next) return; window.localStorage.removeItem('researchagent.active-run.v1'); setRun(null); setScopeRejection(null); setPlanDraft(null); setDossier(null); setSelectedDetail(null); setSelectedId(null); setSelectedSpanId(null); setPendingPurchase(null); setQuestion(next); setQuestionDraft(next); setSetupStep('sources'); setDraftActive(true); setMessage('Question updated. Confirm the source boundary and budget before research starts.') }
  const togglePublisher = (key:PublisherKey) => setSelectedPublishers((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])

  const startResearch = async () => {
    if (busy || !question.trim() || selectedPublishers.length === 0) return
    setBusy(true)
    try {
      const isCanonicalDemo = question.trim() === QUESTION
      const created = await api<ServerState>('/api/v1/research-runs', { method:'POST', body:JSON.stringify({ question, decision:isCanonicalDemo ? 'Inform the next research decision' : '', horizon:isCanonicalDemo ? 'Through 2028' : '', tokenLimit:64000, budgetCents:xrpToCents(budgetXrp), sourceTypes, sourceAllowlist:selectedPublishers }) })
      setScopeRejection(null)
      setRun(created)
      const initialPlan = created.plan ?? createResearchPlan('BALANCED_DILIGENCE', { ...created.config, sourceAllowlist:selectedPublishers })
      setPlanDraft(created.scope?.status === 'UNSUPPORTED' ? null : initialPlan)
      clearSetupDraft(); setSavedDraft(null); window.localStorage.setItem('researchagent.active-run.v1', created.runId)
      setMessage(created.scope?.status === 'UNSUPPORTED' ? created.scope.message : 'Research plan ready. Review and approve it before the agent starts.')
      window.scrollTo({ top:0, behavior:'auto' })
    } catch (error) {
      const scope = error instanceof ApiRequestError ? error.data.scope : undefined
      if (scope && typeof scope === 'object' && (scope as ScopeDecision).status === 'UNSUPPORTED') setScopeRejection(scope as ScopeDecision)
      setMessage((error as Error).message)
    } finally { setBusy(false) }
  }

  const continueSetup = () => {
    if (setupStep === 'question') { beginQuestion(); return }
    if (setupStep === 'sources') { if (selectedPublishers.length === 0) return; setSetupStep('budget'); setMessage('Source boundary saved. Set the maximum research spend before review.'); return }
    void startResearch()
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
      setWorkspaceTab('overview')
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

  const stopResearch = async () => {
    if (!run || busy || run.cancelled) return
    setBusy(true)
    try {
      const next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/cancel`, { method:'POST', body:'{}' })
      setRun(next)
      setMessage('Research stopped. This run is read-only; start a new run to continue.')
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
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
       setPendingPurchase({ sourceId, source, detail, budgetCents:run.budgetCents, spentCents:run.spentCents, remainingCents:run.remainingCents }); setPurchaseOutcome('REVIEW')
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
      setMessage(action === 'SKIP' ? 'Circuit Note skipped because it repeats Northstar Wire.' : source?.reason ? `${source.id === 'gridscope-asia' ? 'GridScope' : source.publisher} blocked: ${source.reason.replace(/^Blocked:\s*/, '')}` : 'Purchase blocked by the server-owned budget or source ceiling.')
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
       setPendingPurchase(null); setPurchaseOutcome('REVIEW')
      const source = next.sources.find((item) => item.id === pendingPurchase.sourceId)
      setMessage(`${source?.publisher} unlocked. The working thesis can now change.`)
      if (selectedId === pendingPurchase.sourceId && source) setSelectedDetail(source)
     } catch (error) { const errorMessage = (error as Error).message; const lower = errorMessage.toLowerCase(); setPurchaseOutcome(lower.includes('expired') || lower.includes('quote') ? 'EXPIRED' : lower.includes('access') ? 'ACCESS_ERROR' : lower.includes('blocked') || lower.includes('exceed') ? 'BLOCKED' : 'UNKNOWN'); setMessage(errorMessage) } finally { setBusy(false) }
  }

  const openSource = async (sourceId:string, spanId?:string) => {
    if (!run) return
    setSelectedId(sourceId)
    setSelectedSpanId(spanId ?? null)
    try { setSelectedDetail(await api<SourceDetail>(`/api/v1/research-runs/${run.runId}/sources/${sourceId}`)) } catch { setSelectedDetail(null) }
  }

  const recoverPurchase = async () => {
    if (!run || !pendingPurchase || busy) return
    setBusy(true)
    try {
      const receipt = await api<{ settlement:string; delivery:string }>(`/api/v1/research-runs/${run.runId}/purchases/${pendingPurchase.sourceId}`)
      await openSource(pendingPurchase.sourceId)
      setPendingPurchase(null)
      setPurchaseOutcome('REVIEW')
      setMessage(`Receipt checked: ${receipt.settlement}. Access status: ${receipt.delivery}. No retry was submitted.`)
    } catch (error) { setMessage(`Receipt recovery unavailable: ${(error as Error).message}. Do not retry the payment.`) } finally { setBusy(false) }
  }

  const synthesize = async () => {
    if (!run || busy) return
    const readiness = answerReadiness(run)
    if (!readiness.ready) { setMessage(readiness.reason); return }
    setBusy(true)
    setWorkspaceTab('overview')
    setSynthesisText('')
    setSynthesisStreaming(true)
    try {
      let next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/synthesize`, { method:'POST', body:'{}' })
      setRun(next)
      const synthesizedReadiness = answerReadiness(next)
      if (!synthesizedReadiness.ready) { setSynthesisStreaming(false); setMessage(synthesizedReadiness.reason); return }
      next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/step`, { method:'POST', body:JSON.stringify({ action:'next' }) })
      setRun(next)
      const finalReadiness = answerReadiness(next)
      if (!finalReadiness.ready) { setSynthesisStreaming(false); setMessage(finalReadiness.reason); return }
      setDossier(await api<Dossier>(`/api/v1/research-runs/${run.runId}/dossier`)); setMessage('Dossier ready. Claims are linked to exact accessible spans.')
    } catch (error) { setSynthesisStreaming(false); setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const visibleSources = run?.sources.filter((source) => run.config.sourceTypes.includes(classifySource(source))) ?? []
  const suggestedQuestion = scenario?.brief.question ?? QUESTION

  return <div className="app-shell">
    <header className="topbar"><button type="button" className="brand-button" onClick={() => void resetToStart()} aria-label="Start a new ResearchAgent thread"><span className="brand-mark" aria-hidden="true">RA</span><span><strong>ResearchAgent</strong></span></button><div className="topbar-thread"><span className="topbar-label">{run ? 'Active thread' : 'Research desk'}</span><span className="topbar-query">{run?.config.question ?? 'A calm workbench for defensible research'}</span></div><div className="topbar-actions">{run && <span className="topbar-budget mono">{formatXrp(centsToXrp(run.remainingCents))} left</span>}<Badge tone={(run?.runtime ?? scenario?.runtime)?.mode === 'live' ? 'warning' : 'fixture'}>{presentationRuntimeLabel(run?.runtime ?? scenario?.runtime)}</Badge></div></header>
    <div className="product-shell">
      <main className={`main-column ${run ? 'has-run' : ''}`}>
        {!run && <section className="start-view">{scopeRejection ? <ScopeNotice scope={scopeRejection} onEdit={editUnsupportedQuestion} onUseCanonical={() => editUnsupportedQuestion(QUESTION)} /> : <GuidedSetup step={setupStep} firstRun={!savedDraft && !question} resumeAvailable={!draftActive && Boolean(savedDraft)} question={questionDraft} selectedPublishers={selectedPublishers} budgetXrp={budgetXrp} publisherOptions={publisherOptions} canonicalQuestion={suggestedQuestion} currentBalanceXrp={CURRENT_XRP_BALANCE} minBudgetXrp={MIN_BUDGET_CENTS / XRP_TO_SGD_CENTS} maxBudgetXrp={MAX_BUDGET_CENTS / XRP_TO_SGD_CENTS} budgetToCents={xrpToCents} money={money} formatXrp={formatXrp} onQuestionChange={(value) => { setQuestion(value); setQuestionDraft(value) }} onTogglePublisher={(key) => togglePublisher(key as PublisherKey)} onBudgetChange={setBudgetXrp} onUseExample={() => beginQuestion(suggestedQuestion)} onResumeDraft={resumeDraft} onDiscardDraft={discardDraft} onContinue={continueSetup} onBack={() => { if (setupStep === 'sources') setSetupStep('question'); else if (setupStep === 'budget') setSetupStep('sources'); setMessage('Previous setup values are preserved.') }} onSaveDraft={saveDraft} />}</section>}
    {run && <section className="research-view">
          <div className="research-intro"><div><span className="kicker">Research thread · {run.config.horizon}</span><h1>{run.config.question}</h1><div className="intro-meta"><span>{run.rawSourceCount} retrieved previews · {run.familyCount} evidence families</span><span>{formatXrp(centsToXrp(run.budgetCents))} research budget</span><span>{run.cancelled ? 'STOPPED · read-only' : run.paused ? 'PAUSED' : 'RUNNING'}</span></div></div><div className="intro-actions"><button type="button" className="small-button" onClick={() => void resetToStart()}>New research</button>{!run.cancelled && !run.paused && <button type="button" className="small-button" onClick={() => void act('pause')} disabled={run.dossierReady || busy}>Pause</button>}{!run.cancelled && run.paused && <button type="button" className="small-button" onClick={() => void act('resume')} disabled={busy}>Resume</button>}<button type="button" className="small-button" onClick={() => void stopResearch()} disabled={run.cancelled || busy}>Stop</button></div></div>
           {run.scope?.status === 'UNSUPPORTED' ? <ScopeNotice scope={run.scope} onEdit={editUnsupportedQuestion} onUseCanonical={() => editUnsupportedQuestion(QUESTION)} /> : planDraft ? <PlanReview plan={planDraft} onChange={setPlanDraft} onApprove={() => void approvePlan()} onBack={() => { window.localStorage.removeItem('researchagent.active-run.v1'); setRun(null); setPlanDraft(null); setSetupStep('budget'); setDraftActive(true); setMessage('Back to budget. Your setup values are preserved.') }} onSaveDraft={saveDraft} busy={busy} /> : <ResearchPath run={run} dossier={dossier} sources={visibleSources} showAll={showAllSources} onShowAll={() => setShowAllSources(true)} selectedId={selectedId} onOpenSource={(id, spanId) => void openSource(id, spanId)} onAction={(sourceId, action) => { if (action === 'BUY') purchaseTriggerRef.current = document.activeElement as HTMLElement; void purchase(sourceId, action) }} onSynthesize={() => void synthesize()} busy={busy} synthesisText={synthesisText} synthesisStreaming={synthesisStreaming} activeTab={workspaceTab} onTabChange={setWorkspaceTab} />}
        </section>}
      </main>
    </div>
    <footer className={`statusbar ${/unavailable|failed|error/i.test(message) ? 'status-error' : /blocked|waiting|exceeds/i.test(message) ? 'status-warning' : /unlocked|ready|complete|paid/i.test(message) ? 'status-success' : ''}`}><span><span className="status-dot" /> {message}</span><span className="mono">{run ? `${run.events.length} events · ${presentationProviderLabel(run.llm.provider)} · ${presentationSemanticLabel(run.semanticStatus)}` : 'Evidence first · citations stay traceable'}</span></footer>
    {selectedDetail && <EvidenceDrawerPanel source={selectedDetail} focusSpanId={selectedSpanId} onClose={() => { setSelectedDetail(null); setSelectedId(null); setSelectedSpanId(null) }} />}
     {pendingPurchase && <PurchaseConfirmation pending={pendingPurchase} busy={busy} outcome={purchaseOutcome} onConfirm={() => void confirmPurchase()} onRecover={() => void recoverPurchase()} onCancel={() => { if (!busy) { setPendingPurchase(null); setPurchaseOutcome('REVIEW'); setMessage('Purchase review cancelled. No payment or access grant occurred.'); window.setTimeout(() => purchaseTriggerRef.current?.focus(), 0) } }} />}
    <div className="sr-live" aria-live="polite">{message}</div>
  </div>
}
