// Owner-Mac workflow only. Reads purchase labels; never runs an LLM or a payment.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportLabels, type LabelRow } from './export-decision-labels.js'
import { fitReceiptValue, type ReceiptPoint } from '../eval/decisions/fit-calibration.js'
import { loadBank } from '../eval/questions/bank.js'
import { ValueFitSchema } from '../server/agents/value-policy.js'

export function receiptTarget(row: LabelRow): 0 | 1 | null {
  if (!row.charged) return null
  if (row.status === 'REFUNDED') return 0
  if (row.status !== 'VERIFIED') return null // unresolved proof/delivery is not a negative
  if (row.reanswer.citesPurchased === false) return 0
  if (row.reanswer.determinable && row.reanswer.citesPurchased === true) return row.reanswer.gainedSupportedFact ? 1 : 0
  return null // a citation without verified support is not a positive
}

export function refit(options: { db?: string; flowReport?: string; out?: string; report?: string }) {
  const bank = loadBank()
  const protocol = JSON.parse(readFileSync('eval/scorecard/receipt-split.json', 'utf8'))
  const devIds = new Set(bank.questions.filter(q => protocol.devFamilies.includes(q.lane)).map(q => q.id))
  const points: ReceiptPoint[] = []
  let key: { provider: string; model: string; promptVersion: string } | undefined
  if (options.flowReport) {
    const raw = JSON.parse(readFileSync(options.flowReport, 'utf8'))
    if (raw.scorecard.split !== 'dev') throw new Error('Receipt refit accepts dev reports only')
    const rows = raw.flowDataset as import('../eval/decisions/dataset.js').DatasetRow[]
    for (const q of raw.flow.results as import('../eval/decisions/offline.js').QuestionResult[]) {
      if (!devIds.has(q.id)) throw new Error('Heldout question in dev report')
      for (const p of q.purchases) {
        const row = rows.find(r => r.questionId === q.id && r.round === p.round && r.resourceId === p.resourceId)
        if (!row) throw new Error('Receipt lacks a matching pre-purchase score')
        const k = { provider: row.provider, model: row.model, promptVersion: row.promptVersion ?? 'unversioned' }
        if (key && JSON.stringify(key) !== JSON.stringify(k)) throw new Error('Mixed provider/prompt keys')
        key = k
        points.push({ questionId: q.id, p: row.addressesGap, y: p.wasted ? 0 : 1, priceMinor: p.priceMinor, trust: row.value / (row.gapMaterial * row.addressesGap * row.originality.original * (0.5 + 0.25 * row.credibility)) })
      }
    }
  } else {
    const rows = exportLabels(options.db ?? process.env.APP_DB ?? 'data/app.db')
    for (const row of rows.filter(r => r.bankQuestionId && devIds.has(r.bankQuestionId))) {
      const y = receiptTarget(row)
      if (y === null || !row.pre) continue
      if (!row.pre.promptVersion) continue // historical unkeyed scores are unsafe to deploy
      const k = { provider: row.pre.provider, model: row.pre.model, promptVersion: row.pre.promptVersion }
      if (key && JSON.stringify(key) !== JSON.stringify(k)) throw new Error('Mixed provider/prompt keys; export one key per refit')
      key = k
      points.push({ questionId: row.bankQuestionId!, p: row.pre.addressesGap, y, priceMinor: row.priceMinor, trust: row.pre.trust ?? 1 })
    }
  }
  const fit = fitReceiptValue(points)
  const report = options.report ?? 'eval/decisions/out/receipt-refit.json'
  mkdirSync(dirname(report), { recursive: true })
  writeFileSync(report, JSON.stringify({ ...fit, key, labels: options.flowReport ? 'synthetic corpus; fixture writer; live model; scripted supported-fact receipts; SIMULATED payments' : 'read-only store export; VERIFIED support or refund/uncited labels; dev only' }, null, 2) + '\n')
  let file: string | null = null
  if (fit.accepted && key) {
    file = options.out ?? 'data/calibration/receipt-value.json'
    let version = 1
    if (existsSync(file)) try { version = ValueFitSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).version + 1 } catch { /* no accepted predecessor */ }
    const data = { sha256: createHash('sha256').update(JSON.stringify(points)).digest('hex'), rows: points.length, groups: new Set(points.map(p => p.questionId)).size }
    const artifact = ValueFitSchema.parse({ schema: 'tftf.receipt-value/v1', version, key, model: fit.model, minFactsPerDollar: fit.threshold, accepted: true, data })
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(artifact, null, 2) + '\n')
  }
  return { accepted: fit.accepted, reasons: fit.reasons, file, report, rows: points.length, method: fit.model.method, threshold: fit.threshold, cvBrier: fit.cvBrier }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
  console.log(JSON.stringify(refit({ db: arg('--db'), flowReport: arg('--flow-report'), out: arg('--out'), report: arg('--report') })))
}
