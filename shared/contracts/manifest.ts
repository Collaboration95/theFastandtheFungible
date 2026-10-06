import { z } from 'zod'

const hex64 = z.string().regex(/^[0-9a-f]{64}$/)

/** Claim kinds name the kind of fact, never its value (D4). Checkers live in shared/manifest.ts. */
export const ClaimKindSchema = z.enum(['dated-figure', 'named-source', 'numeric-series'])

/**
 * Signed manifest of a PAID article (D4). Proofs: `leaves`, `root`, `claims`,
 * `wordCount`. Promise: `relevance` (feeds calibration). `claims[].leaf` is the
 * leaf hash of the passage the claim is bound to. `sig` is hex, by the key that
 * derives to `wallet`, over manifestMessage().
 */
export const ManifestSchema = z.object({
  publisherSlug: z.string().min(1), articleId: z.string().min(1), version: z.string().min(1),
  wallet: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/), pubKey: z.string().regex(/^[0-9A-F]{66}$/i),
  priceMinor: z.number().int().positive(), leaves: z.array(hex64).min(1), root: hex64,
  claims: z.array(z.object({ id: z.string().min(1), kind: ClaimKindSchema, leaf: hex64 })),
  wordCount: z.number().int().positive(), publishedAt: z.string().min(1), relevance: z.number().min(0).max(1),
  sig: z.string().regex(/^[0-9A-F]+$/i),
})

/**
 * One publisher search result (D3). Strict: it never carries body or passages
 * (gate 1); FREE passages come only from the read endpoint. `url` is the
 * root-relative agent endpoint; the human page URL comes from articleUrl() (#147).
 */
export const SearchHitSchema = z.object({
  publisherSlug: z.string().min(1), writerSlug: z.string().min(1), articleId: z.string().min(1), version: z.string().min(1),
  url: z.string().regex(/^\/w\/[a-z0-9-]+\/articles\/[A-Za-z0-9._-]+$/),
  title: z.string().min(1), abstract: z.string().min(1).max(220), tags: z.array(z.string()),
  tier: z.enum(['FREE', 'PAID']), priceMinor: z.number().int().nonnegative(), relevance: z.number().min(0).max(1),
  publishedAt: z.string().min(1), family: z.string().min(1), derivedFrom: z.string().optional(),
  manifest: ManifestSchema.optional(), searchMode: z.enum(['hybrid', 'keyword']),
}).strict().refine(hit => (hit.tier === 'PAID') === Boolean(hit.manifest), { message: 'a PAID hit needs a manifest; a FREE hit has none' })

export type ClaimKind = z.infer<typeof ClaimKindSchema>
export type Manifest = z.infer<typeof ManifestSchema>
export type SearchHit = z.infer<typeof SearchHitSchema>
