import { z } from 'zod'
import { QuoteSchema } from './publisher.js'
export const IntentStatusSchema = z.enum(['DECIDED', 'QUOTED', 'RESERVED', 'SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'VERIFIED', 'SKIPPED', 'FAILED_NOT_SETTLED', 'DELIVERY_FAILED'])
export const PurchaseIntentSchema = z.object({ intentId: z.string(), runId: z.string(), profileId: z.string(), resourceId: z.string(), version: z.string(), amountMinor: z.number().int().nonnegative(), status: IntentStatusSchema, quote: QuoteSchema.optional(), receiptId: z.string().optional(), txHash: z.string().optional(), error: z.string().optional() })
export const GrantSchema = z.object({ runId: z.string(), resourceId: z.string(), version: z.string(), intentId: z.string(), contentDigest: z.string(), grantedAt: z.string() })
export type PurchaseIntent = z.infer<typeof PurchaseIntentSchema>
export type IntentStatus = z.infer<typeof IntentStatusSchema>
export type Grant = z.infer<typeof GrantSchema>

/** Server-private verification input; never included in a run snapshot or wire event. */
export type DeliveryProof = { bytes: string | Uint8Array; digest: string }
