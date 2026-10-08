// Coverage metrics (#213). False-complete is the headline: the share of requirements the evidence does
// not support that an arm calls supported (the stop-too-early error). False-missing is the share of
// supported requirements an arm calls missing (the buy-what-you-have error). Unparsed answers count as
// errors, never as a status.
import { percentile } from '../decisions/metrics.js'
import type { Prediction } from './arms.js'
import { STATUSES, type Snapshot, type Status } from './snapshots.js'

export type Confusion = Record<Status, Record<Status | 'unparsed', number>>
export function coverageMetrics(snapshots: Snapshot[], predictions: Prediction[]) {
  const confusion = Object.fromEntries(STATUSES.map(g => [g, Object.fromEntries([...STATUSES, 'unparsed'].map(p => [p, 0]))])) as Confusion
  const pairs: { gold: Status; pred: Status | null; s: Snapshot }[] = []
  for (const p of predictions) {
    const s = snapshots.find(x => x.id === p.snapshotId)
    if (!s) continue
    for (const r of s.requirements) {
      const gold = s.gold[r.id], pred = p.statuses[r.id] ?? null
      confusion[gold][pred ?? 'unparsed']++
      pairs.push({ gold, pred, s })
    }
  }
  const rate = (num: number, den: number) => den ? num / den : null
  const fc = (list: typeof pairs) => rate(list.filter(x => x.gold !== 'supported' && x.pred === 'supported').length, list.filter(x => x.gold !== 'supported').length)
  const by = (key: (x: (typeof pairs)[number]) => string[]) => {
    const keys = [...new Set(pairs.flatMap(key))].sort()
    return Object.fromEntries(keys.map(k => [k, { n: pairs.filter(x => key(x).includes(k)).length, falseComplete: fc(pairs.filter(x => key(x).includes(k))) }]))
  }
  return {
    requirements: pairs.length, snapshots: new Set(predictions.map(p => p.snapshotId)).size,
    falseComplete: fc(pairs),
    falseMissing: rate(pairs.filter(x => x.gold === 'supported' && x.pred === 'missing').length, pairs.filter(x => x.gold === 'supported').length),
    accuracy: rate(pairs.filter(x => x.gold === x.pred).length, pairs.length),
    unparsed: pairs.filter(x => x.pred === null).length,
    confusion,
    falseCompleteByTrap: by(x => x.s.trapKinds.length ? x.s.trapKinds : ['none']),
    falseCompleteByState: by(x => [x.s.state]),
    falseCompleteByHardCase: by(x => [x.s.hardCase ?? 'none']),
    latencyMs: { p50: percentile(predictions.map(p => p.latencyMs), 0.5), p95: percentile(predictions.map(p => p.latencyMs), 0.95) },
    cost: { calls: predictions.reduce((n, p) => n + p.calls.length, 0), usd: predictions.reduce((s, p) => s + p.usd, 0) },
    errors: predictions.filter(p => p.error).length,
  }
}
