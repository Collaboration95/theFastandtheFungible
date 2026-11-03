// This entry alone replaces transport. The production app and its presentation/gates are shared.
import './style.css'
import { RunSnapshotSchema } from '../shared/contracts/index.js'
const modules = import.meta.glob('./traces/UC*.json', { eager: true, import: 'default' })
type Recording = { run: import('../shared/contracts/index.js').RunSnapshot; scope: import('../shared/contracts/index.js').Scope; health: unknown; reputation: unknown; cards: Record<string, unknown> }
const recordings = Object.values(modules) as Recording[]
for (const item of recordings) RunSnapshotSchema.parse(item.run)
let active = recordings[0]
const visited = new Map<string, Recording>()
const pinned = new Set<string>()
const history = () => [...visited.values()].map(({ run }) => ({ runId: run.runId, question: run.question, phase: run.phase, stopped: false, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, at: run.events[0].at, pinned: pinned.has(run.runId) }))
// No request escapes this entry: only committed recordings and in-memory navigation.
window.fetch = async (input, init) => {
  const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href).pathname
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  let value: unknown
  if (path === '/api/health') value = active.health
  else if (path === '/api/scope' || path === '/runs') {
    const recording = recordings.find(item => item.run.question === body.question)
    if (!recording) return Response.json({ error: 'Choose one of the three recorded questions.' }, { status: 400 })
    active = recording
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
    if (item) { active = item; value = item.run }
  } else value = active.cards[path]
  return value === undefined ? Response.json({}, { status: 404 }) : Response.json(value)
}
await import('../src/main')
