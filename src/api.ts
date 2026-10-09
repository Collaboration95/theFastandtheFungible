import { z } from 'zod'
import { AnswerDraftSchema, AskSchema, LedgerViewSchema, ReputationRecordSchema, RunSnapshotSchema, ScopeSchema, TraceEventSchema } from '../shared/contracts/index.js'
import type { AnswerDraft, Ask, LedgerView, ReputationRecord, RunSnapshot, Scope, TraceEvent } from '../shared/contracts/index.js'

const runPath = (runId: string) => `/runs/${encodeURIComponent(runId)}`

async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, body === undefined ? { method: 'GET' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
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
export async function getRun(runId: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(runPath(runId)))
}
export async function stop(runId: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(`${runPath(runId)}/stop`, {}))
}
export async function retryDelivery(runId: string, intentId: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(`${runPath(runId)}/retry-delivery`, { intentId }))
}
export async function createReport(runId: string): Promise<{ format: 'PDF' | 'HTML'; url: string }> {
  const report = z.object({ format: z.enum(['PDF', 'HTML']), url: z.string().min(1) }).parse(await request(`${runPath(runId)}/report`, {}))
  const url = new URL(report.url, window.location.origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe report URL')
  return report
}

export function streamRun(runId: string, handlers: {
  onSnapshot: (run: RunSnapshot) => void
  onEvent: (event: TraceEvent) => void
  /** The answer as it is written: unvalidated, shown only as a labelled draft. */
  onDraft?: (draft: AnswerDraft) => void
  onError?: (error: Error) => void
}): () => void {
  const source = new EventSource(`${runPath(runId)}/events`)
  let closed = false
  const snapshot = (event: MessageEvent<string>) => {
    if (closed) return
    const parsed = parseMessage(event.data, RunSnapshotSchema)
    if (parsed !== undefined) handlers.onSnapshot(parsed)
  }
  const trace = (event: MessageEvent<string>) => {
    if (closed) return
    const parsed = parseMessage(event.data, TraceEventSchema)
    if (parsed !== undefined) handlers.onEvent(parsed)
  }
  const draft = (event: MessageEvent<string>) => {
    if (closed) return
    const parsed = parseMessage(event.data, AnswerDraftSchema)
    if (parsed !== undefined) handlers.onDraft?.(parsed)
  }
  function parseMessage<T>(data: string, schema: z.ZodType<T>): T | undefined {
    try { return schema.parse(JSON.parse(data)) }
    catch { handlers.onError?.(new Error('Invalid run stream payload')); return undefined }
  }
  const error = () => {
    if (!closed) handlers.onError?.(new Error('Run stream disconnected; reconnecting automatically'))
  }
  source.addEventListener('snapshot', snapshot)
  source.addEventListener('trace', trace)
  if (handlers.onDraft) source.addEventListener('draft', draft)
  source.addEventListener('error', error)
  return () => {
    if (closed) return
    closed = true
    source.removeEventListener('snapshot', snapshot)
    source.removeEventListener('trace', trace)
    if (handlers.onDraft) source.removeEventListener('draft', draft)
    source.removeEventListener('error', error)
    source.close()
  }
}
