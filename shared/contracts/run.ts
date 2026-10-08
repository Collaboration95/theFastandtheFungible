import { z } from 'zod'
import { AnswerSchema, ImpactSchema } from './answer.js'
import { ContentEnvelopeSchema, PublicCandidateSchema } from './corpus.js'
import { DecisionRoundSchema } from './decision.js'
import { PurchaseIntentSchema, GrantSchema } from './ledger.js'
import { ReceiptSchema, SettlementLabelSchema } from './publisher.js'
/** Clarify step (D8): the LLM's plan. Sub-queries are generic, never purchase picks. */
export const PlanSchema = z.object({ restatement: z.string().min(1), subqueries: z.array(z.string().min(1)).min(1).max(3) })
export const ScopeSchema = z.object({ questions: z.array(z.object({ id: z.string().min(1), text: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(4) })).max(2), plan: PlanSchema })
/** The per-question budget: S$0 to S$5 in 5-cent steps (articles cost from S$0.05). It is still the only spending authorisation. */
export const BUDGET = { maxMinor: 500, stepMinor: 5, initialMinor: 200, capMinor: 100 } as const
/** `answers` maps a scope question id to the chosen option; both are optional (questions can be skipped). */
export const AskSchema = z.object({ question: z.string().trim().min(1).max(2000), budgetMinor: z.number().int().min(0).max(BUDGET.maxMinor).multipleOf(BUDGET.stepMinor), answers: z.record(z.string(), z.string()).optional(), plan: PlanSchema.optional() })
/** Trace event types added by the final push; `type` stays a string so existing types keep working. */
export const TRACE_EVENT_TYPES = ['CLARIFY', 'PLAN', 'PROOF', 'CHALLENGE', 'REFUND', 'REPUTATION'] as const
export const TraceEventSchema = z.object({ id: z.number().int(), runId: z.string(), type: z.string(), label: z.string(), at: z.string(), data: z.record(z.string(), z.unknown()).optional() })
export const SEARCH_LABELS = ['hybrid', 'keyword only (embeddings unavailable)'] as const
/** `search` is optional until the search stream (#125+) sets it on every run (gate 5). */
export const ModeLabelsSchema = z.object({ research: z.string(), decision: z.string(), publisher: z.string(), settlement: SettlementLabelSchema, search: z.enum(SEARCH_LABELS).optional(), /** Who wrote the search plan: 'client plan', a live model, or 'fixture · scope-fixture' (gate 5). */ plan: z.string().optional() })
export const RunPhaseSchema = z.enum(['SEARCH', 'READ_FREE', 'ANSWER', 'DECIDE', 'BUY', 'READ_PAID', 'DONE', 'FAILED', 'STOPPED'])
export const RunCheckpointSchema = z.object({ phase: RunPhaseSchema.optional(), round: z.number().int().nonnegative().optional(), answerVersion: z.number().int().positive().optional(), intentId: z.string().optional(), answeredIntentId: z.string().optional(), nextAction: z.enum(['retry-delivery', 'ask']).optional() }).catchall(z.unknown())
export const RunSnapshotSchema = z.object({
  runId: z.string(), question: z.string(), budgetMinor: z.number().int().nonnegative(), spentMinor: z.number().int().nonnegative(), reservedMinor: z.number().int().nonnegative(), perSourceCapMinor: z.number().int().nonnegative(),
  /** Derived: sum of intent refunds. spentMinor stays the gross charge. */ refundedMinor: z.number().int().nonnegative().optional(),
  phase: RunPhaseSchema, stopped: z.boolean(), round: z.number().int().nonnegative(),
  candidates: z.array(PublicCandidateSchema), contents: z.array(ContentEnvelopeSchema), answers: z.array(AnswerSchema), impact: ImpactSchema.optional(), decisions: z.array(DecisionRoundSchema), intents: z.array(PurchaseIntentSchema), receipts: z.array(ReceiptSchema), grants: z.array(GrantSchema), events: z.array(TraceEventSchema), labels: ModeLabelsSchema,
  checkpoint: RunCheckpointSchema, error: z.string().optional(), reportStatus: z.enum(['NONE', 'GENERATING', 'PDF', 'HTML', 'FAILED']),
})
export type TraceEvent = z.infer<typeof TraceEventSchema>
export type RunSnapshot = z.infer<typeof RunSnapshotSchema>
export type ModeLabels = z.infer<typeof ModeLabelsSchema>
export type Ask = z.infer<typeof AskSchema>
export type Plan = z.infer<typeof PlanSchema>
export type Scope = z.infer<typeof ScopeSchema>

export type RunCheckpoint = z.infer<typeof RunCheckpointSchema>

/** Public Testnet wallet view: addresses and balances only, never seeds. */
export const LedgerWalletSchema = z.object({ role: z.enum(['buyer', 'publisher']), name: z.string(), address: z.string(), balanceDrops: z.string().nullable(), receivedDrops: z.string(), payments: z.number().int().nonnegative() })
export const LedgerViewSchema = z.union([
  z.object({ rail: z.literal('simulated') }),
  z.object({ rail: z.literal('xrpl-testnet'), network: z.literal('xrpl:1'), accountExplorer: z.string(), updatedAt: z.string(), wallets: z.array(LedgerWalletSchema) }),
])
export type LedgerView = z.infer<typeof LedgerViewSchema>
