import { z } from 'zod'
export const LlmProviderSchema = z.enum(['deepseek', 'groq', 'fixture'])
/** Visible provider names for labels (gate ⑤). */
export const providerLabels: Record<z.infer<typeof LlmProviderSchema>, string> = { deepseek: 'DeepSeek', groq: 'Groq', fixture: 'fixture' }
export const CitationSchema = z.object({ resourceId: z.string(), version: z.string(), spanId: z.string() })
export const ClaimSchema = z.object({ id: z.string(), text: z.string().min(1), stance: z.enum(['SUPPORTS', 'CHALLENGES', 'UNCERTAIN']), citations: z.array(CitationSchema).min(1) })
/** A free-text gap (D10): what is missing, never what to buy. */
export const GapSchema = z.object({ text: z.string().min(1).max(160), tags: z.array(z.string()).optional() })
export const AnswerSchema = z.object({ conclusion: z.string().min(1), claims: z.array(ClaimSchema), openGaps: z.array(GapSchema), version: z.number().int().positive(), provider: LlmProviderSchema, model: z.string() })
export const ImpactSchema = z.object({ classification: z.enum(['STRENGTHENS', 'QUALIFIES', 'CONTRADICTS', 'UNCHANGED']), explanation: z.string(), claimChanges: z.array(z.object({ fromClaimId: z.string().optional(), toClaimId: z.string().optional(), change: z.enum(['ADDED', 'REVISED', 'REMOVED', 'UNCHANGED']) })) })
/**
 * Requested facts (#208): frozen from the question and the clarify answers before any evidence is read, with stable
 * ids r1…r5. `gap` is the frozen wording the decision model judges while the fact is open (defaults to `text`).
 */
export const RequirementSchema = z.object({ id: z.string().regex(/^r[1-5]$/), text: z.string().min(1).max(160), gap: z.string().min(1).max(160).optional() })
/** The four judged statuses (#213 rubric) plus the application's `unknown` (invalid, absent or failed coverage). */
export const COVERAGE_STATUSES = ['supported', 'partial', 'missing', 'conflicting', 'unknown'] as const
export const CoverageStatusSchema = z.enum(COVERAGE_STATUSES)
export const CoverageEntrySchema = z.object({ requirementId: z.string(), status: CoverageStatusSchema, claimIds: z.array(z.string()).optional() })
/** Coverage of one answer version, judged by the decision model over the passages its validated claims cite. */
export const CoverageSchema = z.object({ answerVersion: z.number().int().positive(), judge: z.string(), entries: z.array(CoverageEntrySchema), error: z.string().optional() })
/**
 * The answer as the model writes it (streaming): UNVERIFIED text, shown only under a "draft" label until the citation
 * check runs. Ephemeral: sent over SSE only, never stored in the run, its events or telemetry. `removed` lists drafted
 * claims the citation check rejected; a `conditional` draft is kept only if it answers more requested facts.
 * Claims only: the validated conclusion is rebuilt from the kept claims, so the model's own summary is never shown.
 */
export const DraftClaimSchema = z.object({ text: z.string(), stance: ClaimSchema.shape.stance.optional() })
export const AnswerDraftSchema = z.object({
  runId: z.string(), version: z.number().int().positive(), conditional: z.boolean(),
  status: z.enum(['WRITING', 'CHECKING', 'KEPT', 'DISCARDED', 'FAILED']),
  claims: z.array(DraftClaimSchema).max(12), removed: z.array(z.string()).optional(),
})
export type Citation = z.infer<typeof CitationSchema>
export type Claim = z.infer<typeof ClaimSchema>
export type Gap = z.infer<typeof GapSchema>
export type Answer = z.infer<typeof AnswerSchema>
export type Impact = z.infer<typeof ImpactSchema>
export type DraftClaim = z.infer<typeof DraftClaimSchema>
export type AnswerDraft = z.infer<typeof AnswerDraftSchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>
export type CoverageEntry = z.infer<typeof CoverageEntrySchema>
export type Coverage = z.infer<typeof CoverageSchema>
