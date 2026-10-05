// Langfuse Cloud tracing (OpenTelemetry). Off unless LANGFUSE_ENABLED=1 and both keys are set;
// without a started SDK every @langfuse/tracing call below is a cheap no-op.
// Gate ①: traces carry only what the LLM and Clef were already allowed to see (free or granted
// passages, public previews) plus public event metadata. The mask strips any secret value.
import { propagateAttributes, startActiveObservation, startObservation } from '@langfuse/tracing'
import type { RunSnapshot, TraceEvent } from '../shared/contracts/index.js'

const SECRET_ENV = ['DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'CLOUDFLARE_API_TOKEN', 'XRPL_PAYER_SEED', 'PUBLISHER_SECRET', 'LANGFUSE_SECRET_KEY']

/** Replaces every configured secret value (and delivery-token-like headers) before export. */
export function maskSecrets(data: string, env: NodeJS.ProcessEnv = process.env): string {
  let masked = data
  for (const name of SECRET_ENV) {
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
  return async () => { await sdk.shutdown().catch(() => undefined) }
}

type RunInfo = Pick<RunSnapshot, 'runId' | 'question' | 'budgetMinor' | 'labels'>
const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`

/**
 * One trace per unit of work (run, report, delivery retry), grouped into a session per run.
 * Tags carry the providers and rail so dashboards can split live vs fixture vs Testnet.
 */
export function traceRun<T>(name: string, run: RunInfo, fn: () => Promise<T>, summarize: () => unknown): Promise<T> {
  const tags = [run.labels.research.split(' · ')[0], run.labels.decision.split(' · ')[0], run.labels.settlement.startsWith('XRPL') ? 'xrpl-testnet' : 'simulated']
  return propagateAttributes({ traceName: name, sessionId: run.runId, tags, metadata: { runId: run.runId, budget: money(run.budgetMinor), settlement: run.labels.settlement } }, () =>
    startActiveObservation(name, async observation => {
      observation.update({ input: { question: run.question, budget: money(run.budgetMinor) } })
      try { return await fn() }
      catch (error) { observation.update({ level: 'ERROR', statusMessage: error instanceof Error ? error.message : 'failed' }); throw error }
      finally { observation.update({ output: summarize() }) }
    }, { asType: 'agent' }))
}

/** Stable, low-cardinality names for the durable trace events (the label carries the detail). */
const EVENT_NAMES: Record<string, string> = { WIRE: 'publisher-http', XRPL: 'xrpl-ledger', GRANT: 'verify-delivery', PURCHASE: 'purchase-status' }
const SKIP = new Set(['PROGRESS', 'SNAPSHOT', 'ANSWER_PROGRESS']) // heartbeats, not steps

/** Mirrors each durable trace event as a Langfuse event under whichever step is active. */
export function traceEvent(event: TraceEvent): void {
  if (SKIP.has(event.type)) return
  startObservation(EVENT_NAMES[event.type] ?? `phase-${event.type.toLowerCase()}`, { output: event.label, metadata: event.data }, { asType: 'event' })
}
