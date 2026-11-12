import { z } from 'zod'
/** A strict public export. Private receipts and audit events are never browser payloads. */
export const PublicPurchaseSchema = z.object({
  rating: z.boolean().nullable().default(null),
  id: z.string().regex(/^[a-f0-9]{24}$/), time: z.string().datetime(), topic: z.string().max(80),
  resourceTitle: z.string().max(240), writer: z.string().max(120), priceMinor: z.number().int().nonnegative(),
  createHash: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(), createLedger: z.number().int().positive().nullable(),
  finishHash: z.string().regex(/^[A-Fa-f0-9]{64}$/).nullable(),
  keyCheck: z.enum(['match','mismatch','pending','unavailable']), gate: z.enum(['verified','failed','pending','unavailable']),
  state: z.enum(['locked','finished','cancelled']), settlementSeconds: z.number().nonnegative().nullable(),
}).strict()
export type PublicPurchase = z.infer<typeof PublicPurchaseSchema>
export type PublicFeed = { rows: PublicPurchase[]; updatedAt: string }
export const PublicFeedExportSchema = z.object({ schema: z.literal('public-feed-v1'), label: z.string().max(160), rows: z.array(PublicPurchaseSchema).max(10000) }).strict()
