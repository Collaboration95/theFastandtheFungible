import { ReceiptBundleSchema } from '../shared/contracts/receipts.js'
export { verifyAnswer, verificationText } from './verify.js'
export type { ReceiptBundle, VerificationResult, VerifyOptions } from './verify.js'
import { z } from 'zod'
import { ModeLabelsSchema, RunSnapshotSchema, type RunSnapshot, type TraceEvent } from '../shared/contracts/run.js'
import { presentRun, type PresentedRun } from './present.js'
export type { HireResult } from './hire.js'
export type { PresentedRun } from './present.js'

export type ErrorCode = 'unauthorized' | 'not_found' | 'invalid' | 'backend_unavailable' | 'cancelled' | 'payment_failed' | 'verification_failed'
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
  /** Requested SGD, clamped by server policy. */
  budget?: number; budgetSgd?: number; escrow?: boolean; idempotencyKey?: string; signal?: AbortSignal
  /** MCP keeps its existing bounded wait. By default SDK callers follow to a terminal phase. */
  waitMs?: number
}
const terminal = (run: RunSnapshot) => ['DONE', 'STOPPED', 'FAILED'].includes(run.phase)

export type ClientOptions = { baseUrl: string; token?: string; fetch?: typeof fetch;
  /** Explicit operator signing authority. Required for pay and hire; never inferred from a seed. */
  payment?: Omit<import('./x402.js').PayOptions, 'method' | 'body' | 'headers' | 'idempotencyKey'> & { journal: import('./x402.js').PaymentJournal }
}
export type AskResult = PresentedRun & { requestedBudgetMinor: number; clamped: boolean; humanMaxBudgetMinor: number; humanDailyCapMinor: number; receipts: RunSnapshot['receipts'] }
export type AskTask = Promise<AskResult> & { events: AsyncIterable<TraceEvent> }

/** Policy owns admission and spending. Direct x402 requires separate explicit operator authority. */
export function createClient(options: ClientOptions) {
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
      if (init.signal?.aborted) throw new ResearchAgentError('cancelled')
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
  const safe = async <T>(action: () => Promise<T>, code: ErrorCode = 'backend_unavailable'): Promise<T> => {
    try { return await action() } catch (error) {
      if (error instanceof ResearchAgentError) throw error
      throw new ResearchAgentError(code)
    }
  }
  const walletStatus = () => safe(async () => {
    const { publisherUrl: _publisherUrl, ...mode } = await status()
    return { ...mode, day: new Date().toISOString().slice(0, 10),
      remainingMinor: Math.max(0, mode.dailyMinor - mode.spentMinor - mode.reservedMinor) }
  })
  return {
    walletStatus,
    /** Offline verification of exported JSON or a local JSON path (Node). */
    verify: (answerOrPath: unknown, opts: import('./verify.js').VerifyOptions = {}) => safe(async () => {
      const { verifyAnswer } = await import('./verify.js')
      const input = typeof answerOrPath === 'string' ? JSON.parse(await (await import('node:fs/promises')).readFile(answerOrPath, 'utf8')) : answerOrPath
      return verifyAnswer(input, opts)
    }, 'verification_failed'),
    /** Buy a generic x402 exact resource on XRPL Testnet. Reuse the intent key and durable journal. */
    pay: (url: string, opts: Pick<import('./x402.js').PayOptions, 'idempotencyKey' | 'method' | 'body' | 'headers'> = {}) => safe(async () => {
      if (!options.payment) throw new ResearchAgentError('invalid')
      const { payAndFetch } = await import('./x402.js')
      return payAndFetch(url, { ...options.payment, ...opts })
    }, 'payment_failed'),
    /** Hire the remote baseUrl with explicit operator signing authority. */
    hire: (question: string, input: { budgetMinor: 100 | 200 | 500; idempotencyKey: string }) => safe(async () => {
      if (!options.payment) throw new ResearchAgentError('invalid')
      const { createHireClient } = await import('./hire.js')
      return createHireClient({ ...options.payment, baseUrl: options.baseUrl, token }).hire(question, input)
    }, 'payment_failed'),
    search: (query: string, opts: { k?: number } = {}) => json(`/api/mcp/search?${new URLSearchParams({ query, k: String(opts.k ?? 10) })}`, SearchSchema),
    ask(question: string, opts: AskOptions): AskTask {
      const events: TraceEvent[] = []
      const seen = new Set<number>()
      let finished = false
      const waiters = new Set<() => void>()
      const emit = (run: RunSnapshot) => {
        for (const event of run.events) if (!seen.has(event.id)) { seen.add(event.id); events.push(event) }
        for (const wake of waiters) wake(); waiters.clear()
      }
      const result = safe(async () => {
        if (opts.signal?.aborted) throw new ResearchAgentError('cancelled')
        const budget = opts.budget ?? opts.budgetSgd
        if (budget === undefined || !Number.isFinite(budget) || budget < 0 || budget > Number.MAX_SAFE_INTEGER / 100) throw new ResearchAgentError('invalid')
        const mode = await status(opts.signal)
        let run = await json('/api/mcp/runs', RunSnapshotSchema, { method: 'POST', signal: opts.signal,
          body: JSON.stringify({ question, budget_sgd: budget, idempotency_key: opts.idempotencyKey, clarify: 'never', escrow: opts.escrow }) })
        emit(run)
        if (!terminal(run)) {
          const wait = opts.waitMs === undefined ? undefined : AbortSignal.timeout(opts.waitMs)
          const signal = wait ? (opts.signal ? AbortSignal.any([wait, opts.signal]) : wait) : opts.signal
          try { for await (const next of follow(run.runId, signal)) { run = next; emit(run) } }
          catch (error) { if (opts.signal?.aborted) throw new ResearchAgentError('cancelled'); if (!wait?.aborted) throw error }
        }
        const requestedMinor = Math.floor(budget * 100 + 1e-7)
        return { ...presentRun(run, mode.publisherUrl), requestedBudgetMinor: requestedMinor,
          clamped: run.budgetMinor < requestedMinor, humanMaxBudgetMinor: mode.maxMinor, humanDailyCapMinor: mode.dailyMinor, receipts: run.receipts }
      }).finally(() => { finished = true; for (const wake of waiters) wake(); waiters.clear() })
      // A stream-only consumer observes rejection through the iterator.
      void result.catch(() => undefined)
      // Consumers may stream while awaiting the same task. Admission happens exactly once.
      return Object.assign(result, { events: { async *[Symbol.asyncIterator]() {
        let cursor = 0
        while (true) {
          while (cursor < events.length) yield events[cursor++]
          if (finished) break
          await new Promise<void>(resolve => { waiters.add(resolve) })
        }
        await result // propagate typed failure to stream consumers too
      } } })
    },
    receipts: (id: string) => json(`/runs/${encodeURIComponent(id)}/receipts.json`, ReceiptBundleSchema),
    async getRun(id: string) {
      return safe(async () => { const mode = await status(); return presentRun(await snapshot(id), mode.publisherUrl) })
    },
    async *watch(id: string, opts: { signal?: AbortSignal } = {}): AsyncGenerator<TraceEvent> {
      try {
        // Verify MCP ownership before opening the legacy stream.
        await snapshot(id, opts.signal)
        const seen = new Set<number>()
        for await (const run of follow(id, opts.signal)) {
          for (const event of run.events) if (!seen.has(event.id)) { seen.add(event.id); yield event }
        }
      } catch (error) {
        if (error instanceof ResearchAgentError) throw error
        throw new ResearchAgentError(opts.signal?.aborted ? 'cancelled' : 'backend_unavailable')
      }
    },
    wallet: walletStatus,
  }
}
export type ResearchAgentClient = ReturnType<typeof createClient>
