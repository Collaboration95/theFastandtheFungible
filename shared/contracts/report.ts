import { z } from 'zod'
import { ClaimSchema, ImpactSchema } from './answer.js'
import { DecisionRoundSchema } from './decision.js'
import { ReceiptSchema } from './publisher.js'
import { ContentEnvelopeSchema } from './corpus.js'
export const ReportSchema = z.object({ title: z.string(), question: z.string(), budgetMinor: z.number(), spentMinor: z.number(), executiveAnswer: z.string(), findings: z.array(ClaimSchema), purchasesChanged: z.string(), impact: ImpactSchema.optional(), openQuestions: z.array(z.string()), method: z.string(), disclaimer: z.string(), decisions: z.array(DecisionRoundSchema), receipts: z.array(ReceiptSchema), sources: z.array(ContentEnvelopeSchema), provider: z.enum(['groq', 'fixture']), model: z.string() })
export type Report = z.infer<typeof ReportSchema>
