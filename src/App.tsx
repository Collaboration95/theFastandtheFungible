import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { BUDGET, ModeLabelsSchema, XRPL_LABEL, type Ask as AskInput, type Citation, type ModeLabels, type Plan, type PublicCandidate, type ReputationRecord, type Receipt as ReceiptData, type RunSnapshot } from '../shared/contracts/index.js'
import { ask, createReport, deleteRun, getReputation, getRun, listPastRuns, pinRun, resetReputation, retryDelivery, scope, stop, streamRun, type PastRun, type ScopeResult } from './api'
import { dwell, isPaid, isTerminal, runEvents, SPEED, staged, type Pace } from './stage'
import { candidateOf, favicon, leadSentence, money } from './format'
import Layout from './components/Layout'
import Sidebar, { NAV_WIDTH, NavToggle } from './components/Sidebar'
import EnvIndicator from './components/EnvIndicator'
import Notice from './components/Notice'
import Ask from './components/Ask'
import AgentSprite from './components/AgentSprite'
import Settings from './components/Settings'
import RunActivity from './components/RunActivity'
import Sources, { getAccessibleContent } from './components/Sources'
import Answer, { validatedAnswers } from './components/Answer'
import MobileSpend from './components/MobileSpend'
import ReportButton from './components/ReportButton'
import SpendPanel from './components/SpendPanel'
import DecisionPanel from './components/DecisionPanel'
import Passage from './components/Passage'
import ReceiptSheet from './components/ReceiptSheet'
import ShowWork from './components/ShowWork'
import Presenter from './components/Presenter'
import Toasts, { type Toast } from './components/Toasts'
import ClarifyChips from './components/ClarifyChips'
import PlanSheet from './components/PlanSheet'
import ChatThread, { type ChatMessage } from './components/ChatThread'
import ReputationPanel from './components/ReputationPanel'
import CommandPalette, { type Command } from './components/CommandPalette'
import { deriveRunState } from './runState'
import { modifier } from './shortcuts'
import { DEMO_QUESTIONS } from '../shared/contracts/examples'

const browserDemo = import.meta.env.MODE === 'browser-demo'
const paceKey = 'researchagent.pace', notifyKey = 'researchagent.notify', clarifyKey = 'researchagent.clarify-never', navKey = 'researchagent.nav', navWidthKey = 'researchagent.nav-width'
const universalKey = 'researchagent.budget-universal', universalMinorKey = 'researchagent.budget-universal-minor'
/** A saved budget in minor units: 0 to the maximum, in 5-cent steps; anything else falls back to the default. */
const savedBudget = (value: string | null) => { const minor = Number(value); return value !== null && Number.isInteger(minor) && minor >= 0 && minor <= BUDGET.maxMinor && minor % BUDGET.stepMinor === 0 ? minor : BUDGET.initialMinor }
const prefs = {
  get(key: string) { try { return localStorage.getItem(key) } catch { return null } },
  set(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
}
const recording = new URLSearchParams(window.location.search).get('record') === '1'
function initialPace(): Pace {
  if (recording || browserDemo) return 'stage'
  // Old staged preferences must not delay financial truth in normal use.
  prefs.set(paceKey, 'real')
  return 'real'
}

export default function App() {
  const [palette, setPalette] = useState<'commands' | 'shortcuts'>()
  const [writersLoading, setWritersLoading] = useState(false)
  const [writersError, setWritersError] = useState('')
  const [healthError, setHealthError] = useState(false)
  const [run, setRun] = useState<RunSnapshot>()
  const [screen, setScreen] = useState<'home' | 'run' | 'settings' | 'chat'>('home')
  // Settings' Back returns to the screen it was opened from; the half-typed question lives here so Home remounting keeps it.
  const [backTo, setBackTo] = useState<'home' | 'run' | 'chat'>('home')
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<number>(BUDGET.initialMinor)
  const [cursor, setCursor] = useState(browserDemo && !new URLSearchParams(location.search).has('scenario') ? 0 : Infinity)
  const [demoPaused, setDemoPaused] = useState(false)
  useEffect(() => {
    if (!browserDemo) return
    const pause = (e: Event) => setDemoPaused((e as CustomEvent<boolean>).detail)
    window.addEventListener('demo-pause', pause)
    return () => window.removeEventListener('demo-pause', pause)
  }, [])
  const [pace, setPace] = useState<Pace>(initialPace)
  const [health, setHealth] = useState<{ labels?: ModeLabels; faults: boolean }>({ faults: false })
  const [notify, setNotify] = useState(() => !recording && prefs.get(notifyKey) === '1')
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
  // A question that needs no research opens the chat page (owner, 9 Oct): a plain conversation, never saved to history, no run.
  const [thread, setThread] = useState<ChatMessage[]>([])
  const [tab, setTab] = useState<'run' | 'writers'>(browserDemo && new URLSearchParams(location.search).has('writers') ? 'writers' : 'run')
  const [reputation, setReputation] = useState<ReputationRecord[]>([])
  const [clarifyNever, setClarifyNever] = useState(() => !recording && (new URLSearchParams(window.location.search).get('clarify') === 'never' || prefs.get(clarifyKey) === '1'))
  const [navOpen, setNavOpen] = useState(() => !recording && prefs.get(navKey) !== 'rail')
  useEffect(() => {
    const narrow = matchMedia('(max-width: 780px)')
    const close = () => { if (narrow.matches) setNavOpen(false) }
    const timer = setTimeout(close, 0)
    narrow.addEventListener('change', close)
    return () => { clearTimeout(timer); narrow.removeEventListener('change', close) }
  }, [])
  // Settings → Universal budget per query: every question uses it, and Home shows a chip instead of the slider.
  const [universal, setUniversal] = useState(() => !recording && prefs.get(universalKey) === '1')
  const [universalMinor, setUniversalMinor] = useState(() => savedBudget(prefs.get(universalMinorKey)))
  const [navWidth, setNavWidth] = useState(() => { const saved = Number(prefs.get(navWidthKey)); return saved >= NAV_WIDTH.min && saved <= NAV_WIDTH.max ? saved : NAV_WIDTH.initial })
  const [why, setWhy] = useState(false)
  const [past, setPast] = useState<PastRun[]>([])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/health').then(response => response.json()).then(data => { if (!cancelled) setHealth({ labels: ModeLabelsSchema.safeParse(data.labels).data, faults: data.faults === true }) }).catch(() => { if (!cancelled) setHealthError(true) })
    // Home is the default; a run opens only when the URL names it (a refresh keeps it). Past runs live in the sidebar.
    const id = new URLSearchParams(window.location.search).get('run')
    if (id) void getRun(id).then(value => { if (!cancelled) { setRun(value); setScreen('run') } }).catch(() => { /* unknown run: stay on Home */ })
    return () => { cancelled = true }
  }, [])
  const runId = run?.runId
  useEffect(() => {
    if (!runId) return
    return streamRun(runId, { onSnapshot: value => { setRun(value); setError(current => current === 'Connection lost. Reconnecting…' ? '' : current) }, onEvent: () => {}, onError: () => setError('Connection lost. Reconnecting…') })
  }, [runId])

  // Stage pacing: reveal one trace event at a time, holding each for its dwell.
  const events = run ? runEvents(run) : []
  const next = events.find(event => event.id > cursor)
  const current = events.find(event => event.id === cursor)
  const replaying = !!run && Number.isFinite(cursor) && !(isTerminal(run) && !next)
  const nextId = next?.id
  const delay = current ? (recording ? dwell(current) * 0.28 : dwell(current)) / SPEED[pace] : 350
  useEffect(() => {
    if (demoPaused || !replaying || nextId === undefined) return
    const timer = setTimeout(() => setCursor(nextId), delay)
    return () => clearTimeout(timer)
  }, [demoPaused, replaying, nextId, delay])
  const shown = run && replaying && (recording || browserDemo || !isTerminal(run)) ? staged(run, cursor) : run
  const model = deriveRunState(shown, pending?.step)
  const finished = !!shown && model.terminal && !replaying
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
    setTab('run'); setDraft(''); setReceipt(undefined); setScreen('home'); setPassage(undefined); setWork(false); setThread([]); setPending(undefined)
  }, [])
  const openSettings = () => {
    const url = new URL(window.location.href); url.searchParams.delete('run'); window.history.replaceState(null, '', url)
    if (screen !== 'settings') setBackTo(screen === 'run' ? 'run' : screen === 'chat' ? 'chat' : 'home')
    setScreen('settings'); setPassage(undefined); setWork(false)
  }
  const closeSettings = () => { if (backTo === 'run' && run) void openRun(run.runId); else if (backTo === 'chat' && thread.length) setScreen('chat'); else setScreen('home') }

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
    if (fallback) state.fallback = true
    if (ended && ended !== state.ended) {
      state.ended = ended
      // The end of a run says only that the agent is done (the spend is on the budget card); Go back is added while the run is off screen.
      const answers = validatedAnswers(shown)
      if (shown.phase === 'STOPPED' || shown.stopped) queue.push([{ id: 'end', tone: 'info', icon: '■', title: 'Run stopped', runId: shown.runId }, 0])
      else if (shown.phase === 'FAILED' && !failed.length) queue.push([{ id: 'end', tone: 'err', icon: '!', title: 'Research paused', runId: shown.runId }, 0])
      else if (shown.phase === 'DONE') {
        queue.push([{ id: 'end', tone: '', icon: '✓', title: 'Your answer is ready', runId: shown.runId }, 0])
        if (notify && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const note = new Notification(`Your answer is ready (${shown.labels.settlement === XRPL_LABEL ? 'Testnet' : 'demo'}) · ResearchAgent`, { body: leadSentence(answers.at(-1)?.conclusion ?? ''), tag: shown.runId })
          note.onclick = () => { window.focus(); void openRun(shown.runId); note.close() }
        }
      }
    }
    if (queue.length) setTimeout(() => queue.forEach(([toast, ttl]) => push(toast, ttl)), 0)
  })

  useEffect(() => {
    let title = 'ResearchAgent', icon: Parameters<typeof favicon>[0] = 'idle'
    if (screen === 'run' && shown) {
      if (model.purchases.some(item => item.failed)) { title = '! Delivery failed · ResearchAgent'; icon = 'alert' }
      else if (model.phase === 'recovering') { title = 'Recovering · ResearchAgent'; icon = 'work' }
      else if (finished) { title = model.phase === 'done' ? '✓ Answer ready · ResearchAgent' : model.phase === 'stopped' ? 'Stopped · ResearchAgent' : '! Paused · ResearchAgent'; icon = model.phase === 'done' ? 'done' : model.phase === 'failed' ? 'alert' : 'idle' }
      else { icon = 'work'; title = `${model.phase[0].toUpperCase() + model.phase.slice(1)} · ResearchAgent` }
    }
    document.title = title
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link) }
    link.href = favicon(icon)
  })

  // Clarify (D8): questions as chips, then the 5 s plan card; the run starts only from the card.
  const sendAsk = async (input: AskInput) => {
    setSending(true); setError('')
    try {
      const result = await scope(input.question, clarifyNever ? 'never' : undefined)
      if (result.chat) { setThread([{ id: 1, question: input.question, reply: result.chat.reply, label: result.label }]); setDraft(''); setScreen('chat'); return }
      setPending({ input, scope: result, answers: {}, step: result.questions.length ? 'clarify' : 'plan' })
    } catch { setError("Can't reach the ResearchAgent server."); throw new Error('scope failed') }
    finally { setSending(false) }
  }
  // A follow-up on the chat page: a chat reply joins the thread; a research question opens the plan card there,
  // with the budget from Home (or Settings' universal budget), and Go starts the run as usual.
  const sendChat = async (question: string) => {
    const id = (thread.at(-1)?.id ?? 0) + 1
    const settle = (patch: Partial<ChatMessage>) => setThread(list => list.map(item => item.id === id ? { ...item, ...patch } : item))
    setThread(list => [...list, { id, question }]); setSending(true)
    try {
      const result = await scope(question, clarifyNever ? 'never' : undefined)
      if (result.chat) settle({ reply: result.chat.reply, label: result.label })
      else setPending({ input: { question, budgetMinor: universal ? universalMinor : picked }, scope: result, answers: {}, step: result.questions.length ? 'clarify' : 'plan' })
    } catch { settle({ error: 'Can’t reach the server. Try again.' }) }
    finally { setSending(false) }
  }
  // Cancelling a plan card on the chat page drops the unanswered message with it.
  const cancelPending = () => { setPending(undefined); if (screen === 'chat') setThread(list => list.filter(item => item.reply !== undefined || item.error)) }
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
    if (recording && (!health.labels?.research.startsWith('fixture') || !health.labels.decision.startsWith('fixture') || health.labels.settlement === XRPL_LABEL)) { setError('Record mode requires fixture providers and simulated settlement. Start make record.'); return }
    setSending(true); setError(''); setPassage(undefined); setCompare(false); setView('latest'); setWhy(false); setToasts([])
    try {
      const created = await ask(input)
      const url = new URL(window.location.href); url.searchParams.set('run', created.runId); window.history.replaceState(null, '', url)
      setCursor(pace === 'real' ? Infinity : 0)
      setRun(created); setTab('run'); setScreen('run'); setDraft('')
    } catch { setError("Can't reach the ResearchAgent server."); throw new Error('ask failed') }
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
    void getReputation().then(list => { if (!cancelled) setReputation(list) }).catch(() => { if (!cancelled) setWritersError('Could not load writers. Switch to Run and back to retry.') }).finally(() => { if (!cancelled) setWritersLoading(false) })
    return () => { cancelled = true }
  }, [tab, reputationEvents])
  const chooseClarifyNever = (on: boolean) => { setClarifyNever(on); prefs.set(clarifyKey, on ? '1' : '0') }
  const choosePace = (value: Pace) => { setPace(value); prefs.set(paceKey, value) }
  const chooseNotify = (on: boolean) => {
    setNotify(on); prefs.set(notifyKey, on ? '1' : '0')
    if (on && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  }
  const focusAsk = () => { newQuestion(); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.ra-qbox')?.focus()) }
  const switchView = (next: 'run' | 'writers') => { if (next === 'writers' && tab !== 'writers') { setWritersLoading(true); setWritersError('') } setTab(next); if (next === 'run' && run) setScreen('run'); else setScreen('home') }
  const commands: Command[] = [
    { id: 'cmd-new', label: 'New question', hint: `${modifier}N`, run: focusAsk },
    { id: 'cmd-run', label: 'Run', hint: `${modifier}1`, run: () => switchView('run') },
    { id: 'cmd-writers', label: 'Writers', hint: `${modifier}2`, run: () => switchView('writers') },
    ...DEMO_QUESTIONS.slice(0, 3).map(preset => ({ id: `cmd-${preset.id}`, label: preset.text, group: 'Examples', run: () => { newQuestion(); setDraft(preset.text); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.ra-qbox')?.focus()) } })),
    { id: 'cmd-budget', label: 'Set budget', run: () => { newQuestion(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.ra-budget-chip')?.click()) } },
    ...(shown ? [{ id: 'cmd-work', label: 'Show work', hint: 'W', run: () => { switchView('run'); setWork(true) } }] : []),
    ...past.slice(0, 3).map(item => ({ id: `cmd-recent-${item.runId}`, label: item.question, group: 'Recent runs', run: () => { setTab('run'); void openRun(item.runId) } })),
    { id: 'cmd-record', label: recording ? 'Leave record mode' : 'Record mode', run: () => { const url = new URL(window.location.href); url.search = recording ? '' : '?record=1'; window.location.assign(url) } },
    { id: 'cmd-mcp', label: 'Connect an agent (MCP)', run: () => { void navigator.clipboard.writeText('claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- make mcp').catch(() => setError('Clipboard unavailable. Run: claude mcp add researchagent -- make mcp')) } },
    ...(run && !isTerminal(run) ? [{ id: 'cmd-stop', label: 'Stop buying', hint: `${modifier}.`, run: () => void stopRun() }] : []),
    { id: 'cmd-ask', label: 'Submit question / Go now', hint: `${modifier}↵`, run: () => { if (pending?.step === 'plan') go(pending.scope.plan); else document.querySelector<HTMLFormElement>('.ra-composer')?.requestSubmit() } },
    { id: 'cmd-focus', label: 'Focus question', hint: '/', run: focusAsk },
    { id: 'cmd-shortcuts', label: 'Keyboard shortcuts', hint: '?', run: () => setPalette('shortcuts') },
    { id: 'cmd-presenter', label: 'Presenter controls', hint: '.', run: () => setPresenter(true) },
  ]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || palette || document.querySelector('dialog[open]')) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const editing = event.target instanceof HTMLElement && !!event.target.closest('input, textarea, select, [contenteditable="true"]')
      if (mod && key === 'k') { event.preventDefault(); setPalette('commands') }
      else if (mod && key === 'n') { event.preventDefault(); focusAsk() }
      else if (mod && (key === '1' || key === '2')) { event.preventDefault(); switchView(key === '1' ? 'run' : 'writers') }
      else if (mod && key === '.') { event.preventDefault(); void stopRun() }
      else if (mod && key === 'enter') { event.preventDefault(); if (pending?.step === 'plan') go(pending.scope.plan); else document.querySelector<HTMLFormElement>('.ra-composer')?.requestSubmit() }
      else if (key === 'Escape'.toLowerCase()) { if (presenter) setPresenter(false); else if (pending) cancelPending() }
      else if (!mod && !event.altKey && !editing) {
        if (key === '/') { event.preventDefault(); if (screen !== 'home') focusAsk(); else document.querySelector<HTMLTextAreaElement>('.ra-qbox')?.focus() }
        else if (key === '?') { event.preventDefault(); setPalette('shortcuts') }
        else if (key === '.' && !recording) setPresenter(open => !open)
        else if (key === 'w' && shown) setWork(open => !open)
        else if (key === 'n') focusAsk()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const labels = <>{(replaying || recording || browserDemo) && <span className="ra-caption">Replay</span>}<nav role="tablist" className="ra-main-views" aria-label="Workspace views"><button role="tab" aria-selected={tab === 'run'} onClick={() => switchView('run')}>Run <kbd>{modifier}1</kbd></button><button role="tab" aria-selected={tab === 'writers'} onClick={() => switchView('writers')}>Writers <kbd>{modifier}2</kbd></button></nav>{!browserDemo && <EnvIndicator labels={shown?.labels ?? health.labels} recording={recording} />}<button className="ra-command-trigger" onClick={() => setPalette('commands')} aria-label="Open commands"><kbd>{modifier}K</kbd></button></>
  const toggle = <NavToggle open={navOpen} onToggle={() => { prefs.set(navKey, navOpen ? 'rail' : 'open'); setNavOpen(!navOpen) }} />
  // The active run's row follows the paced replay, so the sidebar never shows a purchase before the stage does.
  const listed = shown ? past.map(item => item.runId === shown.runId ? { ...item, phase: model.phase === 'recovering' ? 'READ_PAID' : finished ? shown.phase : 'SEARCH', stopped: finished && shown.stopped, spentMinor: shown.spentMinor } : item) : past
  const nav = <Sidebar onView={view => { switchView(view); setNavOpen(false) }} runs={listed} activeId={screen === 'run' ? runId : undefined} settingsOn={screen === 'settings'} onSettings={screen === 'settings' ? closeSettings : openSettings} busy={screen === 'run' && !!shown && !finished} open={navOpen} width={navWidth} onResize={width => { setNavWidth(width); prefs.set(navWidthKey, String(width)) }} onNew={newQuestion}
    onOpenRun={id => void openRun(id)} onPin={(id, pinned) => void pinRun(id, pinned).then(setPast).catch(() => setError('Could not update the pin.'))} onDelete={id => void deletePast(id)} />
  // A run's toast seen from another screen (Home, or another run) gets a way back to that run.
  // A toast about the run in view repeats the screen, so it waits until you leave it.
  const wayBack = toasts.filter(toast => !(toast.runId && screen === 'run' && toast.runId === runId)).map(toast => toast.runId && !(screen === 'run' && toast.runId === runId) ? { ...toast, actions: [...(toast.actions ?? []), { label: 'Go back to chat', primary: true, onClick: () => { dismiss(toast.id); void openRun(toast.runId!) } }] } : toast)
  const overlays = <>
    <Toasts toasts={recording ? [] : wayBack} onDismiss={dismiss} />
    {palette && <CommandPalette commands={commands} sheet={palette === 'shortcuts'} onClose={() => setPalette(undefined)} />}
    {presenter && !recording && <Presenter pace={pace} onPace={choosePace} faults={health.faults} busy={!!shown && !finished} onSkip={replaying ? () => setCursor(Infinity) : undefined} onClose={() => setPresenter(false)} clarifyNever={clarifyNever} onClarifyNever={chooseClarifyNever} onResetReputation={() => resetReputation().then(setReputation)} />}
  </>

  const pendingCard = pending && (pending.step === 'clarify'
    ? <ClarifyChips questions={pending.scope.questions} answers={pending.answers} onAnswer={answer} onSkip={() => setPending({ ...pending, step: 'plan' })} />
    : <PlanSheet budgetMinor={pending.input.budgetMinor} plan={pending.scope.plan} writers={pending.scope.writers} onGo={go} onCancel={cancelPending} />)
  const settlement = shown?.labels.settlement ?? health.labels?.settlement ?? 'SIMULATED SGD · no real funds'
  if (tab === 'writers') return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}><main className="ra-writers-view">{writersError && <p role="alert">{writersError}</p>}{writersLoading ? <p role="status" className="ra-writer-loading"><AgentSprite animation="search" />Loading writer reputation…</p> : <ReputationPanel records={reputation} run={shown} full={run} />}{overlays}</main></Layout>
  if (screen === 'settings') return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <Settings universal={universal} budgetMinor={universalMinor} settlement={settlement} notify={notify} onBack={closeSettings} onNotify={chooseNotify}
      onUniversal={on => { setUniversal(on); prefs.set(universalKey, on ? '1' : '0') }} onBudget={minor => { setUniversalMinor(minor); prefs.set(universalMinorKey, String(minor)) }} />
    {overlays}
  </Layout>

  if (screen === 'chat') return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <ChatThread messages={thread} busy={sending || !!pending} onSend={sendChat} above={pendingCard} />
    {overlays}
  </Layout>

  if (screen === 'home' || !shown) return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <main className="ra-home-wrap">
      {(error || healthError) && <p className="ra-banner" role="alert">{error || "Can't reach the ResearchAgent server."} <button className="ra-link" onClick={() => window.location.reload()}>Try again</button></p>}
      <Ask onAsk={sendAsk} busy={healthError || sending || !!pending || (!!shown && !finished)} above={pendingCard} settlement={settlement} universalMinor={!browserDemo && universal ? universalMinor : undefined} onSettings={openSettings} draft={draft} onDraft={setDraft} picked={picked} onPick={setPicked} />
    </main>
    {overlays}
  </Layout>

    return <Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <div className="ra-ws">
      <main className="ra-brief">
        <h1 className="ra-q">{shown.question}</h1>
        <MobileSpend run={shown} onRetry={id => void retry(id)} onReceipt={setReceipt} />
        <RunActivity run={shown} actualTerminal={!!run && isTerminal(run)} onStop={() => void stopRun()} stopping={stopping} onShowWork={() => setWork(true)} />
        {/* Replace the draft reading surface when the activity timeline closes. */}
        <Fragment key={`${shown.runId}:${finished ? 'final' : 'draft'}`}>
        {model.phase === 'recovering' && <Notice>Payment verified. Resume the answer to finish recovery. <button className="ra-link" onClick={() => { const paid = shown.intents.find(i => i.status === 'VERIFIED' && (!shown.checkpoint?.intentId || i.intentId === shown.checkpoint.intentId)); if (paid) void retry(paid.intentId) }}>Resume answer</button></Notice>}
        {model.phase === 'recovering' && shown.intents.some(i => i.escrow?.mode === 'key-reveal') && <Notice>Waiting for the writer to publish the key · CancelAfter pending</Notice>}
        {shown.phase === 'FAILED' && model.phase !== 'recovering' && <Notice tone="error">{shown.intents.some(i => i.status === 'DELIVERY_FAILED') ? 'Delivery incomplete. Retry delivery in Payments.' : 'The run could not finish. Start a new question.'}</Notice>}
        {shown.labels.research.startsWith('fixture') && !!health.labels && !health.labels.research.startsWith('fixture') && <Notice tone="warn">Written from offline extracts: the model was unavailable.</Notice>}
        {shown.labels.plan?.startsWith('fixture') && !!health.labels && !health.labels.research.startsWith('fixture') && <Notice tone="warn">Planned with offline rules: the planner was unavailable.</Notice>}
        {shown.labels.decision.startsWith('fixture') && !!health.labels && !health.labels.decision.startsWith('fixture') && <Notice tone="warn">Decided by offline rules: the decision model was unavailable.</Notice>}
        {shown.labels.search?.startsWith('keyword') && !!health.labels && !health.labels.research.startsWith('fixture') && <Notice tone="warn">Keyword search only: embeddings were unavailable.</Notice>}
        {shown.intents.filter(i => i.status === 'REFUNDED').map(i => <Notice key={i.intentId}>{candidateOf(shown, i)?.publisher ?? 'The writer'}'s article didn't contain what it promised, so it was refunded and not used.</Notice>)}
        {(error || healthError) && <p className="ra-banner" role="alert">{error || "Can't reach the ResearchAgent server."} <button className="ra-link" onClick={() => window.location.reload()}>Try again</button></p>}
        {!compare && <Sources run={shown} onOpen={candidate => setPassage({ candidate })} />}
        <Answer run={shown} view={view} onView={setView} compare={compare} onCompare={() => { setView('latest'); setCompare(!compare) }}
          onCitation={citation => { const candidate = candidateOf(shown, citation); if (candidate) setPassage({ candidate, citation }) }}
          report={finished ? <ReportButton run={shown} onReport={downloadReport} onCompare={() => { setView('latest'); setCompare(true) }} /> : undefined} />
        </Fragment>
      </main>
      <aside className="ra-side" aria-label="Budget and purchases">
        <SpendPanel run={shown} onRetry={id => void retry(id)} onReceipt={setReceipt} />
        {model.budgetBlocked && <p className="ra-note">Budget too small for eligible sources. Raise the budget on a new question.</p>}
        {model.phase === 'stopped' && <p role="status">{model.stopMessage}</p>}
        <details className="ra-decision-details"><summary>Why this article</summary><DecisionPanel run={shown} fold={!why && (finished || shown.intents.some(isPaid))} onWhy={() => setWhy(true)} /></details>
      </aside>

    </div>
    {passage && <Passage candidate={passage.candidate} content={getAccessibleContent(shown, passage.candidate)} citation={passage.citation} onClose={() => setPassage(undefined)} />}
    {receipt && <ReceiptSheet run={shown} receipt={receipt} onClose={() => setReceipt(undefined)} />}
    {work && <ShowWork run={shown} configured={health.labels} onClose={() => setWork(false)} />}
    {overlays}
  </Layout>
}
