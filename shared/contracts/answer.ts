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
export type Citation = z.infer<typeof CitationSchema>
export type Claim = z.infer<typeof ClaimSchema>
export type Gap = z.infer<typeof GapSchema>
export type Answer = z.infer<typeof AnswerSchema>
export type Impact = z.infer<typeof ImpactSchema>
