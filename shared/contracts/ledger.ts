import { z } from 'zod'
import { QuoteSchema } from './publisher.js'
/**
 * Intent lifecycle. Purchase: DECIDED → QUOTED → RESERVED → SUBMITTING → SETTLED
 * → DELIVERY_PENDING → VERIFIED; SKIPPED, FAILED_NOT_SETTLED and DELIVERY_FAILED end it.
 * Proof (D4/D5), only after delivery: DELIVERY_PENDING → CLAIM_FAILED when
 * verifyDelivery fails (the source is quarantined, never cited) → CHALLENGED once
 * POST /challenge is sent → REFUNDED (writer paid back, write-once refund) |
 * CHALLENGE_REJECTED (writer says the claim holds) | CHALLENGE_REFUSED (refused
 * or timed out after 30 s). All three are terminal; spent stays the gross charge.
 */
export const IntentStatusSchema = z.enum(['DECIDED', 'QUOTED', 'RESERVED', 'SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'VERIFIED', 'SKIPPED', 'FAILED_NOT_SETTLED', 'DELIVERY_FAILED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
export const PurchaseIntentSchema = z.object({ intentId: z.string(), runId: z.string(), profileId: z.string(), resourceId: z.string(), version: z.string(), amountMinor: z.number().int().nonnegative(), status: IntentStatusSchema, quote: QuoteSchema.optional(), /** x402 v2: root-relative paid GET path, resent with the same signed blob. */ paidPath: z.string().optional(), receiptId: z.string().optional(), txHash: z.string().optional(), error: z.string().optional(), failedClaimIds: z.array(z.string()).optional(), refund: z.object({ txHash: z.string(), amountMinor: z.number().int().nonnegative() }).optional() })
export const GrantSchema = z.object({ runId: z.string(), resourceId: z.string(), version: z.string(), intentId: z.string(), /** The manifest root for x402 v2 purchases. */ contentDigest: z.string(), grantedAt: z.string() })
export type PurchaseIntent = z.infer<typeof PurchaseIntentSchema>
export type IntentStatus = z.infer<typeof IntentStatusSchema>
export type Grant = z.infer<typeof GrantSchema>

/** Server-private verification input; never included in a run snapshot or wire event. */
/** x402 v2 (#130): the delivered envelope bytes plus the per-passage salts that recompute the manifest root. */
export type DeliveryProof = { bytes: string | Uint8Array; salts: string[] }
