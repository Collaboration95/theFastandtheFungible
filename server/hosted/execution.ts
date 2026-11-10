import { AsyncLocalStorage } from 'node:async_hooks'
import type { HostedLimits } from './limits.js'
import { HostedError } from './control.js'
export const hostedExecution = new AsyncLocalStorage<{ limits: HostedLimits; holdId: string; principal: string }>()
/** Thin transport wrapper: called inside each provider's retry loop, before any bytes leave. */
export function meteredFetch(transport: (url: string, init: RequestInit) => Promise<Response>, provider: 'research' | 'decision' | 'embedding'): (url: string, init: RequestInit) => Promise<Response> {
  return async (url, init) => {
    if (process.env.HOSTED !== '1') return transport(url, init)
    const context = hostedExecution.getStore()
    if (!context) throw new HostedError(503, 'model_authority_missing')
    const c = context.limits.config
    let body = typeof init?.body === 'string' ? init.body : ''
    const payload = body ? JSON.parse(body) as { model?: string; max_tokens?: number; questions?: unknown[] } : {}
    // Bytes upper-bound input tokens; output ceiling is an operator-qualified provider bound.
    const output = provider === 'research' ? payload.max_tokens ?? 3000 : provider === 'embedding' ? 0 : Number(c.HOSTED_DECISION_OUTPUT_TOKENS || 8192)
    if (provider === 'decision' && body) {
      // Enforce the reserved output ceiling at the provider, including its own reasoning tokens.
      body = JSON.stringify({ ...payload, ...(new URL(url).hostname === 'api.openai.com' ? { max_output_tokens: output } : { max_tokens: output }) })
      init = { ...init, body }
    }
    const input = Buffer.byteLength(body) + 1024
    const prefix = provider.toUpperCase()
    const inputRate = Number(c[`HOSTED_${prefix}_INPUT_USD_PER_MILLION`]), outputRate = Number(c[`HOSTED_${prefix}_OUTPUT_USD_PER_MILLION`])
    if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate < 0 || !Number.isSafeInteger(output) || output < 0) throw new HostedError(503, 'model_rates_unavailable')
    const model = payload.model || (provider === 'embedding' ? 'embedding' : c.DECISION_MODEL || 'decision')
    const attempt = context.limits.attempt(context.holdId, provider, model, input, output, Math.max(1, Math.ceil(input * inputRate + output * outputRate)))
    // Keep the conservative charge even on timeout, invalid JSON, partial stream or missing usage.
    const response = await transport(url, init)
    if (!response.ok || !response.body) return response
    const sse = response.headers.get('content-type')?.includes('text/event-stream')
    let text = '', valid = true, usage: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } | undefined
    const decoder = new TextDecoder()
    const consume = (line: string) => {
      if (!line.startsWith('data:')) return
      try { const value = JSON.parse(line.slice(5)) as { usage?: typeof usage }; if(value.usage) usage=value.usage } catch { /* content is validated by the existing provider */ }
    }
    return new Response(response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
      transform(chunk,controller) {
        controller.enqueue(chunk)
        if (!valid) return
        text += decoder.decode(chunk,{stream:true})
        if(text.length>1048576) {valid=false;text='';return}
        if(sse) {const lines=text.split('\n');text=lines.pop()!;for(const line of lines) consume(line)}
      },
      flush() {
        if (!valid) return
        text += decoder.decode()
        if(sse) consume(text)
        else {try { const payload=JSON.parse(text) as {usage?:typeof usage;result?:{usage?:typeof usage}};usage=payload.usage??payload.result?.usage } catch {return} }
        const i=usage?.prompt_tokens??usage?.input_tokens, o=usage?.completion_tokens??usage?.output_tokens
        if(i!==undefined && o!==undefined) context.limits.completeAttempt(attempt,i,o,Math.ceil(i*inputRate+o*outputRate))
      },
    })),{status:response.status,statusText:response.statusText,headers:response.headers})
  }
}
