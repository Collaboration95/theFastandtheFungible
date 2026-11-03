// Percentile bootstrap over source-family clusters. Never resample candidate rows independently.
import type { Question } from '../questions/bank.js'
import type { QuestionResult } from '../decisions/offline.js'
import type { DatasetRow } from '../decisions/dataset.js'
import { qualityMetrics, type Quality } from './metrics.js'
const metrics = ['wastedSpendPct', 'netWastedSpendPct', 'usedSpendPct', 'selectionF1Flow', 'selectionF1Sweep', 'supportedFactUpliftPts'] as const
export function bootstrapQuality(results: QuestionResult[], sweep: DatasetRow[], questions: Question[], other?: { results: QuestionResult[]; sweep: DatasetRow[] }, repeats = 2000) {
  const groups = new Map<string, string[]>()
  for (const r of results) {
    const q = questions.find(q => q.id === r.id)!
    // Historical bank is grouped conservatively by topic; new questions by source article.
    const key = q.lane
    groups.set(key, [...groups.get(key) ?? [], r.id])
  }
  const clusters = [...groups.values()]
  if (!clusters.length) throw new Error('Cannot bootstrap empty evaluation')
  if (other && results.map(r => r.id).join() !== other.results.map(r => r.id).join()) throw new Error('Paired bootstrap requires identical ordered questions')
  let seed = 700
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const values: Record<string, number[]> = Object.fromEntries(metrics.map(k => [k, []]))
  const sample = (source: QuestionResult[], rows: DatasetRow[], draws: string[][]): Quality => {
    const rs: QuestionResult[] = [], ss: DatasetRow[] = []
    draws.forEach((ids, i) => {
      rs.push(...source.filter(r => ids.includes(r.id)))
      // Preserve multiplicity of a resampled cluster in sweep grouping.
      ss.push(...rows.filter(r => ids.includes(r.questionId)).map(r => ({ ...r, questionId: `${i}:${r.questionId}` })))
    })
    return qualityMetrics(rs, ss, null)
  }
  for (let i = 0; i < repeats; i++) {
    const draws = clusters.map(() => clusters[Math.floor(random() * clusters.length)])
    const a = sample(results, sweep, draws), b = other ? sample(other.results, other.sweep, draws) : undefined
    for (const key of metrics) {
      const x = a[key], y = b?.[key]
      if (x !== null && (!b || (y !== null && y !== undefined))) values[key].push(b ? y! - x : x)
    }
  }
  return { method: 'source-family cluster percentile bootstrap, 95%; conditional on fixed corpus and model draws', seed: 700, repeats, clusters: clusters.length, questions: results.length,
    intervals: Object.fromEntries(metrics.map(key => {
      const sorted = values[key].sort((a, b) => a - b)
      return [key, { low: sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.025)] : null, high: sorted.length ? sorted[Math.ceil((sorted.length - 1) * 0.975)] : null, validReplicates: sorted.length }]
    })) }
}
