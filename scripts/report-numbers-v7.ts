// Offline historical #320 → single final v7 run. No live baseline replay.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadBank } from '../eval/questions/bank.js'
import { bootstrapQuality } from '../eval/scorecard/uncertainty.js'
import { sha256 } from '../eval/scorecard/frozen.js'
import { assertNoSecrets } from '../eval/decisions/transport.js'
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const file = process.argv[2]
if (!file) throw new Error('Usage: report-numbers-v7.ts <final heldout report.json>')
const before = read('eval/scorecard/spend-extraction-results.json').after, after = read(file)
const old = read('eval/scorecard/frozen-pre-numbers-v7.json'), current = read('eval/scorecard/frozen.json')
for (const key of ['bank', 'corpus', 'corpusContent', 'snapshots', 'split', 'order', 'latencySample', 'config']) {
  if (JSON.stringify(old[key]) !== JSON.stringify(current[key])) throw new Error(`Historical comparison input changed: ${key}`)
}
if (before.scorecard.split !== 'heldout' || after.scorecard.split !== 'heldout' || before.scorecard.mode !== 'LIVE' || after.scorecard.mode !== 'LIVE'
  || before.scorecard.inputHash !== sha256(JSON.stringify(old)) || after.scorecard.inputHash !== sha256(JSON.stringify(current))) throw new Error('Wrong frozen runs')
const keep = (x: typeof after) => ({ scorecard: x.scorecard, flow: { results: x.flow.results.map(({ id, requested, spentMinor, refundedMinor, wastedMinor, firstBuy, expectedBuy, free, final, purchases }: typeof x.flow.results[number]) => ({ id, requested, spentMinor, refundedMinor, wastedMinor, firstBuy, expectedBuy, free, final, purchases })) },
  sweep: { dataset: x.sweep.dataset.map(({ questionId, factId, round, factOpen, selected, threshold, value, priceMinor, resourceId, labels, originality, verdict }: typeof x.sweep.dataset[number]) => ({ questionId, factId, round, factOpen, selected, threshold, value, priceMinor, resourceId, labels, originality, verdict })) } })
const paired = bootstrapQuality(before.flow.results, before.sweep.dataset, loadBank().questions, { results: after.flow.results, sweep: after.sweep.dataset })
const out = 'eval/scorecard/numbers-v7-results.json'
writeFileSync(out, JSON.stringify({ schema: 'tftf.numbers-v7/v1', comparison: 'Historical #320 after versus one fresh final run; reused question holdout, exposed historical failures; no fresh simultaneous baseline and no unseen-test claim. CIs condition on fixed corpus and observed draws.', before: keep(before), after: keep(after), pairedDelta95: paired }) + '\n')
assertNoSecrets([out])
console.log(JSON.stringify({ before: before.scorecard.quality, after: after.scorecard.quality, ci: after.scorecard.confidenceIntervals, paired }, null, 2))
