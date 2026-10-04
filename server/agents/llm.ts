export const researchModel = () => process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
export const isGroqConfigured = () => process.env.LLM_PROVIDER === 'groq' && Boolean(process.env.GROQ_API_KEY)

/** Raw JSON deltas are progress only. Consumers must validate before displaying facts. */
export async function streamJson(system: string, input: unknown, onToken?: (delta: string) => void): Promise<unknown> {
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
          { role: 'system', content: system }, { role: 'user', content: JSON.stringify(input) },
        ] }),
    })
    if (!response.ok) throw new Error(`Groq returned ${response.status}`)
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
