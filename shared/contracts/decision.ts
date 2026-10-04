import { z } from 'zod'
import { PublicCandidateSchema } from './corpus.js'
export const CandidateJudgmentSchema = z.object({ addressesGap: z.number().min(0).max(1), originality: z.object({ original: z.number().min(0).max(1), rewrite: z.number().min(0).max(1), overlap: z.number().min(0).max(1) }), credibility: z.number().min(0).max(2) })
export const DecisionRowSchema = z.object({ candidate: PublicCandidateSchema, judgment: CandidateJudgmentSchema, value: z.number(), valuePerDollar: z.number(), verdict: z.enum(['BUY', 'SKIP_REWRITE', 'SKIP_OVER_CAP', 'SKIP_OVER_BUDGET', 'SKIP_LOW_VALUE', 'SKIP_NO_GAP']), reason: z.string(), wouldBuy: z.boolean().default(false) })
export const DecisionRoundSchema = z.object({ round: z.number().int().positive(), gap: z.string(), gapMaterial: z.number().min(0).max(1), provider: z.enum(['cloudflare', 'fixture']), model: z.string(), threshold: z.number(), rows: z.array(DecisionRowSchema), selectedResourceId: z.string().optional(), fallbackReason: z.string().optional() })
export type CandidateJudgment = z.infer<typeof CandidateJudgmentSchema>
export type DecisionRow = z.infer<typeof DecisionRowSchema>
export type DecisionRound = z.infer<typeof DecisionRoundSchema>
