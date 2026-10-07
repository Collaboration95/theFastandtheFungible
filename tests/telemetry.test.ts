import { afterAll, describe, expect, it, vi } from 'vitest'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { setLangfuseTracerProvider } from '@langfuse/tracing'
import { deepseekPricingWindow, maskSecrets, recordStep, traceStep, scoreStep, scoreTrace, telemetryEnabled, traceEvent, traceRun } from '../server/telemetry.js'
import { writeAnswer } from '../server/agents/research.js'
import { exampleCandidate, exampleContent, exampleRun } from '../shared/contracts/examples.js'
import type { ContentEnvelope, PublicCandidate } from '../shared/contracts/index.js'

// A local tracer stands in for Langfuse Cloud: same spans and attributes, nothing leaves the test.
const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
provider.register()
setLangfuseTracerProvider(provider)
afterAll(() => provider.shutdown())

const stream = (value: unknown) => {
  const frames = [`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(value) } }] })}\n\n`, `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 30, prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: 20 } })}\n\n`, 'data: [DONE]\n\n']
  return new Response(new TextEncoder().encode(frames.join('')))
}

describe('Langfuse telemetry', () => {
  it('is off unless explicitly enabled with both keys', () => {
    expect(telemetryEnabled({ LANGFUSE_PUBLIC_KEY: 'pk', LANGFUSE_SECRET_KEY: 'sk' })).toBe(false)
    expect(telemetryEnabled({ LANGFUSE_ENABLED: '1', LANGFUSE_PUBLIC_KEY: 'pk' })).toBe(false)
    expect(telemetryEnabled({ LANGFUSE_ENABLED: '1', LANGFUSE_PUBLIC_KEY: 'pk', LANGFUSE_SECRET_KEY: 'sk' })).toBe(true)
  })

  it('maps DeepSeek peak hours (UTC weekdays 01–04 and 06–10) and everything else to off-peak', () => {
    expect(deepseekPricingWindow(new Date('2026-10-05T02:30:00Z'))).toBe('peak')      // Monday
    expect(deepseekPricingWindow(new Date('2026-10-05T09:59:00Z'))).toBe('peak')
    expect(deepseekPricingWindow(new Date('2026-10-05T04:30:00Z'))).toBe('off-peak')  // gap between windows
    expect(deepseekPricingWindow(new Date('2026-10-05T10:00:00Z'))).toBe('off-peak')
    expect(deepseekPricingWindow(new Date('2026-10-10T02:30:00Z'))).toBe('off-peak')  // Saturday (demo day)
  })

  it('scores are a silent no-op when tracing is off', () => {
    vi.stubEnv('LANGFUSE_ENABLED', '0')
    expect(() => { scoreStep('citation-validity', 1); scoreTrace('fully-live', true); scoreTrace('impact', 'QUALIFIES') }).not.toThrow()
    vi.unstubAllEnvs()
  })

  it('masks every configured secret and delivery-token-like field', () => {
    const env = { DEEPSEEK_API_KEY: 'sk-deepseek-secret-123', XRPL_PAYER_SEED: 'sEdTestSeedValue000', LANGFUSE_SECRET_KEY: 'sk-lf-secret-xyz' }
    const masked = maskSecrets(JSON.stringify({ a: 'Bearer sk-deepseek-secret-123', seed: 'sEdTestSeedValue000', deliveryToken: 'tok-abc', note: 'sk-lf-secret-xyz' }), env)
    for (const secret of Object.values(env)) expect(masked).not.toContain(secret)
    expect(masked).not.toContain('tok-abc')
    expect(masked).toContain('[DEEPSEEK_API_KEY]')
  })

  it('records the #143 step spans (search-fanout retriever, challenge, proof-check, reputation-update) when a tracer is registered', async () => {
    exporter.reset()
    await traceStep('search-fanout', {}, async () => 1, () => ({ perPublisher: { alphaleak: 1 }, searchMode: 'hybrid' }), 'retriever')
    await traceStep('challenge', {}, async () => 1, () => ({ status: 'REFUNDED' }))
    recordStep('proof-check', {}, { status: 'CLAIM_FAILED' }); recordStep('reputation-update', {}, { before: { H: 0.8 }, after: { H: 0.4 } })
    const spans = exporter.getFinishedSpans()
    expect(spans.map(s => s.name)).toEqual(['search-fanout', 'challenge', 'proof-check', 'reputation-update'])
    expect(spans[0].attributes['langfuse.observation.type']).toBe('retriever')
  })

  it('masks every XRPL_PUBLISHER_*_SEED (never trace a publisher seed, FINAL-PUSH §9)', () => {
    const env = { XRPL_PUBLISHER_ALPHALEAK_SEED: 'sEdAlphaLeakSeed0001', XRPL_PUBLISHER_THE_FAB_FLOOR_SEED: 'sEdFabFloorSeed00002' }
    const masked = maskSecrets(`seeds ${env.XRPL_PUBLISHER_ALPHALEAK_SEED} ${env.XRPL_PUBLISHER_THE_FAB_FLOOR_SEED}`, env)
    for (const seed of Object.values(env)) expect(masked).not.toContain(seed)
    expect(masked).toContain('[XRPL_PUBLISHER_ALPHALEAK_SEED]')
  })

  it('traces a run as agent → chain → generation with model, tokens and events, and no key', async () => {
    exporter.reset()
    vi.stubEnv('LLM_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'sk-never-in-a-span-42'); vi.stubEnv('LLM_API_KEY', ''); vi.stubEnv('LLM_BASE_URL', ''); vi.stubEnv('LLM_MODEL', '')
    const candidate: PublicCandidate = { ...exampleCandidate, resourceId: 'free-a', tier: 'FREE' }
    const content: ContentEnvelope = { ...exampleContent, resourceId: 'free-a', body: 'Grid slots are confirmed for 240 MW.', spans: [{ id: 's1', text: 'Grid slots are confirmed for 240 MW.' }] }
    vi.stubGlobal('fetch', vi.fn(async () => stream({ conclusion: 'c', claims: [{ id: 'k', text: content.body, stance: 'SUPPORTS', citations: [{ resourceId: 'free-a', version: content.version, spanId: 's1' }] }], openGaps: [] })))
    await traceRun('research-run', exampleRun, async () => {
      traceEvent({ id: 1, runId: exampleRun.runId, type: 'SEARCH', label: 'Searching', at: new Date().toISOString() })
      traceEvent({ id: 2, runId: exampleRun.runId, type: 'PROGRESS', label: 'noise', at: new Date().toISOString() })
      await writeAnswer({ question: 'q', candidates: [candidate], contents: [content], version: 1 })
    }, () => ({ done: true }))
    vi.unstubAllEnvs(); vi.unstubAllGlobals()

    const spans = exporter.getFinishedSpans()
    const byName = (name: string) => spans.find(s => s.name === name)!
    const type = (name: string) => byName(name).attributes['langfuse.observation.type']
    expect(type('research-run')).toBe('agent')
    expect(type('write-answer')).toBe('chain')
    expect(type('generate-answer')).toBe('generation')
    expect(type('phase-search')).toBe('event')
    expect(spans.some(s => s.name === 'phase-progress')).toBe(false)
    const generation = byName('generate-answer')
    expect(generation.attributes['langfuse.observation.model.name']).toBe('deepseek-flash')
    // Cache hits are split out so the custom deepseek-flash price bills them at the cache rate.
    expect(JSON.parse(String(generation.attributes['langfuse.observation.usage_details']))).toEqual({ input: 20, input_cache_read: 100, output: 30 })
    expect(generation.attributes['langfuse.observation.metadata.pricing_window']).toMatch(/^(peak|off-peak)$/)
    expect(generation.attributes['langfuse.observation.completion_start_time']).toBeTruthy()
    // Nesting: generation under write-answer under the run; one trace for the whole run.
    expect(generation.parentSpanContext?.spanId).toBe(byName('write-answer').spanContext().spanId)
    expect(byName('write-answer').parentSpanContext?.spanId).toBe(byName('research-run').spanContext().spanId)
    expect(new Set(spans.map(s => s.spanContext().traceId)).size).toBe(1)
    expect(JSON.stringify(spans.map(s => s.attributes))).not.toContain('sk-never-in-a-span-42')
  })
})
