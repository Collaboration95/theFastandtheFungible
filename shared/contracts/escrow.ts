import { z } from 'zod'
import { AssetSchema } from './asset.js'
export const KeyRevealCommitmentSchema = z.object({ ciphertextHash: z.string().regex(/^[a-f0-9]{64}$/), plaintextHash: z.string().regex(/^[a-f0-9]{64}$/), iv: z.string().regex(/^[A-F0-9]{24}$/), tag: z.string().regex(/^[A-F0-9]{32}$/) })
export const EscrowTermsSchema = z.object({
  keyReveal: KeyRevealCommitmentSchema.optional(), scheme: z.literal('escrow-v1'), network: z.literal('xrpl:1'), asset: AssetSchema,
  quoteId: z.string(), intentId: z.string().min(1).max(200), publisherSlug: z.string(), articleId: z.string(), version: z.string(),
  manifestRoot: z.string(), amount: z.string().regex(/^(?:[1-9]\d*(?:\.\d{1,6})?|0\.\d{1,6})$/), payer: z.string(), payTo: z.string(),
  condition: z.string().regex(/^A0258020[0-9A-F]{64}810120$/), cancelAfter: z.number().int().positive(),
})
export const EscrowQuoteSchema = z.object({ ciphertext: z.string().regex(/^[A-F0-9]+$/).optional(), terms: EscrowTermsSchema, pubKey: z.string(), sig: z.string() })
export const EscrowStatusSchema = z.object({ scheme: z.literal('escrow-v1'), policy: z.literal('escrow-policy-v1'),
  state: z.enum(['PREPARED', 'LOCKED', 'VERIFIED_FOR_RELEASE', 'CANCEL_DUE', 'RELEASED', 'CANCELLED']),
  mode: z.literal('key-reveal').optional(), revealLedger: z.number().int().positive().optional(), owner: z.string(), cancelAfter: z.number(), createSequence: z.number().optional(), createHash: z.string().optional(),
  keyVerified: z.boolean().optional(), decryptVerified: z.boolean().optional(), finishHash: z.string().optional(), cancelHash: z.string().optional(), proofOk: z.boolean().optional(),
})
export type EscrowTerms = z.infer<typeof EscrowTermsSchema>
export type EscrowQuote = z.infer<typeof EscrowQuoteSchema>
export type EscrowStatus = z.infer<typeof EscrowStatusSchema>
