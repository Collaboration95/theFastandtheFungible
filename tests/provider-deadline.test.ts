import { afterEach, expect, it, vi } from 'vitest'
import { LlmHttpError, streamJson } from '../server/agents/llm.js'
import { ProviderDeadlineError } from '../server/agents/provider-retry.js'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })
for (const stage of ['headers', 'stream', 'cancel'] as const) {
  it(`bounds a provider stuck at ${stage} and aborts both attempts`, async () => {
    vi.useFakeTimers()
    vi.stubEnv('LLM_PROVIDER', 'deepseek'); vi.stubEnv('LLM_API_KEY', 'synthetic-unused')
    vi.stubEnv('LLM_BASE_URL', 'http://127.0.0.1/provider'); vi.stubEnv('LLM_TIMEOUT_MS', '100')
    vi.stubEnv('LLM_SYNTHESIS_TIMEOUT_MS', '100')
    const signals: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      signals.push(init.signal)
      if (stage === 'headers') return new Promise(() => {})
      if (stage === 'cancel') return { ok: false, status: 503, headers: new Headers(), body: { cancel: () => new Promise(() => {}) } }
      return new Response(new ReadableStream({ pull: () => new Promise(() => {}), cancel: () => new Promise(() => {}) }))
    }))
    const result = streamJson('test', {})
    // Attach rejection handler before advancing timers.
    const settled = result.catch(error => error)
    await vi.advanceTimersByTimeAsync(1200)
    const error = await settled
    if (stage === 'cancel') expect(error).toBeInstanceOf(LlmHttpError)
    else expect(error).toBeInstanceOf(ProviderDeadlineError)
    expect(signals).toHaveLength(2)
    expect(signals.every(s => s.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
}
