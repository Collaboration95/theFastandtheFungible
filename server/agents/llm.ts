import { startActiveObservation, type LangfuseGeneration } from '@langfuse/tracing'
import { deepseekPricingWindow } from '../telemetry.js'
/**
 * OpenAI-compatible chat providers. LLM_PROVIDER picks one; LLM_BASE_URL, LLM_MODEL and LLM_API_KEY
 * configure it. The provider entry only supplies defaults and a legacy key name (DEEPSEEK_API_KEY,
 * GROQ_API_KEY), so the endpoint and key always come from the same .env block.
 * DeepSeek runs with thinking disabled: reasoning tokens roughly double latency for this JSON task.
 */
const providers = {
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com', key: 'DEEPSEEK_API_KEY', model: 'deepseek-flash', extra: { thinking: { type: 'disabled' } } },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile', extra: {} },
} as const
export type LlmProvider = keyof typeof providers
const current = () => providers[process.env.LLM_PROVIDER as LlmProvider] as (typeof providers)[LlmProvider] | undefined
export const llmProvider = (): LlmProvider | undefined => current() ? process.env.LLM_PROVIDER as LlmProvider : undefined
export const llmLabel = () => current()?.label ?? 'fixture'
/** Effective endpoint, model and key for a provider (default: the selected one, else DeepSeek). */
export const llmConfig = (name = process.env.LLM_PROVIDER) => {
  const p = providers[name as LlmProvider] ?? providers.deepseek
  return { baseUrl: (process.env.LLM_BASE_URL || p.base).replace(/\/$/, ''), model: process.env.LLM_MODEL || p.model, apiKey: process.env.LLM_API_KEY || process.env[p.key] || '' }
}
export const researchModel = () => llmConfig().model
export const isLlmConfigured = () => Boolean(current() && llmConfig().apiKey)
export type OnToken = (delta: string, text: string) => void

/**
 * Raw JSON deltas are unvalidated: show them only as a labelled draft, and validate before displaying facts.
 * onToken also gets this attempt's text so far, so a retry starts a clean draft.
 * Each attempt is one Langfuse generation: model, parameters, messages, output, tokens, first-token time.
 */
function streamJsonAttempt(name: string, system: string, input: unknown, onToken?: OnToken): Promise<unknown> {
  return startActiveObservation(name, generation => attemptJson(generation, system, input, onToken), { asType: 'generation' })
}
async function attemptJson(generation: LangfuseGeneration, system: string, input: unknown, onToken?: OnToken): Promise<unknown> {
  const provider = current()
  if (!provider || !isLlmConfigured()) throw new Error('LLM is not configured')
  const { baseUrl, apiKey } = llmConfig()
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
  const controller = new AbortController()
  const configuredTimeout = Number(process.env.LLM_SYNTHESIS_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS ?? 45000)
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 45000)
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
  try {
    const response = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: researchModel(), ...modelParameters, stream: true, stream_options: { include_usage: true }, ...provider.extra,
        response_format: { type: 'json_object' }, messages }),
    })
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after')
      const seconds = Number(retryAfter)
      const retryMs = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000
      throw new LlmHttpError(response.status, Math.max(60000, Number.isFinite(retryMs) ? retryMs : 60000))
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
      if (typeof delta === 'string') { if (!text) generation.update({ completionStartTime: new Date() }); text += delta; onToken?.(delta, text) }
      if (text.length > 1_000_000) throw new Error('LLM JSON exceeds limit')
    }
    while (!finished) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) { consume(line); if (finished) break }
      if (done) { if (pending && !finished) consume(pending); break }
    }
    const parsed: unknown = JSON.parse(text)
    // DeepSeek reports cache hits separately; they are billed at a fraction of normal input.
    const cached = usage?.prompt_cache_hit_tokens
    generation.update({ output: parsed, ...(usage ? { usageDetails: cached === undefined ? { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 } : { input: usage.prompt_cache_miss_tokens ?? (usage.prompt_tokens ?? 0) - cached, input_cache_read: cached, output: usage.completion_tokens ?? 0 } } : {}) })
    return parsed
  } catch (error) {
    generation.update({ level: 'ERROR', statusMessage: error instanceof Error ? error.message : 'LLM call failed' })
    throw error
  } finally {
    clearTimeout(timeout)
    await reader?.cancel().catch(() => undefined)
  }
}

class LlmHttpError extends Error {
  constructor(readonly status: number, readonly retryMs: number) { super(`LLM returned ${status}`) }
}

/** Retry once; rate limits wait before retrying. Never expose response bodies. */
export async function streamJson(system: string, input: unknown, onToken?: OnToken, name = 'generate-json'): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await streamJsonAttempt(name, system, input, onToken) } catch (error) {
      if (attempt === 1 || !isLlmConfigured()) throw error
      if (error instanceof LlmHttpError && error.status === 429) {
        // A long account cooldown is a labelled fallback, never an early retry.
        if (error.retryMs > 60000) throw error
        await new Promise(resolve => setTimeout(resolve, error.retryMs))
      }
    }
  }
  throw new Error('LLM unavailable')
}
