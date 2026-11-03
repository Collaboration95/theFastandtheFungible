import type { PresentedRun } from './present.js'
import { payAndFetch, type PayOptions } from './x402.js'
/** Public result of /v1/ask, including the caller-to-writer money chain. */
export type HireResult = PresentedRun & { moneyChain: {
  inbound: { txHash: string; payer: string; payTo: string; amountDrops: string; explorerUrl: string; label: string }
  writerAddresses: Record<string, string>
  cancelledRoyalties: { id: string; payTo: string; amountDrops: string; reason: string }[]
  payments: { id: string; kind: string; payTo: string; amountDrops: string; txHash: string; explorerUrl: string; label: string }[]
  purchaseDrops: string; royaltyDrops: string; changeDrops: string; retainedDrops: string; feePolicy: string; policy: string
} }
/** Configure the remote URL and signing authority outside the calling LLM. */
export function createHireClient(options: { baseUrl: string; token?: string } & Omit<PayOptions, 'body' | 'method' | 'headers' | 'idempotencyKey'>) {
  return {
    async hire(question: string, input: { budgetMinor: 100 | 200 | 500; idempotencyKey: string }) {
      const paid = await payAndFetch(new URL('/v1/ask', options.baseUrl).href, { ...options, method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
        body: JSON.stringify({ question, budgetMinor: input.budgetMinor }), idempotencyKey: input.idempotencyKey })
      if (!paid.response.ok) throw new Error('Hire delivery unavailable; retry the same idempotency key')
      return await paid.response.json() as HireResult
    },
  }
}
