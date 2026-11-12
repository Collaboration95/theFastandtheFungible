import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BUDGET, ModeLabelsSchema, XRPL_LABEL, type Ask as AskInput, type Citation, type ModeLabels, type Plan, type PublicCandidate, type ReputationRecord, type Receipt as ReceiptData, type RunSnapshot } from '../shared/contracts/index.js'
import { ApiError, ask, createReport, deleteRun, getDemoStatus, getReputation, getRun, listPastRuns, pinRun, resetReputation, retryDelivery, scope, stop, streamRun, type HostedDemoStatus, type PastRun, type ScopeResult } from './api'
import { canAsk, homeState, HostedContext, questionCap, refusal, type Hosted } from './hosted'
import { dwell, isPaid, isTerminal, runEvents, SPEED, staged, type Pace } from './stage'
import { candidateOf, favicon, leadSentence, money } from './format'
import Layout from './components/Layout'
import Sidebar, { NAV_WIDTH, NavToggle } from './components/Sidebar'
import EnvIndicator from './components/EnvIndicator'
import { environmentLabel } from '../shared/presentation'
import { runSettled } from '../shared/anchor-status'
import HostedEnv from './components/hosted/HostedEnv'
import { HostedComposerNote, HostedIntro, HostedWaiting } from './components/hosted/HostedHome'
import HostedRunNotice from './components/hosted/HostedRunNotice'
import Notice from './components/Notice'
import Ask from './components/Ask'
import AgentSprite from './components/AgentSprite'
const Settings = lazy(() => import('./components/Settings'))
import RunActivity from './components/RunActivity'
import Sources, { getAccessibleContent } from './components/Sources'
import Answer, { validatedAnswers } from './components/Answer'
import MobileSpend from './components/MobileSpend'
import ReportButton from './components/ReportButton'
const AnswerRating = lazy(() => import('./components/AnswerRating').catch(() => ({ default: () => null })))
const PaymentStepper = lazy(() => import('./components/PaymentStepper'))
import SpendPanel from './components/SpendPanel'
import DecisionPanel from './components/DecisionPanel'
const Passage = lazy(() => import('./components/Passage'))
const ReceiptSheet = lazy(() => import('./components/ReceiptSheet'))
const ShowWork = lazy(() => import('./components/ShowWork'))
import LoadingSheet from './components/LoadingSheet'
const Presenter = lazy(() => import('./components/Presenter'))
import Toasts, { type Toast } from './components/Toasts'
import ClarifyChips from './components/ClarifyChips'
import PlanSheet from './components/PlanSheet'
import type { ChatMessage } from './components/ChatThread'
const ChatThread = lazy(() => import('./components/ChatThread'))
const ReputationPanel = lazy(() => import('./components/ReputationPanel'))
import CommandPalette, { type Command } from './components/CommandPalette'
import { deriveRunState } from './runState'
import { offlineNotice, planNotice } from './notices'
import Icon from './components/Icon'
import Connecting from './components/Connecting'
import { warmVerifier } from './warm-verifier'
import { modifier } from './shortcuts'
import { exampleQuestions } from '../shared/contracts/examples'
import { recordedRunLabel } from '../shared/recorded-run-label'

const browserDemo = import.meta.env.MODE === 'browser-demo'
const paceKey = 'researchagent.pace', notifyKey = 'researchagent.notify', clarifyKey = 'researchagent.clarify-never', navKey = 'researchagent.nav', navWidthKey = 'researchagent.nav-width'
const universalKey = 'researchagent.budget-universal', universalMinorKey = 'researchagent.budget-universal-minor'
/** A saved budget in minor units: 0 to the maximum, in 5-cent steps; anything else falls back to the default. */
const savedBudget = (value: string | null) => { const minor = Number(value); return value !== null && Number.isInteger(minor) && minor >= 0 && minor <= BUDGET.maxMinor && minor % BUDGET.stepMinor === 0 ? minor : BUDGET.initialMinor }
const prefs = {
  get(key: string) { try { return localStorage.getItem(key) } catch { return null } },
  set(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
}
const recordRequested = () => new URLSearchParams(window.location.search).get('record') === '1'
function initialPace(recording: boolean): Pace {
  if (recording || browserDemo) return 'stage'
  // Old staged preferences must not delay financial truth in normal use.
  prefs.set(paceKey, 'real')
  return 'real'
}

/** `hosted`: the server's demo status when this is the hosted judge demo (read once at boot in main.tsx). */
/** An end-of-run toast is a courtesy, not a pending task: it clears itself so it never lingers on another screen. */
const END_TOAST_MS = 10_000
export default function App({ hosted: boot, bootFailed = false }: { hosted?: HostedDemoStatus; bootFailed?: boolean } = {}) {
  const [recording] = useState(() => !boot && recordRequested())
  const [palette, setPalette] = useState<'commands' | 'shortcuts'>()
  const [writersLoading, setWritersLoading] = useState(false)
  const [writersError, setWritersError] = useState('')
  const [healthError, setHealthError] = useState(false)
  const [run, setRun] = useState<RunSnapshot>()
  const [screen, setScreen] = useState<'home' | 'run' | 'settings' | 'chat'>(!boot && (new URLSearchParams(location.search).has('settings') || new URLSearchParams(location.search).has('onboarding')) ? 'settings' : 'home')
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
  const [pace, setPace] = useState<Pace>(() => initialPace(recording))
  const [health, setHealth] = useState<{ labels?: ModeLabels; faults: boolean; answerRatings: boolean; realCorpus?: boolean }>({ faults: false, answerRatings: false })

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
  const [tab, setTab] = useState<'run' | 'writers'>(new URLSearchParams(location.search).has('writers') ? 'writers' : 'run')
  const [reputation, setReputation] = useState<ReputationRecord[]>([])
  const [clarifyNever, setClarifyNever] = useState(() => !recording && (new URLSearchParams(window.location.search).get('clarify') === 'never' || prefs.get(clarifyKey) === '1'))
  const [navOpen, setNavOpen] = useState(() => !recording && !(typeof matchMedia === 'function' && matchMedia('(max-width: 780px)').matches) && prefs.get(navKey) !== 'rail')
  useEffect(() => {
    const narrow = matchMedia('(max-width: 780px)')
    const close = () => { if (narrow.matches) setNavOpen(false) }
    narrow.addEventListener('change', close)
    return () => narrow.removeEventListener('change', close)
  }, [])
  // Settings → Universal budget per query: every question uses it, and Home shows a chip instead of the slider.
  const [universal, setUniversal] = useState(() => !recording && prefs.get(universalKey) === '1')
  const [universalMinor, setUniversalMinor] = useState(() => savedBudget(prefs.get(universalMinorKey)))
  const [navWidth, setNavWidth] = useState(() => { const saved = Number(prefs.get(navWidthKey)); return saved >= NAV_WIDTH.min && saved <= NAV_WIDTH.max ? saved : NAV_WIDTH.initial })
  const [why, setWhy] = useState(false)
  const [past, setPast] = useState<PastRun[]>([])
  // Hosted judge demo: server-authoritative status, polled; the first-visit environment note is local-only and inline.
  const [demo, setDemo] = useState<HostedDemoStatus | undefined>(boot)
  const [connection, setConnection] = useState<Hosted['connection']>()
  const [detecting, setDetecting] = useState(bootFailed)
  const [waiting, setWaiting] = useState<{ input: AskInput; since: number }>()
  // One Idempotency-Key per hosted question: its scope and its submit share it, and re-asking the same text reuses it.
  const draftKey = useRef<{ question: string; key: string }>(undefined)
  const keyFor = (question: string) => { if (draftKey.current?.question !== question) draftKey.current = { question, key: crypto.randomUUID() }; return draftKey.current.key }
  const onStatus = useRef<(status: HostedDemoStatus) => void>(undefined)
  const refreshDemo = useCallback(async () => {
    try { const next = await getDemoStatus(); setDemo(next); setConnection(undefined); setDetecting(false); onStatus.current?.(next) }
    catch (failure) {
      if (failure instanceof ApiError && [404, 405].includes(failure.status)) { setDetecting(false); return }
      setConnection(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unreachable')
    }
  }, [])
  const hosted = useMemo<Hosted | undefined>(() => demo && { status: demo, connection }, [demo, connection])
  const ownQueued = !!demo?.queue?.some(item => (item.position ?? 0) > 0)
  useEffect(() => {
    if (!demo && !detecting) return
    const tick = () => { if (!document.hidden) void refreshDemo() }
    const timer = setInterval(tick, waiting || ownQueued || connection || detecting ? 3000 : 15000)
    const offline = () => setConnection('offline')
    const online = () => { setConnection(undefined); setError(current => current.startsWith('You’re offline.') || current === 'Connection lost. Reconnecting…' ? '' : current); tick() }
    window.addEventListener('online', online); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', tick) }
  }, [demo, detecting, waiting, ownQueued, connection, refreshDemo])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/health').then(response => response.json()).then(data => { if (!cancelled) setHealth({ labels: ModeLabelsSchema.safeParse(data.labels).data, faults: data.faults === true, answerRatings: data.answerRatings === true, realCorpus: data.corpusProfile === 'real' }) }).catch(() => { if (!cancelled) setHealthError(true) })

    // Home is the default; a run opens only when the URL names it (a refresh keeps it). Past runs live in the sidebar.
    const id = new URLSearchParams(window.location.search).get('run')
    if (id) void getRun(id).then(value => { if (!cancelled) { setRun(value); setScreen('run') } }).catch(() => {
      // Unknown run: stay on Home. A hosted run opens only in the browser that asked it, for 24 hours.
      if (cancelled || !boot) return
      const url = new URL(window.location.href); url.searchParams.delete('run'); window.history.replaceState(null, '', url)
      setError('That question isn’t available here. Questions on the shared demo are private to the browser that asked them and kept for 24 hours.')
    })
    return () => { cancelled = true }
  }, [boot])
  const runId = run?.runId
  // A finished run with final payments and its ledger anchor gets nothing more: it is read in full, with no live stream,
  // and a live stream closes once the run settles. Behind the hosted proxies a closed tab's stream stayed open on the
  // server and counted against the visitor (H5).
  const settled = !!run && runSettled(run)
  useEffect(() => {
    if (!runId || settled) return
    let phaseSeen = ''
    return streamRun(runId, { onSnapshot: value => {
      // The hosted allowance and queue move with the run; re-read them when its phase changes.
      if (boot && value.phase + value.stopped !== phaseSeen) { phaseSeen = value.phase + value.stopped; void refreshDemo() }
      setRun(value); setError(current => current === 'Connection lost. Reconnecting…' ? '' : current) }, onEvent: () => {}, onError: () => setError('Connection lost. Reconnecting…') })
  }, [runId, settled, boot, refreshDemo])

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
  const runHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (screen === 'run') runHeading.current?.focus() }, [screen, runId])
  const done = run?.phase === 'DONE'
  useEffect(() => { if (done && !browserDemo) return warmVerifier() }, [done])
  const returningToQuestion = useRef(false)
  useEffect(() => {
    if (pending || sending) {
      returningToQuestion.current = true
      if (sending && !pending) document.getElementById('main')?.focus()
      return
    }
    if (returningToQuestion.current && screen === 'home') document.querySelector<HTMLTextAreaElement>('.ra-qbox')?.focus()
    returningToQuestion.current = false
  }, [pending, sending, screen])
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
  /** Hosted "Clear my history": hides every finished run of this visitor. Unresolved payments keep their journals. */
  const clearHistory = async () => {
    let list = past
    for (const item of past.filter(item => item.stopped || ['DONE', 'FAILED', 'STOPPED'].includes(item.phase))) {
      try { list = await deleteRun(item.runId) } catch { /* a run still settling stays listed */ }
      if (item.runId === run?.runId) { setRun(undefined); newQuestion() }
    }
    setPast(list)
  }
  const deletePast = async (id: string) => {
    try {
      setPast(await deleteRun(id))
      if (id === run?.runId) { setRun(undefined); newQuestion() }
    } catch { setError('Stop the run before deleting it.') }
  }
  const newQuestion = useCallback(() => {
    const url = new URL(window.location.href); url.searchParams.delete('run'); url.searchParams.delete('settings'); url.searchParams.delete('onboarding'); window.history.replaceState(null, '', url)
    if (matchMedia('(max-width: 780px)').matches) setNavOpen(false)
    setTab('run'); setDraft(''); setReceipt(undefined); setScreen('home'); setPassage(undefined); setWork(false); setThread([]); setPending(undefined)
  }, [])
  const openSettings = () => {
    setTab('run')
    const url = new URL(window.location.href); url.searchParams.delete('run'); window.history.replaceState(null, '', url)
    if (screen !== 'settings') setBackTo(screen === 'run' ? 'run' : screen === 'chat' ? 'chat' : 'home')
    if ((window as unknown as {desktop?:unknown}).desktop) { const url = new URL(location.href); url.searchParams.set('settings','1'); history.replaceState(null,'',url) }
    setScreen('settings'); setPassage(undefined); setWork(false)
  }
  const closeSettings = () => { const url = new URL(location.href); url.searchParams.delete('settings'); url.searchParams.delete('onboarding'); history.replaceState(null,'',url); if (backTo === 'run' && run) void openRun(run.runId); else if (backTo === 'chat' && thread.length) setScreen('chat'); else setScreen('home') }

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
    const rail = environmentLabel(shown.labels.settlement)
    const queue: [Toast, number][] = []
    // A purchase is already on screen (the purchase card, the run bar), so it gets no toast of its own.
    for (const id of verified) if (!state.verified.has(id)) {
      state.verified.add(id)
      setTimeout(() => dismiss(`failed-${id}`), 0)
    }
    for (const id of failed) if (!state.failed.has(id)) {
      const intent = shown.intents.find(item => item.intentId === id)!
      queue.push([{ id: `failed-${id}`, tone: 'err', icon: '!', title: 'The article didn’t arrive', body: `You were charged once (${money(intent.amountMinor)}, ${rail}). Retrying fetches the same article, with no second charge.`, actions: [{ label: 'Retry delivery', onClick: () => void retry(id), primary: true }] }, 0])
      state.failed.add(id)
    }
    if (fallback) state.fallback = true
    if (ended && ended !== state.ended) {
      state.ended = ended
      // The end of a run says only that the agent is done (the spend is on the budget card); Go back is added while the run is off screen.
      const answers = validatedAnswers(shown)
      if (shown.phase === 'STOPPED' || shown.stopped) queue.push([{ id: 'end', tone: 'info', icon: '■', title: 'Run stopped', runId: shown.runId }, END_TOAST_MS])
      else if (shown.phase === 'FAILED' && !failed.length) queue.push([{ id: 'end', tone: 'err', icon: '!', title: 'Run stopped early', runId: shown.runId }, 0])
      else if (shown.phase === 'DONE') {
        queue.push([{ id: 'end', tone: '', icon: '✓', title: 'Your answer is ready', runId: shown.runId }, END_TOAST_MS])
        if (notify && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const note = new Notification(`Your answer is ready (${environmentLabel(shown.labels.settlement)}) · ResearchAgent`, { body: leadSentence(answers.at(-1)?.conclusion ?? ''), tag: shown.runId })
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
      else if (model.phase === 'recovering') { title = 'Finishing after restart · ResearchAgent'; icon = 'work' }
      else if (finished) { title = model.phase === 'done' ? '✓ Answer ready · ResearchAgent' : model.phase === 'stopped' ? 'Stopped · ResearchAgent' : '! Couldn’t finish · ResearchAgent'; icon = model.phase === 'done' ? 'done' : model.phase === 'failed' ? 'alert' : 'idle' }
      else { icon = 'work'; title = `${model.phase[0].toUpperCase() + model.phase.slice(1)} · ResearchAgent` }
    }
    document.title = title
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link) }
    link.href = favicon(icon)
  })

  /** A hosted request the gateway refused: wait for a turn, show the server's state, or say plainly what happened. */
  const refused = (failure: unknown, input: AskInput) => {
    const outcome = refusal(failure)
    if (outcome.kind === 'wait') { setWaiting(current => current ?? { input, since: Date.now() }); return }
    if (outcome.kind === 'retry-new-key') draftKey.current = undefined
    void refreshDemo()
    setError(outcome.kind === 'state' ? '' : outcome.text)
  }
  // Clarify (D8): questions as chips, then the 5 s plan card; the run starts only from the card.
  const sendAsk = async (input: AskInput) => {
    setSending(true); setError('')
    const key = demo ? keyFor(input.question) : undefined
    try {
      const result = await scope(input.question, clarifyNever ? 'never' : undefined, key)
      if (result.chat) { setThread([{ id: 1, question: input.question, reply: result.chat.reply, label: result.label }]); setDraft(''); setScreen('chat'); return }
      setPending({ input, scope: result, answers: {}, step: result.questions.length ? 'clarify' : 'plan' })
    } catch (failure) { if (demo) { refused(failure, input); return } setError("Can’t reach the ResearchAgent server."); throw new Error('scope failed', { cause: failure }) }
    finally { setSending(false) }
  }
  // A follow-up on the chat page: a chat reply joins the thread; a research question opens the plan card there,
  // with the budget from Home (or Settings' universal budget), and Go starts the run as usual.
  const sendChat = async (question: string) => {
    const id = (thread.at(-1)?.id ?? 0) + 1
    const settle = (patch: Partial<ChatMessage>) => setThread(list => list.map(item => item.id === id ? { ...item, ...patch } : item))
    setThread(list => [...list, { id, question }]); setSending(true)
    try {
      const result = await scope(question, clarifyNever ? 'never' : undefined, demo ? keyFor(question) : undefined)
      if (result.chat) settle({ reply: result.chat.reply, label: result.label })
      else setPending({ input: { question, budgetMinor: universal ? universalMinor : picked }, scope: result, answers: {}, step: result.questions.length ? 'clarify' : 'plan' })
    } catch (failure) { settle({ error: demo ? refusal(failure).text || 'The shared demo can’t take a question right now.' : 'Can’t reach the server. Try again.' }) }
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
      const created = await ask(input, demo ? keyFor(input.question) : undefined)
      draftKey.current = undefined
      const url = new URL(window.location.href); url.searchParams.set('run', created.runId); window.history.replaceState(null, '', url)
      setCursor(pace === 'real' ? Infinity : 0)
      setRun(created); setTab('run'); setScreen('run'); setDraft('')
    } catch (failure) { if (demo) { const { plan: _plan, answers: _answers, ...retry } = input; refused(failure, retry); return } setError("Can’t reach the ResearchAgent server."); throw new Error('ask failed', { cause: failure }) }
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
  useEffect(() => {
    onStatus.current = next => {
      if (!waiting) return
      if (Date.now() - waiting.since > 180_000) { setWaiting(undefined); setError('The shared demo stayed busy for three minutes. Your question is still here; ask again in a moment.'); return }
      if (next.state !== 'ready' || !next.capabilities.scope) return
      setWaiting(undefined)
      void sendAsk(waiting.input).catch(() => { /* refusal copy already shown */ })
    }
  })
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
    ...exampleQuestions(browserDemo ? undefined : shown?.labels.settlement ?? health.labels?.settlement).map(preset => ({ id: `cmd-${preset.id}`, label: preset.text, group: 'Examples', run: () => { newQuestion(); setDraft(preset.text); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.ra-qbox')?.focus()) } })),
    { id: 'cmd-budget', label: 'Set budget', run: () => { newQuestion(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.ra-budget-chip')?.click()) } },
    ...(shown ? [{ id: 'cmd-work', label: 'Show work', hint: 'W', run: () => { switchView('run'); setWork(true) } }] : []),
    ...past.slice(0, 3).map(item => ({ id: `cmd-recent-${item.runId}`, label: item.question, group: 'Recent runs', run: () => { setTab('run'); void openRun(item.runId) } })),
    ...(demo ? [] : [{ id: 'cmd-record', label: recording ? 'Leave record mode' : 'Record mode', run: () => { const url = new URL(window.location.href); url.search = recording ? '' : '?record=1'; window.location.assign(url) } },
    { id: 'cmd-mcp', label: 'Connect an agent (MCP)', run: openSettings }]),
    ...(run && !isTerminal(run) ? [{ id: 'cmd-stop', label: 'Stop buying', hint: `${modifier}.`, run: () => void stopRun() }] : []),
    { id: 'cmd-ask', label: 'Submit question / Go now', hint: `${modifier}↵`, run: () => { if (pending?.step === 'plan') go(pending.scope.plan); else document.querySelector<HTMLFormElement>('.ra-composer')?.requestSubmit() } },
    { id: 'cmd-focus', label: 'Focus question', hint: '/', run: focusAsk },
    ...(demo ? [] : [{ id: 'cmd-settings', label: 'Settings', hint: '⌘,', run: openSettings }]),
    { id: 'cmd-shortcuts', label: 'Keyboard shortcuts', hint: '?', run: () => setPalette('shortcuts') },
    ...(demo ? [] : [{ id: 'cmd-presenter', label: 'Presenter controls', hint: '.', run: () => setPresenter(true) }]),
  ]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || palette || document.querySelector('dialog[open]')) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const editing = event.target instanceof HTMLElement && !!event.target.closest('input, textarea, select, [contenteditable="true"]')
      if (mod && key === 'k') { event.preventDefault(); setPalette('commands') }
      else if (mod && key === ',') { event.preventDefault(); if (!demo) openSettings() }
      else if (mod && key === 'n') { event.preventDefault(); focusAsk() }
      else if (mod && (key === '1' || key === '2')) { event.preventDefault(); switchView(key === '1' ? 'run' : 'writers') }
      else if (mod && key === '.') { event.preventDefault(); void stopRun() }
      else if (mod && key === 'enter') { event.preventDefault(); if (pending?.step === 'plan') go(pending.scope.plan); else document.querySelector<HTMLFormElement>('.ra-composer')?.requestSubmit() }
      else if (key === 'Escape'.toLowerCase()) { if (presenter) setPresenter(false); else if (pending) cancelPending() }
      else if (!mod && !event.altKey && !editing) {
        if (key === '/') { event.preventDefault(); if (screen !== 'home') focusAsk(); else document.querySelector<HTMLTextAreaElement>('.ra-qbox')?.focus() }
        else if (key === '?') { event.preventDefault(); setPalette('shortcuts') }
        else if (key === '.' && !recording && !demo) setPresenter(open => !open)
        else if (key === 'w' && shown) setWork(open => !open)
        else if (key === 'n') focusAsk()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const labels = <>{(replaying || recording || browserDemo) && <span className="ra-caption">Replay</span>}<nav className="ra-main-views" aria-label="Workspace views"><button aria-current={screen !== 'settings' && tab === 'run' ? 'page' : undefined} onClick={() => switchView('run')}>Run <kbd>{modifier}1</kbd></button><button aria-current={screen !== 'settings' && tab === 'writers' ? 'page' : undefined} onClick={() => switchView('writers')}>Writers <kbd>{modifier}2</kbd></button></nav>{!browserDemo && (hosted ? <HostedEnv hosted={hosted} /> : <EnvIndicator realCorpus={health.realCorpus} labels={shown?.labels ?? health.labels} recording={recording} />)}<button className="ra-command-trigger" onClick={() => setPalette('commands')} aria-label="Open commands"><Icon name="search" size={16} /><kbd>{modifier}K</kbd></button></>
  const toggle = <NavToggle open={navOpen} onToggle={() => { prefs.set(navKey, navOpen ? 'rail' : 'open'); setNavOpen(!navOpen) }} />
  // The active run's row follows the paced replay, so the sidebar never shows a purchase before the stage does.
  const listed = shown ? past.map(item => item.runId === shown.runId ? { ...item, phase: model.phase === 'recovering' ? 'READ_PAID' : finished ? shown.phase : 'SEARCH', stopped: finished && shown.stopped, spentMinor: shown.spentMinor } : item) : past
  const nav = <Sidebar onView={view => { switchView(view); setNavOpen(false) }} runs={listed} activeId={screen === 'run' ? runId : undefined} settingsOn={screen === 'settings'} onSettings={demo ? undefined : screen === 'settings' ? closeSettings : openSettings} onClose={() => setNavOpen(false)} hosted={demo ? { onClear: clearHistory } : undefined} busy={screen === 'run' && !!shown && !finished} open={navOpen} width={navWidth} onResize={width => { setNavWidth(width); prefs.set(navWidthKey, String(width)) }} onNew={newQuestion}
    onOpenRun={id => { if (matchMedia('(max-width: 780px)').matches) setNavOpen(false); void openRun(id) }} onPin={(id, pinned) => void pinRun(id, pinned).then(setPast).catch(() => setError('Could not update the pin.'))} onDelete={id => void deletePast(id)} />
  // A run's toast seen from another screen (Home, or another run) gets a way back to that run.
  // A toast about the run in view repeats the screen, so it waits until you leave it.
  const wayBack = toasts.filter(toast => !(toast.runId && screen === 'run' && toast.runId === runId)).map(toast => toast.runId && !(screen === 'run' && toast.runId === runId) ? { ...toast, actions: [...(toast.actions ?? []), { label: 'Back to answer', primary: true, onClick: () => { dismiss(toast.id); void openRun(toast.runId!) } }] } : toast)
  const overlays = <>
    <Toasts toasts={recording ? [] : wayBack} onDismiss={dismiss} />
    {palette && <CommandPalette commands={commands} sheet={palette === 'shortcuts'} onClose={() => setPalette(undefined)} />}
    {presenter && !recording && !demo && <Suspense fallback={<p role="status">Loading presenter…</p>}><Presenter pace={pace} onPace={choosePace} faults={health.faults} busy={!!shown && !finished} onSkip={replaying ? () => setCursor(Infinity) : undefined} onClose={() => setPresenter(false)} clarifyNever={clarifyNever} onClarifyNever={chooseClarifyNever} onResetReputation={() => resetReputation().then(setReputation)} /></Suspense>}
  </>

  const pendingCard = pending && (pending.step === 'clarify'
    ? <ClarifyChips questions={pending.scope.questions} answers={pending.answers} onAnswer={answer} onSkip={() => setPending({ ...pending, step: 'plan' })} />
    : <PlanSheet capMinor={BUDGET.capMinor} budgetMinor={pending.input.budgetMinor} plan={pending.scope.plan} writers={pending.scope.writers} onGo={go} onCancel={cancelPending} />)
  const settlement = shown?.labels.settlement ?? health.labels?.settlement ?? 'SIMULATED SGD · no real funds'
  const provide = (node: ReactNode) => <HostedContext.Provider value={hosted}>{node}</HostedContext.Provider>
  // Hosted errors are specific and retry on their own; the local banner keeps its reload.
  const notice = finished && connection === 'offline' ? "You're offline. This result is final; it refreshes when you reconnect."
    : finished && error === 'Connection lost. Reconnecting…' ? 'The result is final. Trying to reconnect for ledger updates…' : error
  const banner = hosted ? notice && <p className="ra-banner" role="alert">{notice}</p>
    : (error || healthError) && <p className="ra-banner" role="alert">{error || "Can’t reach the ResearchAgent server."} <button className="ra-link" onClick={() => window.location.reload()}>Try again</button></p>
  const state = hosted && homeState(hosted)
  if (detecting && !hosted) return <Connecting />
  if (tab === 'writers') return provide(<Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}><main id="main" tabIndex={-1} className="ra-writers-view"><h1>Writers</h1>{writersError && <p role="alert">{writersError}</p>}{writersLoading ? <p role="status" className="ra-writer-loading"><AgentSprite animation="search" />Loading writer reputation…</p> : <Suspense fallback={<p role="status" style={{ minHeight: 420 }}>Loading writers…</p>}><ReputationPanel records={reputation} run={shown} full={run} /></Suspense>}{overlays}</main></Layout>)
  if (screen === 'settings' && !hosted) return provide(<Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <Suspense fallback={<main id="main" tabIndex={-1} className="ra-settings"><h1>Settings</h1><p role="status">Loading settings…</p></main>}><Settings realCorpus={health.realCorpus} universal={universal} budgetMinor={universalMinor} settlement={settlement} notify={notify} onBack={closeSettings} onNotify={chooseNotify}
      onUniversal={on => { setUniversal(on); prefs.set(universalKey, on ? '1' : '0') }} onBudget={minor => { setUniversalMinor(minor); prefs.set(universalMinorKey, String(minor)) }} /></Suspense>
    {overlays}
  </Layout>)

  if (screen === 'chat') return provide(<Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <Suspense fallback={<main id="main" tabIndex={-1} style={{ minHeight: 420 }}><p role="status">Loading conversation…</p></main>}><ChatThread messages={thread} busy={sending || !!pending || (!!state && !canAsk(state))} onSend={sendChat} above={pendingCard} /></Suspense>
    {overlays}
  </Layout>)

  if (screen === 'home' || screen === 'settings' || !shown) return provide(<Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <main id="main" tabIndex={-1} className={`ra-home-wrap${hosted ? ' is-hosted' : ''}`}>
      {banner}
      {hosted && state
        ? <Ask onAsk={sendAsk} busy={!canAsk(state) || sending || !!pending || !!waiting || (!!shown && !finished)} above={waiting ? <HostedWaiting hosted={hosted} onCancel={() => setWaiting(undefined)} /> : pendingCard} settlement={settlement} draft={draft} onDraft={setDraft} picked={Math.min(picked, Math.floor(questionCap(hosted.status) / 5) * 5)} onPick={setPicked}
            intro={<HostedIntro hosted={hosted} state={state} />} closed={!canAsk(state)} budgetMax={Math.floor(questionCap(hosted.status) / 5) * 5} composerNote={canAsk(state) ? <HostedComposerNote hosted={hosted} state={state} /> : undefined}
            placeholder={settlement.startsWith('XRPL') ? 'Ask about XRPL payments, escrow, x402 or agent wallets…' : undefined} examplesLabel="Questions that answer well today" />
        : <Ask onAsk={sendAsk} busy={healthError || sending || !!pending || (!!shown && !finished)} above={pendingCard} settlement={settlement} universalMinor={!browserDemo && universal ? universalMinor : undefined} onSettings={openSettings} draft={draft} onDraft={setDraft} picked={picked} onPick={setPicked}
            />}
    </main>
    {overlays}
  </Layout>)

  return provide(<Layout labels={labels} toggle={toggle} nav={nav} navWidth={navWidth}>
    <div className="ra-ws">
      <main id="main" tabIndex={-1} className="ra-brief">
        <h1 ref={runHeading} tabIndex={-1} className="ra-q" onKeyDown={event => { if (event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); document.querySelector<HTMLButtonElement>('.ra-show-work')?.focus() } }}>{shown.question}</h1>
        <MobileSpend run={shown} onRetry={id => void retry(id)} onReceipt={setReceipt} />
        <RunActivity run={shown} actualTerminal={!!run && isTerminal(run)} onStop={() => void stopRun()} stopping={stopping} onShowWork={() => setWork(true)} />
        {hosted && <HostedRunNotice hosted={hosted} run={shown} stopping={stopping} onCancel={() => void stopRun()} />}
        {shown.intents.some(intent => intent.escrow?.mode === 'key-reveal') && <Suspense fallback={<p role="status">Loading payment steps…</p>}><PaymentStepper run={shown} clockAt={recording || browserDemo || shown !== run ? Date.parse(shown.events.at(-1)?.at ?? '') : undefined} /></Suspense>}
        {/* Replace the draft reading surface when the activity timeline closes. */}
        <Fragment key={`${shown.runId}:${finished ? 'final' : 'draft'}`}>
        {model.phase === 'recovering' && <Notice>Payment verified. Resume the answer to finish recovery. <button className="ra-link" onClick={() => { const paid = shown.intents.find(i => i.status === 'VERIFIED' && (!shown.checkpoint?.intentId || i.intentId === shown.checkpoint.intentId)); if (paid) void retry(paid.intentId) }}>Resume answer</button></Notice>}
        {model.phase === 'recovering' && shown.intents.some(i => i.escrow?.mode === 'key-reveal') && <Notice>Waiting for the writer to release the key. Funds return after the ledger confirms cancellation if the writer doesn’t release it.</Notice>}
        {shown.phase === 'FAILED' && model.phase !== 'recovering' && <Notice tone="error">{shown.intents.some(i => i.status === 'DELIVERY_FAILED') ? 'Delivery incomplete. Retry delivery in Payments.' : 'The run could not finish. Start a new question.'}</Notice>}
        {offlineNotice(shown) && !!health.labels && !health.labels.research.startsWith('fixture') && <Notice tone="warn">{offlineNotice(shown)}</Notice>}
        {!!health.labels && !health.labels.research.startsWith('fixture') && planNotice(shown.labels.plan) && <Notice tone="warn">{planNotice(shown.labels.plan)}</Notice>}
        {shown.labels.decision.startsWith('fixture') && !!health.labels && !health.labels.decision.startsWith('fixture') && <Notice tone="warn">Decided by offline rules: the decision model was unavailable.</Notice>}
        {/* The hosted demo searches by keyword by design: its environment indicator says so once, not a warning on every answer. */}
        {!hosted && shown.labels.search?.startsWith('keyword') && !!health.labels && !health.labels.research.startsWith('fixture') && <Notice tone="warn">Keyword search only: embeddings were unavailable.</Notice>}
        {shown.intents.filter(i => i.status === 'REFUNDED').map(i => <Notice key={i.intentId}>{candidateOf(shown, i)?.publisher ?? 'The writer'}’s article didn’t contain what it promised, so it was refunded and not used.</Notice>)}
        {banner}
        {!compare && <Sources run={shown} onOpen={candidate => setPassage({ candidate })} />}
        {browserDemo && <p className="ra-replay-provenance ra-note">{recordedRunLabel(shown)}</p>}
        <Answer run={shown} view={view} onView={setView} compare={compare} onCompare={() => { setView('latest'); setCompare(!compare) }}
          onCitation={citation => { const candidate = candidateOf(shown, citation); if (candidate) setPassage({ candidate, citation }) }}
          report={finished ? <ReportButton run={shown} onReport={downloadReport} onCompare={() => { setView('latest'); setCompare(true) }} /> : undefined} />
        {!browserDemo && health.answerRatings && finished && shown.spentMinor > 0 && validatedAnswers(shown).length > 0 && <Suspense fallback={null}><AnswerRating key={shown.runId} runId={shown.runId} amountMinor={shown.spentMinor} /></Suspense>}
        </Fragment>
      </main>
      <aside className="ra-side" aria-label="Budget and purchases">
        <SpendPanel run={shown} onRetry={id => void retry(id)} onReceipt={setReceipt} />
        {model.budgetBlocked && <p className="ra-note">Budget too small for eligible sources. Raise the budget on a new question.</p>}
        {model.phase === 'stopped' && !hosted && <p role="status">{model.stopMessage}</p>}
        {shown.receipts.length > 0 && <details className="ra-decision-details"><summary>Why this article</summary><DecisionPanel run={shown} fold={!why && (finished || shown.intents.some(isPaid))} onWhy={() => setWhy(true)} /></details>}
      </aside>

    </div>
    {passage && <Suspense fallback={<LoadingSheet label="Passage" className="ra-passage" onClose={() => setPassage(undefined)} />}><Passage candidate={passage.candidate} content={getAccessibleContent(shown, passage.candidate)} citation={passage.citation} onClose={() => setPassage(undefined)} /></Suspense>}
    {receipt && <Suspense fallback={<LoadingSheet label="Receipt" className="ra-receipt-sheet" onClose={() => setReceipt(undefined)} />}><ReceiptSheet run={shown} receipt={receipt} onClose={() => setReceipt(undefined)} /></Suspense>}
    {work && <Suspense fallback={<LoadingSheet label="Show work" className="ra-sheet" onClose={() => setWork(false)} />}><ShowWork run={shown} configured={health.labels} onClose={() => setWork(false)} /></Suspense>}
    {overlays}
  </Layout>)
}
