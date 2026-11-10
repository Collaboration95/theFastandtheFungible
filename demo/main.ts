import { HOSTED_APP_URL } from '../shared/links'
// This entry alone replaces transport. The production app and its presentation/gates are shared.
import './style.css'
import { RunSnapshotSchema } from '../shared/contracts/index.js'
const packedModules = import.meta.glob('./traces/UC*.json', { eager: true, import: 'default' })
const modules = Object.fromEntries(await Promise.all(Object.entries(packedModules).map(async ([id, value]) => [id, await value])))
type Recording = { run: import('../shared/contracts/index.js').RunSnapshot; scope: import('../shared/contracts/index.js').Scope; health: unknown; reputation: unknown; cards: Record<string, unknown> }
const recordings = Object.values(modules) as Recording[]
for (const item of recordings) RunSnapshotSchema.parse(item.run)
let active = modules['./traces/UC3-key-reveal.json'] as Recording ?? recordings.find(r => r.run.labels.settlement.includes('TESTNET')) ?? recordings[0]
const initial = new URL(location.href)
if (!initial.searchParams.has('scenario')) { initial.searchParams.set('run', active.run.runId); window.history.replaceState(null, '', initial) }
const scenario = initial.searchParams.get('scenario')
if (scenario) { active = recordings.find(r => r === modules[`./traces/${scenario}.json`]) ?? active }
else active = recordings.find(r => r.run.runId === initial.searchParams.get('run')) ?? active
if (active === modules['./traces/UC-key-reveal.json']) {
  initial.searchParams.delete('scenario'); initial.searchParams.set('run', active.run.runId)
  window.history.replaceState(null, '', initial)
}
const visited = new Map<string, Recording>()
const pinned = new Set<string>()
const testnetRun = (recording: Recording) => recording.run.labels.settlement.includes('TESTNET')
// Recording dates read in Singapore time, as the submission and the site do.
const recordedOn = (recording: Recording) => { const at = recording.run.events[0]?.at; return at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }) : 'date unavailable' }
const scenarioOf = (recording: Recording) => { const key = Object.keys(modules).find(id => modules[id] === recording)?.match(/traces\/(.+)\.json$/)?.[1] ?? ''; return key === 'UC3-key-reveal' ? '' : key }
const showLabel = () => {
  document.querySelector('.demo-banner > span')!.textContent = `Replay · recorded ${recordedOn(active)} · ${testnetRun(active) ? 'XRPL Testnet' : 'simulated payments'}`
  const picker = document.querySelector<HTMLSelectElement>('.demo-banner select')
  if (picker) picker.value = scenarioOf(active)
}
visited.set(active.run.runId, active)
const history = () => [...visited.values()].map(({ run }) => ({ runId: run.runId, question: run.question, phase: run.phase, stopped: false, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, at: run.events[0].at, pinned: pinned.has(run.runId) }))
// No request escapes this entry: only committed recordings and in-memory navigation.
window.fetch = async (input, init) => {
  const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href).pathname
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  let value: unknown
  if (path === '/api/health') value = active.health
  else if (path === '/api/scope' || path === '/runs') {
    const recording = recordings.find(item => item.run.question === body.question && !item.run.labels.settlement.includes('TESTNET'))
    if (!recording) return Response.json({ error: 'Choose one of the three recorded questions.' }, { status: 400 })
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
    const item = recordings.find(item => item.run.runId === path.split('/')[2])
    if (item) {
      active = item; showLabel()
      // Only the key-reveal UC3 recording ships its real export; other tabs have no receipts.json (404), never a run snapshot posing as one.
      if (!path.endsWith('/receipts.json')) value = item.run
      else if (item === modules['./traces/UC3-key-reveal.json']) value = (await import('../docs/evidence/replay-nov11/key-reveal/UC3.receipts.json')).default
    }
  } else value = active.cards[path]
  return value === undefined ? Response.json({}, { status: 404 }) : Response.json(value)
}
await import('../src/main')

const testnet = testnetRun(active)
const banner = document.querySelector('.demo-banner')!
const runYourself = banner.querySelector('details')!
const askOwn = document.createElement('a'); askOwn.href = HOSTED_APP_URL; askOwn.textContent = 'Ask your own question'; askOwn.className = 'demo-ask'
// One row: what this is, its ledger check, the scenario picker, Pause, then the ways out.
const controls = document.createElement('div'); controls.className = 'demo-controls'
const picker = document.createElement('select'); picker.setAttribute('aria-label', 'Recorded scenario')
for (const [label, scenario] of [['Key reveal (start here)', ''], ['Plain payment', 'UC3-testnet'], ['Writer no-show', 'UC-key-reveal'], ['Simulated: decline', 'UC1'], ['Simulated: buy', 'UC2'], ['Simulated: refund', 'UC3']]) {
  const option = document.createElement('option'); option.value = scenario; option.textContent = label; picker.append(option)
}
picker.onchange = () => { location.href = picker.value ? `${location.pathname}?scenario=${picker.value}` : location.pathname }
const pause = document.createElement('button'); pause.textContent = 'Pause'
pause.onclick = () => { const paused = pause.textContent === 'Pause'; pause.textContent = paused ? 'Resume' : 'Pause'; window.dispatchEvent(new CustomEvent('demo-pause', {detail:paused})) }
controls.append(picker, pause)
banner.append(controls, runYourself, askOwn)
showLabel()

if (testnet) {
  // @ts-expect-error Dependency-free browser JavaScript shared with the ledger page.
  const { refresh } = await import('../site/ledger/ledger.js')
  const rows = active === modules['./traces/UC3-key-reveal.json'] ? (await import('../docs/evidence/replay-nov11/key-reveal/transactions.json')).default.transactions : active === modules['./traces/UC-key-reveal.json'] ? (await import('../docs/evidence/round4-j1/replays/no-show/transactions.json')).default.transactions : (await import('../docs/evidence/round4-j1/replays/payment/transactions.json')).default.transactions
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
    a.href = `https://testnet.xrpl.org/transactions/${row.hash}`; a.textContent = `${'label' in row ? row.label : row.kind}: ${row.hash}`; a.target = '_blank'; a.rel = 'noopener'
    state.textContent = ' · Recorded validated tesSUCCESS; checking live…'; states.set(row.hash, state); p.append(a, state); list.append(p)
  }
  banner.querySelector('.demo-banner > span')!.after(panel)
  void refresh(rows, WebSocket, (hash: string, status: string) => {
    states.get(hash)!.textContent = ` · ${status}`
    checked++; if (status.startsWith('validated')) verified++
    summaryText.textContent = checked === rows.length
      ? `${verified}/${rows.length} hashes verified live${verified === rows.length ? ' ✓' : ' · historical evidence available'}`
      : `Checking hashes live… ${checked}/${rows.length}`
  })
}
