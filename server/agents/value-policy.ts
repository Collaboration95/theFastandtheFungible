// #276: models estimate; this pure rule can only reject/rank, never submit a payment.
import type { ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'
import { sameSource } from '../../shared/source-identity.js'
import { noNewEvidence } from './requirements.js'
import { signedFactMenu } from './clef.js'
import { satisfiesFactCover } from '../../shared/fact-menu.js'
import { applyCalibration } from '../../eval/decisions/calibration.js'
import type { CalibrationModel } from '../../eval/decisions/calibration.js'
import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { CalibrationModelSchema } from './calibration.js'

export const ValueFitSchema = z.object({
  schema: z.literal('tftf.receipt-value/v1'), version: z.number().int().positive(),
  key: z.object({ provider: z.string(), model: z.string(), promptVersion: z.string() }),
  model: CalibrationModelSchema, minFactsPerDollar: z.number().positive().finite(),
  accepted: z.literal(true), data: z.object({ sha256: z.string(), rows: z.number().int().positive(), groups: z.number().int().min(2) }),
})
export type ValueFit = z.infer<typeof ValueFitSchema>
export function activeValueFit(key: { name: string; model: string; promptVersion?: string }): ValueFit | undefined {
  const file = process.env.DECISION_VALUE_FIT ?? 'data/calibration/receipt-value.json'
  if (!existsSync(file)) return undefined
  try {
    const fit = ValueFitSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    return fit.key.provider === key.name && fit.key.model === key.model && fit.key.promptVersion === key.promptVersion ? fit : undefined
  } catch { return undefined }
}

/** Evidence is supplied only by the free/verified-grant accessor. A promise alone never closes a requirement.
 * Conservatively discount only promises whose full entity/measure/period/comparison occurs in one accessible span.
 * Missing menus retain the raw estimate; unsigned or forged menus cannot manufacture novelty or a veto.
 */
export function marginalValue(input: { candidate: PublicCandidate; evidence: ContentEnvelope[]; probability: number; trust: number; model?: CalibrationModel; minFactsPerDollar?: number }) {
  const menu = signedFactMenu(input.candidate)
  const covered = menu.filter(f => input.evidence.some(c =>
    sameSource(c,input.candidate) ||
    Boolean((f.period || f.comparison) && c.spans.some(span => span.text.split(/(?<=[.!?])\s+/).some(text => !noNewEvidence.test(text)
      && !/not (?:disclosed|available|published)|no (?:dated|independent|confirmed)/i.test(text)
      && /\b(?!20\d{2}\b)\d+(?:[.,]\d+)?\b/.test(text) && !/\b(?:no|not|without)\b/i.test(text) && satisfiesFactCover(text, f)))))).length
  const novelty = menu.length && covered === menu.length ? 0 : 1
  // One round targets one missing requirement: a long menu never multiplies the expected fact count.
  const probability = applyCalibration(input.model ?? { method: 'identity' }, input.probability)
  const expectedFacts = probability * Math.max(0, Math.min(1, input.trust)) * novelty
  const factsPerDollar = expectedFacts / (Math.max(1, input.candidate.price.amountMinor) / 100)
  const threshold = input.minFactsPerDollar ?? 0.5
  return { policy: 'receipt-value/v1', menuEntries: menu.length, coveredEntries: covered, novelty, probability, expectedFacts, factsPerDollar, threshold,
    eligible: expectedFacts > 0 && factsPerDollar >= threshold }
}
