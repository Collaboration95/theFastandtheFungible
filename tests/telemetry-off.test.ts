// D22 / #143: with LANGFUSE_ENABLED unset (as in every test and the fixture demo) no exporter,
// span processor or Langfuse network client is ever created, and the new step spans are no-ops.
import { describe, expect, it, vi } from 'vitest'
import { getActiveTraceId } from '@langfuse/tracing'

const created = vi.hoisted(() => ({ sdk: 0, processor: 0, client: 0 }))
vi.mock('@opentelemetry/sdk-node', () => ({ NodeSDK: class { constructor() { created.sdk++ } start() {} shutdown() {} } }))
vi.mock('@langfuse/otel', () => ({ LangfuseSpanProcessor: class { constructor() { created.processor++ } } }))
vi.mock('@langfuse/client', () => ({ LangfuseClient: class { constructor() { created.client++ } } }))
const { activeTraceUrl, recordStep, scoreStep, scoreTrace, startTelemetry, telemetryEnabled, traceStep } = await import('../server/telemetry.js')

describe('Langfuse is off in tests (#143)', () => {
  it('creates no exporter or network client, and the new spans are no-ops', async () => {
    expect(process.env.LANGFUSE_ENABLED).not.toBe('1')
    expect(telemetryEnabled()).toBe(false)
    await (await startTelemetry())()
    let traceId: string | undefined = 'unset'
    const result = await traceStep('search-fanout', { q: 'x' }, async () => { traceId = getActiveTraceId(); return 7 }, r => ({ r }), 'retriever')
    await traceStep('challenge', { intentId: 'i' }, async () => 'REFUNDED', status => ({ status }))
    for (const name of ['manifest-verify', 'proof-check', 'reputation-update']) recordStep(name, { a: 1 }, { b: 2 })
    scoreStep('citation-validity', 1); scoreTrace('refund-issued', true); scoreTrace('quarantined-publishers', 1)
    expect(await activeTraceUrl()).toBeUndefined()
    expect(result).toBe(7)
    expect(traceId === undefined || /^0+$/.test(traceId)).toBe(true) // no recording span, no trace
    expect(created).toEqual({ sdk: 0, processor: 0, client: 0 })
  })
})
