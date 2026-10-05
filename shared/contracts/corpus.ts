import { z } from 'zod'
export const FacetSchema = z.enum(['demand', 'equipment-delivery', 'grid-energisation'])
export const PriceSchema = z.object({ amountMinor: z.number().int().nonnegative(), currency: z.literal('SGD') })
export const SpanSchema = z.object({ id: z.string().min(1), text: z.string().min(1), label: z.string().optional() })
export const PublicCandidateSchema = z.object({
  profileId: z.string().min(1), resourceId: z.string().min(1), version: z.string().min(1),
  title: z.string().min(1), publisher: z.string().min(1), preview: z.string().min(1),
  // A paid publisher's public XRPL Testnet address: where its readers pay (#98 phase 2).
  price: PriceSchema, wallet: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/).optional(), family: z.string().min(1), derivedFrom: z.string().optional(),
  facets: z.array(FacetSchema), authority: z.number().min(0).max(2), tier: z.enum(['FREE', 'PAID']),
  license: z.object({ kind: z.string(), attribution: z.string() }),
})
export const ContentEnvelopeSchema = z.object({
  profileId: z.string(), resourceId: z.string(), version: z.string(), title: z.string(), publisher: z.string(),
  body: z.string().min(1), spans: z.array(SpanSchema).min(1),
})
export const CorpusResourceSchema = PublicCandidateSchema.extend({ body: z.string().min(1), spans: z.array(SpanSchema).min(1) })
export type Facet = z.infer<typeof FacetSchema>
export type PublicCandidate = z.infer<typeof PublicCandidateSchema>
export type PublicSourceRef = Pick<PublicCandidate, 'resourceId' | 'version' | 'title' | 'publisher' | 'family' | 'facets'>
export type ContentEnvelope = z.infer<typeof ContentEnvelopeSchema>
export type CorpusResource = z.infer<typeof CorpusResourceSchema>
