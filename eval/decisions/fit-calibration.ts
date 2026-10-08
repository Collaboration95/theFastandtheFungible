// `npm run calibration:fit -- --data <dataset.jsonl>` (#207): fits the versioned calibrator for each
// (provider, model, prompt version) in a per-candidate dataset from `offline.ts --sweep --dataset`, and writes
//   data/calibration/<provider>-<model>-<prompt hash>.json   (only when accepted, or with --force)
//   eval/decisions/out/calibration-fit-<key>.{json,md}       (always: CV Brier and purchase F1 before vs after)
// Method per target (P(addresses gap), P(original)): identity, Platt or isotonic, by grouped CV (calibration.ts).
// The buy threshold is proposed on OUT-OF-FOLD calibrated values: highest dev purchase F1, then least wasted spend,
// then the higher threshold. It is stored with the calibrator and used only on calibrated values, never raw ones.
// Accepted when CV Brier is no worse for both targets and purchase F1 is no worse than raw at the raw threshold.
// Flags: --group family|question (default family = the bank's topic lane), --mode sweep|flow|all (default all),
// --out-dir <dir> (default data/calibration), --report-dir <dir> (default eval/decisions/out), --force.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buyThreshold } from '../../server/agents/decision.js'
import { CALIBRATION_DIR, CALIBRATOR_SCHEMA, CalibratorSchema, calibratorFileName, UNVERSIONED, type Calibrator, type CalibratorKey } from '../../server/agents/calibration.js'
import { applyCalibration, chooseCalibration, fitCalibration, type CalibrationItem, type CalibrationMethod, type CalibrationModel } from './calibration.js'
import { readJsonl, type DatasetRow } from './dataset.js'
import { DEFAULT_SEED, seededRandom, type Estimate } from './metrics.js'

export type Grouping = 'family' | 'question'
type Unit = { rows: DatasetRow[] }
const groupOf = (row: DatasetRow, grouping: Grouping) => grouping === 'family' ? row.family : row.questionId
/** Policy-eligible regardless of value: the RAW rewrite guard and the verdicts value never changes. */
const eligible = (row: DatasetRow) => row.originality.rewrite < row.originality.original && !['SKIP_REWRITE', 'SKIP_LOW_TRUST', 'SKIP_OVER_CAP', 'SKIP_NO_GAP'].includes(row.verdict)
/** decide()'s value with trust 1: gap_material × P(addresses) × P(original) × credibility weight. */
const valueOf = (row: DatasetRow, addressesGap: number, original: number) => row.gapMaterial * addressesGap * original * (0.5 + 0.25 * row.credibility)

/** Purchase metrics over decision units (one round each), selecting as policy does: best value per dollar at or above t. */
export function purchaseMetrics(units: Unit[], values: Map<DatasetRow, number>, threshold: number) {
  let tp = 0, fp = 0, fn = 0, wastedMinor = 0, skippedUnknown = 0
  for (const unit of units) {
    const positives = unit.rows.filter(r => r.labels.buy === 1)
    const picks = unit.rows.filter(r => eligible(r) && values.get(r)! >= threshold)
      .sort((a, b) => values.get(b)! / Math.max(b.priceMinor, 1) - values.get(a)! / Math.max(a.priceMinor, 1) || a.resourceId.localeCompare(b.resourceId))
    const pick = picks[0]
    if (pick && pick.labels.buy === null) { skippedUnknown++; continue }
    if (pick?.labels.buy === 1) tp++
    else {
      if (pick) { fp++; wastedMinor += pick.priceMinor }
      if (positives.length) fn++
    }
  }
  const f1 = 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0
  return { units: units.length - skippedUnknown, skippedUnknown, tp, fp, fn, f1, precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0, wastedMinor }
}
/** Highest F1, then least waste, then the higher (more conservative) threshold. */
export function proposeThreshold(units: Unit[], values: Map<DatasetRow, number>) {
  const grid = [...new Set([...units.flatMap(u => u.rows.filter(eligible).map(r => values.get(r)!)), 1])].sort((a, b) => a - b)
  let best = { threshold: 1, metrics: purchaseMetrics(units, values, 1) }
  for (const threshold of grid) {
    const metrics = purchaseMetrics(units, values, threshold)
    if (metrics.f1 > best.metrics.f1 + 1e-12 || (Math.abs(metrics.f1 - best.metrics.f1) <= 1e-12 && (metrics.wastedMinor < best.metrics.wastedMinor || (metrics.wastedMinor === best.metrics.wastedMinor && threshold > best.threshold)))) best = { threshold, metrics }
  }
  return best
}
/** The same group-shuffled folds chooseCalibration builds, shared by both targets so out-of-fold values line up. */
function groupFolds(groups: string[], seed = DEFAULT_SEED): string[][] {
  const keys = [...new Set(groups)].sort()
  const random = seededRandom(seed)
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]] }
  const count = Math.min(5, keys.length)
  const folds: string[][] = Array.from({ length: count }, () => [])
  keys.forEach((key, i) => folds[i % count].push(key))
  return folds
}

export type FitResult = {
  key: CalibratorKey; accepted: boolean; reasons: string[]
  sample: { rows: number; groups: number; grouping: Grouping; folds: number; units: number; addressesGap: { n: number; positives: number }; original: { n: number; positives: number }; buy: { positives: number; unknown: number } }
  methods: { addressesGap: CalibrationMethod; original: CalibrationMethod }
  cvBrier: { addressesGap: Record<CalibrationMethod, Estimate>; original: Record<CalibrationMethod, Estimate> }
  purchase: { raw: ReturnType<typeof purchaseMetrics> & { threshold: number }; rawBestThreshold: ReturnType<typeof purchaseMetrics> & { threshold: number }; calibrated: ReturnType<typeof purchaseMetrics> & { threshold: number } }
  models: { addressesGap: CalibrationModel; original: CalibrationModel }
  note: string
}
/** Fit one key's rows. Pure: no files. */
export function fitKey(key: CalibratorKey, rows: DatasetRow[], grouping: Grouping = 'family'): FitResult {
  const item = (p: number, y: number, row: DatasetRow): CalibrationItem => ({ p, y, group: groupOf(row, grouping) })
  const gapRows = rows.filter(r => r.labels.addressesGap !== null), origRows = rows.filter(r => r.labels.original !== null)
  const gapSel = chooseCalibration(gapRows.map(r => item(r.addressesGap, r.labels.addressesGap!, r)))
  const origSel = chooseCalibration(origRows.map(r => item(r.originality.original, r.labels.original!, r)))
  // Out-of-fold calibrated values with the chosen methods, on shared group folds.
  const folds = groupFolds(rows.map(r => groupOf(r, grouping)))
  const oof = new Map<DatasetRow, number>()
  for (const held of folds) {
    const train = (list: DatasetRow[]) => list.filter(r => !held.includes(groupOf(r, grouping)))
    const fitOn = (list: DatasetRow[], method: CalibrationMethod, p: (r: DatasetRow) => number, y: (r: DatasetRow) => number): CalibrationModel => {
      const points = train(list).map(r => ({ p: p(r), y: y(r) }))
      return points.length ? fitCalibration(points, method) : { method: 'identity' }
    }
    const gapModel = fitOn(gapRows, gapSel.method, r => r.addressesGap, r => r.labels.addressesGap!)
    const origModel = fitOn(origRows, origSel.method, r => r.originality.original, r => r.labels.original!)
    for (const row of rows.filter(r => held.includes(groupOf(r, grouping)))) oof.set(row, valueOf(row, applyCalibration(gapModel, row.addressesGap), applyCalibration(origModel, row.originality.original)))
  }
  const raw = new Map(rows.map(r => [r, valueOf(r, r.addressesGap, r.originality.original)]))
  // Production decides open facts only; one unit per (question, fact, round, mode).
  const byUnit = new Map<string, DatasetRow[]>()
  for (const row of rows.filter(r => r.factOpen)) { const id = `${row.questionId}|${row.factId}|${row.round}|${row.mode}|${row.gap}`; byUnit.set(id, [...byUnit.get(id) ?? [], row]) }
  const units = [...byUnit.values()].map(list => ({ rows: list }))
  const rawThreshold = buyThreshold(key.model, '')
  const rawMetrics = { threshold: rawThreshold, ...purchaseMetrics(units, raw, rawThreshold) }
  const rawBest = proposeThreshold(units, raw)
  const proposed = proposeThreshold(units, oof)
  const brierWorse = (sel: typeof gapSel) => (sel.cvBrier[sel.method] ?? 0) > (sel.cvBrier.identity ?? 0) + 1e-12
  const reasons = [
    ...(units.length ? [] : ['no open-fact decision units to tune a threshold on']),
    ...(gapSel.nGroups < 2 || origSel.nGroups < 2 ? ['fewer than two groups: no independent CV'] : []),
    ...(brierWorse(gapSel) ? ['addresses-gap CV Brier worse than raw'] : []),
    ...(brierWorse(origSel) ? ['originality CV Brier worse than raw'] : []),
    ...(proposed.metrics.f1 + 1e-12 < rawMetrics.f1 ? [`purchase F1 ${proposed.metrics.f1.toFixed(3)} < raw ${rawMetrics.f1.toFixed(3)}`] : []),
  ]
  return {
    key, accepted: reasons.length === 0, reasons,
    sample: { rows: rows.length, groups: new Set(rows.map(r => groupOf(r, grouping))).size, grouping, folds: folds.length, units: units.length, addressesGap: { n: gapRows.length, positives: gapRows.filter(r => r.labels.addressesGap === 1).length }, original: { n: origRows.length, positives: origRows.filter(r => r.labels.original === 1).length }, buy: { positives: rows.filter(r => r.factOpen && r.labels.buy === 1).length, unknown: rows.filter(r => r.labels.buy === null).length } },
    methods: { addressesGap: gapSel.method, original: origSel.method },
    cvBrier: { addressesGap: gapSel.cvBrier, original: origSel.cvBrier },
    purchase: { raw: rawMetrics, rawBestThreshold: { threshold: rawBest.threshold, ...rawBest.metrics }, calibrated: { threshold: proposed.threshold, ...proposed.metrics } },
    models: { addressesGap: gapSel.model, original: origSel.model },
    note: 'Purchase F1 after calibration uses out-of-fold calibrated values, but the threshold is chosen on those same values, so it is optimistic (in-sample for the threshold). rawBestThreshold is the same optimism applied to raw scores, for a fair comparison.',
  }
}

const keyOf = (row: DatasetRow): CalibratorKey => ({ provider: row.provider as CalibratorKey['provider'], model: row.model, promptVersion: row.promptVersion ?? UNVERSIONED })
export function markdownReport(fit: FitResult, file: string | null): string {
  const n = (x: Estimate | number) => x === null ? '–' : x.toFixed(3)
  const p = fit.purchase
  return [
    `# Calibration fit · ${fit.key.provider} · ${fit.key.model}`, '',
    `Prompt version: \`${fit.key.promptVersion}\``, '',
    `**${fit.accepted ? 'Accepted' : 'Not accepted'}**${fit.reasons.length ? `: ${fit.reasons.join('; ')}` : ''}. Calibrator file: ${file ? `\`${file}\`` : 'not written'}.`, '',
    `Sample: ${fit.sample.rows} rows, ${fit.sample.groups} groups by ${fit.sample.grouping}, ${fit.sample.folds} folds, ${fit.sample.units} open-fact decisions; addresses-gap ${fit.sample.addressesGap.positives}/${fit.sample.addressesGap.n} positive, original ${fit.sample.original.positives}/${fit.sample.original.n}, buy positives ${fit.sample.buy.positives}, unknown buy labels ${fit.sample.buy.unknown}.`, '',
    '| Target | Method | CV Brier raw | Platt | Isotonic |', '|---|---|---|---|---|',
    `| P(addresses gap) | ${fit.methods.addressesGap} | ${n(fit.cvBrier.addressesGap.identity)} | ${n(fit.cvBrier.addressesGap.platt)} | ${n(fit.cvBrier.addressesGap.isotonic)} |`,
    `| P(original) | ${fit.methods.original} | ${n(fit.cvBrier.original.identity)} | ${n(fit.cvBrier.original.platt)} | ${n(fit.cvBrier.original.isotonic)} |`, '',
    '| Purchase decisions | Threshold | F1 | Precision | Recall | Wasted |', '|---|---|---|---|---|---|',
    `| Raw, production threshold | ${n(p.raw.threshold)} | ${n(p.raw.f1)} | ${n(p.raw.precision)} | ${n(p.raw.recall)} | S$${(p.raw.wastedMinor / 100).toFixed(2)} |`,
    `| Raw, best threshold (post hoc) | ${n(p.rawBestThreshold.threshold)} | ${n(p.rawBestThreshold.f1)} | ${n(p.rawBestThreshold.precision)} | ${n(p.rawBestThreshold.recall)} | S$${(p.rawBestThreshold.wastedMinor / 100).toFixed(2)} |`,
    `| Calibrated (out of fold), proposed threshold | ${n(p.calibrated.threshold)} | ${n(p.calibrated.f1)} | ${n(p.calibrated.precision)} | ${n(p.calibrated.recall)} | S$${(p.calibrated.wastedMinor / 100).toFixed(2)} |`, '',
    fit.note, '',
    'The proposed threshold is on the calibrated value scale and applies only with `DECISION_CALIBRATION=on` and this exact key. Never set `BUY_THRESHOLD` to it.', '',
  ].join('\n')
}

export function fitDataset(options: { data: string; grouping?: Grouping; mode?: 'sweep' | 'flow' | 'all'; outDir?: string; reportDir?: string; force?: boolean; now?: string }) {
  const all = readJsonl<DatasetRow>(options.data).filter(r => options.mode === undefined || options.mode === 'all' || r.mode === options.mode)
  const sha256 = createHash('sha256').update(fs.readFileSync(options.data)).digest('hex')
  const keys = new Map<string, CalibratorKey>()
  for (const row of all) keys.set(JSON.stringify(keyOf(row)), keyOf(row))
  const outDir = path.resolve(options.outDir ?? CALIBRATION_DIR), reportDir = path.resolve(options.reportDir ?? 'eval/decisions/out')
  return [...keys.values()].map(key => {
    const rows = all.filter(r => JSON.stringify(keyOf(r)) === JSON.stringify(key))
    const fit = fitKey(key, rows, options.grouping ?? 'family')
    const name = calibratorFileName(key)
    let file: string | null = null
    if (fit.accepted || options.force) {
      file = path.join(outDir, name)
      let version = 1
      try { const existing = CalibratorSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))); version = existing.version + 1 } catch { /* first fit for this key */ }
      const calibrator: Calibrator = CalibratorSchema.parse({ schema: CALIBRATOR_SCHEMA, version, key, addressesGap: fit.models.addressesGap, original: fit.models.original, buyThreshold: fit.purchase.calibrated.threshold, fittedAt: options.now ?? new Date().toISOString(), data: { file: path.relative(process.cwd(), path.resolve(options.data)), sha256, rows: rows.length, groups: fit.sample.groups, grouping: fit.sample.grouping }, accepted: fit.accepted, ...(fit.accepted ? {} : { forcedDespite: fit.reasons }) })
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(calibrator, null, 2) + '\n')
    }
    fs.mkdirSync(reportDir, { recursive: true })
    const base = path.join(reportDir, `calibration-fit-${name.replace(/\.json$/, '')}`)
    fs.writeFileSync(`${base}.json`, JSON.stringify({ ...fit, calibratorFile: file }, null, 2) + '\n')
    const shown = file && (path.relative(process.cwd(), file).startsWith('..') ? file : path.relative(process.cwd(), file))
    fs.writeFileSync(`${base}.md`, markdownReport(fit, shown))
    return { fit, file, report: `${base}.md` }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
  const data = arg('--data')
  if (!data) throw new Error('Usage: npm run calibration:fit -- --data <dataset.jsonl> [--group family|question] [--mode sweep|flow|all] [--out-dir data/calibration] [--report-dir eval/decisions/out] [--force]')
  const grouping = (arg('--group') ?? 'family') as Grouping
  if (!['family', 'question'].includes(grouping)) throw new Error('--group is family or question')
  for (const { fit, file, report } of fitDataset({ data, grouping, mode: arg('--mode') as 'sweep' | 'flow' | 'all' | undefined, outDir: arg('--out-dir'), reportDir: arg('--report-dir'), force: process.argv.includes('--force') })) {
    console.log(`${fit.key.provider} · ${fit.key.model} · ${fit.accepted ? 'accepted' : `not accepted (${fit.reasons.join('; ')})`} · methods ${fit.methods.addressesGap}/${fit.methods.original} · F1 raw ${fit.purchase.raw.f1.toFixed(3)} → calibrated ${fit.purchase.calibrated.f1.toFixed(3)} at ${fit.purchase.calibrated.threshold.toFixed(3)}`)
    console.log(`  calibrator: ${file ?? 'not written'} · report: ${report}`)
  }
}
