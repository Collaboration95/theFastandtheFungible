// #207: versioned calibrators for the decision model's raw scores, fitted on in-domain data (never synthetic) by
// `npm run calibration:fit`. OFF by default: decide() applies one only when DECISION_CALIBRATION=on AND a file under
// data/calibration/ matches the active (provider, model, prompt version) exactly; otherwise scores stay raw (identity).
// The calibrator maps P(addresses gap) and P(original) only. The rewrite guard keeps reading the RAW originality, and
// the buy threshold stored with the calibrator applies to calibrated values only, never to raw ones.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import type { CandidateJudgment, DecisionProviderName } from '../../shared/contracts/index.js'
// The math is the benchmark's, reused unchanged (eval/decisions/calibration.ts is pure and dependency-free).
import { applyCalibration } from '../../eval/decisions/calibration.js'

export const CALIBRATION_DIR = 'data/calibration'
export const CALIBRATOR_SCHEMA = 'tftf.calibrator/v1'
const probability = z.number().min(0).max(1)
const MethodSchema = z.enum(['identity', 'platt', 'isotonic'])
export const CalibrationModelSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('identity') }),
  z.object({ method: z.literal('platt'), a: z.number().finite(), b: z.number().finite() }),
  z.object({ method: z.literal('isotonic'), knots: z.array(probability).min(1), values: z.array(probability).min(1) }),
])
export const CalibratorKeySchema = z.object({ provider: z.enum(['cloudflare', 'openai', 'fixture']), model: z.string().min(1), promptVersion: z.string().min(1) })
export const CalibratorSchema = z.object({
  schema: z.literal(CALIBRATOR_SCHEMA),
  /** Bumped on every refit for the same key; shown as "calibrated vN" (gate 5). */
  version: z.number().int().positive(),
  key: CalibratorKeySchema,
  addressesGap: CalibrationModelSchema,
  original: CalibrationModelSchema,
  /** The buy threshold on the CALIBRATED value scale, proposed by the fit (dev-F1 max, waste tiebreak). Never applied to raw values. */
  buyThreshold: probability,
  fittedAt: z.string(),
  /** Where the labels came from: the dataset file, its hash and sizes. */
  data: z.object({ file: z.string(), sha256: z.string(), rows: z.number().int().nonnegative(), groups: z.number().int().nonnegative(), grouping: z.string() }),
}).passthrough()
export type Calibrator = z.infer<typeof CalibratorSchema>
export type CalibratorKey = z.infer<typeof CalibratorKeySchema>

/** Clef sends no prompt version; its key uses this. */
export const UNVERSIONED = 'unversioned'
export const calibratorKey = (provider: { name: DecisionProviderName; model: string; promptVersion?: string }): CalibratorKey => ({ provider: provider.name, model: provider.model, promptVersion: provider.promptVersion ?? UNVERSIONED })
const sameKey = (a: CalibratorKey, b: CalibratorKey) => a.provider === b.provider && a.model === b.model && a.promptVersion === b.promptVersion
/** `<provider>-<model>-<prompt hash>.json`: one file per key; a refit bumps `version` inside it. */
export function calibratorFileName(key: CalibratorKey): string {
  const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug(key.provider)}-${slug(key.model)}-${createHash('sha256').update(key.promptVersion).digest('hex').slice(0, 8)}.json`
}
export const calibratorId = (c: Pick<Calibrator, 'key' | 'version'>) => `${calibratorFileName(c.key).replace(/\.json$/, '')}@v${c.version}`

/** Every valid calibrator file in `dir`; an unreadable or invalid file is skipped (it can never be applied). */
export function loadCalibrators(dir: string = process.env.DECISION_CALIBRATION_DIR || CALIBRATION_DIR): Calibrator[] {
  const root = resolve(dir)
  if (!existsSync(root)) return []
  return readdirSync(root).filter(name => name.endsWith('.json')).flatMap(name => {
    try { return [CalibratorSchema.parse(JSON.parse(readFileSync(join(root, name), 'utf8')))] } catch { return [] }
  })
}
export const calibrationEnabled = (configured: unknown = process.env.DECISION_CALIBRATION) => configured === 'on'
/**
 * The calibrator decide() applies: undefined unless DECISION_CALIBRATION=on and one matches the provider's exact
 * (provider, model, prompt version). A changed wording or model therefore falls back to raw scores, never a stale map.
 */
export function activeCalibrator(provider: { name: DecisionProviderName; model: string; promptVersion?: string }, env: NodeJS.ProcessEnv = process.env): Calibrator | undefined {
  if (!calibrationEnabled(env.DECISION_CALIBRATION)) return undefined
  const key = calibratorKey(provider)
  return loadCalibrators(env.DECISION_CALIBRATION_DIR || CALIBRATION_DIR).filter(c => sameKey(c.key, key)).sort((a, b) => b.version - a.version)[0]
}
/** Calibrated P(addresses gap) and P(original). The raw judgment is not changed. */
export function calibrate(calibrator: Calibrator, judgment: CandidateJudgment): { addressesGap: number; original: number } {
  return { addressesGap: applyCalibration(calibrator.addressesGap, judgment.addressesGap), original: applyCalibration(calibrator.original, judgment.originality.original) }
}
export const roundCalibration = (c: Calibrator) => ({ id: calibratorId(c), version: c.version, methods: { addressesGap: MethodSchema.parse(c.addressesGap.method), original: MethodSchema.parse(c.original.method) } })
