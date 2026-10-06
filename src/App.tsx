import { useCallback, useEffect, useRef, useState } from 'react'
import { ModeLabelsSchema, XRPL_LABEL, type Ask as AskInput, type Citation, type ModeLabels, type PublicCandidate, type Receipt as ReceiptData, type RunSnapshot } from '../shared/contracts/index.js'
import { ask, createReport, getRun, retryDelivery, stop, streamRun } from './api'
import { dwell, isPaid, isTerminal, runEvents, SPEED, staged, type Pace } from './stage'
import { candidateOf, favicon, leadSentence, money } from './format'
import Layout from './components/Layout'
import Modes from './components/Modes'
import Ask from './components/Ask'
import RunTape from './components/RunTape'
import Sources, { getAccessibleContent } from './components/Sources'
import Answer, { validatedAnswers } from './components/Answer'
import ReportButton from './components/ReportButton'
import Budget from './components/Budget'
import DecisionPanel from './components/DecisionPanel'
import Purchase from './components/Purchase'
import Ledger from './components/Ledger'
import Passage from './components/Passage'
import Receipt from './components/Receipt'
import ShowWork from './components/ShowWork'
import Presenter from './components/Presenter'
import Toasts, { type Toast } from './components/Toasts'

const activeKey = 'researchagent.october.active-run'
const paceKey = 'researchagent.pace', notifyKey = 'researchagent.notify'
const prefs = {
  get(key: string) { try { return localStorage.getItem(key) } catch { return null } },
  set(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* private mode */ } },
  remove(key: string) { try { localStorage.removeItem(key) } catch { /* private mode */ } },
}
function initialPace(): Pace {
  const value = new URLSearchParams(window.location.search).get('pace') ?? prefs.get(paceKey)
  return value === 'real' || value === 'slow' ? value : 'stage'
}
const crumb = (question: string) => question.length > 52 ? `${question.slice(0, 50).trimEnd()}…` : question

export default function App() {
  const [run, setRun] = useState<RunSnapshot>()
  const [screen, setScreen] = useState<'home' | 'run'>('home')
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

  useEffect(() => {
    let cancelled = false
    void fetch('/api/health').then(response => response.json()).then(data => { if (!cancelled) setHealth({ labels: ModeLabelsSchema.safeParse(data.labels).data, faults: data.faults === true }) }).catch(() => { /* labels fall back to the run's own */ })
    const id = new URLSearchParams(window.location.search).get('run') ?? prefs.get(activeKey)
    if (id) void getRun(id).then(value => { if (!cancelled) { setRun(value); setScreen('run') } }).catch(() => prefs.remove(activeKey))
    return () => { cancelled = true }
  }, [])
  const runId = run?.runId
  useEffect(() => {
    if (!runId) return
    return streamRun(runId, { onSnapshot: setRun, onEvent: () => {}, onError: () => setError('Connection interrupted. The server preserves the run and reconnects automatically.') })
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
      push(report.format === 'PDF'
        ? { id: 'report', tone: 'pen', icon: '↓', title: 'Report ready', body: 'Findings, what the purchase changed, open questions and receipts, with the same citation numbers.', actions: [{ label: 'Open PDF', onClick: open, primary: true }, { label: 'Download again', onClick: save }] }
        : { id: 'report', tone: 'pen', icon: '↓', title: 'Report opened as printable HTML', body: 'The PDF engine wasn’t available. Use your browser’s Print to save a PDF.', actions: [{ label: 'Open again', onClick: open }] })
    } catch { setError('Report generation failed. Your last answer and receipts remain available; try again.'); throw new Error('report failed') }
  }
  const retry = async (intentId: string) => {
    if (!run) return
    setError('')
    if (pace !== 'real') setCursor(events.at(-1)?.id ?? 0)
    try { setRun(await retryDelivery(run.runId, intentId)) } catch { setError('Delivery could not be retried. The charge remains recorded; no new purchase was made.') }
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
    for (const id of verified) if (!state.verified.has(id)) {
      const intent = shown.intents.find(item => item.intentId === id)!
      queue.push([{ id: `bought-${id}`, tone: 'pen', receipt: true, icon: '✓', title: `Bought ${candidateOf(shown, intent)?.publisher ?? intent.resourceId}`, body: `${money(intent.amountMinor)} · sha-256 verified · ${shown.labels.settlement}` }, 6000])
      state.verified.add(id)
      setTimeout(() => dismiss(`failed-${id}`), 0)
    }
    for (const id of failed) if (!state.failed.has(id)) {
      const intent = shown.intents.find(item => item.intentId === id)!
      queue.push([{ id: `failed-${id}`, tone: 'err', icon: '!', title: 'Delivery failed after payment', body: `Charged once (${money(intent.amountMinor)}, ${rail}). Retry fetches the same copy.`, actions: [{ label: 'Retry delivery', onClick: () => void retry(id), primary: true }] }, 0])
      state.failed.add(id)
    }
    if (fallback && !state.fallback) { state.fallback = true; queue.push([{ id: 'fallback', tone: 'warn', icon: '!', title: 'Research model unavailable', body: 'Showing a labelled fixture answer built from the same verified passages.' }, 8000]) }
    if (ended && ended !== state.ended) {
      state.ended = ended
      const answers = validatedAnswers(shown)
      const spend = `${money(shown.spentMinor)} of ${money(shown.budgetMinor)} spent`
      const would = shown.decisions[0]?.rows.filter(row => row.wouldBuy) ?? []
      if (shown.phase === 'STOPPED' || shown.stopped) queue.push([{ id: 'end', tone: 'info', icon: '■', title: 'Stopped', body: `No new purchases will start. ${spend}. The latest answer stays.` }, 6000])
      else if (shown.phase === 'FAILED' && !failed.length) queue.push([{ id: 'end', tone: 'err', icon: '!', title: 'Research paused', body: 'The last verified answer is kept. You can ask again.' }, 0])
      else if (shown.phase === 'DONE') {
        const body = shown.budgetMinor === 0 && would.length ? `Free sources only. It would have bought ${would.length} source${would.length === 1 ? '' : 's'} for ${money(would.reduce((sum, row) => sum + row.candidate.price.amountMinor, 0))}.`
          : !shown.intents.some(isPaid) ? `Nothing was worth buying. ${spend}.`
            : shown.impact ? `v${answers.at(-1)?.version ?? 2} ${shown.impact.classification.toLowerCase()} the free answer · ${spend}` : spend
        queue.push([{ id: 'end', tone: '', icon: '✓', title: 'Answer ready', body, actions: [{ label: 'Download report', onClick: () => void downloadReport().catch(() => {}), primary: true }, ...(answers.length > 1 ? [{ label: `Compare v1 → v${answers.at(-1)!.version}`, onClick: () => { setView('latest'); setCompare(true) } }] : [])] }, 0])
        if (notify && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const note = new Notification('Answer ready · ResearchAgent', { body: `${leadSentence(answers.at(-1)?.conclusion ?? '')} ${spend} (${rail}).`, tag: shown.runId })
          note.onclick = () => { window.focus(); note.close() }
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
      else if (event.key === 'Escape') setPresenter(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, run])

  const sendAsk = async (input: AskInput) => {
    setSending(true); setError(''); setPassage(undefined); setCompare(false); setView('latest'); setToasts([])
    try {
      const created = await ask(input)
      prefs.set(activeKey, created.runId)
      const url = new URL(window.location.href); url.searchParams.set('run', created.runId); window.history.replaceState(null, '', url)
      setCursor(pace === 'real' ? Infinity : 0)
      setRun(created); setScreen('run')
    } catch { setError('The API is unavailable. Start the demo processes, then ask again.'); throw new Error('ask failed') }
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
  const choosePace = (value: Pace) => { setPace(value); prefs.set(paceKey, value) }
  const chooseNotify = (on: boolean) => {
    setNotify(on); prefs.set(notifyKey, on ? '1' : '0')
    if (on && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  }
  const labels = <Modes labels={shown?.labels} configured={health.labels} />
  const overlays = <>
    <Toasts toasts={toasts} onDismiss={dismiss} />
    {presenter && <Presenter pace={pace} onPace={choosePace} faults={health.faults} busy={!!shown && !finished} onClose={() => setPresenter(false)} />}
  </>

  if (screen === 'home' || !shown) return <Layout labels={labels} action={run ? <button type="button" className="ra-btn" onClick={() => setScreen('run')}>Back to the last run</button> : undefined}>
    <main className="ra-home-wrap">
      {error && <p className="ra-banner" role="alert">{error}</p>}
      <Ask onAsk={sendAsk} busy={sending || (!!shown && !finished)} settlement={shown?.labels.settlement ?? health.labels?.settlement ?? 'SIMULATED SGD · no real funds'} notify={notify} onNotify={chooseNotify} />
    </main>
    {overlays}
  </Layout>

  const intents = shown.intents.filter(item => item.runId === shown.runId)
  const asked = runEvents(shown)[0]?.at
  return <Layout crumb={crumb(shown.question)} labels={labels} action={<button type="button" className="ra-btn" disabled={!finished} title={finished ? undefined : 'Available when the run ends, or after Stop buying'} onClick={() => { const url = new URL(window.location.href); url.searchParams.delete('run'); window.history.replaceState(null, '', url); setScreen('home'); setPassage(undefined); setWork(false) }}>New question</button>}>
    <div className="ra-ws">
      <RunTape run={shown} replaying={replaying} realDone={isTerminal(run)} onStop={() => void stopRun()} stopping={stopping} onShowWork={() => setWork(true)} />
      <main className="ra-brief">
        <p className="ra-eyebrow">Question · Budget {money(shown.budgetMinor)}{asked ? ` · asked ${new Date(asked).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        <h1 className="ra-q">{shown.question}</h1>
        {error && <p className="ra-banner" role="alert">{error}</p>}
        {!compare && <Sources run={shown} onOpen={candidate => setPassage({ candidate })} />}
        <Answer run={shown} view={view} onView={setView} compare={compare} onCompare={() => { setView('latest'); setCompare(!compare) }}
          onCitation={citation => { const candidate = candidateOf(shown, citation); if (candidate) setPassage({ candidate, citation }) }}
          report={<ReportButton run={shown} onReport={downloadReport} busy={!finished} />} />
      </main>
      <aside className="ra-side" aria-label="Budget and purchases">
        <Budget run={shown} />
        {[...intents].reverse().map(intent => <Purchase key={intent.intentId} run={shown} intent={intent} onRetry={id => void retry(id)} onReceipt={setReceipt} />)}
        <DecisionPanel run={shown} />
        {!intents.length && shown.budgetMinor > 0 && !shown.decisions.length && <section className="ra-panel is-idle" aria-label="Purchases"><div className="ra-panel-h"><h2>Purchases</h2></div><p>Each purchase shows 402 → quote → settle → delivery → sha-256 here. One charge per source, even on retry.</p></section>}
        <Ledger run={shown} />
      </aside>
    </div>
    {passage && <Passage candidate={passage.candidate} content={getAccessibleContent(shown, passage.candidate)} citation={passage.citation} onClose={() => setPassage(undefined)} />}
    {receipt && <Receipt run={shown} receipt={receipt} onClose={() => setReceipt(undefined)} />}
    {work && <ShowWork run={shown} onClose={() => setWork(false)} />}
    {overlays}
  </Layout>
}
