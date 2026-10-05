import { startActiveObservation, type LangfuseGeneration } from '@langfuse/tracing'
/**
 * OpenAI-compatible chat providers. LLM_PROVIDER picks one. Each reads its own key, base URL and
 * model override, so a key is never sent to another provider's endpoint.
 * DeepSeek runs with thinking disabled: reasoning tokens roughly double latency for this JSON task.
 */
const providers = {
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com', baseEnv: 'DEEPSEEK_BASE_URL', key: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_MODEL', model: 'deepseek-flash', extra: { thinking: { type: 'disabled' } } },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', baseEnv: 'LLM_BASE_URL', key: 'GROQ_API_KEY', modelEnv: 'LLM_MODEL', model: 'llama-3.3-70b-versatile', extra: {} },
} as const
export type LlmProvider = keyof typeof providers
const current = () => providers[process.env.LLM_PROVIDER as LlmProvider] as (typeof providers)[LlmProvider] | undefined
export const llmProvider = (): LlmProvider | undefined => current() ? process.env.LLM_PROVIDER as LlmProvider : undefined
export const llmLabel = () => current()?.label ?? 'fixture'
export const researchModel = () => { const p = current() ?? providers.deepseek; return process.env[p.modelEnv] || p.model }
export const isLlmConfigured = () => Boolean(current() && process.env[current()!.key])

/**
 * Raw JSON deltas are progress only. Consumers must validate before displaying facts.
 * Each attempt is one Langfuse generation: model, parameters, messages, output, tokens, first-token time.
 */
function streamJsonAttempt(name: string, system: string, input: unknown, onToken?: (delta: string) => void): Promise<unknown> {
  return startActiveObservation(name, generation => attemptJson(generation, system, input, onToken), { asType: 'generation' })
}
async function attemptJson(generation: LangfuseGeneration, system: string, input: unknown, onToken?: (delta: string) => void): Promise<unknown> {
  const provider = current()
  if (!provider || !isLlmConfigured()) throw new Error('LLM is not configured')
  const base = process.env[provider.baseEnv] || provider.base
  const endpoint = base.endsWith('/chat/completions') ? base : `${base.replace(/\/$/, '')}/chat/completions`
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
  generation.update({ model: researchModel(), modelParameters, input: messages, metadata: { provider: provider.label } })
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined
  try {
    const response = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[provider.key]}` },
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
      if (typeof delta === 'string') { if (!text) generation.update({ completionStartTime: new Date() }); text += delta; onToken?.(delta) }
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
    generation.update({ output: parsed, ...(usage ? { usageDetails: { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 } } : {}) })
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
export async function streamJson(system: string, input: unknown, onToken?: (delta: string) => void, name = 'generate-json'): Promise<unknown> {
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
