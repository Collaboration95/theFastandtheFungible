import { compatibleFetch } from './compatible.js'
import { abortable, pause } from './provider-retry.js'
import { reportModelUsage } from '../telemetry.js'
import { loadConfig } from '../config.js'
import { withProviderDeadline, retryAfterMs, retryDelayMs } from './provider-retry.js'
import { startActiveObservation, type LangfuseGeneration } from '@langfuse/tracing'
import { deepseekPricingWindow } from '../telemetry.js'
/**
 * OpenAI-compatible chat providers. LLM_PROVIDER picks one; LLM_BASE_URL, LLM_MODEL and LLM_API_KEY
 * configure it. The provider entry only supplies defaults and a legacy key name (DEEPSEEK_API_KEY,
 * GROQ_API_KEY), so the endpoint and key always come from the same .env block.
 * DeepSeek runs with thinking disabled: reasoning tokens roughly double latency for this JSON task.
 */
const providers = {
  'openai-compatible': { label: 'OpenAI-compatible', base: '', key: 'LLM_API_KEY', model: '', extra: {} },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com', key: 'DEEPSEEK_API_KEY', model: 'deepseek-flash', extra: { thinking: { type: 'disabled' } } },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile', extra: {} },
} as const
export type LlmProvider = keyof typeof providers
const current = () => providers[loadConfig().LLM_PROVIDER as LlmProvider] as (typeof providers)[LlmProvider] | undefined
export const llmProvider = (): LlmProvider | undefined => current() ? loadConfig().LLM_PROVIDER as LlmProvider : undefined
export const llmLabel = () => current()?.label ?? 'fixture'
/** Effective endpoint, model and key for a provider (default: the selected one, else DeepSeek). */
export const llmConfig = (name = loadConfig().LLM_PROVIDER) => {
  const p = providers[name as LlmProvider] ?? providers.deepseek
  return { baseUrl: (loadConfig().LLM_BASE_URL || p.base).replace(/\/$/, ''), model: loadConfig().LLM_MODEL || p.model, apiKey: loadConfig().LLM_API_KEY || loadConfig()[p.key] || '' }
}
export const researchModel = () => llmConfig().model
export const isLlmConfigured = () => Boolean(current() && llmConfig().apiKey)

/**
 * Raw JSON deltas are progress only. Consumers must validate before displaying facts.
 * Each attempt is one Langfuse generation: model, parameters, messages, output, tokens, first-token time.
 */
function streamJsonAttempt(name: string, system: string, input: unknown, onToken?: (delta: string) => void, signal?: AbortSignal): Promise<unknown> {
  return startActiveObservation(name, generation => attemptJson(generation, system, input, onToken, signal), { asType: 'generation' })
}
async function attemptJson(generation: LangfuseGeneration, system: string, input: unknown, onToken?: (delta: string) => void, signal?: AbortSignal): Promise<unknown> {
  const provider = current()
  if (!provider || !isLlmConfigured()) throw new Error('LLM is not configured')
  const { baseUrl, apiKey } = llmConfig()
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
  const controller = new AbortController()
  const abandon = () => controller.abort()
  if (signal?.aborted) abandon()
  signal?.addEventListener('abort', abandon, { once: true })
  const configuredTimeout = Number(loadConfig().LLM_SYNTHESIS_TIMEOUT_MS ?? loadConfig().LLM_TIMEOUT_MS ?? 45000)
  const deadlineMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 45000
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const messages = [
    { role: 'system', content: system }, { role: 'user', content: JSON.stringify(input, (key, value) => {
      // Report envelopes duplicate long bodies already represented by exact spans.
      // Keep the citation bindings and accessible spans; never send previews as facts.
      return key === 'body' ? undefined : value
    }) },
  ]
  const modelParameters = { temperature: 0.2, max_tokens: 3000 }
  // pricing_window selects the Langfuse price tier for the custom deepseek-flash model.
  generation.update({ model: researchModel(), modelParameters, input: messages, metadata: { provider: provider.label, ...(provider.label === 'DeepSeek' ? { pricing_window: deepseekPricingWindow() } : {}) } })
  let usage: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number } | undefined
  return withProviderDeadline('LLM', deadlineMs, controller, async () => {
    try {
      const response = await (llmProvider() === 'openai-compatible' ? compatibleFetch : fetch)(endpoint, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: researchModel(), ...modelParameters, stream: true, stream_options: { include_usage: true }, ...provider.extra,
          response_format: { type: 'json_object' }, messages }),
      })
      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after')
        void response.body?.cancel().catch(() => undefined)
        throw new LlmHttpError(response.status, retryAfterMs(retryAfter))
      }
      reader = response.body?.getReader()
      if (!reader) throw new Error('LLM returned no stream')
      const decoder = new TextDecoder()
      let pending = '', text = '', finished = false
      const consume = (line: string) => {
        if (!line.startsWith('data:')) return
        const data = line.slice(5).trim()
        if (!data) return
        if (data === '[DONE]') { finished = true; return }
        const frame = JSON.parse(data) as { error?: unknown; usage?: typeof usage; choices?: { delta?: { content?: string }; finish_reason?: string }[] }
        if (frame.usage) usage = frame.usage
        if (frame.error) throw new Error('LLM stream failed')
        if (frame.choices?.[0]?.finish_reason === 'length') throw new Error('LLM JSON truncated')
        const delta = frame.choices?.[0]?.delta?.content
        if (typeof delta === 'string') { if (!text) generation.update({ completionStartTime: new Date() }); text += delta; onToken?.(delta) }
        if (text.length > 1_000_000) throw new Error('LLM JSON exceeds limit')
      }
      while (!finished) {
        const { value, done } = await reader.read()
        pending += decoder.decode(value, { stream: !done })
        if (pending.length > 1_000_000) throw new Error('LLM frame exceeds limit')
        const lines = pending.split(/\r?\n/)
        pending = lines.pop() ?? ''
        for (const line of lines) { consume(line); if (finished) break }
        if (done) { if (pending && !finished) consume(pending); break }
      }
      const parsed: unknown = JSON.parse(text)
      // DeepSeek reports cache hits separately; they are billed at a fraction of normal input.
      reportModelUsage(usage?.prompt_tokens, usage?.completion_tokens)
      const cached = usage?.prompt_cache_hit_tokens
      generation.update({ output: parsed, ...(usage ? { usageDetails: cached === undefined ? { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 } : { input: usage.prompt_cache_miss_tokens ?? (usage.prompt_tokens ?? 0) - cached, input_cache_read: cached, output: usage.completion_tokens ?? 0 } } : {}) })
      return parsed
    } catch (error) {
      generation.update({ level: 'ERROR', statusMessage: 'LLM call failed' })
      throw error
    } finally {
      signal?.removeEventListener('abort', abandon)
      void reader?.cancel().catch(() => undefined)
    }
  })
}

export class LlmHttpError extends Error {
  readonly code = 'PROVIDER_HTTP'
  override name = 'LlmHttpError'
  constructor(readonly status: number, readonly retryMs: number) { super(`LLM returned ${status}`) }
}

/** Retry once; rate limits wait before retrying. Never expose response bodies. */
export async function streamJson(system: string, input: unknown, onToken?: (delta: string) => void, name = 'generate-json', signal?: AbortSignal): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted()
    try { return await abortable(streamJsonAttempt(name, system, input, onToken, signal), signal) } catch (error) {
      if (signal?.aborted || attempt === 1 || !isLlmConfigured()) throw error
      // Authentication, billing and malformed requests cannot heal with a retry.
      if (error instanceof LlmHttpError && error.status >= 400 && error.status < 500 && error.status !== 429) throw error
      if (error instanceof LlmHttpError && error.status === 429) {
        // A long account cooldown is a labelled fallback, never an early retry.
        if (error.retryMs > 60000) throw error
        await pause(retryDelayMs(error.retryMs), signal)
      } else if (error instanceof LlmHttpError && error.status >= 500) {
        await pause(retryDelayMs(250), signal)
      }
    }
  }
  throw new Error('LLM unavailable')
}
