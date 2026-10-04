export const researchModel = () => process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
export const isGroqConfigured = () => process.env.LLM_PROVIDER === 'groq' && Boolean(process.env.GROQ_API_KEY)

/** Raw JSON deltas are progress only. Consumers must validate before displaying facts. */
async function streamJsonAttempt(system: string, input: unknown, onToken?: (delta: string) => void): Promise<unknown> {
  if (!isGroqConfigured()) throw new Error('Groq is not configured')
  const base = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions'
  const endpoint = base.endsWith('/chat/completions') ? base : `${base.replace(/\/$/, '')}/chat/completions`
  const controller = new AbortController()
  const configuredTimeout = Number(process.env.LLM_SYNTHESIS_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS ?? 45000)
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 45000)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: researchModel(), temperature: 0.2, max_tokens: 3000, stream: true,
        response_format: { type: 'json_object' }, messages: [
          { role: 'system', content: system }, { role: 'user', content: JSON.stringify(input, (key, value) => {
            // Report envelopes duplicate long bodies already represented by exact spans.
            // Keep the citation bindings and accessible spans; never send previews as facts.
            return key === 'body' ? undefined : value
          }) },
        ] }),
    })
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after')
      const seconds = Number(retryAfter)
      const retryMs = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000
      throw new GroqHttpError(response.status, Math.max(60000, Number.isFinite(retryMs) ? retryMs : 60000))
    }
    reader = response.body?.getReader()
    if (!reader) throw new Error('Groq returned no stream')
    const decoder = new TextDecoder()
    let pending = '', text = '', finished = false
    const consume = (line: string) => {
      if (!line.startsWith('data:')) return
      const data = line.slice(5).trim()
      if (!data) return
      if (data === '[DONE]') { finished = true; return }
      const frame = JSON.parse(data) as { error?: unknown; choices?: { delta?: { content?: string }; finish_reason?: string }[] }
      if (frame.error) throw new Error('Groq stream failed')
      if (frame.choices?.[0]?.finish_reason === 'length') throw new Error('Groq JSON truncated')
      const delta = frame.choices?.[0]?.delta?.content
      if (typeof delta === 'string') { text += delta; onToken?.(delta) }
      if (text.length > 1_000_000) throw new Error('Groq JSON exceeds limit')
    }
    while (!finished) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) { consume(line); if (finished) break }
      if (done) { if (pending && !finished) consume(pending); break }
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timeout)
    await reader?.cancel().catch(() => undefined)
  }
}

class GroqHttpError extends Error {
  constructor(readonly status: number, readonly retryMs: number) { super(`Groq returned ${status}`) }
}

/** Retry once; rate limits wait before retrying. Never expose response bodies. */
export async function streamJson(system: string, input: unknown, onToken?: (delta: string) => void): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await streamJsonAttempt(system, input, onToken) } catch (error) {
      if (attempt === 1 || !isGroqConfigured()) throw error
      if (error instanceof GroqHttpError && error.status === 429) {
        // A long account cooldown is a labelled fallback, never an early retry.
        if (error.retryMs > 60000) throw error
        await new Promise(resolve => setTimeout(resolve, error.retryMs))
      }
    }
  }
  throw new Error('Groq unavailable')
}
