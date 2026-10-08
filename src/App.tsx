import { useCallback, useEffect, useRef, useState } from 'react'
import { BUDGET, ModeLabelsSchema, XRPL_LABEL, type Ask as AskInput, type Citation, type ModeLabels, type Plan, type PublicCandidate, type ReputationRecord, type Receipt as ReceiptData, type RunSnapshot } from '../shared/contracts/index.js'
import { ask, createReport, deleteRun, getReputation, getRun, listPastRuns, pinRun, resetReputation, retryDelivery, scope, stop, streamRun, type PastRun, type ScopeResult } from './api'
import { dwell, isPaid, isTerminal, runEvents, SPEED, staged, type Pace } from './stage'
import { candidateOf, favicon, leadSentence, money } from './format'
import Layout from './components/Layout'
import Sidebar, { NAV_WIDTH, NavToggle } from './components/Sidebar'
import Modes from './components/Modes'
import Ask from './components/Ask'
import Settings from './components/Settings'
import RunTape from './components/RunTape'
import Sources, { getAccessibleContent } from './components/Sources'
import Answer, { validatedAnswers } from './components/Answer'
import ReportButton from './components/ReportButton'
import Budget from './components/Budget'
import DecisionPanel from './components/DecisionPanel'
import Purchase from './components/Purchase'
import Passage from './components/Passage'
import Receipt from './components/Receipt'
import ShowWork from './components/ShowWork'
import Presenter from './components/Presenter'
import Toasts, { type Toast } from './components/Toasts'
import ClarifyChips from './components/ClarifyChips'
import ActionModal from './components/ActionModal'
import ReputationPanel from './components/ReputationPanel'

const paceKey = 'researchagent.pace', notifyKey = 'researchagent.notify', clarifyKey = 'researchagent.clarify-never', navKey = 'researchagent.nav', navWidthKey = 'researchagent.nav-width'
const universalKey = 'researchagent.budget-universal', universalMinorKey = 'researchagent.budget-universal-minor'
/** A saved budget in minor units: 0 to the maximum, in 5-cent steps; anything else falls back to the default. */
const savedBudget = (value: string | null) => { const minor = Number(value); return value !== null && Number.isInteger(minor) && minor >= 0 && minor <= BUDGET.maxMinor && minor % BUDGET.stepMinor === 0 ? minor : BUDGET.initialMinor }
const prefs = {
  get(key: string) { try { return localStorage.getItem(key) } catch { return null } },
  set(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
}
function initialPace(): Pace {
  const value = new URLSearchParams(window.location.search).get('pace') ?? prefs.get(paceKey)
  return value === 'real' || value === 'slow' ? value : 'stage'
}

export default function App() {
  const [run, setRun] = useState<RunSnapshot>()
  const [screen, setScreen] = useState<'home' | 'run' | 'settings'>('home')
  // Settings' Back returns to the screen it was opened from; the half-typed question lives here so Home remounting keeps it.
  const [backTo, setBackTo] = useState<'home' | 'run'>('home')
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<number>(BUDGET.initialMinor)
  const [cursor, setCursor] = useState(Infinity)
  const [pace, setPace] = useState<Pace>(initialPace)
  const [health, setHealth] = useState<{ labels?: ModeLabels; faults: boolean }>({ faults: false })
  const [notify, setNotify] = useState(() => prefs.get(notifyKey) === '1')
  const [sending, setSending] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState('')
  const [passage, setPassage] = useState<{ candidate: PublicCandidate; citation?: Citation }>()
  const [receipt, setReceipt] = useState<ReceiptData>()
  const [work, setWork] = useState(false)
  const [presenter, setPresenter] = useState(false)
  const [view, setView] = useState<'latest' | 'baseline'>('latest')
  const [compare, setCompare] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<{ input: AskInput; scope: ScopeResult; answers: Record<string, string>; step: 'clarify' | 'plan' }>()
  const [tab, setTab] = useState<'run' | 'writers'>('run')
  const [reputation, setReputation] = useState<ReputationRecord[]>([])
  const [clarifyNever, setClarifyNever] = useState(() => new URLSearchParams(window.location.search).get('clarify') === 'never' || prefs.get(clarifyKey) === '1')
  const [navOpen, setNavOpen] = useState(() => prefs.get(navKey) !== 'rail')
  // Settings → Universal budget per query: every question uses it, and Home shows a chip instead of the slider.
  const [universal, setUniversal] = useState(() => prefs.get(universalKey) === '1')
  const [universalMinor, setUniversalMinor] = useState(() => savedBudget(prefs.get(universalMinorKey)))
  const [navWidth, setNavWidth] = useState(() => { const saved = Number(prefs.get(navWidthKey)); return saved >= NAV_WIDTH.min && saved <= NAV_WIDTH.max ? saved : NAV_WIDTH.initial })
  const [why, setWhy] = useState(false)
  const [past, setPast] = useState<PastRun[]>([])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/health').then(response => response.json()).then(data => { if (!cancelled) setHealth({ labels: ModeLabelsSchema.safeParse(data.labels).data, faults: data.faults === true }) }).catch(() => { /* labels fall back to the run's own */ })
    // Home is the default; a run opens only when the URL names it (a refresh keeps it). Past runs live in the sidebar.
    const id = new URLSearchParams(window.location.search).get('run')
    if (id) void getRun(id).then(value => { if (!cancelled) { setRun(value); setScreen('run') } }).catch(() => { /* unknown run: stay on Home */ })
    return () => { cancelled = true }
  }, [])
  const runId = run?.runId
  useEffect(() => {
    if (!runId) return
    return streamRun(runId, { onSnapshot: setRun, onEvent: () => {}, onError: () => setError('Connection lost. Reconnecting…') })
  }, [runId])

  // Stage pacing: reveal one trace event at a time, holding each for its dwell.
  const events = run ? runEvents(run) : []
  const next = events.find(event => event.id > cursor)
  const current = events.find(event => event.id === cursor)
  const replaying = !!run && Number.isFinite(cursor) && !(isTerminal(run) && !next)
  const nextId = next?.id
  const delay = current ? dwell(current) / SPEED[pace] : 350
  useEffect(() => {
    if (!replaying || nextId === undefined) return
    const timer = setTimeout(() => setCursor(nextId), delay)
    return () => clearTimeout(timer)
  }, [replaying, nextId, delay])
  const shown = run && replaying ? staged(run, cursor) : run
  const finished = !!shown && isTerminal(shown) && !replaying
  const openRun = async (id: string) => {
    const show = () => { const url = new URL(window.location.href); url.searchParams.set('run', id); window.history.replaceState(null, '', url) }
    if (id === run?.runId) { show(); setScreen('run'); return }
    try {
      const value = await getRun(id)
      show()
      setPassage(undefined); setReceipt(undefined); setWork(false); setCompare(false); setView('latest'); setWhy(false); setToasts([]); setError('')
      setCursor(Infinity); setRun(value); setScreen('run')
    } catch { setError('That run could not be opened.') }
  }
  const deletePast = async (id: string) => {
    try {
      setPast(await deleteRun(id))
      if (id === run?.runId) { setRun(undefined); newQuestion() }
    } catch { setError('Stop the run before deleting it.') }
  }
  const newQuestion = useCallback(() => {
    const url = new URL(window.location.href); url.searchParams.delete('run'); window.history.replaceState(null, '', url)
    setScreen('home'); setPassage(undefined); setWork(false)
  }, [])
  const openSettings = () => {
    const url = new URL(window.location.href); url.searchParams.delete('run'); window.history.replaceState(null, '', url)
    if (screen !== 'settings') setBackTo(screen === 'run' ? 'run' : 'home')
    setScreen('settings'); setPassage(undefined); setWork(false)
  }
  const closeSettings = () => { if (backTo === 'run' && run) void openRun(run.runId); else newQuestion() }

  const refreshPast = useCallback(() => { void listPastRuns().then(setPast).catch(() => { /* the sidebar keeps its last list */ }) }, [])
  const phase = run?.phase
  useEffect(refreshPast, [refreshPast, runId, phase, run?.stopped, run?.spentMinor])

  const dismiss = useCallback((id: string) => setToasts(list => list.filter(toast => toast.id !== id)), [])
  const push = useCallback((toast: Toast, ttl = 0) => {
    setToasts(list => [...list.filter(item => item.id !== toast.id), toast])
    if (ttl) setTimeout(() => dismiss(toast.id), ttl)
  }, [dismiss])

  const downloadReport = async () => {
    if (!run) return
    setError('')
    try {
      const report = await createReport(run.runId)
      const open = () => { const link = document.createElement('a'); link.href = report.url; link.target = '_blank'; link.rel = 'noopener'; document.body.append(link); link.click(); link.remove() }
      const save = () => { const link = document.createElement('a'); link.href = report.url; link.download = `researchagent-${run.runId}.pdf`; document.body.append(link); link.click(); link.remove() }
      if (report.format === 'PDF') save(); else open()
      // A PDF download is its own confirmation; only the printable fallback needs a word.
      if (report.format !== 'PDF') push({ id: 'report', tone: 'pen', icon: '↓', title: 'Opened for printing', body: 'Use Print → Save as PDF.', actions: [{ label: 'Open again', onClick: open }] })
    } catch { setError('Couldn’t create the report. Try again.'); throw new Error('report failed') }
  }
  const retry = async (intentId: string) => {
    if (!run) return
    setError('')
    if (pace !== 'real') setCursor(events.at(-1)?.id ?? 0)
    try { setRun(await retryDelivery(run.runId, intentId)) } catch { setError('Retry failed. You weren’t charged again.') }
  }

  // Results arrive as toasts; the tab, favicon and (if asked) a desktop notification carry the end state.
  const memo = useRef<{ runId?: string; verified: Set<string>; failed: Set<string>; ended: string; fallback: boolean }>({ verified: new Set(), failed: new Set(), ended: '', fallback: false })
  useEffect(() => {
    if (!shown) return
    const verified = shown.intents.filter(item => item.status === 'VERIFIED').map(item => item.intentId)
    const failed = shown.intents.filter(item => item.status === 'DELIVERY_FAILED').map(item => item.intentId)
    const fallback = !!health.labels && !health.labels.research.startsWith('fixture') && shown.labels.research.startsWith('fixture') && shown.answers.length > 0
    const state = memo.current
    const ended = finished ? shown.phase : ''
    if (state.runId !== shown.runId) { memo.current = { runId: shown.runId, verified: new Set(verified), failed: new Set(failed), ended, fallback }; return }
    const rail = shown.labels.settlement === XRPL_LABEL ? 'XRPL Testnet' : 'simulated'
    const queue: [Toast, number][] = []
    // A purchase is already on screen (the purchase card, the run bar), so it gets no toast of its own.
    for (const id of verified) if (!state.verified.has(id)) {
      state.verified.add(id)
      setTimeout(() => dismiss(`failed-${id}`), 0)
    }
    for (const id of failed) if (!state.failed.has(id)) {
      const intent = shown.intents.find(item => item.intentId === id)!
      queue.push([{ id: `failed-${id}`, tone: 'err', icon: '!', title: 'Delivery failed after payment', body: `Charged once (${money(intent.amountMinor)}, ${rail}). Retry fetches the same copy.`, actions: [{ label: 'Retry delivery', onClick: () => void retry(id), primary: true }] }, 0])
      state.failed.add(id)
    }
    if (fallback && !state.fallback) { state.fallback = true; queue.push([{ id: 'fallback', tone: 'warn', icon: '!', title: 'Research model unavailable', body: 'Showing a fixture answer instead.' }, 8000]) }
    if (ended && ended !== state.ended) {
      state.ended = ended
      // The end of a run says only that the agent is done (the spend is on the budget card); Go back is added while the run is off screen.
      const answers = validatedAnswers(shown)
      if (shown.phase === 'STOPPED' || shown.stopped) queue.push([{ id: 'end', tone: 'info', icon: '■', title: 'Run stopped', runId: shown.runId }, 0])
      else if (shown.phase === 'FAILED' && !failed.length) queue.push([{ id: 'end', tone: 'err', icon: '!', title: 'Research paused', runId: shown.runId }, 0])
      else if (shown.phase === 'DONE') {
        queue.push([{ id: 'end', tone: '', icon: '✓', title: 'Your answer is ready', runId: shown.runId }, 0])
        if (notify && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const note = new Notification('Your answer is ready · ResearchAgent', { body: leadSentence(answers.at(-1)?.conclusion ?? ''), tag: shown.runId })
          note.onclick = () => { window.focus(); void openRun(shown.runId); note.close() }
        }
      }
    }
    if (queue.length) setTimeout(() => queue.forEach(([toast, ttl]) => push(toast, ttl)), 0)
  })

  useEffect(() => {
    let title = 'ResearchAgent', icon: Parameters<typeof favicon>[0] = 'idle'
    if (screen === 'run' && shown) {
      const buying = shown.intents.find(item => !isPaid(item) && !['VERIFIED', 'SKIPPED', 'FAILED_NOT_SETTLED'].includes(item.status))
      if (shown.intents.some(item => item.status === 'DELIVERY_FAILED')) { title = '! Delivery failed · ResearchAgent'; icon = 'alert' }
      else if (finished) { title = shown.phase === 'DONE' ? '✓ Answer ready · ResearchAgent' : shown.phase === 'STOPPED' ? 'Stopped · ResearchAgent' : '! Paused · ResearchAgent'; icon = shown.phase === 'DONE' ? 'done' : shown.phase === 'FAILED' ? 'alert' : 'idle' }
      else { icon = 'work'; title = `${buying ? `Buying ${money(buying.amountMinor)}` : shown.answers.length > 1 || (shown.phase === 'ANSWER' && shown.intents.length) ? 'Rewriting answer' : shown.phase === 'DECIDE' ? 'Choosing sources' : 'Reading sources'} · ResearchAgent` }
    }
    document.title = title
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link) }
    link.href = favicon(icon)
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, dialog'))) return
      if (event.key === '.') setPresenter(open => !open)
      else if (event.key.toLowerCase() === 'w' && screen === 'run' && run) setWork(open => !open)
      else if (event.key.toLowerCase() === 'n' && ((screen === 'run' && finished) || screen === 'settings')) newQuestion()
      else if (event.key === 'Escape') setPresenter(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, run, finished, newQuestion])

  // Clarify (D8): questions as chips, then the 5 s plan card; the run starts only from the card.
  const sendAsk = async (input: AskInput) => {
    setSending(true); setError('')
    try {
      const result = await scope(input.question, clarifyNever ? 'never' : undefined)
      setPending({ input, scope: result, answers: {}, step: result.questions.length ? 'clarify' : 'plan' })
    } catch { setError('Can’t reach the server. Try again.'); throw new Error('scope failed') }
    finally { setSending(false) }
  }
  const answer = (id: string, option: string) => setPending(state => {
    if (!state) return state
    const answers = { ...state.answers, [id]: option }
    return { ...state, answers, step: state.scope.questions.every(question => answers[question.id]) ? 'plan' : 'clarify' }
  })
  const go = (plan: Plan) => {
    if (!pending) return
    const { input, answers } = pending
    setPending(undefined)
    void startRun({ ...input, plan, ...(Object.keys(answers).length ? { answers } : {}) }).catch(() => { /* error banner already set */ })
  }
  const startRun = async (input: AskInput) => {
    setSending(true); setError(''); setPassage(undefined); setCompare(false); setView('latest'); setWhy(false); setToasts([])
    try {
      const created = await ask(input)
      const url = new URL(window.location.href); url.searchParams.set('run', created.runId); window.history.replaceState(null, '', url)
      setCursor(pace === 'real' ? Infinity : 0)
      setRun(created); setScreen('run'); setDraft('')
    } catch { setError('Can’t reach the server. Try again.'); throw new Error('ask failed') }
    finally { setSending(false) }
  }
  const stopRun = async () => {
    if (!run) return
    setCursor(Infinity)
    // At stage pace the real run may already be over: then Stop only skips the replay, it can't undo a purchase.
    if (isTerminal(run)) return
    setStopping(true); setError('')
    try { setRun(await stop(run.runId)) } catch { setError('Stop request failed. Try Stop again.') } finally { setStopping(false) }
  }
  const reputationEvents = shown?.events.filter(event => event.type === 'REPUTATION').length ?? 0
  useEffect(() => {
    if (tab !== 'writers') return
    let cancelled = false
    void getReputation().then(list => { if (!cancelled) setReputation(list) }).catch(() => { /* the panel shows what the run carries */ })
    return () => { cancelled = true }
  }, [tab, reputationEvents])
  const resetWriters = () => void resetReputation().then(setReputation).catch(() => setError('Reputation reset failed.'))
  const chooseClarifyNever = (on: boolean) => { setClarifyNever(on); prefs.set(clarifyKey, on ? '1' : '0') }
  const choosePace = (value: Pace) => { setPace(value); prefs.set(paceKey, value) }
  const chooseNotify = (on: boolean) => {
    setNotify(on); prefs.set(notifyKey, on ? '1' : '0')
    if (on && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  }
  const labels = <Modes quiet labels={shown?.labels} configured={health.labels} />
  const toggle = <NavToggle open={navOpen} onToggle={() => { prefs.set(navKey, navOpen ? 'rail' : 'open'); setNavOpen(!navOpen) }} />
  // The active run's row follows the paced replay, so the sidebar never shows a purchase before the stage does.
  const listed = shown ? past.map(item => item.runId === shown.runId ? { ...item, phase: finished ? shown.phase : 'SEARCH', stopped: finished && shown.stopped, spentMinor: shown.spentMinor } : item) : past
  const nav = <Sidebar runs={listed} activeId={screen === 'run' ? runId : undefined} settingsOn={screen === 'settings'} onSettings={screen === 'settings' ? closeSettings : openSettings} busy={screen === 'run' && !!shown && !finished} open={navOpen} width={navWidth} onResize={width => { setNavWidth(width); prefs.set(navWidthKey, String(width)) }} onNew={newQuestion}
    onOpenRun={id => void openRun(id)} onPin={(id, pinned) => void pinRun(id, pinned).then(setPast).catch(() => setError('Could not update the pin.'))} onDelete={id => void deletePast(id)} />
  // A run's toast seen from another screen (Home, or another run) gets a way back to that run.
  // A toast about the run in view repeats the screen, so it waits until you leave it.
  const wayBack = toasts.filter(toast => !(toast.runId && screen === 'run' && toast.runId === runId)).map(toast => toast.runId && !(screen === 'run' && toast.runId === runId) ? { ...toast, actions: [...(toast.actions ?? []), { label: 'Go back to chat', primary: true, onClick: () => { dismiss(toast.id); void openRun(toast.runId!) } }] } : toast)
  const overlays = <>
    <Toasts toasts={wayBack} onDismiss={dismiss} />
    {presenter && <Presenter pace={pace} onPace={choosePace} faults={health.faults} busy={!!shown && !finished} onSkip={replaying ? () => setCursor(Infinity) : undefined} onClose={() => setPresenter(false)} clarifyNever={clarifyNever} onClarifyNever={chooseClarifyNever} onResetReputation={() => resetReputation().then(setReputation)} />}
  </>

  const settlement = shown?.labels.settlement ?? health.labels?.settlement ?? 'SIMULATED SGD · no real funds'
  if (screen === 'settings') return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <Settings universal={universal} budgetMinor={universalMinor} settlement={settlement} notify={notify} onBack={closeSettings} onNotify={chooseNotify}
      onUniversal={on => { setUniversal(on); prefs.set(universalKey, on ? '1' : '0') }} onBudget={minor => { setUniversalMinor(minor); prefs.set(universalMinorKey, String(minor)) }} />
    {overlays}
  </Layout>

  if (screen === 'home' || !shown) return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <main className="ra-home-wrap">
      {error && <p className="ra-banner" role="alert">{error}</p>}
      <Ask onAsk={sendAsk} busy={sending || !!pending || (!!shown && !finished)} above={pending && (pending.step === 'clarify'
        ? <ClarifyChips questions={pending.scope.questions} answers={pending.answers} onAnswer={answer} onSkip={() => setPending({ ...pending, step: 'plan' })} />
        : <ActionModal plan={pending.scope.plan} writers={pending.scope.writers} onGo={go} onCancel={() => setPending(undefined)} />)} settlement={settlement} universalMinor={universal ? universalMinor : undefined} onSettings={openSettings} draft={draft} onDraft={setDraft} picked={picked} onPick={setPicked} />
    </main>
    {overlays}
  </Layout>

  const intents = shown.intents.filter(item => item.runId === shown.runId)
  return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <div className="ra-ws">
      <main className="ra-brief">
        <h1 className="ra-q">{shown.question}</h1>
        {error && <p className="ra-banner" role="alert">{error}</p>}
        {!compare && <Sources run={shown} onOpen={candidate => setPassage({ candidate })} />}
        <Answer run={shown} view={view} onView={setView} compare={compare} onCompare={() => { setView('latest'); setCompare(!compare) }}
          onCitation={citation => { const candidate = candidateOf(shown, citation); if (candidate) setPassage({ candidate, citation }) }}
          report={<ReportButton run={shown} onReport={downloadReport} busy={!finished} />} />
      </main>
      <aside className="ra-side" aria-label="Budget and purchases">
        <div className="ra-tabs" role="tablist" aria-label="Right panel">
          <button type="button" role="tab" aria-selected={tab === 'run'} onClick={() => setTab('run')}>Run</button>
          <button type="button" role="tab" aria-selected={tab === 'writers'} onClick={() => setTab('writers')}>Writers</button>
        </div>
        {tab === 'writers' ? <ReputationPanel records={reputation} run={shown} full={run} presenter={presenter} onReset={resetWriters} /> : <>
        <Budget run={shown} />
        {[...intents].reverse().map(intent => <Purchase key={intent.intentId} run={shown} intent={intent} onRetry={id => void retry(id)} onReceipt={setReceipt} />)}
        <DecisionPanel run={shown} fold={!why && (finished || intents.some(isPaid))} onWhy={() => setWhy(true)} />
        </>}
      </aside>
      <RunTape run={shown} replaying={replaying} realDone={isTerminal(run)} onStop={() => void stopRun()} stopping={stopping} onShowWork={() => setWork(true)} />
    </div>
    {passage && <Passage candidate={passage.candidate} content={getAccessibleContent(shown, passage.candidate)} citation={passage.citation} onClose={() => setPassage(undefined)} />}
    {receipt && <Receipt run={shown} receipt={receipt} onClose={() => setReceipt(undefined)} />}
    {work && <ShowWork run={shown} configured={health.labels} onClose={() => setWork(false)} />}
    {overlays}
  </Layout>
}
