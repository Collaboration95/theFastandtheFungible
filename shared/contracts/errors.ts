import { z } from 'zod'
export const ErrorCodeSchema = z.enum(['unauthorized', 'not_found', 'invalid', 'backend_unavailable', 'cancelled', 'payment_failed', 'verification_failed', 'cap_zero', 'paused', 'budget_exhausted', 'overloaded', 'deadline', 'settlement_pending'])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>
export const ErrorEnvelopeSchema = z.object({ code: ErrorCodeSchema, status: z.number().int().min(400).max(599), retryable: z.boolean(), message: z.string().max(200), runId: z.string().optional(), intentId: z.string().optional() })
export const errorEnvelope = (code: ErrorCode, status: number, runId?: string) => ErrorEnvelopeSchema.parse({ code, status,
  retryable: ['backend_unavailable', 'overloaded', 'deadline', 'settlement_pending'].includes(code), message: `ResearchAgent: ${code}`, ...(runId ? { runId } : {}) })
