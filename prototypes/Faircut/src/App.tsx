import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Candidate, CandidateId, DemoPhase, PurchaseState, Scenario } from './domain'
import { candidates as fixtureCandidates, formatDrops, formatTime, phaseIndex, phaseLabels, PLACEMENT_DURATION_MS, PLACEMENT_START_MS, PRICE_DROPS, PROJECT_ID } from './domain'
import { eventCopy, receiptLimitations, waveformLabels } from './data'

type WorkspaceResponse = {
  project: { title: string; durationMs: number; placement: { startMs: number; durationMs: number } }
  mandate: { version: number; agent: string; workload: string; territories: string[]; term: string; placement: string; capDrops: string; displayBudget: string; expiresAt: string; canonicalHash: string; use: string; provenance: string }
  candidates: Candidate[]
  state: { phase: DemoPhase; purchaseState: PurchaseState; settlementStatus?: string; selectedCandidateId: CandidateId | null; discovered: boolean; evaluated: boolean; mode: string; lastReconciledAt: string; scenario: Scenario; delivery: { status: string; assetHash?: string; policyHash?: string; detail?: string } }
}

type ReceiptResponse = {
  headline: string
  environment: string
  modeLabel: string
  mandate: { hash: string; summary: string }
  decision: { candidate: string; creator: string; provider: string; creativeSummary: string; rightsDecision: string; reasonCodes: string[]; modelSource: string | null; policyEvaluator: string }
  licence: { odrlPolicyHash: string; attribution: string; provenance: string; limitation: string }
  payment: { source: string; x402Version: number; network: string; asset: string; amountDrops: number; invoiceId: string | null; payTo: string; transactionHash: string | null; validation: { validated: boolean; transactionResult: string | null; label?: string }; sourceTag: number; explorerUrl: string | null }
  delivery: { status: string; assetHash?: string; policyHash?: string; detail?: string }
  audit: { eventCount: number; headHash: string | null; events: Array<{ sequence: number; type: string; actor: string; occurredAt: string; eventHash: string }> }
  limitations: string[]
}

const fallbackWorkspace: WorkspaceResponse = {
  project: { title: 'Japan Travel / Final 20s', durationMs: 20_000, placement: { startMs: PLACEMENT_START_MS, durationMs: PLACEMENT_DURATION_MS } },
  mandate: { version: 1, agent: 'FairCut edit agent', workload: 'travel-campaign-042', territories: ['Singapore', 'Japan'], term: '6 months', placement: '12 seconds', capDrops: '10000', displayBudget: 'S$1 demo estimate', expiresAt: '2026-09-05T23:59:00+08:00', canonicalHash: 'sha256:mandate-leah-launch-v1', use: 'Commercial social', provenance: 'Required' },
  candidates: [],
  state: { phase: 'rough-cut', purchaseState: 'DRAFT', settlementStatus: 'NONE', selectedCandidateId: null, discovered: false, evaluated: false, mode: 'demo-local', lastReconciledAt: new Date().toISOString(), scenario: 'happy', delivery: { status: 'NOT_REQUESTED' } },
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init })
  const data = await response.json().catch(() => ({})) as T & { message?: string; error?: string }
  if (!response.ok) throw Object.assign(new Error(data.message ?? data.error ?? 'The request could not be completed.'), { status: response.status, data })
  return data
}

function localReceipt(workspace: WorkspaceResponse, candidate: Candidate): ReceiptResponse {
  const blocked = workspace.state.purchaseState === 'BLOCKED' && candidate.id === 'neon-pilgrim'
  return {
    headline: blocked ? 'Blocked before signing' : workspace.state.delivery.status === 'VERIFIED' ? 'Settled and fulfilled' : 'Fixture rehearsal',
    environment: workspace.state.mode,
    modeLabel: workspace.state.mode === 'demo-local' ? 'FIXTURE DEMO · SIMULATION — NOT SETTLED' : workspace.state.mode,
    mandate: { hash: workspace.mandate.canonicalHash, summary: '12 seconds · commercial social · Singapore + Japan · six months · cap 10,000 drops' },
    decision: { candidate: candidate.title, creator: candidate.creator, provider: candidate.provider, creativeSummary: candidate.creative.summary, rightsDecision: candidate.rightDecision, reasonCodes: candidate.rights.filter((check) => check.result === 'FAIL').map((check) => check.code), modelSource: 'Recorded demo assessment · no chain-of-thought stored', policyEvaluator: 'FairCut deterministic rights evaluator v1' },
    licence: { odrlPolicyHash: candidate.policyHash, attribution: candidate.attribution, provenance: candidate.provenanceLabel, limitation: 'Provenance assertions do not prove copyright ownership or legal authority to license.' },
    payment: { source: 'Local FairCut policy (demo)', x402Version: 2, network: 'xrpl:1', asset: 'XRP', amountDrops: candidate.priceDrops, invoiceId: null, payTo: 'rMikaDemoPayee7Q', transactionHash: null, validation: { validated: false, transactionResult: 'NOT_APPLICABLE', label: 'SIMULATION — NOT SETTLED' }, sourceTag: 804681468, explorerUrl: null },
    delivery: workspace.state.delivery,
    audit: { eventCount: 0, headHash: null, events: [] },
    limitations: receiptLimitations,
  }
}

function StatusIcon({ result }: { result: 'PASS' | 'FAIL' | 'UNKNOWN' | 'pending' }) {
  return <span className={`status-icon status-${result.toLowerCase()}`} aria-hidden="true">{result === 'PASS' ? '✓' : result === 'FAIL' ? '×' : result === 'UNKNOWN' ? '?' : '·'}</span>
}

function Waveform({ candidate, selected, onSelect }: { candidate: Candidate; selected: boolean; onSelect: () => void }) {
  const points = candidate.waveform.map((height, index) => `${index * 8},${50 - height / 2} ${index * 8},${50 + height / 2}`).join(' ')
  return (
    <button type="button" className={`waveform-button ${selected ? 'is-selected' : ''}`} onClick={onSelect} aria-pressed={selected} aria-label={`${candidate.title}: ${waveformLabels[candidate.id]}`}>
      <svg className="waveform" viewBox="0 0 184 50" preserveAspectRatio="none" role="img" aria-hidden="true">
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="waveform-label">{selected ? 'Auditioning in cut' : 'Audition preview'}</span>
    </button>
  )
}

function TraceRibbon({ phase, selectedCandidate, purchaseState }: { phase: DemoPhase; selectedCandidate: Candidate | undefined; purchaseState: PurchaseState }) {
  const markers = [
    { label: 'cut', at: 4 }, { label: 'audition', at: 26 }, { label: 'rights', at: 47 }, { label: 'guard', at: 64 }, { label: 'ledger', at: 80 }, { label: 'stem', at: 95 },
  ]
  const active = phaseIndex(phase)
  return (
    <section className="trace-section" aria-labelledby="trace-title">
      <div className="section-kicker"><span id="trace-title">Rights Trace Desk</span><span className="trace-context">{selectedCandidate ? `Following ${selectedCandidate.title}` : '20-second edit / 12-second placement'}</span></div>
      <div className="trace-ribbon" aria-label="Linked evidence trace from cut to delivered stem">
        <div className="trace-line" />
        {markers.map((marker, index) => {
          const isDone = index <= active
          const isCurrent = index === active
          return <div className={`trace-marker ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`} style={{ left: `${marker.at}%` }} key={marker.label}><span className="trace-dot">{isDone ? '✓' : index + 1}</span><span>{marker.label}</span></div>
        })}
      </div>
      <p className="trace-note"><span className="mono">{purchaseState}</span> is separate from creative fit, rights, settlement, and delivery verification.</p>
    </section>
  )
}

function CandidateRow({ candidate, selected, onSelect, onInspect }: { candidate: Candidate; selected: boolean; onSelect: () => void; onInspect: () => void }) {
  const average = Math.round((candidate.creative.timingFit + candidate.creative.moodFit + candidate.creative.transitionFit + candidate.creative.sonicClarity) / 4)
  return (
    <article className={`candidate-row ${candidate.rightDecision === 'BLOCKED' ? 'is-blocked' : ''} ${selected ? 'is-selected' : ''}`}>
      <div className="candidate-index mono">{candidate.id === 'neon-pilgrim' ? 'A' : candidate.id === 'dawn-current' ? 'B' : 'C'}</div>
      <div className="candidate-main">
        <div className="candidate-title-line"><h3>{candidate.title}</h3>{candidate.id === 'dawn-current' && <span className="best-fit">Best eligible fit</span>}</div>
        <p className="candidate-byline">{candidate.creator} <span>·</span> {candidate.provider}</p>
        <Waveform candidate={candidate} selected={selected} onSelect={onSelect} />
      </div>
      <div className="candidate-data">
        <div className="data-cell"><span className="data-label">Creative fit</span><strong className="mono score">{average}<span>/100</span></strong><small>{candidate.creative.summary}</small></div>
        <div className="data-cell"><span className="data-label">Rights trace</span><span className={`decision-label ${candidate.rightDecision === 'ELIGIBLE' ? 'decision-eligible' : 'decision-blocked'}`}><StatusIcon result={candidate.rightDecision === 'ELIGIBLE' ? 'PASS' : 'FAIL'} />{candidate.rightDecision === 'ELIGIBLE' ? 'Eligible' : 'Blocked'}</span><small>{candidate.provenanceLabel}</small></div>
        <div className="data-cell price-cell"><span className="data-label">Exact quote</span><strong className="mono">{formatDrops(candidate.priceDrops)} <span className="unit">drops</span></strong><small>{candidate.priceDrops === PRICE_DROPS ? 'S$0.80 demo estimate' : candidate.priceDrops === 2_000 ? 'S$0.20 demo estimate' : 'S$0.90 demo estimate'}</small></div>
      </div>
      <div className="candidate-actions"><button type="button" className="button button-quiet" onClick={onInspect}>Why?</button><button type="button" className={`button ${candidate.rightDecision === 'BLOCKED' ? 'button-disabled' : selected ? 'button-selected' : 'button-outline'}`} onClick={onSelect} disabled={candidate.rightDecision === 'BLOCKED'}>{candidate.rightDecision === 'BLOCKED' ? 'No purchase' : selected ? 'Selected' : 'Use this cue'}</button></div>
    </article>
  )
}

function CopyValue({ value, label, className = '' }: { value: string | null | undefined; label: string; className?: string }) {
  if (!value) return <span className={className}>Awaiting</span>
  const copy = async () => { try { await navigator.clipboard.writeText(value) } catch { /* clipboard permissions are optional */ } }
  return <span className={`copy-value ${className}`}><span className="wrap-anywhere">{value}</span><button type="button" className="copy-button" onClick={() => void copy()} aria-label={`Copy ${label}`}>Copy</button></span>
}

function EvidenceDrawer({ receipt, onClose }: { receipt: ReceiptResponse; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement)
  const requestClose = () => { onClose(); window.setTimeout(() => previousFocusRef.current?.focus(), 0) }
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })
  return <>
    <button type="button" className="drawer-backdrop" aria-label="Close evidence drawer" onClick={requestClose} />
    <div ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
      <div className="drawer-head"><div><span className="eyebrow">Public-safe receipt</span><h2 id="evidence-title">Evidence drawer</h2></div><button ref={closeRef} type="button" className="icon-button" onClick={requestClose} aria-label="Close evidence drawer">×</button></div>
      <div className="drawer-status"><span className={`status-chip ${receipt.delivery.status === 'VERIFIED' ? 'chip-success' : receipt.headline.includes('Blocked') ? 'chip-danger' : 'chip-neutral'}`}>{receipt.headline}</span><span className="drawer-mode">{receipt.modeLabel}</span></div>
      <div className="drawer-scroll">
        <section className="evidence-block"><h3>Decision</h3><dl className="evidence-list"><div><dt>Mandate</dt><dd>{receipt.mandate.summary}<CopyValue value={receipt.mandate.hash} label="mandate hash" className="mono hash" /></dd></div><div><dt>Selected cue</dt><dd>{receipt.decision.candidate}<span>{receipt.decision.creator} · {receipt.decision.provider}</span></dd></div><div><dt>Creative rationale</dt><dd>{receipt.decision.creativeSummary}<span>{receipt.decision.modelSource}</span></dd></div><div><dt>Rights decision</dt><dd><span className={receipt.decision.rightsDecision === 'ELIGIBLE' ? 'text-success' : 'text-danger'}>{receipt.decision.rightsDecision}</span>{receipt.decision.reasonCodes.length > 0 && <span className="mono reason-codes">{receipt.decision.reasonCodes.join(' · ')}</span>}</dd></div></dl></section>
        <section className="evidence-block"><h3>Licence</h3><dl className="evidence-list"><div><dt>ODRL 2.2 policy</dt><dd><CopyValue value={receipt.licence.odrlPolicyHash} label="licence policy hash" className="mono hash" /><span>{receipt.mandate.summary}</span></dd></div><div><dt>Attribution</dt><dd>{receipt.licence.attribution}</dd></div><div><dt>Provenance</dt><dd>{receipt.licence.provenance}<span className="limitation">{receipt.licence.limitation}</span></dd></div></dl></section>
        <section className="evidence-block"><h3>Payment</h3><dl className="evidence-list"><div><dt>Decision source</dt><dd>{receipt.payment.source}<span>x402 v{receipt.payment.x402Version} · {receipt.payment.network} · {receipt.payment.asset}</span></dd></div><div><dt>Exact amount</dt><dd className="mono">{formatDrops(receipt.payment.amountDrops)} drops<span className="subtle">Source tag {receipt.payment.sourceTag}</span><CopyValue value={receipt.payment.invoiceId} label="invoice ID" className="subtle" /></dd></div><div><dt>Payee binding</dt><dd><CopyValue value={receipt.payment.payTo} label="payee address" className="mono" /></dd></div><div><dt>Ledger result</dt><dd>{receipt.payment.validation.label ?? (receipt.payment.validation.validated ? 'validated · tesSUCCESS' : 'Not validated')} {receipt.payment.transactionHash && <CopyValue value={receipt.payment.transactionHash} label="transaction hash" className="mono hash" />}{receipt.payment.explorerUrl && <a href={receipt.payment.explorerUrl} target="_blank" rel="noreferrer">Open Testnet explorer ↗</a>}</dd></div></dl></section>
        <section className="evidence-block"><h3>Delivery</h3><dl className="evidence-list"><div><dt>Verification</dt><dd className={receipt.delivery.status === 'VERIFIED' ? 'text-success' : receipt.delivery.status === 'EXCEPTION' ? 'text-danger' : ''}>{receipt.delivery.status}{receipt.delivery.detail && <span>{receipt.delivery.detail}</span>}</dd></div><div><dt>Asset digest</dt><dd><CopyValue value={receipt.delivery.assetHash} label="asset digest" className="mono" /></dd></div><div><dt>Licence digest</dt><dd><CopyValue value={receipt.delivery.policyHash} label="licence digest" className="mono" /></dd></div></dl></section>
        <section className="evidence-block"><h3>Audit chain</h3><p className="audit-summary">{receipt.audit.eventCount} public-safe events · head hash</p><CopyValue value={receipt.audit.headHash} label="audit head hash" className="mono hash" /><ol className="audit-events">{receipt.audit.events.map((event) => <li key={`${event.sequence}-${event.eventHash}`}><span className="mono">{String(event.sequence).padStart(2, '0')}</span><span>{event.type.replaceAll('_', ' ').toLowerCase()}</span><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol></section>
        <section className="evidence-block limitations-block"><h3>What this does not prove</h3><ul>{receipt.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>
      </div>
    </div>
  </>
}

function ScenarioMenu({ onReset, onScenario }: { onReset: () => void; onScenario: (scenario: Scenario) => void }) {
  return <div className="scenario-menu" role="menu" aria-label="Demo scenarios"><div className="scenario-menu-head"><span className="eyebrow">Scenario menu</span><span className="mono">demo-local</span></div><button type="button" role="menuitem" onClick={onReset}>Reset demo</button><div className="scenario-rule" /><span className="scenario-label">Rehearse a failure path</span><button type="button" role="menuitem" onClick={() => onScenario('quote_changed')}>Changed quote · re-review required</button><button type="button" role="menuitem" onClick={() => onScenario('payment_failed')}>Facilitator unavailable</button><button type="button" role="menuitem" onClick={() => onScenario('payment_unconfirmed')}>Ledger unconfirmed</button><button type="button" role="menuitem" onClick={() => onScenario('delivery_mismatch')}>Delivery hash mismatch</button><button type="button" role="menuitem" onClick={() => onScenario('risk_unavailable')}>Risk provider unavailable</button></div>
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse>(fallbackWorkspace)
  const [candidates, setCandidates] = useState<Candidate[]>(fixtureCandidates)
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('Cut')
  const [statusMessage, setStatusMessage] = useState<string>(eventCopy.rough)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const toastTimeout = useRef<number | undefined>(undefined)

  const phase = workspace.state.phase
  const selectedCandidate = useMemo(() => candidates.find((candidate) => candidate.id === workspace.state.selectedCandidateId) ?? (workspace.state.evaluated && phase !== 'rough-cut' ? candidates[1] : undefined), [candidates, phase, workspace.state.evaluated, workspace.state.selectedCandidateId])
  const isFinal = workspace.state.purchaseState === 'FULFILMENT_VERIFIED' || phase === 'final-cut'
  const modeLabel = workspace.state.mode === 'demo-local' ? 'FIXTURE DEMO' : workspace.state.mode === 'offline-rehearsal' ? 'OFFLINE SIMULATION' : workspace.state.mode === 'recorded-testnet' ? 'RECORDED TESTNET EVIDENCE' : 'LIVE · XRPL TESTNET'

  const notify = useCallback((message: string) => { setToast(message); window.clearTimeout(toastTimeout.current); toastTimeout.current = window.setTimeout(() => setToast(null), 5200) }, [])

  const syncState = useCallback((next: WorkspaceResponse) => { setWorkspace(next); if (next.candidates.length) setCandidates(next.candidates); }, [])

  useEffect(() => { api<WorkspaceResponse>(`/api/projects/${PROJECT_ID}/workspace`).then(syncState).catch(() => { /* The fixture remains usable in a static preview. */ }); document.title = 'FairCut — Japan Travel / Final 20s' }, [syncState])

  useEffect(() => { const video = videoRef.current; const audio = audioRef.current; if (!video || !audio) return; const sync = () => { setCurrentTime(video.currentTime * 1000); if (Math.abs(audio.currentTime - video.currentTime) > 0.18) audio.currentTime = video.currentTime }; video.addEventListener('timeupdate', sync); video.addEventListener('ended', () => { setIsPlaying(false); audio.pause() }); return () => { video.removeEventListener('timeupdate', sync) } }, [selectedCandidate?.id, isFinal])

  useEffect(() => { const audio = audioRef.current; if (audio) audio.src = isFinal ? '/api/providers/mika-direct/assets/sku_dawn-current_12s_clean/master' : selectedCandidate?.previewUrl ?? '/media/rough-bed.mp3' }, [isFinal, selectedCandidate?.previewUrl])

  const handleDiscover = async () => { if (busy || workspace.state.discovered) return; setBusy(true); setStatusMessage('Comparing provider catalogues…'); try { const response = await api<{ candidates: Candidate[]; state: WorkspaceResponse['state'] }>(`/api/projects/${PROJECT_ID}/discover`, { method: 'POST', body: JSON.stringify({ mandateId: 'mandate_leah_launch_v1', placementId: 'placement_reveal_12s', idempotencyKey: crypto.randomUUID() }) }); syncState({ ...workspace, candidates: response.candidates, state: response.state }); setCandidates(response.candidates); setStatusMessage(eventCopy.compare); notify('Three provider offers are ready to compare.'); } catch { setWorkspace((current) => ({ ...current, state: { ...current.state, phase: 'compare', discovered: true, purchaseState: 'DISCOVERED' }, candidates })); setStatusMessage(eventCopy.compare) } finally { setBusy(false) } }
  const handleEvaluate = async () => { if (busy || workspace.state.evaluated) return; setBusy(true); setStatusMessage('Separating creative assessment from deterministic rights checks…'); try { const response = await api<{ assessments: unknown; state: WorkspaceResponse['state'] }>(`/api/projects/${PROJECT_ID}/evaluate`, { method: 'POST', body: JSON.stringify({ mandateId: 'mandate_leah_launch_v1', idempotencyKey: crypto.randomUUID() }) }); syncState({ ...workspace, state: response.state }); setStatusMessage(eventCopy.blocked); notify('One attractive cue is blocked before signing.'); } catch { setWorkspace((current) => ({ ...current, state: { ...current.state, phase: 'blocked', evaluated: true, purchaseState: 'BLOCKED', selectedCandidateId: 'neon-pilgrim' } })); setStatusMessage(eventCopy.blocked) } finally { setBusy(false) } }
  const handleSelect = async (candidateId: CandidateId) => { if (busy) return; const candidate = candidates.find((item) => item.id === candidateId); if (!candidate || candidate.rightDecision === 'BLOCKED') { setStatusMessage(eventCopy.blocked); return } setBusy(true); try { const response = await api<{ state: WorkspaceResponse['state'] }>(`/api/projects/${PROJECT_ID}/select`, { method: 'POST', body: JSON.stringify({ candidateId, idempotencyKey: crypto.randomUUID() }) }); syncState({ ...workspace, state: response.state }); setStatusMessage(eventCopy.eligible); notify(`${candidate.title} is ready for exact-term review.`) } catch { setWorkspace((current) => ({ ...current, state: { ...current.state, phase: 'license', purchaseState: 'ELIGIBLE', selectedCandidateId: candidateId } })); setStatusMessage(eventCopy.eligible) } finally { setBusy(false) } }
  const handleAuthorizeAndPay = async () => { if (busy || selectedCandidate?.rightDecision !== 'ELIGIBLE') return; setBusy(true); setStatusMessage('Checking exact payment terms…'); try { await api(`/api/purchases/${PROJECT_ID.replace('project_', 'purchase_')}/authorize`, { method: 'POST', body: JSON.stringify({ purchaseId: 'purchase_dawn_current_12s', challengeHash: workspace.mandate.canonicalHash, idempotencyKey: crypto.randomUUID() }) }); setStatusMessage('Signing one bounded Testnet Payment on the server…'); const response = await api<{ state: PurchaseState; mode?: string; settlementStatus?: string }>(`/api/purchases/purchase_dawn_current_12s/pay`, { method: 'POST', body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); if (response.state === 'PAYMENT_FAILED' || response.state === 'PAYMENT_UNCONFIRMED') { setWorkspace((current) => ({ ...current, state: { ...current.state, purchaseState: response.state, settlementStatus: response.settlementStatus ?? current.state.settlementStatus } })); setStatusMessage(response.state === 'PAYMENT_FAILED' ? 'Payment failed safely. No clean stem was unlocked.' : 'Payment is unconfirmed. No second payment was attempted.'); notify(response.state === 'PAYMENT_FAILED' ? 'Facilitator unavailable — retry is safe after reconciliation.' : 'Ledger validation is still unconfirmed.'); } else { const liveSettlement = response.mode === 'LIVE · XRPL TESTNET' || response.settlementStatus === 'VALIDATED_SUCCESS'; setWorkspace((current) => ({ ...current, state: { ...current.state, phase: 'deliver', purchaseState: 'SIMULATED_SETTLED', settlementStatus: liveSettlement ? 'VALIDATED_SUCCESS' : 'FIXTURE_SIMULATION' } })); setStatusMessage(liveSettlement ? 'Payment validated on XRPL Testnet. Delivery can now be verified.' : eventCopy.simulated); notify(liveSettlement ? 'Validated Testnet payment recorded. Delivery can now be verified.' : 'Fixture purchase recorded. Delivery can now be verified.'); } } catch (error) { const typed = error as Error & { status?: number; data?: { state?: string; changedField?: string } }; setStatusMessage(typed.data?.changedField ? `Quote changed: ${typed.data.changedField}. Authorization was discarded.` : typed.message); notify(typed.data?.changedField ? 'Terms changed — review the new quote before any signing.' : 'Payment was not authorized. No transaction was submitted.'); } finally { setBusy(false) } }
  const handleFulfil = async () => { if (busy) return; setBusy(true); setStatusMessage('Verifying delivered stem, licence, and order binding…'); try { const response = await api<{ state: PurchaseState; delivery: WorkspaceResponse['state']['delivery'] }>(`/api/purchases/purchase_dawn_current_12s/fulfil`, { method: 'POST', body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); setWorkspace((current) => ({ ...current, state: { ...current.state, phase: response.state === 'FULFILMENT_VERIFIED' ? 'final-cut' : 'deliver', purchaseState: response.state, delivery: response.delivery } })); setStatusMessage(response.state === 'FULFILMENT_VERIFIED' ? eventCopy.final : eventCopy.deliveryException); notify(response.state === 'FULFILMENT_VERIFIED' ? 'Clean stem verified and placed on the timeline.' : 'Delivery exception preserved the settlement without inserting the clean stem.'); } catch (error) { const typed = error as Error & { data?: { message?: string } }; setStatusMessage(typed.data?.message ?? typed.message); notify('Delivery verification needs attention.'); } finally { setBusy(false) } }
  const handleNext = () => { if (phase === 'rough-cut') void handleDiscover(); else if (phase === 'compare') void handleEvaluate(); else if (phase === 'blocked') void handleSelect('dawn-current'); else if (phase === 'license') void handleAuthorizeAndPay(); else if (phase === 'deliver') void handleFulfil(); else setReceiptOpen(true) }
  const handleReset = async () => { setMenuOpen(false); setReceiptOpen(false); setBusy(true); try { const next = await api<WorkspaceResponse>('/api/demo/reset', { method: 'POST', body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); syncState(next); setStatusMessage(eventCopy.rough); setCurrentTime(0); setIsPlaying(false); videoRef.current?.pause(); audioRef.current?.pause(); notify('Fixture reset. Recorded or live ledger evidence is never rewritten.'); } catch { setWorkspace(fallbackWorkspace); setCandidates(fixtureCandidates); setStatusMessage(eventCopy.rough) } finally { setBusy(false) } }
  const handleScenario = async (scenario: Scenario) => { setMenuOpen(false); await handleReset(); try { await api('/api/demo/scenario', { method: 'POST', body: JSON.stringify({ scenario, idempotencyKey: crypto.randomUUID() }) }); setWorkspace((current) => ({ ...current, state: { ...current.state, scenario } })); notify(`Failure rehearsal armed: ${scenario.replaceAll('_', ' ')}.`) } catch { setWorkspace((current) => ({ ...current, state: { ...current.state, scenario } })) } }
  const togglePlayback = async () => { const video = videoRef.current; const audio = audioRef.current; if (!video || !audio) return; if (isPlaying) { video.pause(); audio.pause(); setIsPlaying(false); return } try { await video.play(); await audio.play(); setIsPlaying(true) } catch { setStatusMessage('Playback needs a user gesture. Use the play control again.'); } }
  const seek = (value: number) => { const video = videoRef.current; const audio = audioRef.current; if (!video || !audio) return; video.currentTime = value / 1000; audio.currentTime = value / 1000; setCurrentTime(value) }
  const openReceipt = async () => { try { const next = await api<ReceiptResponse>('/api/purchases/purchase_dawn_current_12s/receipt'); setReceipt(next) } catch { setReceipt(localReceipt(workspace, selectedCandidate ?? candidates[0])) } setReceiptOpen(true) }

  useEffect(() => {
    const live = workspace.state.settlementStatus === 'VALIDATED_SUCCESS'
    const trace = document.querySelector<HTMLElement>('.payment-progress .progress-title .mono')
    const note = document.querySelector<HTMLElement>('.payment-progress .progress-step small')
    const stateLabel = document.querySelector<HTMLElement>('.action-kicker .mono')
    if (trace) trace.textContent = live ? 'validated Testnet payment' : 'fixture evidence'
    if (note) note.textContent = live ? 'VALIDATED · TESUCCESS' : 'SIMULATION — NOT SETTLED'
    if (stateLabel && workspace.state.purchaseState === 'SIMULATED_SETTLED') stateLabel.textContent = live ? 'VALIDATED_SUCCESS' : 'SIMULATED_SETTLED'
  }, [workspace.state.purchaseState, workspace.state.settlementStatus])

  // The compact JSX keeps button labels stable across guided and manual paths;
  // this capture phase guarantees those action buttons remain wired even when
  // a nested icon span receives the pointer event.
  useEffect(() => {
    const handleActionClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('button')
      const label = button?.textContent?.trim() ?? ''
      if (!button || !label) return
      const action = label.startsWith('Find cues') ? handleDiscover : label.startsWith('Evaluate 3 cues') ? handleEvaluate : label.startsWith('License for') ? handleAuthorizeAndPay : label.startsWith('Verify delivered stem') ? handleFulfil : label === 'Play final cut ▶' ? togglePlayback : label === 'Open rights receipt' ? openReceipt : undefined
      if (!action) return
      event.stopPropagation()
      void action()
    }
    document.addEventListener('click', handleActionClick, true)
    return () => document.removeEventListener('click', handleActionClick, true)
  }, [handleAuthorizeAndPay, handleDiscover, handleEvaluate, handleFulfil, openReceipt, togglePlayback])

  useEffect(() => {
    const timeline = document.querySelector<HTMLElement>('.timeline-wrap')
    timeline?.setAttribute('tabindex', '0')
    timeline?.setAttribute('aria-label', 'Scrollable timeline viewport')
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const nav = document.querySelector<HTMLElement>('.left-rail')
    const restore = document.activeElement as HTMLElement | null
    if (!nav) return
    const first = nav.querySelector<HTMLElement>('button')
    first?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileNavOpen(false); restore?.focus(); return }
      if (event.key !== 'Tab') return
      const focusable = nav.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const firstFocusable = focusable[0]; const lastFocusable = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === firstFocusable) { event.preventDefault(); lastFocusable.focus() }
      else if (!event.shiftKey && document.activeElement === lastFocusable) { event.preventDefault(); firstFocusable.focus() }
    }
    const onOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !nav.contains(event.target)) { setMobileNavOpen(false); restore?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onOutsidePointer, true)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('pointerdown', onOutsidePointer, true) }
  }, [mobileNavOpen])

  return <div className="app-shell">
    <header className="app-header"><div className="brand-block"><span className="wordmark">FAIRCUT</span><span className="brand-slash">/</span><span className="breadcrumb">Japan Travel <span>/</span> Final 20s</span></div><div className="header-meta"><span className={`mode-badge ${workspace.state.mode === 'demo-local' ? 'mode-fixture' : 'mode-live'}`}><span className="mode-dot" />{modeLabel}</span><span className="freshness"><span className="fresh-dot" />Fresh 12s ago</span><button type="button" className="header-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu">Scenario <span aria-hidden="true">⌄</span></button><button type="button" className="header-button help-button" onClick={() => setActiveSection('Rights')} aria-label="Open help and limitations">?</button></div>{menuOpen && <ScenarioMenu onReset={() => void handleReset()} onScenario={(scenario) => void handleScenario(scenario)} />}</header>
    <div className="mobile-bar" role="navigation" aria-label="Mobile project controls"><button type="button" className="icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open project navigation">☰</button><span className="mono">CUT / 01</span><button type="button" className="mobile-receipt" onClick={() => void openReceipt()}>Receipt</button></div>
    <div className="workspace-grid">
      <aside className={`left-rail ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Project navigation"><div className="rail-top"><span className="rail-mark">FC</span><button type="button" className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close project navigation">×</button></div><nav className="rail-nav">{['Cut', 'Cues', 'Rights', 'Receipt'].map((item) => <button type="button" key={item} className={`rail-link ${activeSection === item ? 'is-active' : ''}`} aria-current={activeSection === item ? 'page' : undefined} onClick={() => { setActiveSection(item); setMobileNavOpen(false); if (item === 'Receipt') void openReceipt() }}><span className="rail-number">{item === 'Cut' ? '01' : item === 'Cues' ? '02' : item === 'Rights' ? '03' : '04'}</span><span>{item}</span></button>)}</nav><div className="rail-footer"><span className="mono">SG / JP</span><span className="mono">20 SEC</span></div></aside>
      <main className="main-column"><section className="story-header"><div><span className="eyebrow">Leah Tan · independent filmmaker · Singapore</span><h1>Leah needs one usable cue <em>before midnight.</em></h1><p className="story-dek">FairCut lets Leah delegate the creative search and a tiny rights-clearing purchase—without delegating unrestricted wallet authority.</p></div><div className="story-action"><span className="micro-label">Guided fixture · {phaseIndex(phase) + 1} / 6</span><button type="button" className="button button-primary button-large" onClick={phase === 'final-cut' ? () => void handleReset() : handleNext} disabled={busy}>{busy ? <><span className="spinner" />Working…</> : phase === 'rough-cut' ? 'Run guided demo' : phase === 'final-cut' ? 'Replay demo' : 'Next step'}<span className="button-arrow">↗</span></button><button type="button" className="back-explanation" onClick={() => { setWorkspace((current) => ({ ...current, state: { ...current.state, phase: 'rough-cut' } })); setStatusMessage(eventCopy.rough) }}>Back to explanation</button></div></section>
        <nav className="phase-rail" aria-label="Guided demo phases">{phaseLabels.map((item, index) => <button type="button" key={item.id} className={`phase-item ${index < phaseIndex(phase) ? 'is-complete' : ''} ${item.id === phase ? 'is-current' : ''}`} onClick={() => { if (index === 0) { setWorkspace((current) => ({ ...current, state: { ...current.state, phase: 'rough-cut' } })); setStatusMessage(eventCopy.rough) } }} aria-current={item.id === phase ? 'step' : undefined}><span className="phase-eyebrow mono">{item.eyebrow}</span><span>{item.label}</span></button>)}</nav>
        <section className="monitor-panel" aria-labelledby="monitor-title"><div className="monitor-toolbar"><div><span className="eyebrow">Film monitor</span><h2 id="monitor-title">{isFinal ? 'Final licensed cut' : selectedCandidate ? `Auditioning ${selectedCandidate.title}` : 'Current cut / rough audio'}</h2></div><span className={`monitor-state ${isFinal ? 'state-final' : ''}`}><span className="state-dot" />{isFinal ? 'Clean stem inserted' : phase === 'blocked' ? 'Watermarked preview' : 'Rough cut'}</span></div><div className="video-frame"><video ref={videoRef} src="/media/rough-cut.mp4" preload="metadata" playsInline aria-label="Original team-created 20-second Japan travel rough cut" /><div className="frame-overlay"><span className="frame-corner corner-tl" /><span className="frame-corner corner-tr" /><span className="frame-corner corner-bl" /><span className="frame-corner corner-br" /><span className="frame-time mono">{formatTime(currentTime)}</span><span className="frame-project">JAPAN / FINAL 20s</span></div><div className="frame-caption">{isFinal ? 'CLEAN MASTER / RIGHTS TRACE COMPLETE' : 'ROUGH CUT / MUSIC BED UNRESOLVED'}</div></div><audio ref={audioRef} preload="metadata" /><div className="transport"><button type="button" className="play-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Pause current cut' : 'Play current cut'}>{isPlaying ? 'Ⅱ' : '▶'}</button><label className="scrubber-label"><span className="sr-only">Seek current cut</span><input type="range" min="0" max="20000" step="10" value={currentTime} onChange={(event) => seek(Number(event.target.value))} aria-label="Seek current cut" /></label><span className="mono transport-time">{formatTime(currentTime)} <span>/ 00:20.000</span></span><button type="button" className="volume-button" onClick={() => { setMuted((value) => !value); if (audioRef.current) audioRef.current.muted = !muted }} aria-label={muted ? 'Unmute current cut' : 'Mute current cut'}>{muted ? 'Mute' : 'Sound'}</button><button type="button" className="transport-link" onClick={() => seek(PLACEMENT_START_MS)}>Jump to placement ↘</button></div></section>
        <section className="timeline-panel" aria-labelledby="timeline-title"><div className="panel-heading"><div><span className="eyebrow">Timeline / linked evidence</span><h2 id="timeline-title">{formatTime(0)} <span>→</span> {formatTime(20_000)}</h2></div><span className="placement-note"><span className="placement-swatch" />Music placement · 00:05.500–00:17.500</span></div><div className="timeline-wrap"><div className="time-ruler">{[0, 5, 10, 15, 20].map((second) => <span key={second} style={{ left: `${second * 5}%` }} className="mono">{`00:${String(second).padStart(2, '0')}.000`}</span>)}</div><div className="timeline-track"><div className="video-lane"><span className="lane-label">PICTURE</span><span className="video-strip"><i /><i /><i /><i /><i /><i /><i /><i /></span></div><div className="music-lane"><span className="lane-label">MUSIC</span><div className="placement-region"><span className="region-label">{isFinal ? 'DAWN CURRENT / CLEAN STEM' : selectedCandidate ? `${selectedCandidate.title.toUpperCase()} / ${selectedCandidate.rightDecision === 'BLOCKED' ? 'WATERMARKED PREVIEW' : 'PREVIEW'}` : '12s placement / unresolved'}</span><span className="mini-waveform">{Array.from({ length: 46 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 45)}%` }} />)}</span></div></div><div className="playhead" style={{ left: `${Math.min(100, currentTime / 200)}%` }}><span className="playhead-label mono">{formatTime(currentTime)}</span></div></div><TraceRibbon phase={phase} selectedCandidate={selectedCandidate} purchaseState={workspace.state.purchaseState} /></div></section>
        <section className="comparison-section" aria-labelledby="comparison-title"><div className="section-heading"><div><span className="eyebrow">Agent audition / deterministic policy</span><h2 id="comparison-title">Three cues. One hard boundary.</h2></div><span className="comparison-meta mono">{workspace.state.discovered ? '3 OFFERS / 2 PROVIDERS' : 'AWAITING DISCOVERY'}</span></div>{!workspace.state.discovered ? <div className="empty-state"><span className="empty-index mono">01</span><div><h3>Start with Leah’s actual cut.</h3><p>FairCut will query three original fixture offers from two independent providers, then keep creative fit separate from rights eligibility.</p></div><button type="button" className="button button-outline" onClick={() => void handleDiscover()} disabled={busy}>Find cues</button></div> : <div className="candidate-stack">{candidates.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} selected={selectedCandidate?.id === candidate.id} onSelect={() => candidate.rightDecision === 'ELIGIBLE' ? void handleSelect(candidate.id) : setStatusMessage(eventCopy.blocked)} onInspect={() => { setActiveSection('Rights'); setStatusMessage(candidate.rightDecision === 'BLOCKED' ? eventCopy.blocked : `${candidate.title}: ${candidate.creative.summary}`) }} />)}</div>}</section>
      </main>
      <aside className="right-column" aria-label="Current mandate and next action"><section className="inspector-section mandate-section"><div className="section-heading"><div><span className="eyebrow">Mandate / version {workspace.mandate.version}</span><h2>Leah’s guardrails</h2></div><span className="mandate-lock" aria-label="Mandate is active">● active</span></div><p className="mandate-lede">{workspace.mandate.placement} for {workspace.mandate.use.toLowerCase()} use in {workspace.mandate.territories.join(' and ')}, valid {workspace.mandate.term.toLowerCase()}, up to <strong className="mono">{formatDrops(Number(workspace.mandate.capDrops))} drops</strong>.</p><div className="mandate-chips"><span>✦ No voice replicas</span><span>⌁ Provenance required</span><span>↗ Attribution displayed</span></div><dl className="mandate-details"><div><dt>Principal</dt><dd>Leah Tan</dd></div><div><dt>Agent / workload</dt><dd>{workspace.mandate.agent}<span className="mono">{workspace.mandate.workload}</span></dd></div><div><dt>Spend envelope</dt><dd className="mono">0 / {formatDrops(Number(workspace.mandate.capDrops))} drops<span className="subtle">{workspace.mandate.displayBudget} · display estimate only</span></dd></div><div><dt>Expires</dt><dd className="mono">05 Sep 2026 · 23:59 SGT</dd></div></dl><button type="button" className="text-button" onClick={() => setStatusMessage('Mandate editing is intentionally held before authorization; changing it would create a new version and invalidate any frozen intent.')}>Edit mandate <span>↗</span></button></section><section className={`inspector-section action-section ${workspace.state.purchaseState === 'BLOCKED' ? 'action-blocked' : isFinal ? 'action-final' : ''}`} aria-live="polite"><div className="action-kicker"><span className="eyebrow">Next action</span><span className="mono">{workspace.state.purchaseState}</span></div><h2>{phase === 'rough-cut' ? 'Find a cue that can ship.' : phase === 'compare' ? 'Compare inside the cut.' : phase === 'blocked' ? 'Beautiful. Still blocked.' : phase === 'license' ? 'Freeze the exact licence.' : phase === 'deliver' ? 'Prove what arrived.' : 'Hear the difference.'}</h2><p>{statusMessage}</p>{phase === 'blocked' && <div className="blocked-callout"><div className="callout-title"><StatusIcon result="FAIL" /><strong>Blocked before signing</strong></div><p>This cue fits the cut, but its licence does not permit the requested commercial use and its payee could not be bound to the claimed rights-holder.</p><p className="no-transaction">No transaction was signed or submitted.</p><div className="check-list">{(selectedCandidate ?? candidates[0])?.rights.filter((check) => check.result !== 'PASS').map((check) => <div className="check-row" key={check.code}><StatusIcon result={check.result} /><span>{check.label}</span><span className="mono check-observed">{check.observed}</span></div>)}</div></div>}{phase === 'license' && selectedCandidate && <div className="purchase-summary"><div><span>Exact package</span><strong>{selectedCandidate.title}</strong><small>12s clean stem + ODRL 2.2 licence + attribution</small></div><div><span>Creator payee</span><strong>{selectedCandidate.creator}</strong><small className="mono">{formatDrops(selectedCandidate.priceDrops)} drops · xrpl:1</small></div></div>}{phase === 'deliver' && <div className={`payment-progress ${workspace.state.purchaseState.includes('PAYMENT') ? 'progress-failed' : ''}`}><div className="progress-title"><span className="eyebrow">Purchase trace</span><span className="mono">{workspace.state.purchaseState === 'SIMULATED_SETTLED' ? 'fixture evidence' : workspace.state.purchaseState}</span></div>{['Mandate matched', 'Rights policy matched', 'Payee and quote bound', 'Payment evidence recorded', 'Asset and licence delivered', 'Delivery verified'].map((step, index) => <div className={`progress-step ${index < (workspace.state.purchaseState === 'SIMULATED_SETTLED' ? 4 : 2) ? 'is-done' : index === 4 ? 'is-current' : ''}`} key={step}><StatusIcon result={index < (workspace.state.purchaseState === 'SIMULATED_SETTLED' ? 4 : 2) ? 'PASS' : index === 4 ? 'pending' : 'UNKNOWN'} /><span>{step}</span>{index === 3 && workspace.state.purchaseState === 'SIMULATED_SETTLED' && <small>SIMULATION — NOT SETTLED</small>}</div>)}</div>}{isFinal && <div className="final-callout"><span className="final-mark">✓</span><div><strong>Final licensed cut is playable.</strong><p>Clean stem verified against the frozen order. {selectedCandidate?.attribution}.</p></div></div>}<div className="action-buttons">{phase === 'rough-cut' && <button type="button" className="button button-primary" onClick={() => void handleDiscover} disabled={busy}>Find cues <span>↗</span></button>}{phase === 'compare' && <button type="button" className="button button-primary" onClick={() => void handleEvaluate} disabled={busy}>Evaluate 3 cues <span>↗</span></button>}{phase === 'blocked' && <button type="button" className="button button-primary" onClick={() => void handleSelect('dawn-current')} disabled={busy}>Compare next eligible cue <span>↗</span></button>}{phase === 'license' && <button type="button" className="button button-primary" onClick={() => void handleAuthorizeAndPay} disabled={busy}>License for {formatDrops(PRICE_DROPS)} drops <span>↗</span></button>}{phase === 'deliver' && <button type="button" className="button button-primary" onClick={() => void handleFulfil} disabled={busy}>Verify delivered stem <span>↗</span></button>}{phase === 'final-cut' && <button type="button" className="button button-primary" onClick={() => void togglePlayback}>Play final cut <span>▶</span></button>}<button type="button" className="button button-outline" onClick={() => void openReceipt}>Open rights receipt</button></div></section><section className="why-section"><button type="button" className="why-row" onClick={() => setStatusMessage('The agent auditions alternatives inside the cut and adapts after an attractive cue fails hard constraints. A fixed checkout cannot make that creative comparison.') }><span>Why this needs an agent</span><span>+</span></button><button type="button" className="why-row" onClick={() => setStatusMessage('XRPL records the approved micro-purchase from an independent provider. It does not decide rights, creative fit, provenance, or whether delivery matches.') }><span>Why XRPL here</span><span>+</span></button></section></aside>
    </div>
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    {receiptOpen && receipt && <EvidenceDrawer receipt={receipt} onClose={() => setReceiptOpen(false)} />}
  </div>
}
