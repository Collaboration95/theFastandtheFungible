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
const showLabel = () => { document.querySelector('.demo-banner > span')!.textContent = active.run.labels.settlement.includes('TESTNET') ? (active.run.intents.some(i => i.escrow?.mode === 'key-reveal') ? `Recorded on XRPL Testnet · no real value · key reveal · ciphertext before grant stays quarantined; plaintext only after verified grant${active.run.intents.some(i => i.refund) ? ' · the refund is writer-signed (fixture writer cooperates)' : ''}` : 'Recorded on XRPL Testnet · no real value') : 'Replay of a recorded run · fictional writers · simulated payments' }
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
      else if (item === modules['./traces/UC3-key-reveal.json']) value = (await import('../docs/evidence/lane-b3/UC3.receipts.json')).default
    }
  } else value = active.cards[path]
  return value === undefined ? Response.json({}, { status: 404 }) : Response.json(value)
}
await import('../src/main')

const testnet = active.run.labels.settlement.includes('TESTNET')
showLabel()
const controls = document.createElement('nav')
controls.setAttribute('aria-label', 'Recorded scenarios')
for (const [label, scenario] of [['Testnet UC3 · key reveal','testnet'],['Testnet UC3 · payment','UC3-testnet'],['Testnet · writer no-show','UC-key-reveal'],['Simulated UC1','UC1'],['Simulated UC2','UC2'],['Simulated UC3','UC3']]) {
  const link = document.createElement('a'); link.textContent = label
  link.href = scenario === 'testnet' ? location.pathname : `${location.pathname}?scenario=${scenario}`
  controls.append(link)
}
const pause = document.createElement('button'); pause.textContent = 'Pause'
pause.onclick = () => { const paused = pause.textContent === 'Pause'; pause.textContent = paused ? 'Resume' : 'Pause'; window.dispatchEvent(new CustomEvent('demo-pause', {detail:paused})) }
controls.append(pause); document.querySelector('.demo-banner')!.after(controls)

if (testnet) {
  // @ts-expect-error Dependency-free browser JavaScript shared with the ledger page.
  const { refresh } = await import('../site/ledger/ledger.js')
  const rows = active === modules['./traces/UC3-key-reveal.json'] ? (await import('../docs/evidence/lane-b3/transactions.json')).default.transactions : active === modules['./traces/UC-key-reveal.json'] ? (await import('../site/ledger/transactions.json')).default.rows.filter(r => r.source === 'docs/evidence/round2-v1/transactions.json') : (await import('../docs/evidence/round2-p2/transactions.json')).default.transactions
  const panel = document.createElement('details'); panel.open = true; panel.className = 'demo-transactions'
  const summary = document.createElement('summary'); summary.textContent = active.run.intents.some(i => i.escrow?.mode === 'key-reveal') ? 'Recorded key-reveal escrows · read-only live checks' : 'Recorded Testnet payments and refund · read-only live checks'; panel.append(summary)
  const states = new Map<string, HTMLElement>()
  for (const row of rows) {
    const p = document.createElement('p'), a = document.createElement('a'), state = document.createElement('span')
    a.href = `https://testnet.xrpl.org/transactions/${row.hash}`; a.textContent = `${'label' in row ? row.label : row.kind}: ${row.hash}`; a.target = '_blank'; a.rel = 'noopener'
    state.textContent = ' · Recorded validated tesSUCCESS; checking live…'; states.set(row.hash, state); p.append(a, state); panel.append(p)
  }
  controls.after(panel)
  void refresh(rows, WebSocket, (hash: string, status: string) => { states.get(hash)!.textContent = ` · ${status}` })
}
