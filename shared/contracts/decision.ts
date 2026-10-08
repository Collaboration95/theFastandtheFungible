import { z } from 'zod'
import { PublicCandidateSchema, ReputationSummarySchema } from './corpus.js'
export const CandidateJudgmentSchema = z.object({ addressesGap: z.number().min(0).max(1), originality: z.object({ original: z.number().min(0).max(1), rewrite: z.number().min(0).max(1), overlap: z.number().min(0).max(1) }), credibility: z.number().min(0).max(2) })
export const DecisionRowSchema = z.object({ candidate: PublicCandidateSchema, judgment: CandidateJudgmentSchema, value: z.number().min(0).max(1), valuePerDollar: z.number().nonnegative().finite(), verdict: z.enum(['BUY', 'SKIP_REWRITE', 'SKIP_OVER_CAP', 'SKIP_OVER_BUDGET', 'SKIP_LOW_VALUE', 'SKIP_NO_GAP', 'SKIP_LOW_TRUST']), reason: z.string(), wouldBuy: z.boolean().default(false), reputation: ReputationSummarySchema.optional() })
/** Who judged a round (gate 5): Cloudflare Clef, OpenAI Decisions, or the offline metadata fixture. Never one labelled as another. */
export const DecisionProviderSchema = z.enum(['cloudflare', 'openai', 'fixture'])
export type DecisionProviderName = z.infer<typeof DecisionProviderSchema>
export const decisionProviderLabels: Record<DecisionProviderName, string> = { cloudflare: 'Cloudflare', openai: 'OpenAI Decisions', fixture: 'fixture' }
/** "OpenAI Decisions · gpt-6-luna", "Cloudflare · @cf/cloudflare/clef-flash", "fixture · metadata-fixture". */
export const decisionLabel = (round: { provider: DecisionProviderName; model: string }) => `${decisionProviderLabels[round.provider]} · ${round.model}`
/**
 * `fallbackReason` is no longer written (#216: a failed live round buys nothing and is never substituted);
 * it stays optional so stored runs from before still parse. `promptVersion` names the question wording and option order.
 */
export const DecisionRoundSchema = z.object({ round: z.number().int().positive(), gap: z.string(), gapMaterial: z.number().min(0).max(1), provider: DecisionProviderSchema, model: z.string(), promptVersion: z.string().optional(), threshold: z.number().min(0).max(1), rows: z.array(DecisionRowSchema), selectedResourceId: z.string().optional(), fallbackReason: z.string().optional() })
export type CandidateJudgment = z.infer<typeof CandidateJudgmentSchema>
export type DecisionRow = z.infer<typeof DecisionRowSchema>
export type DecisionRound = z.infer<typeof DecisionRoundSchema>

/**
 * Beta Reputation System + calibration (FINAL-PUSH §7), keyed by the seller of
 * record: the publisher wallet that signs manifests and is paid (D21).
 * H = (r + α0) / (r + s + α0 + β0); C = 1 − brierSum / n (1 when n = 0); T = H × C.
 */
export const ReputationRecordSchema = z.object({
  publisherSlug: z.string().min(1), wallet: z.string().min(1),
  r: z.number().nonnegative(), s: z.number().nonnegative(),
  passes: z.number().int().nonnegative(), fails: z.number().int().nonnegative(), refunds: z.number().int().nonnegative(), refusals: z.number().int().nonnegative(),
  brierSum: z.number().nonnegative(), n: z.number().int().nonnegative(),
  H: z.number().min(0).max(1), C: z.number().min(0).max(1), T: z.number().min(0).max(1),
  status: z.enum(['active', 'quarantined', 'delisted']), updatedAt: z.string(),
})
export type ReputationRecord = z.infer<typeof ReputationRecordSchema>
