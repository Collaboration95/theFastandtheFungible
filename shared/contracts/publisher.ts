import { z } from 'zod'
/** Settlement rails. Both are labelled; neither moves real value. */
export const SIMULATED_LABEL = 'SIMULATED SGD · no real funds'
export const XRPL_LABEL = 'XRPL TESTNET · no real value'
export const SettlementLabelSchema = z.enum([SIMULATED_LABEL, XRPL_LABEL])
export const RailSchema = z.enum(['simulated', 'xrpl-testnet'])
/** Fixed, labelled demo rate (Testnet XRP has no value): S$0.01 = 1,000 drops, so S$0.80 = 0.08 XRP. */
export const DROPS_PER_MINOR = 1000
export const XRPL_EXPLORER = 'https://testnet.xrpl.org/transactions'
const hash256 = z.string().regex(/^[0-9A-F]{64}$/)
/** x402-shaped payment terms carried by a quote; invoiceId (the quote hash) becomes the XRPL InvoiceID. */
export const PaymentRequirementSchema = z.object({ rail: z.literal('xrpl-testnet'), network: z.literal('xrpl:1'), asset: z.literal('XRP'), payTo: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/), amountDrops: z.string().regex(/^[1-9]\d*$/), invoiceId: hash256 })
export const LedgerProofSchema = z.object({ txHash: hash256, ledgerIndex: z.number().int().positive(), payer: z.string(), payTo: z.string(), amountDrops: z.string() })
export const ProfileSchema = z.object({ id: z.string(), name: z.string(), tier: z.enum(['FREE', 'PAID']) })
export const QuoteRequestSchema = z.object({ profileId: z.string(), resourceId: z.string(), version: z.string(), runId: z.string(), intentId: z.string() })
export const QuoteSchema = QuoteRequestSchema.extend({ quoteId: z.string(), quoteHash: z.string(), amountMinor: z.number().int().nonnegative(), currency: z.literal('SGD'), expiresAt: z.string(), contentDigest: z.string(), payment: PaymentRequirementSchema.optional() })
export const SettlementRequestSchema = z.object({ quoteId: z.string(), quoteHash: z.string(), intentId: z.string(), txHash: hash256.optional() })
export const SettlementSchema = z.object({ status: z.enum(['NOT_FOUND', 'PENDING', 'SETTLED']), receiptId: z.string().optional(), deliveryToken: z.string().optional(), ledger: LedgerProofSchema.optional() })
export const ReceiptSchema = z.object({ receiptId: z.string(), intentId: z.string(), runId: z.string(), resourceId: z.string(), version: z.string(), amountMinor: z.number().int().nonnegative(), currency: z.literal('SGD'), settledAt: z.string(), label: SettlementLabelSchema, xrpl: LedgerProofSchema.extend({ explorerUrl: z.string() }).optional() })
export type Profile = z.infer<typeof ProfileSchema>
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>
export type Quote = z.infer<typeof QuoteSchema>
export type Settlement = z.infer<typeof SettlementSchema>
export type Receipt = z.infer<typeof ReceiptSchema>
export type PaymentRequirement = z.infer<typeof PaymentRequirementSchema>
export type LedgerProof = z.infer<typeof LedgerProofSchema>
export type Rail = z.infer<typeof RailSchema>
