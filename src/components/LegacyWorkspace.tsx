import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CURRENT_XRP_BALANCE, DEFAULT_BUDGET_CENTS, MAX_BUDGET_CENTS, MIN_BUDGET_CENTS, QUESTION, XRP_TO_SGD_CENTS, type Claim, type Phase, type ResearchApproach, type ResearchConfig, type ResearchPlanArtifact, type RuntimeStatus, type Source } from '../domain'
import { createResearchPlan } from '../research-plan'
import { ActivityFeed, ApprovalModal, BudgetSummary, Disclosure, EvidenceDrawer as EvidenceDrawerShell, ProgressPanel, SourceProfileList, SourceRow, StepHeader } from '../ui'
import { clearSetupDraft, GuidedSetup, GuidedStepProgress, loadSetupDraft, persistSetupDraft, type SetupDraft, type SetupStep } from '../ui/setup'
import { ScopeDecision, ServerState, PurchaseDecisionResponse, Scenario, Dossier, SourceDetail, PendingPurchase, WorkspaceTab, PurchaseOutcome, money, formatXrp, xrpToCents, centsToXrp, DEFAULT_BUDGET_XRP, presentationRuntimeLabel, presentationProviderLabel, presentationSemanticLabel, ApiRequestError, api, sourceTypes, publisherOptions, PublisherKey, classifySource, answerReadiness, Badge, ScopeNotice, PlanReview, EvidenceDrawerPanel, PurchaseConfirmation, ResearchPath } from './LegacyPanels'

export default function LegacyWorkspace() {
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
