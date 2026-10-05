import { z } from 'zod'
import { AskSchema, LedgerViewSchema, RunSnapshotSchema, TraceEventSchema } from '../shared/contracts/index.js'
import type { Ask, LedgerView, RunSnapshot, TraceEvent } from '../shared/contracts/index.js'

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
export async function ask(input: Ask): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request('/runs', AskSchema.parse(input)))
}
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
  function parseMessage<T>(data: string, schema: z.ZodType<T>): T | undefined {
    try { return schema.parse(JSON.parse(data)) }
    catch { handlers.onError?.(new Error('Invalid run stream payload')); return undefined }
  }
  const error = () => {
    if (!closed) handlers.onError?.(new Error('Run stream disconnected; reconnecting automatically'))
  }
  source.addEventListener('snapshot', snapshot)
  source.addEventListener('trace', trace)
  source.addEventListener('error', error)
  return () => {
    if (closed) return
    closed = true
    source.removeEventListener('snapshot', snapshot)
    source.removeEventListener('trace', trace)
    source.removeEventListener('error', error)
    source.close()
  }
}
