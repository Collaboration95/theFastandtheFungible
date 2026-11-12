import { z } from 'zod'

export const SettlementPhaseSchema = z.enum(['quote', 'createSubmitted', 'createValidated', 'lockProven', 'finishSubmitted', 'finishValidated', 'unlocked', 'paymentSubmitted', 'paymentValidated'])
export const PhaseObservationSchema = z.object({
  at: z.string().datetime(), elapsedMs: z.number().finite().nonnegative(),
  source: z.enum(['buyer', 'writer']), txHash: z.string().regex(/^[A-F0-9]{64}$/).optional(),
  ledgerIndex: z.number().int().positive().optional(),
})
/** Local observation times, not ledger timestamps or consensus latency. Missing phases stay missing. */
export const SettlementTimingSchema = z.object({ startedAt: z.string().datetime(), phases: z.partialRecord(SettlementPhaseSchema, PhaseObservationSchema) })
export type SettlementPhase = z.infer<typeof SettlementPhaseSchema>
export type PhaseObservation = z.infer<typeof PhaseObservationSchema>
export type SettlementTiming = z.infer<typeof SettlementTimingSchema>
