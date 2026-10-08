// `npm run eval:coverage` (#213): requirement-level coverage labels over fixed evidence snapshots, scored
// per arm. Offline by default (the overlap fixture only). `--plan` prints the snapshot count and the calls
// each live arm would make; `--arms writer,flash,luna --live` with EVAL_LIVE=1 runs them (coordinator only,
// separate EVAL_* account; not run in this PR).
import { fileURLToPath } from 'node:url'
import { loadBank } from '../questions/bank.js'
import { enableLive, forecast, save } from '../decisions/transport.js'
import { loadWorld } from '../decisions/world.js'
import { predict, type CoverageArm, type Prediction } from './arms.js'
import { coverageMetrics } from './metrics.js'
import { buildSnapshots, STATUSES } from './snapshots.js'

export async function runCoverage(arms: CoverageArm[], options: { repeats?: number } = {}) {
  const world = await loadWorld()
  const snapshots = await buildSnapshots(world, loadBank())
  const results: Record<string, { predictions: Prediction[]; metrics: ReturnType<typeof coverageMetrics> }> = {}
  for (const arm of arms) {
    const predictions: Prediction[] = []
    for (let repeat = 0; repeat < (options.repeats ?? 1); repeat++) for (const s of snapshots) predictions.push(await predict(arm, s, 'coverage', repeat))
    results[arm] = { predictions, metrics: coverageMetrics(snapshots, predictions) }
  }
  const gold = Object.fromEntries(STATUSES.map(s => [s, snapshots.reduce((n, x) => n + Object.values(x.gold).filter(g => g === s).length, 0)]))
  return { label: 'REAL corpus · constructed requirement labels · fixed evidence snapshots', snapshots: snapshots.length, gold, results, snapshotIndex: snapshots.map(s => ({ id: s.id, state: s.state, hardCase: s.hardCase, trapKinds: s.trapKinds, gold: s.gold, evidence: s.evidence.map(e => `${e.articleId}#${e.passageId}${e.role === 'partial' ? ' (cut)' : ''}`) })) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--arms')
  const arms = (i < 0 ? 'fixture' : process.argv[i + 1]).split(',') as CoverageArm[]
  const live = arms.filter(a => a !== 'fixture')
  if (process.argv.includes('--plan')) {
    const snapshots = await buildSnapshots(await loadWorld(), loadBank())
    forecast('coverage', Object.fromEntries(live.map(a => [a === 'writer' ? 'deepseek' : a, snapshots.length])), 2500)
    console.log(JSON.stringify({ snapshots: snapshots.length, callsPerArm: snapshots.length, requirements: snapshots.reduce((n, s) => n + s.requirements.length, 0) }))
  } else {
    if (live.length) { if (!process.argv.includes('--live')) throw new Error('Live coverage arms need --live (and EVAL_LIVE=1); use --plan to count calls.'); enableLive() }
    const report = await runCoverage(arms)
    console.log(JSON.stringify({ snapshots: report.snapshots, gold: report.gold, ...Object.fromEntries(Object.entries(report.results).map(([arm, r]) => [arm, { falseComplete: r.metrics.falseComplete, falseMissing: r.metrics.falseMissing, accuracy: r.metrics.accuracy, unparsed: r.metrics.unparsed, falseCompleteByTrap: r.metrics.falseCompleteByTrap }])) }, null, 2))
    console.log(`Full report: ${save(`coverage-${arms.join('-')}.json`, report)}`)
  }
}
