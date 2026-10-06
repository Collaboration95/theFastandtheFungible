import { z } from 'zod'

// x402 v2 (specs/x402-specification-v2.md) with the XRPL exact scheme
// (specs/schemes/exact/scheme_exact_xrpl.md). XRPL Testnet only: network 'xrpl:1'.
const xrplAddress = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/)

export const X402_NETWORK = 'xrpl:1'
export const ResourceInfoSchema = z.object({ url: z.string().min(1), description: z.string().optional(), mimeType: z.string().optional() })
/** One `accepts[]` entry. `extra.invoiceId` is invoiceIdFor(...) (canonical JSON); the tx InvoiceID is its sha256. */
export const PaymentRequirementsSchema = z.object({
  scheme: z.literal('exact'), network: z.literal(X402_NETWORK), amount: z.string().regex(/^[1-9]\d*$/), asset: z.literal('XRP'),
  payTo: xrplAddress, maxTimeoutSeconds: z.number().int().positive(),
  extra: z.object({ invoiceId: z.string().min(1), areFeesSponsored: z.literal(false) }),
})
/** `PAYMENT-REQUIRED` header, sent with HTTP 402. */
export const PaymentRequiredSchema = z.object({ x402Version: z.literal(2), resource: ResourceInfoSchema, accepts: z.array(PaymentRequirementsSchema).min(1), error: z.string().optional() })
/** `PAYMENT-SIGNATURE` header: the buyer's signed XRPL Payment, hex encoded. */
export const PaymentSignatureSchema = z.object({ x402Version: z.literal(2), resource: ResourceInfoSchema.optional(), accepted: PaymentRequirementsSchema, payload: z.object({ signedTxBlob: z.string().regex(/^[0-9A-F]+$/i) }) })
/** `PAYMENT-RESPONSE` header (spec SettlementResponse). `transaction` is '' when settlement failed. */
export const PaymentResponseSchema = z.object({ success: z.boolean(), errorReason: z.string().optional(), payer: xrplAddress.optional(), transaction: z.union([z.literal(''), z.string().regex(/^[0-9A-F]{64}$/)]), network: z.literal(X402_NETWORK) })

export type ResourceInfo = z.infer<typeof ResourceInfoSchema>
export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>
export type PaymentRequired = z.infer<typeof PaymentRequiredSchema>
export type PaymentSignature = z.infer<typeof PaymentSignatureSchema>
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>
