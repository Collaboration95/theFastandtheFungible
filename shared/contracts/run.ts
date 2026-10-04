import { z } from 'zod'
import { AnswerSchema, ImpactSchema } from './answer.js'
import { ContentEnvelopeSchema, PublicCandidateSchema } from './corpus.js'
import { DecisionRoundSchema } from './decision.js'
import { PurchaseIntentSchema, GrantSchema } from './ledger.js'
import { ReceiptSchema } from './publisher.js'
export const AskSchema = z.object({ question: z.string().trim().min(1).max(2000), budgetMinor: z.union([z.literal(0), z.literal(100), z.literal(200), z.literal(500)]) })
export const TraceEventSchema = z.object({ id: z.number().int(), runId: z.string(), type: z.string(), label: z.string(), at: z.string(), data: z.record(z.string(), z.unknown()).optional() })
export const ModeLabelsSchema = z.object({ research: z.string(), decision: z.string(), publisher: z.string(), settlement: z.literal('SIMULATED SGD · no real funds') })
export const RunSnapshotSchema = z.object({
  runId: z.string(), question: z.string(), budgetMinor: z.number().int().nonnegative(), spentMinor: z.number().int().nonnegative(), reservedMinor: z.number().int().nonnegative(), perSourceCapMinor: z.number().int().nonnegative(),
  phase: z.enum(['SEARCH', 'READ_FREE', 'ANSWER', 'DECIDE', 'BUY', 'READ_PAID', 'DONE', 'FAILED', 'STOPPED']), stopped: z.boolean(), round: z.number().int().nonnegative(),
  candidates: z.array(PublicCandidateSchema), contents: z.array(ContentEnvelopeSchema), answers: z.array(AnswerSchema), impact: ImpactSchema.optional(), decisions: z.array(DecisionRoundSchema), intents: z.array(PurchaseIntentSchema), receipts: z.array(ReceiptSchema), grants: z.array(GrantSchema), events: z.array(TraceEventSchema), labels: ModeLabelsSchema,
  checkpoint: z.record(z.string(), z.unknown()), error: z.string().optional(), reportStatus: z.enum(['NONE', 'GENERATING', 'PDF', 'HTML', 'FAILED']),
})
export type TraceEvent = z.infer<typeof TraceEventSchema>
export type RunSnapshot = z.infer<typeof RunSnapshotSchema>
export type ModeLabels = z.infer<typeof ModeLabelsSchema>
export type Ask = z.infer<typeof AskSchema>
