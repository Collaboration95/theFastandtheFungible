import { z } from 'zod'
import { AskSchema, LedgerViewSchema, ReputationRecordSchema, RunSnapshotSchema, ScopeSchema, TraceEventSchema } from '../shared/contracts/index.js'
import type { Ask, LedgerView, ReputationRecord, RunSnapshot, Scope, TraceEvent } from '../shared/contracts/index.js'

const runPath = (runId: string) => `/runs/${encodeURIComponent(runId)}`

async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { ...(body === undefined ? { method: 'GET' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), ...(signal ? { signal } : {}) })
  // Do not reflect arbitrary server error bodies (which may contain secrets).
  if (!response.ok) throw new Error(`ResearchAgent request failed (HTTP ${response.status})`)
  return response.json()
}

export async function getLedger(): Promise<LedgerView> {
  return LedgerViewSchema.parse(await request('/api/ledger'))
}
/** Clarify step (D8): questions and a plan, never a purchase. `writers` is optional until the server sends a count. */
export type ScopeResult = Scope & { label?: string; writers?: number }
export async function scope(question: string, clarify?: 'never'): Promise<ScopeResult> {
  return ScopeSchema.extend({ label: z.string().optional(), writers: z.number().int().nonnegative().optional() }).parse(await request('/api/scope', { question, ...(clarify ? { clarify } : {}) }))
}
const ReputationListSchema = z.object({ publishers: z.array(ReputationRecordSchema) })
export async function getReputation(): Promise<ReputationRecord[]> {
  return ReputationListSchema.parse(await request('/api/reputation')).publishers
}
export async function resetReputation(): Promise<ReputationRecord[]> {
  return ReputationListSchema.parse(await request('/api/reputation/reset', {})).publishers
}
export async function ask(input: Ask): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request('/runs', AskSchema.parse(input)))
}
export const PastRunSchema = z.object({ runId: z.string(), question: z.string(), phase: z.string(), stopped: z.boolean(), budgetMinor: z.number(), spentMinor: z.number(), at: z.string(), pinned: z.boolean() })
export type PastRun = z.infer<typeof PastRunSchema>
const pastRuns = async (response: Response) => { if (!response.ok) throw new Error(`ResearchAgent request failed (HTTP ${response.status})`); return z.array(PastRunSchema).parse(await response.json()) }
export const listPastRuns = async () => pastRuns(await fetch('/api/runs'))
export const pinRun = async (runId: string, pinned: boolean) => pastRuns(await fetch(`/api${runPath(runId)}/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned }) }))
export const deleteRun = async (runId: string) => pastRuns(await fetch(`/api${runPath(runId)}`, { method: 'DELETE' }))
export async function getRun(runId: string, signal?: AbortSignal): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(runPath(runId), undefined, signal))
}
export async function stop(runId: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(`${runPath(runId)}/stop`, {}))
}
export async function retryDelivery(runId: string, intentId: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(`${runPath(runId)}/retry-delivery`, { intentId }))
}
export async function createReport(runId: string): Promise<{ format: 'PDF' | 'HTML'; url: string }> {
  const report = z.object({ format: z.enum(['PDF', 'HTML']), url: z.string().min(1) }).parse(await request(`${runPath(runId)}/report`, {}))
  const url = new URL(report.url, window.location.href)
  const desktopReport = window.location.protocol === 'app:' && url.protocol === 'app:' && url.host === 'researchagent' && /^\/runs\/[a-f0-9-]+\/report\.html$/.test(url.pathname)
  if ((!['http:', 'https:'].includes(url.protocol) && !desktopReport) || url.username || url.password) throw new Error('Unsafe report URL')
  return report
}

export function streamRun(runId: string, handlers: {
  onSnapshot: (run: RunSnapshot) => void
  onEvent: (event: TraceEvent) => void
  onError?: (error: Error) => void
}): () => void {
  const source = new EventSource(`${runPath(runId)}/events`)
  let closed = false
  let latest: RunSnapshot | undefined
  let frontier = 0
  let snapshotAt = Date.now()
  let recovering = false
  let revision = 0
  const abort = new AbortController()
  const terminal = (run: RunSnapshot) => ['DONE', 'STOPPED', 'FAILED'].includes(run.phase)
  const accept = (run: RunSnapshot) => {
    const cursor = run.events.reduce((max, event) => Math.max(max, event.id), 0)
    // A GET begun before an SSE update must never roll back money or event state.
    if (closed || run.runId !== runId || cursor < frontier || (latest && (
      run.spentMinor < latest.spentMinor || (run.refundedMinor ?? 0) < (latest.refundedMinor ?? 0)
      || latest.receipts.some(receipt => !run.receipts.some(next => next.receiptId === receipt.receiptId))
      || (terminal(latest) && !terminal(run) && cursor === frontier)))) return false
    frontier = cursor
    latest = run
    revision++
    snapshotAt = Date.now()
    handlers.onSnapshot(run)
    return true
  }
  const recover = async () => {
    if (closed || recovering) return
    recovering = true
    const started = revision
    try {
      const run = await getRun(runId, abort.signal)
      if (started === revision && accept(run) && terminal(run)) unsubscribe()
    } catch {
      if (!closed) handlers.onError?.(new Error('Run resynchronization failed; retrying the same run'))
    } finally { recovering = false }
  }
  // Heartbeats do not carry snapshots. A quiet or oversized stream still has a
  // durable GET; this path never admits or retries a research/purchase intent.
  const timer = setInterval(() => {
    if (Date.now() - snapshotAt >= 5000 && (!latest || !terminal(latest))) void recover()
  }, 5000)
  const snapshot = (event: MessageEvent<string>) => {
    if (closed) return
    const parsed = parseMessage(event.data, RunSnapshotSchema)
    if (parsed !== undefined) accept(parsed)
  }
  const trace = (event: MessageEvent<string>) => {
    if (closed) return
    const parsed = parseMessage(event.data, TraceEventSchema)
    if (parsed !== undefined && parsed.runId === runId) { frontier = Math.max(frontier, parsed.id); handlers.onEvent(parsed) }
  }
  function parseMessage<T>(data: string, schema: z.ZodType<T>): T | undefined {
    try { return schema.parse(JSON.parse(data)) }
    catch { handlers.onError?.(new Error('Invalid run stream payload')); return undefined }
  }
  const error = () => {
    if (!closed) void recover()
  }
  source.addEventListener('snapshot', snapshot)
  source.addEventListener('trace', trace)
  source.addEventListener('error', error)
  function unsubscribe() {
    if (closed) return
    closed = true
    clearInterval(timer)
    abort.abort()
    source.removeEventListener('snapshot', snapshot)
    source.removeEventListener('trace', trace)
    source.removeEventListener('error', error)
    source.close()
  }
  return unsubscribe
}
