import { z } from 'zod'
export const ProfileSchema = z.object({ id: z.string(), name: z.string(), tier: z.enum(['FREE', 'PAID']) })
export const QuoteRequestSchema = z.object({ profileId: z.string(), resourceId: z.string(), version: z.string(), runId: z.string(), intentId: z.string() })
export const QuoteSchema = QuoteRequestSchema.extend({ quoteId: z.string(), quoteHash: z.string(), amountMinor: z.number().int().nonnegative(), currency: z.literal('SGD'), expiresAt: z.string(), contentDigest: z.string() })
export const SettlementRequestSchema = z.object({ quoteId: z.string(), quoteHash: z.string(), intentId: z.string() })
export const SettlementSchema = z.object({ status: z.enum(['NOT_FOUND', 'SETTLED']), receiptId: z.string().optional(), deliveryToken: z.string().optional() })
export const ReceiptSchema = z.object({ receiptId: z.string(), intentId: z.string(), runId: z.string(), resourceId: z.string(), version: z.string(), amountMinor: z.number().int().nonnegative(), currency: z.literal('SGD'), settledAt: z.string(), label: z.literal('SIMULATED SGD · no real funds') })
export type Profile = z.infer<typeof ProfileSchema>
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>
export type Quote = z.infer<typeof QuoteSchema>
export type Settlement = z.infer<typeof SettlementSchema>
export type Receipt = z.infer<typeof ReceiptSchema>
