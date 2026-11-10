import { z } from 'zod'
import { AskSchema, LedgerViewSchema, ReputationRecordSchema, RunSnapshotSchema, ScopeSchema, TraceEventSchema } from '../shared/contracts/index.js'
import type { Ask, LedgerView, ReputationRecord, RunSnapshot, Scope, TraceEvent } from '../shared/contracts/index.js'

const runPath = (runId: string) => `/runs/${encodeURIComponent(runId)}`

/** A failed request: the HTTP status and, for the hosted gateway, its short error code. Never the raw body. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code?: string, readonly retryAfter?: number) { super(`ResearchAgent request failed (HTTP ${status})`) }
}
// Hosted gateway session (server-authoritative). Local and desktop never set it, so their requests are unchanged.
let hostedCsrf: string | undefined
export const isHostedSession = () => hostedCsrf !== undefined
const CODE = /^[a-z][a-z_]{1,39}$/
async function failure(response: Response): Promise<ApiError> {
  // Do not reflect arbitrary server error bodies (which may contain secrets): only a short known-shape code.
  let code: string | undefined
  try { const body = await response.json() as { error?: unknown; code?: unknown }; const value = typeof body.code === 'string' ? body.code : body.error; if (typeof value === 'string' && CODE.test(value)) code = value } catch { /* not JSON */ }
  const after = Number(response.headers?.get?.('Retry-After'))
  return new ApiError(response.status, code, Number.isFinite(after) && after > 0 ? after : undefined)
}
type Send = { body?: unknown; method?: 'GET' | 'POST' | 'DELETE'; signal?: AbortSignal; key?: string }
async function send(path: string, { body, method = body === undefined ? 'GET' : 'POST', signal, key }: Send, retried = false): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (hostedCsrf !== undefined && method !== 'GET') { headers['X-CSRF-Token'] = hostedCsrf; if (key) headers['Idempotency-Key'] = key }
  const response = await fetch(path, { method, ...(Object.keys(headers).length ? { headers } : {}), ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}) })
  if (response.ok) return response
  const error = await failure(response)
  // A hosted session can expire (24 h): the gateway issues a new cookie, so fetch its token once and repeat the same request.
  if (hostedCsrf !== undefined && !retried && error.status === 403 && error.code === 'csrf_denied') { await getDemoStatus(); return send(path, { body, method, signal, key }, true) }
  throw error
}
async function request(path: string, body?: unknown, signal?: AbortSignal, key?: string): Promise<unknown> {
  return (await send(path, { body, signal, key })).json()
}

export async function getLedger(): Promise<LedgerView> {
  return LedgerViewSchema.parse(await request('/api/ledger'))
}
/** Clarify step (D8): questions and a plan, never a purchase. `writers` is optional until the server sends a count. */
export type ScopeResult = Scope & { label?: string; writers?: number }
export async function scope(question: string, clarify?: 'never', key?: string): Promise<ScopeResult> {
  return ScopeSchema.extend({ label: z.string().optional(), writers: z.number().int().nonnegative().optional() }).parse(await request('/api/scope', { question, ...(clarify ? { clarify } : {}) }, undefined, key))
}
const ReputationListSchema = z.object({ publishers: z.array(ReputationRecordSchema) })
export async function getReputation(): Promise<ReputationRecord[]> {
  return ReputationListSchema.parse(await request('/api/reputation')).publishers
}
export async function resetReputation(): Promise<ReputationRecord[]> {
  return ReputationListSchema.parse(await request('/api/reputation/reset', {})).publishers
}
/** `key` (hosted only) is the question's Idempotency-Key: the same key as its scope, kept across network retries. */
export async function ask(input: Ask, key?: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request('/runs', AskSchema.parse(input), undefined, key))
}
export const PastRunSchema = z.object({ runId: z.string(), question: z.string(), phase: z.string(), stopped: z.boolean(), budgetMinor: z.number(), spentMinor: z.number(), at: z.string(), pinned: z.boolean() })
export type PastRun = z.infer<typeof PastRunSchema>
const pastRuns = async (response: Response) => z.array(PastRunSchema).parse(await response.json())
export const listPastRuns = async () => pastRuns(await send('/api/runs', {}))
export const pinRun = async (runId: string, pinned: boolean) => pastRuns(await send(`/api${runPath(runId)}/pin`, { body: { pinned } }))
export const deleteRun = async (runId: string) => pastRuns(await send(`/api${runPath(runId)}`, { method: 'DELETE' }))
export async function getRun(runId: string, signal?: AbortSignal): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(runPath(runId), undefined, signal))
}
export async function stop(runId: string): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(`${runPath(runId)}/stop`, {}))
}
export async function retryDelivery(runId: string, intentId: string, key = hostedCsrf === undefined ? undefined : crypto.randomUUID()): Promise<RunSnapshot> {
  return RunSnapshotSchema.parse(await request(`${runPath(runId)}/retry-delivery`, { intentId }, undefined, key))
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
  if (import.meta.env.MODE === 'browser-demo') return () => {}
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

/** Server-authoritative hosted capabilities. HU owns presentation and mutation headers. */
const HostedDemoStatusSchema = z.object({
  questionCapMinor: z.number().int().min(0).max(200).optional(),
  state: z.enum(['ready', 'paused', 'busy', 'degraded', 'ended']),
  capabilities: z.object({ ask: z.boolean(), scope: z.boolean(), history: z.boolean(), receipts: z.boolean(), pdf: z.literal(false), settings: z.literal(false), faultControls: z.literal(false) }),
  remaining: z.object({ questions: z.number().int().nonnegative(), minor: z.number().int().nonnegative() }),
  labels: z.object({ models: z.string().max(200), rail: z.string().max(200) }),
  links: z.object({ repo: z.string().max(500), deck: z.string().max(500), video: z.string().max(500), progress: z.string().max(500), replay: z.string().max(500) }),
  csrfToken: z.string().max(200).optional(),
  queue: z.array(z.object({ runId: z.string(), position: z.number().int().nonnegative().nullable(), expiresAt: z.string() })).max(16).optional(),
})
export type HostedDemoStatus = z.infer<typeof HostedDemoStatusSchema>
export async function getDemoStatus(signal?: AbortSignal): Promise<HostedDemoStatus> {
  const response = await fetch('/api/demo/status', signal ? { signal } : undefined)
  // The paused shell answers 503 with the same bounded status body.
  let body: unknown
  try { body = await response.json() } catch { throw new ApiError(response.status) }
  // A local or desktop server answers 200 {hosted:false} instead of a 404, so the browser console stays clean; detectHosted reads it as "not hosted".
  if (typeof body === 'object' && body !== null && (body as { hosted?: unknown }).hosted === false) throw new ApiError(404)
  const status = HostedDemoStatusSchema.safeParse(body)
  if (!status.success) throw new ApiError(response.ok ? 502 : response.status)
  if (status.data.csrfToken) hostedCsrf = status.data.csrfToken
  else hostedCsrf ??= ''
  return status.data
}
/** Boot: is this a hosted gateway? 404 means local or desktop. A transient failure is retried briefly, then reported. */
export async function detectHosted(attempts = 3): Promise<{ status?: HostedDemoStatus; failed: boolean }> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return { status: await getDemoStatus(AbortSignal.timeout(4000)), failed: false } }
    catch (error) {
      if (error instanceof ApiError && [404, 405].includes(error.status)) return { failed: false }
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  return { failed: true }
}

/** Proof of refusal (lane W1): may this finished decline be shared, and has it been? The server decides; the words are its. */
const RefusalProofSchema = z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), path: z.string().regex(/^\/proof\/[a-f0-9]{32}$/), createdAt: z.string() })
const RefusalStatusSchema = z.object({ eligible: z.boolean(), code: z.string().max(40).optional(), message: z.string().max(300).optional(), proof: RefusalProofSchema.optional() })
export type RefusalStatus = z.infer<typeof RefusalStatusSchema>
export type RefusalProof = z.infer<typeof RefusalProofSchema>
export const getRefusalProof = async (runId: string, signal?: AbortSignal): Promise<RefusalStatus> => RefusalStatusSchema.parse(await request(`/api${runPath(runId)}/proof`, undefined, signal))
/** Creates the public snapshot, or returns the one already made for this run. Needs the visitor's explicit click. */
export async function createRefusalProof(runId: string): Promise<RefusalProof> {
  return z.object({ proof: RefusalProofSchema }).parse(await (await send(`/api${runPath(runId)}/proof`, { method: 'POST' })).json()).proof
}
