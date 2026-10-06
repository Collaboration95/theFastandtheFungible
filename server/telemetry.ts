// Langfuse Cloud tracing (OpenTelemetry). Off unless LANGFUSE_ENABLED=1 and both keys are set;
// without a started SDK every @langfuse/tracing call below is a cheap no-op.
// Gate ①: traces carry only what the LLM and Clef were already allowed to see (free or granted
// passages, public previews) plus public event metadata. The mask strips any secret value.
import { getActiveTraceId, propagateAttributes, setActiveTraceAsPublic, startActiveObservation, startObservation } from '@langfuse/tracing'
import { LangfuseClient } from '@langfuse/client'
import type { RunSnapshot, TraceEvent } from '../shared/contracts/index.js'

const SECRET_ENV = ['DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'CLOUDFLARE_API_TOKEN', 'XRPL_PAYER_SEED', 'PUBLISHER_SECRET', 'LANGFUSE_SECRET_KEY']
/** Every publisher wallet seed (FINAL-PUSH §9: never log or trace a publisher seed). */
const PUBLISHER_SEED = /^XRPL_PUBLISHER_.+_SEED$/

/** Replaces every configured secret value (and delivery-token-like headers) before export. */
export function maskSecrets(data: string, env: NodeJS.ProcessEnv = process.env): string {
  let masked = data
  for (const name of [...SECRET_ENV, ...Object.keys(env).filter(key => PUBLISHER_SEED.test(key))]) {
    const value = env[name]
    if (value && value.length >= 8) masked = masked.split(value).join(`[${name}]`)
  }
  return masked.replace(/("?(?:deliveryToken|authorization|x-delivery-token)"?\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
}

export const telemetryEnabled = (env: NodeJS.ProcessEnv = process.env) =>
  env.LANGFUSE_ENABLED === '1' && Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY)

/** Starts the exporter once per process; returns a shutdown that flushes pending spans. */
export async function startTelemetry(): Promise<() => Promise<void>> {
  if (!telemetryEnabled()) return async () => {}
  const [{ NodeSDK }, { LangfuseSpanProcessor }] = await Promise.all([import('@opentelemetry/sdk-node'), import('@langfuse/otel')])
  const sdk = new NodeSDK({
    // No host/process resource detectors: hostname, host id, OS user and paths stay on this machine.
    serviceName: 'researchagent-api', resourceDetectors: [],
    spanProcessors: [new LangfuseSpanProcessor({
      mask: ({ data }) => maskSecrets(typeof data === 'string' ? data : JSON.stringify(data)),
      environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || 'development',
    })],
  })
  sdk.start()
  return async () => { await client?.shutdown().catch(() => undefined); await sdk.shutdown().catch(() => undefined) }
}

type RunInfo = Pick<RunSnapshot, 'runId' | 'question' | 'budgetMinor' | 'labels'>
const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`

/**
 * One trace per unit of work (run, report, delivery retry), grouped into a session per run.
 * Tags carry the providers and rail so dashboards can split live vs fixture vs Testnet.
 */
export function traceRun<T>(name: string, run: RunInfo, fn: () => Promise<T>, summarize: () => unknown, scoreTrace?: () => void): Promise<T> {
  const tags = [run.labels.research.split(' · ')[0], run.labels.decision.split(' · ')[0], run.labels.settlement.startsWith('XRPL') ? 'xrpl-testnet' : 'simulated']
  return propagateAttributes({ traceName: name, sessionId: run.runId, tags, metadata: { runId: run.runId, budget: money(run.budgetMinor), settlement: run.labels.settlement } }, () =>
    startActiveObservation(name, async observation => {
      observation.update({ input: { question: run.question, budget: money(run.budgetMinor) } })
      // Public traces open without a login: stage backups when the venue wifi or login fails.
      if (process.env.LANGFUSE_PUBLIC_TRACES === '1') setActiveTraceAsPublic()
      try { return await fn() }
      catch (error) { observation.update({ level: 'ERROR', statusMessage: error instanceof Error ? error.message : 'failed' }); throw error }
      finally {
        observation.update({ output: summarize() })
        try { scoreTrace?.() } catch { /* scores never fail a run */ }
      }
    }, { asType: 'agent' }))
}

/** A named step that wraps work (search-fanout, challenge). A no-op unless startTelemetry() registered an exporter. */
export function traceStep<T>(name: string, input: unknown, fn: () => Promise<T>, output: (result: T) => unknown, asType: 'span' | 'retriever' = 'span'): Promise<T> {
  const body = async (observation: { update: (attributes: { input?: unknown; output?: unknown }) => unknown }) => {
    observation.update({ input })
    const result = await fn()
    try { observation.update({ output: output(result) }) } catch { /* telemetry never blocks */ }
    return result
  }
  return asType === 'retriever' ? startActiveObservation(name, body, { asType }) : startActiveObservation(name, body)
}
/** A finished step recorded after the fact (manifest-verify, proof-check, reputation-update). Same no-op rule. */
export function recordStep(name: string, input: unknown, output: unknown): void {
  try { startObservation(name, { input, output }).end() } catch { /* telemetry never blocks */ }
}

/** Stable, low-cardinality names for the durable trace events (the label carries the detail). */
const EVENT_NAMES: Record<string, string> = { WIRE: 'publisher-http', XRPL: 'xrpl-ledger', GRANT: 'verify-delivery', PURCHASE: 'purchase-status' }
const SKIP = new Set(['PROGRESS', 'SNAPSHOT', 'ANSWER_PROGRESS', 'TRACE']) // heartbeats and the post-run trace link

/** Mirrors each durable trace event as a Langfuse event under whichever step is active. */
export function traceEvent(event: TraceEvent): void {
  if (SKIP.has(event.type)) return
  startObservation(EVENT_NAMES[event.type] ?? `phase-${event.type.toLowerCase()}`, { output: event.label, metadata: event.data }, { asType: 'event' })
}

// Scores turn traces into dashboards: latency, failure (fallback) rates and quality over time.
let client: LangfuseClient | undefined
const scorer = () => telemetryEnabled() ? (client ??= new LangfuseClient()) : undefined
type ScoreValue = number | string | boolean
const body = (name: string, value: ScoreValue, comment?: string) => typeof value === 'boolean'
  ? { name, value: value ? 1 : 0, dataType: 'BOOLEAN' as const, comment }
  : typeof value === 'string' ? { name, value, dataType: 'CATEGORICAL' as const, comment } : { name, value, dataType: 'NUMERIC' as const, comment }
/** Scores the step that is currently running (a no-op when tracing is off). */
export function scoreStep(name: string, value: ScoreValue, comment?: string): void {
  try { scorer()?.score.activeObservation(body(name, value, comment)) } catch { /* telemetry never blocks */ }
}
/** Scores the whole trace the current step belongs to. */
export function scoreTrace(name: string, value: ScoreValue, comment?: string): void {
  try { scorer()?.score.activeTrace(body(name, value, comment)) } catch { /* telemetry never blocks */ }
}

/** DeepSeek bills peak hours (UTC weekdays 01:00–04:00 and 06:00–10:00) at twice the off-peak rate. */
export function deepseekPricingWindow(now = new Date()): 'peak' | 'off-peak' {
  const day = now.getUTCDay(), hour = now.getUTCHours()
  return day >= 1 && day <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)) ? 'peak' : 'off-peak'
}

/** Link to the current trace in the Langfuse UI, or undefined when tracing is off. */
export async function activeTraceUrl(): Promise<string | undefined> {
  const traceId = getActiveTraceId()
  const c = scorer()
  if (!c || !traceId) return undefined
  try { return await c.getTraceUrl(traceId) } catch { return undefined }
}
