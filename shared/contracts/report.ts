import { z } from 'zod'
import { ClaimSchema, ImpactSchema, LlmProviderSchema } from './answer.js'
import { DecisionRoundSchema } from './decision.js'
import { ReceiptSchema } from './publisher.js'
import { PublicCandidateSchema, ContentEnvelopeSchema } from './corpus.js'
import { GrantSchema } from './ledger.js'
import { ModeLabelsSchema } from './run.js'

export const ReportSchema = z.object({
  title: z.string(), question: z.string(),
  budgetMinor: z.number().int().nonnegative(), spentMinor: z.number().int().nonnegative(),
  executiveAnswer: z.string(), findings: z.array(ClaimSchema),
  purchasesChanged: z.string(), impact: ImpactSchema.optional(),
  openQuestions: z.array(z.string()), method: z.string(), disclaimer: z.string(),
  decisions: z.array(DecisionRoundSchema), receipts: z.array(ReceiptSchema),
  sources: z.array(ContentEnvelopeSchema), provider: LlmProviderSchema, model: z.string(),
  // Additive fields preserve the W0 report shape. Rendering requires access provenance.
  fallbackReason: z.string().optional(),
  firstAnswer: z.string().optional(), finalAnswer: z.string().optional(),
  firstFindings: z.array(ClaimSchema).optional(), finalFindings: z.array(ClaimSchema).optional(),
  firstVersion: z.number().int().positive().optional(), finalVersion: z.number().int().positive().optional(),
  labels: ModeLabelsSchema.optional(),
  access: z.object({ runId: z.string(), candidates: z.array(PublicCandidateSchema), grants: z.array(GrantSchema) }).optional(),
})
export type Report = z.infer<typeof ReportSchema>
