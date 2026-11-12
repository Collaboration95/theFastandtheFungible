import { ENV, dateSGT, shortTx } from '../shared/presentation'
import { HOSTED_APP_URL } from '../shared/links'
// This entry alone replaces transport. The production app and its presentation/gates are shared.
import './style.css'
import { RunSnapshotSchema } from '../shared/contracts/index.js'
import recordingIndex from './recording-index.json'
import { replayLabel } from './replay-label'
const modules = import.meta.glob('./traces/UC*.json', { import: 'default' })
type Recording = { run: import('../shared/contracts/index.js').RunSnapshot; scope: import('../shared/contracts/index.js').Scope; health: unknown; reputation: unknown; cards: Record<string, unknown> }
const loaded = new Map<string, Promise<Recording>>()
const loadRecording = (scenario: string) => {
  if (!loaded.has(scenario)) loaded.set(scenario, modules[`./traces/${scenario}.json`]().then(async value => {
    const recording = await value as Recording
    RunSnapshotSchema.parse(recording.run)
    return recording
  }))
  return loaded.get(scenario)!
}
const initial = new URL(location.href)
const selected = recordingIndex.find(item => item.scenario === initial.searchParams.get('scenario'))
  ?? recordingIndex.find(item => item.runId === initial.searchParams.get('run'))
  ?? recordingIndex.find(item => item.scenario === 'UC3-key-reveal')!
initial.searchParams.set('run', selected.runId)
window.history.replaceState(null, '', initial)
const visited = new Map<string, Recording>()
let active!: Recording // API reads below wait for activeReady.
const activeReady = loadRecording(selected.scenario).then(recording => { active = recording; visited.set(recording.run.runId, recording) })
const pinned = new Set<string>()
const testnetRun = (recording: Recording) => recording.run.labels.settlement.includes('TESTNET')
// Recording dates read in Singapore time, as the submission and the site do.
const recordedOn = (recording: Recording) => { const at = recording.run.events[0]?.at; return at ? dateSGT(at) : 'date unavailable' }
const scenarioOf = (recording: Recording) => { const key = recordingIndex.find(item => item.runId === recording.run.runId)?.scenario ?? ''; return key === 'UC3-key-reveal' ? '' : key }
// The title and compact date reuse the canonical replay name.
const replayName = ENV.replayShort().split(' · ')[0]
const titlePrefix = () => `${replayName} · ${recordedOn(active)} · `
const showTitle = () => {
  const prefix = titlePrefix()
  if (!document.title.startsWith(prefix)) document.title = prefix + document.title.replace(/^Replay · [^·]+ · /, '')
}
let updateTransactions: (() => Promise<void>) | undefined = undefined
const showLabel = () => {
  for (const label of document.querySelectorAll('.demo-label')) label.textContent = replayLabel(scenarioOf(active), recordedOn(active), testnetRun(active))
  document.querySelector('.demo-short')!.textContent = `${replayName} · ${recordedOn(active)}`
  showTitle()
  const picker = document.querySelector<HTMLSelectElement>('.demo-banner select')
  if (picker) picker.value = scenarioOf(active)
  void updateTransactions?.()
}
const history = () => [...visited.values()].map(({ run }) => ({ runId: run.runId, question: run.question, phase: run.phase, stopped: false, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, at: run.events[0].at, pinned: pinned.has(run.runId) }))
// No request escapes this entry: only committed recordings and in-memory navigation.
window.fetch = async (input, init) => {
  await activeReady
  const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href).pathname
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  let value: unknown
  if (path === '/api/health') value = active.health
  else if (path === '/api/scope' || path === '/runs') {
    const entry = recordingIndex.find(item => item.question === body.question && !item.testnet)
    const recording = entry ? await loadRecording(entry.scenario) : undefined
    if (!recording) return Response.json({ error: 'Choose a recorded question.' }, { status: 400 })
    active = recording; showLabel()
    if (path === '/api/scope') value = { ...recording.scope, questions: [] }
    else { visited.set(active.run.runId, active); value = active.run }
  } else if (path === '/api/reputation') value = active.reputation
  else if (path === '/api/runs') value = history()
  else if (path.startsWith('/api/runs/')) {
    const id = path.split('/')[3]
    if (init?.method === 'DELETE') visited.delete(id)
    else if (body.pinned) pinned.add(id)
    else pinned.delete(id)
    value = history()
  } else if (path.startsWith('/runs/')) {
    const entry = recordingIndex.find(item => item.runId === path.split('/')[2])
    const item = entry ? await loadRecording(entry.scenario) : undefined
    if (item) {
      active = item; showLabel()
      // Only the key-reveal UC3 recording ships its real export; other tabs have no receipts.json (404), never a run snapshot posing as one.
      if (!path.endsWith('/receipts.json')) value = item.run
      else if (entry?.scenario === 'UC3-key-reveal') value = (await import('../docs/evidence/replay-nov11/key-reveal/UC3.receipts.json')).default
    }
  } else value = active.cards[path]
  return value === undefined ? Response.json({}, { status: 404 }) : Response.json(value)
}
// Keep the labelled loading shell until the selected recording validates.
// The shared app loads afterward so it does not compete with the public question.
await activeReady
showLabel()
// App status titles can change as the replay advances; retain the selected run's date.
new MutationObserver(showTitle).observe(document.querySelector('title')!, { childList: true })
// Finish the question's font before handoff so its glyph area stays stable.
await document.fonts.load('600 24px "Replay Geist Variable"', selected.question).catch(() => undefined)
// Let the public question reach a paint before replacing the loading shell.
// Even a cached recording must not erase the loading feedback in the same frame.
await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
await import('../src/main')

const banner = document.querySelector('.demo-banner')!
const runYourself = banner.querySelector('.demo-install')!
const shell = banner.querySelector<HTMLDetailsElement>('.demo-shell')!
const options = banner.querySelector('.demo-options')!
const mobile = matchMedia('(max-width: 780px)')
const compact = () => { shell.open = !mobile.matches }
mobile.addEventListener('change', compact); compact()
const askOwn = document.createElement('a'); askOwn.href = HOSTED_APP_URL; askOwn.textContent = 'Ask your own question'; askOwn.className = 'demo-ask'
// One row: what this is, its ledger check, the scenario picker, Pause, then the ways out.
const controls = document.createElement('div'); controls.className = 'demo-controls'
const picker = document.createElement('select'); picker.setAttribute('aria-label', 'Recorded scenario')
for (const [label, scenario] of [['Key reveal + refund (start here)', ''], ['Public docs · live models', 'UC-real-content'], ['Plain payment', 'UC3-testnet'], ['Writer never reveals: money back', 'UC-key-reveal'], ['Simulated: decline', 'UC1'], ['Simulated: buy', 'UC2'], ['Simulated: refund', 'UC3']]) {
  const option = document.createElement('option'); option.value = scenario; option.textContent = label; picker.append(option)
}
picker.onchange = () => { location.href = picker.value ? `${location.pathname}?scenario=${picker.value}` : location.pathname }
const pause = document.createElement('button'); pause.textContent = 'Pause'
pause.onclick = () => { const paused = pause.textContent === 'Pause'; pause.textContent = paused ? 'Resume' : 'Pause'; window.dispatchEvent(new CustomEvent('demo-pause', {detail:paused})) }
controls.append(picker, pause)
options.append(controls, runYourself, askOwn)
showLabel()

let checkedRun: string | undefined, generation = 0
const ledgerSockets = new Set<WebSocket>()
updateTransactions = async () => {
  if (checkedRun === active.run.runId) return
  checkedRun = active.run.runId
  const current = ++generation, recording = active
  for (const socket of ledgerSockets) socket.close()
  ledgerSockets.clear()
  options.querySelector('.demo-transactions')?.remove()
  if (!testnetRun(recording)) return
  // @ts-expect-error Dependency-free browser JavaScript shared with the ledger page.
  const { refresh } = await import('../site/ledger/ledger.js')
  const rows = scenarioOf(recording) === '' ? (await import('../docs/evidence/replay-nov11/key-reveal/transactions.json')).default.transactions : scenarioOf(recording) === 'UC-key-reveal' ? (await import('../docs/evidence/round4-j1/replays/no-show/transactions.json')).default.transactions : (await import('../docs/evidence/round4-j1/replays/payment/transactions.json')).default.transactions
  if (current !== generation) return
  const panel = document.createElement('details'); panel.open = false; panel.className = 'demo-transactions'
  const summary = document.createElement('summary')
  const summaryText = document.createElement('span'), toggle = document.createElement('span')
  summaryText.textContent = `Checking ${rows.length} hashes live…`
  toggle.textContent = ' · show'; summary.append(summaryText, toggle); panel.append(summary)
  panel.ontoggle = () => { toggle.textContent = panel.open ? ' · hide' : ' · show' }
  const list = document.createElement('div'); list.className = 'demo-tx-list'; panel.append(list)
  let verified = 0, checked = 0
  const states = new Map<string, HTMLElement>()
  for (const row of rows) {
    const p = document.createElement('p'), a = document.createElement('a'), state = document.createElement('span')
    a.href = `https://testnet.xrpl.org/transactions/${row.hash}`; a.title = row.hash; a.textContent = `${'label' in row ? row.label : row.kind}: ${shortTx(row.hash)}`; a.className = 'mono'; a.target = '_blank'; a.rel = 'noopener'
    state.textContent = ' · Recorded validated tesSUCCESS; checking live…'; states.set(row.hash, state); p.append(a, state); list.append(p)
  }
  options.append(panel)
  class RecordingSocket extends WebSocket {
    constructor(url: string) {
      // A previous refresh may try its next node after the visitor changes runs.
      if (current !== generation) throw Error('Replay changed')
      super(url)
      ledgerSockets.add(this)
    }
  }
  void refresh(rows, RecordingSocket, (hash: string, status: string) => {
    if (current !== generation) return
    states.get(hash)!.textContent = ` · ${status}`
    checked++; if (status.startsWith('validated')) verified++
    summaryText.textContent = checked === rows.length
      ? `${verified}/${rows.length} hashes verified live${verified === rows.length ? '' : ' · historical evidence available'}`
      : `Checking hashes live… ${checked}/${rows.length}`
  })
}
void updateTransactions()
