import { LedgerAnchorSchema } from './anchor.js'
import { SourceIdentitySchema } from '../source-identity.js'
import { ContributionsSchema } from '../contribution.js'
import { z } from 'zod'
import { AnswerSchema, RequirementSchema } from './answer.js'
import { ContentEnvelopeSchema, PublicCandidateSchema } from './corpus.js'
import { ManifestSchema } from './manifest.js'
import { GrantSchema, PurchaseIntentSchema } from './ledger.js'
import { ReceiptSchema } from './publisher.js'
import { AssetSchema } from './asset.js'
import { EscrowQuoteSchema, EscrowTermsSchema, HoldbackStatusSchema } from './escrow.js'

export const AuditProofEntrySchema = z.object({ seq: z.number().int().positive(), at: z.string(), prevHash: z.string(), hash: z.string(), runId: z.string().nullable(), intentId: z.string().nullable(), surface: z.string(), principal: z.string(), kind: z.string(), data: z.record(z.string(), z.unknown()) })
export const ReceiptRowSchema = z.object({
  asset: AssetSchema.optional(), deliveredAmount: z.unknown().optional(), escrowTerms: EscrowTermsSchema.optional(), escrowCreateHash: z.string().optional(), escrowCreateSequence: z.number().optional(), escrowState: z.string().optional(), holdback: HoldbackStatusSchema.optional(),
  kind: z.enum(['purchase', 'inbound', 'royalty', 'change']), label: z.string(), network: z.string(), runId: z.string(), intentId: z.string(), surface: z.string(), principal: z.string(), policyVersion: z.string(), writer: z.string(), resourceId: z.string(), version: z.string(),
  payee: z.string(), payer: z.string(), amountMinor: z.union([z.number(), z.literal('')]), currency: z.string(), amountDrops: z.string(), txHash: z.string(), invoiceId: z.string(), ledgerIndex: z.union([z.number(), z.literal('')]), explorerUrl: z.string(), status: z.string(), refundTxHash: z.string(), refundAmountMinor: z.union([z.number(), z.literal('')]), refundExplorerUrl: z.string(), reservedAt: z.string(), settledAt: z.string(),
})
/** A portable, explicit export of accessible evidence. Never includes quarantined bodies or signed blobs. */
export const ReceiptBundleSchema = z.object({
  holdbacks: z.array(z.object({ intentId:z.string(), batch:z.record(z.string(),z.unknown()), terminal:z.record(z.string(),z.unknown()).optional() })).optional(),
  fraudProofs: z.array(z.object({ intentId: z.string(), manifest: ManifestSchema, quote: EscrowQuoteSchema, key: z.string().regex(/^[A-F0-9]{64}$/), finishHash: z.string(), ledgerIndex: z.number().int().positive(), ciphertextHash: z.string(), failedClaimIds: z.array(z.string()) })).optional(),
  ledgerAnchor: LedgerAnchorSchema.optional(),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), identityVersion: z.union([z.literal(1), z.literal(2)]).optional(), contributions: ContributionsSchema.optional(), requirements: z.array(RequirementSchema).optional(), runId: z.string(), label: z.string(),
  answers: z.array(AnswerSchema).min(1), sources: z.array(ContentEnvelopeSchema), candidates: z.array(PublicCandidateSchema),
  intents: z.array(PurchaseIntentSchema), grants: z.array(GrantSchema), receipts: z.array(ReceiptSchema), payments: z.array(ReceiptRowSchema),
  proofs: z.array(z.object({ source: SourceIdentitySchema.optional(), resourceId: z.string(), version: z.string(), manifest: ManifestSchema, salts: z.array(z.string()), intentId: z.string().optional(), keyReveal: z.object({ quote: EscrowQuoteSchema, key: z.string().regex(/^[A-F0-9]{64}$/), finishHash: z.string(), ledgerIndex: z.number().int().positive(), createHash: z.string() }).optional() })),
  audit: z.object({ anchor: z.object({ seq: z.number().int().nonnegative(), hash: z.string() }), entries: z.array(z.union([AuditProofEntrySchema, z.object({ seq: z.number().int().positive(), prevHash: z.string(), hash: z.string(), commitment: z.literal(true) })])), head: z.string() }),
})
export type ReceiptBundle = z.infer<typeof ReceiptBundleSchema>
