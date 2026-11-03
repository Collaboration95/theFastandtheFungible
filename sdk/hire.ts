import { payAndFetch, type PayOptions } from './x402.js'
/** Configure the remote URL and signing authority outside the calling LLM. */
export function createHireClient(options: { baseUrl: string; token?: string } & Omit<PayOptions, 'body' | 'method' | 'headers' | 'idempotencyKey'>) {
  return {
    async hire(question: string, input: { budgetMinor: 100 | 200 | 500; idempotencyKey: string }) {
      const paid = await payAndFetch(new URL('/v1/ask', options.baseUrl).href, { ...options, method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
        body: JSON.stringify({ question, budgetMinor: input.budgetMinor }), idempotencyKey: input.idempotencyKey })
      if (!paid.response.ok) throw new Error('Hire delivery unavailable; retry the same idempotency key')
      return await paid.response.json() as Record<string, unknown>
    },
  }
}
