import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { QUESTION, type Claim, type Phase, type ResearchConfig, type Source } from './domain'

type Brief = { principal:string; audience:string; question:string; deliverable:string; budgetCents:number; autoBuyMaxPerSourceCents:number; sourceAboveThreshold:string; horizon:number; mode:string; sourceAllowlist?: string[] }
type ServerState = { runId:string; phase:Phase; paused:boolean; cancelled:boolean; budgetCents:number; spentCents:number; remainingCents:number; rawSourceCount:number; familyCount:number; gap:{question:string; importance:string; state:string}; thesis:{open:string; afterNorthstar?:string; afterMeridian?:string; current:string}; claims:Claim[]; events:{id:string; type:string; label:string; at:string}[]; dossierReady:boolean; llm:{provider:string; status:string; model:string}; semanticStatus:string; config:ResearchConfig; sources:Source[] }
type Scenario = { brief:Brief; sources:Source[] }
type Dossier = { title:string; conclusion:string; changedAfterPaidResearch:{before:string; afterNorthstar?:string; after:string}; afterLabel?:string; claims:Claim[]; uncertainty:string; sourceLedger:{publisher:string; priceCents:number; decision:string; family:string; authority:string; originality:string; access:string}[]; method:string }
type SourceDetail = Source & { premium?:{status:string; contentHash?:string; quoteHash?:string; resourceId?:string} }
type SourceType = 'primary' | 'public' | 'independent' | 'specialist'

const money = (cents:number) => `S$${(cents / 100).toFixed(2)}`
const formatTokens = (tokens:number) => `${Math.round(tokens / 1000).toLocaleString()}k`
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
  { id:'financial-press', label:'Financial Times', example:'ft.com · markets' },
  { id:'wire-services', label:'Reuters', example:'reuters.com · global macro' },
  { id:'central-banks', label:'BIS', example:'bis.org · policy releases' },
  { id:'public-data', label:'FRED', example:'fred.stlouisfed.org · data' },
  { id:'specialist-research', label:'IMF research', example:'imf.org · analysis' },
  { id:'company-filings', label:'SEC EDGAR', example:'sec.gov/edgar · filings' },
  { id:'macro-research', label:'The Economist', example:'economist.com · analysis' },
  { id:'infrastructure-press', label:'IEA', example:'iea.org · infrastructure' },
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

function ScopeToggle({ type, selected, onToggle }:{ type:SourceType; selected:boolean; onToggle:()=>void }) {
  return <button type="button" className={`scope-toggle ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={onToggle}><span className="toggle-box">{selected && <Icon name="check" />}</span><span>{sourceTypeLabels[type]}</span></button>
}

function PublisherPicker({ selected, onToggle }:{ selected:PublisherKey[]; onToggle:(key:PublisherKey)=>void }) {
  return <section className="publisher-picker" aria-labelledby="publisher-picker-title"><div className="publisher-picker-head"><div><span className="kicker">Search boundary</span><h2 id="publisher-picker-title">Choose the websites I can read.</h2></div><span className="picker-count mono">{selected.length} / {publisherOptions.length} selected</span></div><p className="publisher-picker-note">These are fixture adapters for the demo. Article bodies are synthetic, but the allowlist, ranking, quote, and payment steps are real product state.</p><div className="publisher-grid">{publisherOptions.map((option) => <button key={option.id} type="button" className={`publisher-option ${selected.includes(option.id) ? 'is-selected' : ''}`} aria-pressed={selected.includes(option.id)} onClick={() => onToggle(option.id)}><span className="publisher-check">{selected.includes(option.id) ? '✓' : ''}</span><span><strong>{option.label}</strong><small>{option.example}</small></span></button>)}</div></section>
}

function ScopeCard({ question, decision, horizon, tokenLimit, selectedTypes, publisherCount, onQuestionChange, onDecisionChange, onHorizonChange, onTokenLimitChange, onToggleType, onStart, busy }:{ question:string; decision:string; horizon:string; tokenLimit:number; selectedTypes:SourceType[]; publisherCount:number; onQuestionChange:(value:string)=>void; onDecisionChange:(value:string)=>void; onHorizonChange:(value:string)=>void; onTokenLimitChange:(value:number)=>void; onToggleType:(type:SourceType)=>void; onStart:()=>void; busy:boolean }) {
  return <section className="scope-card" aria-labelledby="scope-title">
    <div className="scope-card-top"><div><span className="kicker">Before I search</span><h2 id="scope-title">Make the question answerable.</h2></div><span className="scope-step">Scope <b>1</b> of <b>2</b></span></div>
    <p className="scope-intro">A narrow question produces evidence you can use. Confirm the decision, time horizon, and source universe before I spend your research budget.</p>
    <div className="scope-fields">
      <label className="field field-wide"><span>Working question</span><textarea className="resize-none" value={question} onChange={(event) => onQuestionChange(event.target.value)} rows={2} style={{ resize:'none' }} /></label>
      <label className="field"><span>Decision this supports</span><input value={decision} onChange={(event) => onDecisionChange(event.target.value)} placeholder="e.g. invest, wait, or avoid" /></label>
      <label className="field"><span>Time horizon</span><input value={horizon} onChange={(event) => onHorizonChange(event.target.value)} placeholder="e.g. through 2028" /></label>
    </div>
    <div className="scope-options">
      <div className="option-group"><div className="option-heading"><span>Allowed source universe</span><small>Choose what can enter the evidence set.</small></div><div className="toggle-grid">{sourceTypes.map((type) => <ScopeToggle key={type} type={type} selected={selectedTypes.includes(type)} onToggle={() => onToggleType(type)} />)}</div></div>
      <label className="token-control"><span>Analysis token cap <small>Manual limit</small></span><div className="token-input"><input type="number" min={8000} max={256000} step={1000} value={tokenLimit} onChange={(event) => onTokenLimitChange(Math.max(8000, Math.min(256000, Number(event.target.value) || 8000)))} /><span>tokens</span></div><div className="token-presets">{[32000, 64000, 128000].map((value) => <button type="button" key={value} className={tokenLimit === value ? 'is-active' : ''} onClick={() => onTokenLimitChange(value)}>{formatTokens(value)}</button>)}</div></label>
    </div>
    <div className="scope-footer"><span><span className="status-dot" /> {publisherCount > 0 ? `Fixture corpus · ${publisherCount} websites · S$2.00 mandate` : 'Choose at least one website to continue'}</span><button type="button" className="primary-button" onClick={onStart} disabled={busy || !question.trim() || selectedTypes.length === 0 || publisherCount === 0}>{busy ? 'Building evidence map…' : 'Start research'} <Icon name="arrow" /></button></div>
  </section>
}

function SourceItem({ source, selected, onOpen, onAction }:{ source:Source; selected:boolean; onOpen:()=>void; onAction:(action:'BUY'|'SKIP'|'BLOCKED')=>void }) {
  const decision = source.decision
  const actionLabel = source.id === 'circuit-note' ? 'Skip' : source.id === 'gridscope-asia' ? 'Block' : 'Buy'
  return <article className={`source-row ${selected ? 'is-selected' : ''}`}>
    <div className="source-rank">{String(Math.max(1, source.relevance)).padStart(2, '0')}</div>
    <button type="button" className="source-open" onClick={onOpen} aria-label={`Inspect ${source.publisher}: ${source.title}`}>
      <span className="source-title-line"><strong>{source.title}</strong><span className="source-publisher">{source.publisher}</span></span>
      <span className="source-preview">{source.preview}</span>
      <span className="source-meta"><span>{sourceTypeLabels[classifySource(source)]}</span><span>{source.familyLabel}</span><span>{source.authority.toLowerCase()} authority</span><span>{source.originality.toLowerCase()}</span></span>
    </button>
      <div className="source-metrics"><span className="metric-score"><b>{source.relevance}</b><small>match</small></span><span className="metric-price">{source.priceCents ? money(source.priceCents) : 'Free'}</span>{source.priceCents > 0 && <small className="metric-x402">x402 · {source.xrpDrops?.toLocaleString() ?? '—'} drops</small>}</div>
    <div className="source-actions">
      {decision === 'BUY' && <Badge tone="success"><Icon name="check" /> Unlocked</Badge>}
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
  return <><button className="drawer-backdrop" type="button" aria-label="Close evidence drawer" onClick={onClose} /><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className="drawer-head"><div><span className="kicker">Evidence inspection</span><h2 id="drawer-title">{source.publisher}</h2></div><button ref={closeRef} type="button" className="icon-button light" onClick={onClose} aria-label="Close evidence drawer"><Icon name="close" /></button></div><div className="drawer-content"><Badge tone={locked ? 'warning' : source.accessTier === 'OPEN' ? 'neutral' : 'success'}>{source.accessTier === 'OPEN' ? 'Open evidence' : locked ? 'Premium preview' : 'Premium · unlocked'}</Badge><h3>{source.title}</h3><p className="drawer-preview">{source.preview}</p><dl className="detail-list"><div><dt>Evidence family</dt><dd>{source.familyLabel}<small>{source.originality} · {source.trustNote}</small></dd></div><div><dt>Retrieval score</dt><dd className="mono">{source.relevance} / 100<small>Price never affects relevance.</small></dd></div><div><dt>Gap match</dt><dd className="mono">{source.gapMatch} / 100<small>How directly this source answers the active gap.</small></dd></div><div><dt>Terms</dt><dd>{source.priceCents ? `${money(source.priceCents)} exact resource quote` : 'Open / no payment required'}<small>Fixture content is synthetic and clearly labelled.</small></dd></div></dl>{locked && <div className="locked-evidence"><Icon name="lock" /><div><strong>Full text is protected</strong><p>Only metadata, preview, price, and terms are visible before purchase. This preview cannot be cited as read.</p><p className="mono">x402 quote · XRPL Testnet fixture · {source.xrpDrops?.toLocaleString() ?? '—'} drops · not settled</p></div></div>}{source.evidenceSpans && <section className="span-section"><h3>Accessible evidence spans</h3>{source.evidenceSpans.map((span) => <blockquote key={span.id} id={span.id}><span className="kicker">{span.label} · {span.id}</span><p>“{span.text}”</p></blockquote>)}</section>}</div></aside></>
}

function BudgetCard({ run }:{ run:ServerState }) {
  const spentPercent = Math.min(100, (run.spentCents / run.budgetCents) * 100)
  return <section className="side-card budget-card"><div className="side-card-heading"><span className="kicker">Research budget</span><span className="mono">{money(run.remainingCents)} left</span></div><div className="budget-number"><strong>{money(run.spentCents)}</strong><span>of {money(run.budgetCents)} used</span></div><div className="budget-bar"><i style={{ width:`${spentPercent}%` }} /></div><div className="budget-note">Paid evidence can change the thesis. The agent cannot exceed the mandate or buy a source above S$1.00.</div></section>
}

function citationLabel(id:string) {
  const labels:Record<string,string> = { 'company-capex':'Vertex Compute', 'energy-dataset':'EMA data', 'northstar-wire':'Northstar Wire', 'meridian-ledger':'Meridian Ledger', 'gridscope-asia':'GridScope Asia', 'circuit-note':'Circuit Note', 'treasury-volatility':'Harbour Rates Wire', 'term-premium-desk':'Term Premium Desk', 'credit-spread-watch':'Credit Spread Watch', 'auction-absorption':'Auction Flow Review', 'real-yield-tracker':'Real Yield Tracker', 'fiscal-monitor':'Fiscal Monitor', 'central-bank-minutes':'Policy Archive', 'duration-allocator':'Allocator Notes' }
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
  const bondQuestion = /bond|yield|duration|treasury|rates|term premium|fiscal/i.test(run.config.question)
  const sentences = run.claims.length ? run.claims : [{ id:'working-thesis', text:run.thesis.current, stance:'UNCERTAIN' as const, materiality:'MATERIAL' as const, sourceIds:bondQuestion ? ['fiscal-monitor','central-bank-minutes'] : ['company-capex','energy-dataset'], familyCount:2, spanIds:bondQuestion ? ['fiscal-monitor','central-bank-minutes'] : ['company-capex','energy-dataset'] }]
  return <section className="answer-panel" aria-labelledby="answer-title"><div className="answer-head"><div><span className="kicker">Working answer</span><h2 id="answer-title">What the evidence says so far</h2></div><span className="answer-status mono">{run.dossierReady ? 'CITED MEMO READY' : 'OPEN-SOURCE BASELINE'}</span></div><div className="answer-copy">{sentences.map((claim) => <div className="answer-sentence" key={claim.id}><p>{claim.text} <Citations ids={claim.sourceIds} onOpen={onOpenSource} /></p><QuoteStrip ids={claim.sourceIds} sources={run.sources} onOpen={onOpenSource} /></div>)}</div><p className="answer-note">Each citation opens the source record. Paid excerpts are only available after the exact fixture quote is accepted.</p></section>
}

function DossierPanel({ dossier, run, onOpenSource, onSynthesize, busy }:{ dossier:Dossier|null; run:ServerState; onOpenSource:(id:string)=>void; onSynthesize:()=>void; busy:boolean }) {
  if (!dossier) return null
  return <section className="dossier-panel" id="dossier"><div className="dossier-heading"><div><span className="kicker">Verified dossier</span><h2>{dossier.title}</h2></div><button type="button" className="small-button light" onClick={() => window.print()}>Print</button></div><div className="dossier-paper"><div className="dossier-kicker">FIXTURE RESEARCH · NOT INVESTMENT ADVICE</div><h3>{dossier.conclusion}</h3><div className="changed-callout"><span className="kicker">What changed after paid evidence</span><span className="change-line"><b>Open web</b>{dossier.changedAfterPaidResearch.before}</span>{dossier.changedAfterPaidResearch.afterNorthstar && <span className="change-line"><b>+ Northstar</b>{dossier.changedAfterPaidResearch.afterNorthstar}</span>}<span className="change-line final"><b>{dossier.afterLabel ?? '+ Meridian'}</b>{dossier.changedAfterPaidResearch.after}</span></div><div className="dossier-columns"><div><span className="kicker">Supports the thesis</span>{dossier.claims.filter((claim) => claim.stance === 'SUPPORTS').map((claim) => <ClaimBlock key={claim.id} claim={claim} sources={run.sources} onOpen={onOpenSource} />)}</div><div><span className="kicker">Challenges the thesis</span>{dossier.claims.filter((claim) => claim.stance !== 'SUPPORTS').map((claim) => <ClaimBlock key={claim.id} claim={claim} sources={run.sources} onOpen={onOpenSource} />)}</div></div><div className="dossier-footer"><div><span className="kicker">Key uncertainty</span><p>{dossier.uncertainty}</p></div><div><span className="kicker">Method & limitations</span><p>{dossier.method}</p></div></div></div></section>
}

export default function App() {
  const [scenario, setScenario] = useState<Scenario|null>(null)
  const [run, setRun] = useState<ServerState|null>(null)
  const [question, setQuestion] = useState('')
  const [questionDraft, setQuestionDraft] = useState('')
  const [decision, setDecision] = useState('')
  const [horizon, setHorizon] = useState('Through 2028')
  const [tokenLimit, setTokenLimit] = useState(64000)
  const [selectedTypes, setSelectedTypes] = useState<SourceType[]>(sourceTypes)
  const [selectedPublishers, setSelectedPublishers] = useState<PublisherKey[]>(publisherOptions.map((option) => option.id))
  const [chatStarted, setChatStarted] = useState(false)
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SourceDetail|null>(null)
  const [dossier, setDossier] = useState<Dossier|null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Ready when you are.')
  const [showAllSources, setShowAllSources] = useState(false)

  useEffect(() => {
    document.title = 'ResearchAgent — Deep research'
    api<Scenario>('/api/v1/scenarios/data-centre-2028').then(setScenario).catch(() => setMessage('Backend unavailable. Start the API to begin a fixture research run.'))
  }, [])

  useEffect(() => {
    if (!run?.runId) return
    const stream = new EventSource(`/api/v1/research-runs/${run.runId}/stream`)
    stream.addEventListener('PLAN_CREATED', () => setMessage('Scope accepted. I’m building the evidence map.'))
    stream.addEventListener('PURCHASE_BLOCKED', () => setMessage('GridScope blocked: S$1.40 exceeds the remaining S$1.00.'))
    stream.addEventListener('DOSSIER_READY', () => setMessage('Dossier ready. Claims point to accessible evidence spans.'))
    return () => stream.close()
  }, [run?.runId])

  useEffect(() => {
    if (run?.runId) window.scrollTo({ top:0, behavior:'auto' })
  }, [run?.runId])

  const resetToStart = () => { setRun(null); setDossier(null); setQuestion(''); setQuestionDraft(''); setDecision(''); setHorizon('Through 2028'); setTokenLimit(64000); setSelectedTypes(sourceTypes); setSelectedPublishers(publisherOptions.map((option) => option.id)); setChatStarted(false); setSelectedId(null); setSelectedDetail(null); setMessage('Ready when you are.'); window.scrollTo({ top:0, behavior:'smooth' }) }
  const beginClarification = (value = questionDraft) => { const next = value.trim(); if (!next) return; setQuestion(next); setQuestionDraft(next); setChatStarted(true); setMessage('Question received. Confirm the scope before research starts.') }
  const toggleType = (type:SourceType) => setSelectedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  const togglePublisher = (key:PublisherKey) => setSelectedPublishers((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])

  const startResearch = async () => {
    if (busy || !question.trim() || selectedTypes.length === 0 || selectedPublishers.length === 0) return
    setBusy(true)
    try {
      const created = await api<ServerState>('/api/v1/research-runs', { method:'POST', body:JSON.stringify({ question, decision:decision || 'What decision will this research support?', horizon, tokenLimit, sourceTypes:selectedTypes, sourceAllowlist:selectedPublishers }) })
      setRun(created)
      let next = created
      for (let index = 0; index < 6; index += 1) next = await api<ServerState>(`/api/v1/research-runs/${created.runId}/step`, { method:'POST', body:JSON.stringify({ action:'next' }) })
      setRun(next); setMessage('Evidence map ready. Review the sources that can change the answer.'); window.scrollTo({ top:0, behavior:'auto' })
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const act = async (action:string) => {
    if (!run || busy) return
    setBusy(true)
    try { const next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/step`, { method:'POST', body:JSON.stringify({ action }) }); setRun(next); setMessage(action === 'pause' ? 'Research paused.' : action === 'resume' ? 'Research resumed.' : message) } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const purchase = async (sourceId:string, action:'BUY'|'SKIP'|'BLOCKED') => {
    if (!run || busy) return
    setBusy(true)
    try {
      const next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/purchases`, { method:'POST', body:JSON.stringify({ sourceId, action, idempotencyKey:crypto.randomUUID() }) })
      setRun(next)
      const source = next.sources.find((item) => item.id === sourceId)
      setMessage(action === 'BUY' ? `${source?.publisher} unlocked. The working thesis can now change.` : action === 'SKIP' ? 'Circuit Note skipped because it repeats Northstar Wire.' : 'GridScope blocked: S$1.40 exceeds the remaining S$1.00.')
      if (selectedId === sourceId && source) setSelectedDetail(source)
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
    try {
      let next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/synthesize`, { method:'POST', body:'{}' })
      setRun(next)
      next = await api<ServerState>(`/api/v1/research-runs/${run.runId}/step`, { method:'POST', body:JSON.stringify({ action:'next' }) })
      setRun(next); setDossier(await api<Dossier>(`/api/v1/research-runs/${run.runId}/dossier`)); setMessage('Dossier ready. Claims are linked to exact accessible spans.')
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }

  const visibleSources = run?.sources.filter((source) => run.config.sourceTypes.includes(classifySource(source))) ?? []
  const displayedSources = showAllSources ? visibleSources : visibleSources.slice(0, 7)
  const suggestedQuestion = scenario?.brief.question ?? QUESTION

  return <div className="app-shell">
    <header className="topbar"><button type="button" className="brand-button" onClick={resetToStart} aria-label="Start a new research thread"><span className="brand-mark">RA</span><span><strong>ResearchAgent</strong><small>deep research, with a budget</small></span></button><div className="topbar-thread"><span className="topbar-label">{run ? 'Research thread' : 'New research'}</span>{run && <span className="topbar-query">{run.config.question}</span>}</div><div className="topbar-actions">{run && <><Badge tone="fixture">Fixture</Badge><span className="topbar-budget mono">{money(run.spentCents)} / {money(run.budgetCents)}</span><button type="button" className="icon-button" onClick={() => void act(run.paused ? 'resume' : 'pause')} disabled={run.dossierReady || busy} aria-label={run.paused ? 'Resume research' : 'Pause research'}>{run.paused ? '▶' : 'Ⅱ'}</button></>}<button type="button" className="small-button" onClick={resetToStart}>{run ? 'New research' : 'Reset'}</button></div></header>
    <div className="product-shell">
      <main className={`main-column ${run ? 'has-run' : ''}`}>
        {!run && <section className={`start-view ${chatStarted ? 'is-clarifying' : ''}`}>
          <div className="start-copy"><span className="kicker">ResearchAgent / New thread</span><h1>{chatStarted ? 'Let’s make the question useful.' : 'What are you trying to find out?'}</h1><p>{chatStarted ? 'I’ll search only the source profiles you approved, buy only when the evidence can change the answer, and cite the result sentence by sentence.' : 'Write the question first. Then choose the websites I’m allowed to search before the agent starts reading.'}</p></div>
          <div className="start-layout"><div className="start-main"><div className="conversation"><ChatBubble role="assistant">{chatStarted ? <>Good starting point. I’ve captured the question and allowlist. Before I read, confirm <strong>the decision</strong> and <strong>time horizon</strong> below.</> : <>I’m useful when the question has a point of view. Try a thesis, a market you’re considering, or a risk you need to disprove.</>}</ChatBubble>{chatStarted && <ChatBubble role="user">{question}</ChatBubble>}</div>{!chatStarted && <div className="suggested-starts"><span className="suggested-label">Try a starting point</span><button type="button" onClick={() => beginClarification(suggestedQuestion)}>{suggestedQuestion}<Icon name="arrow" /></button><button type="button" onClick={() => beginClarification('What is causing the bond market implosion, and which risk matters next?')}>What is causing the bond market implosion? <Icon name="arrow" /></button><button type="button" onClick={() => beginClarification('Compare the evidence for demand growth versus delivery constraints in a new market.')}>Compare two sides of a market <Icon name="arrow" /></button></div>}<Composer value={questionDraft} onChange={setQuestionDraft} onSubmit={() => beginClarification()} placeholder={chatStarted ? 'Add a sharper version of the question…' : 'Ask a question worth investigating…'} /></div><PublisherPicker selected={selectedPublishers} onToggle={togglePublisher} /></div>
          {chatStarted && <ScopeCard question={question} decision={decision} horizon={horizon} tokenLimit={tokenLimit} selectedTypes={selectedTypes} publisherCount={selectedPublishers.length} onQuestionChange={setQuestion} onDecisionChange={setDecision} onHorizonChange={setHorizon} onTokenLimitChange={setTokenLimit} onToggleType={toggleType} onStart={() => void startResearch()} busy={busy} />}
        </section>}
        {run && <section className="research-view">
          <div className="research-intro"><div><span className="kicker">Research thread · {run.config.horizon}</span><h1>{run.config.question}</h1><div className="intro-meta"><Badge tone="neutral">{formatTokens(run.config.tokenLimit)} token cap</Badge><span>Decision: {run.config.decision}</span><span>{run.rawSourceCount} sources · {run.familyCount} families</span></div></div><div className="intro-actions"><button type="button" className="small-button" onClick={() => setShowAllSources(!showAllSources)}>{showAllSources ? 'Show recommended' : 'Show all sources'}</button><button type="button" className="small-button" onClick={() => void act('cancel')} disabled={run.dossierReady || busy}>Stop</button></div></div>
          <div className="research-thread"><ChatBubble role="user">{run.config.question}</ChatBubble><ChatBubble role="assistant">I’ll run semantic queries across the websites you approved, collapse duplicate reporting, then buy only the article that can change a material claim. Every sentence in the final answer will carry a source citation.</ChatBubble></div>
          <WorkingAnswer run={run} onOpenSource={(id) => void openSource(id)} />
          <div className="results-layout"><section className="sources-panel" id="sources"><div className="panel-heading"><div><span className="kicker">Sources in scope</span><h2>{visibleSources.length} mock articles ranked</h2></div><span className="panel-note mono">Semantic query · price separate from relevance</span></div><div className="source-filter"><span>Websites:</span>{(run.config.sourceAllowlist ?? []).map((key) => <span key={key} className="filter-chip"><i />{publisherOptions.find((option) => option.id === key)?.label ?? key}</span>)}</div><div className="source-list">{displayedSources.map((source) => <SourceItem key={source.id} source={source} selected={selectedId === source.id} onOpen={() => void openSource(source.id)} onAction={(action) => void purchase(source.id, action)} />)}</div>{visibleSources.length > displayedSources.length && <button type="button" className="load-more" onClick={() => setShowAllSources(true)}>Show {visibleSources.length - displayedSources.length} more articles <Icon name="arrow" /></button>}</section><aside className="research-side"><section className="side-card scope-summary"><div className="side-card-heading"><span className="kicker">Working scope</span><button type="button" className="text-action" onClick={resetToStart}>Edit</button></div><p>{run.config.question}</p><dl><div><dt>Decision</dt><dd>{run.config.decision}</dd></div><div><dt>Horizon</dt><dd>{run.config.horizon}</dd></div><div><dt>Token cap</dt><dd className="mono">{formatTokens(run.config.tokenLimit)}</dd></div></dl></section><BudgetCard run={run} /><section className="side-card gap-card"><div className="side-card-heading"><span className="kicker">Active gap</span><Badge tone={run.gap.state === 'RESOLVED' ? 'success' : 'warning'}>{run.gap.state}</Badge></div><h3>{run.gap.question}</h3><p>Open sources establish the baseline. Paid excerpts are only considered when they add an independent family, resolve a gap, or test a material claim.</p></section><section className="next-action"><span className="kicker">Next useful step</span><strong>{run.dossierReady ? 'Read the cited memo.' : run.sources.some((source) => source.decision === 'BUY') ? 'Assemble the cited answer.' : 'Inspect an article before buying it.'}</strong>{!run.dossierReady && <button type="button" className="outline-button" disabled={busy || !run.sources.some((source) => source.decision === 'BUY')} onClick={() => void synthesize()}>Assemble cited answer <Icon name="arrow" /></button>}{run.dossierReady && <button type="button" className="outline-button" onClick={() => document.getElementById('dossier')?.scrollIntoView({ behavior:'smooth' })}>Open cited memo <Icon name="arrow" /></button>}</section></aside></div>
          <DossierPanel dossier={dossier} run={run} onOpenSource={(id) => void openSource(id)} onSynthesize={() => void synthesize()} busy={busy} />
        </section>}
      </main>
    </div>
    <footer className="statusbar"><span><span className="status-dot" /> {message}</span><span className="mono">{run ? `${run.events.length} events · ${run.llm.provider} fallback · ${run.semanticStatus}` : 'Evidence first · citations stay traceable'}</span></footer>
    {selectedDetail && <EvidenceDrawer source={selectedDetail} onClose={() => { setSelectedDetail(null); setSelectedId(null) }} />}
    <div className="sr-live" aria-live="polite">{message}</div>
  </div>
}
