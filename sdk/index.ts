import { z } from 'zod'
import { ModeLabelsSchema, RunSnapshotSchema, type RunSnapshot, type TraceEvent } from '../shared/contracts/run.js'
import { presentRun } from './present.js'
export type { PresentedRun } from './present.js'

export type ErrorCode = 'unauthorized' | 'not_found' | 'invalid' | 'backend_unavailable'
export class ResearchAgentError extends Error {
  constructor(readonly code: ErrorCode) {
    super(`ResearchAgent: ${code}`)
    this.name = 'ResearchAgentError'
  }
}

const StatusSchema = z.object({
  labels: ModeLabelsSchema, corpusLabel: z.string(), publisherUrl: z.url(),
  maxMinor: z.number(), dailyMinor: z.number(), spentMinor: z.number(), reservedMinor: z.number(),
  paused: z.boolean().optional(), wallet: z.object({ dailyMinor: z.number(), spentMinor: z.number(), reservedMinor: z.number(), paused: z.boolean(), label: z.string(), policyVersion: z.string() }).optional(),
  agent: z.object({ id: z.string(), name: z.string(), maxMinor: z.number(), dailyMinor: z.number(), spentMinor: z.number(), reservedMinor: z.number(), spent7DaysMinor: z.number(), paused: z.boolean(), revoked: z.boolean(), rails: z.array(z.string()) }).optional(),
  rail: z.string(), payerAddress: z.string().nullable(),
})
const SearchSchema = z.object({
  labels: ModeLabelsSchema, corpusLabel: z.string(), unavailable: z.array(z.string()),
  hits: z.array(z.object({ untrusted: z.literal(true), title: z.string(), writer: z.string(), tier: z.enum(['FREE', 'PAID']),
    priceMinor: z.number(), abstract: z.string(), relevance: z.number(), url: z.url() })),
})
export type SearchResult = z.infer<typeof SearchSchema>
export type AskOptions = {
  budgetSgd: number; escrow?: boolean; idempotencyKey?: string; signal?: AbortSignal
  /** MCP keeps its existing bounded wait. By default SDK callers follow to a terminal phase. */
  waitMs?: number
}
const terminal = (run: RunSnapshot) => ['DONE', 'STOPPED', 'FAILED'].includes(run.phase)

/** Authority remains in backend policy. This client has no purchase or settlement command. */
export function createClient(options: { baseUrl: string; token?: string; fetch?: typeof fetch }) {
  const transport = options.fetch ?? globalThis.fetch
  const token = options.token ?? (typeof process !== 'undefined' ? process.env.RA_API_TOKEN : undefined)
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const request = async (path: string, init: RequestInit = {}) => {
    try {
      const response = await transport(new URL(path, options.baseUrl), {
        ...init, headers: { ...headers, ...init.headers }, redirect: 'error',
        signal: init.signal ?? AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new ResearchAgentError(response.status === 401 || response.status === 403 ? 'unauthorized'
          : response.status === 404 ? 'not_found' : response.status >= 400 && response.status < 500 ? 'invalid' : 'backend_unavailable')
      }
      return response
    } catch (error) {
      if (init.signal?.aborted) throw init.signal.reason
      if (error instanceof ResearchAgentError) throw error
      throw new ResearchAgentError('backend_unavailable')
    }
  }
  const json = async <T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> => {
    const response = await request(path, init)
    try { return schema.parse(await response.json()) }
    catch { init?.signal?.throwIfAborted(); throw new ResearchAgentError('backend_unavailable') }
  }
  const status = (signal?: AbortSignal) => json('/api/mcp/status', StatusSchema, { signal })
  const snapshot = (id: string, signal?: AbortSignal) => json(`/api/mcp/runs/${encodeURIComponent(id)}`, RunSnapshotSchema, { signal })
  const pause = (signal?: AbortSignal) => new Promise<void>((done, fail) => {
    signal?.throwIfAborted()
    const abort = () => { clearTimeout(timer); fail(signal?.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); done() }, 250)
    signal?.addEventListener('abort', abort, { once: true })
  })
  // Snapshots in the existing SSE contain the durable trace. An interrupted/unsupported stream
  // falls back to read-only polling; admission is never retried automatically.
  async function* follow(id: string, signal?: AbortSignal): AsyncGenerator<RunSnapshot> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const controller = new AbortController()
    const streamSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    let idle = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await request(`/runs/${encodeURIComponent(id)}/events`, {
        headers: { Accept: 'text/event-stream' }, signal: streamSignal,
      })
      if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
        await response.body?.cancel()
        throw new ResearchAgentError('backend_unavailable')
      }
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        clearTimeout(idle)
        idle = setTimeout(() => controller.abort(), 30_000)
        pending += decoder.decode(value, { stream: true })
        pending = pending.replace(/\r\n/g, '\n')
        let end: number
        while ((end = pending.indexOf('\n\n')) >= 0) {
          const frame = pending.slice(0, end)
          pending = pending.slice(end + 2)
          if (!frame.split('\n').includes('event: snapshot')) continue
          const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
          const run = RunSnapshotSchema.parse(JSON.parse(data))
          yield run
          if (terminal(run)) return
        }
      }
    } catch (error) {
      signal?.throwIfAborted()
      if (error instanceof ResearchAgentError && error.code === 'unauthorized') throw error
    } finally {
      clearTimeout(idle)
      controller.abort()
      await reader?.cancel().catch(() => undefined)
    }
    while (true) {
      signal?.throwIfAborted()
      const run = await snapshot(id, signal)
      yield run
      if (terminal(run)) return
      await pause(signal)
    }
  }
  return {
    search: (query: string, opts: { k?: number } = {}) => json(`/api/mcp/search?${new URLSearchParams({ query, k: String(opts.k ?? 10) })}`, SearchSchema),
    async ask(question: string, opts: AskOptions) {
      opts.signal?.throwIfAborted()
      const mode = await status(opts.signal)
      let run = await json('/api/mcp/runs', RunSnapshotSchema, { method: 'POST', signal: opts.signal,
        body: JSON.stringify({ question, budget_sgd: opts.budgetSgd, idempotency_key: opts.idempotencyKey, clarify: 'never', escrow: opts.escrow }) })
      if (!terminal(run)) {
        const wait = opts.waitMs === undefined ? undefined : AbortSignal.timeout(opts.waitMs)
        const signal = wait ? (opts.signal ? AbortSignal.any([wait, opts.signal]) : wait) : opts.signal
        try { for await (const next of follow(run.runId, signal)) run = next }
        catch (error) { opts.signal?.throwIfAborted(); if (!wait?.aborted) throw error }
      }
      const requestedMinor = Math.floor(opts.budgetSgd * 100 + 1e-7)
      return { ...presentRun(run, mode.publisherUrl), requestedBudgetMinor: requestedMinor,
        clamped: run.budgetMinor < requestedMinor, humanMaxBudgetMinor: mode.maxMinor, humanDailyCapMinor: mode.dailyMinor }
    },
    async getRun(id: string) {
      const mode = await status()
      return presentRun(await snapshot(id), mode.publisherUrl)
    },
    async *watch(id: string, opts: { signal?: AbortSignal } = {}): AsyncGenerator<TraceEvent> {
      // Verify MCP ownership before opening the legacy stream.
      await snapshot(id, opts.signal)
      const seen = new Set<number>()
      for await (const run of follow(id, opts.signal)) {
        for (const event of run.events) if (!seen.has(event.id)) { seen.add(event.id); yield event }
      }
    },
    async wallet() {
      const { publisherUrl: _publisherUrl, ...mode } = await status()
      return { ...mode, day: new Date().toISOString().slice(0, 10),
        remainingMinor: Math.max(0, mode.dailyMinor - mode.spentMinor - mode.reservedMinor) }
    },
  }
}
export type ResearchAgentClient = ReturnType<typeof createClient>
