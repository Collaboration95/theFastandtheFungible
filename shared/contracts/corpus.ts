import { z } from 'zod'
import { ManifestSchema } from './manifest.js'
export const PriceSchema = z.object({ amountMinor: z.number().int().nonnegative(), currency: z.literal('SGD') })
export const SpanSchema = z.object({ id: z.string().min(1), text: z.string().min(1), label: z.string().optional() })
/** Engine-side trust view of a seller of record (D6, D21); see ReputationRecordSchema in decision.ts. */
export const ReputationSummarySchema = z.object({ H: z.number().min(0).max(1), C: z.number().min(0).max(1), T: z.number().min(0).max(1), status: z.enum(['active', 'quarantined', 'delisted']) })
/**
 * Identity mapping (W0, #115; decided once so #130, #131, #138 and #142 agree):
 * on candidates, intents, grants and contents, `profileId` = publisher slug and
 * `resourceId` = article id (globally unique); `version` is unchanged. The new
 * fields below are additive, so `server/store.ts` keeps its storage keys.
 */
export const PublicCandidateSchema = z.object({
  profileId: z.string().min(1), resourceId: z.string().min(1), version: z.string().min(1),
  title: z.string().min(1), publisher: z.string().min(1), preview: z.string().min(1),
  // A paid publisher's public XRPL Testnet address: where its readers pay (#98 phase 2).
  price: PriceSchema, wallet: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/).optional(), family: z.string().min(1), derivedFrom: z.string().optional(),
  // Free-form tags (D10). Legacy field name kept so the current corpus loads; Article.tags maps here.
  facets: z.array(z.string()), authority: z.number().min(0).max(2), tier: z.enum(['FREE', 'PAID']),
  license: z.object({ kind: z.string(), attribution: z.string() }),
  publisherSlug: z.string().optional(), writerSlug: z.string().optional(),
  /** Agent-facing, root-relative endpoint (`/w/<slug>/articles/<id>`), as on SearchHit. */
  url: z.string().optional(), relevance: z.number().min(0).max(1).optional(),
  reputation: ReputationSummarySchema.optional(),
  /** The verified signed manifest of a PAID search hit (D4); purchase checks the 402 terms against it. Never sent to Clef. */
  manifest: ManifestSchema.optional(),
})
export const ContentEnvelopeSchema = z.object({
  profileId: z.string(), resourceId: z.string(), version: z.string(), title: z.string(), publisher: z.string(),
  body: z.string().min(1), spans: z.array(SpanSchema).min(1),
})
export const CorpusResourceSchema = PublicCandidateSchema.extend({ body: z.string().min(1), spans: z.array(SpanSchema).min(1) })
export type ReputationSummary = z.infer<typeof ReputationSummarySchema>
export type PublicCandidate = z.infer<typeof PublicCandidateSchema>
export type PublicSourceRef = Pick<PublicCandidate, 'resourceId' | 'version' | 'title' | 'publisher' | 'family' | 'facets'>
export type ContentEnvelope = z.infer<typeof ContentEnvelopeSchema>
export type CorpusResource = z.infer<typeof CorpusResourceSchema>
