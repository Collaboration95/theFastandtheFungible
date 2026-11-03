// Recompute the paired comparison from raw scorecard reports. No provider calls.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadBank } from '../eval/questions/bank.js'
import { bootstrapQuality } from '../eval/scorecard/uncertainty.js'
import { sha256 } from '../eval/scorecard/frozen.js'
import { qualityMetrics } from '../eval/scorecard/metrics.js'
import { assertNoSecrets } from '../eval/decisions/transport.js'
const [beforeFile, afterFile, outputFile] = process.argv.slice(2)
if (!beforeFile || !afterFile) throw new Error('Usage: report-numbers.ts <before report.json> <after report.json>')
const before = JSON.parse(readFileSync(beforeFile, 'utf8')), after = JSON.parse(readFileSync(afterFile, 'utf8'))
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const mainFreeze = read('eval/scorecard/frozen-fresh-main.json'), generalFreeze = read('eval/scorecard/frozen-fresh-general.json')
for (const key of ['bank', 'corpus', 'corpusContent', 'snapshots', 'split', 'order', 'latencySample', 'config']) {
  if (JSON.stringify(mainFreeze[key]) !== JSON.stringify(generalFreeze[key])) throw new Error(`Fresh data/config mismatch: ${key}`)
}
for (const [file, hash] of Object.entries(mainFreeze.promptSources)) {
  if (!['server/agents/scope-policy.ts', 'server/agents/fact-selection.ts'].includes(file) && hash !== generalFreeze.promptSources[file]) throw new Error(`Unexpected policy comparison change: ${file}`)
}
for (const [run, freeze] of [[before, mainFreeze], [after, generalFreeze]]) {
  if (run.scorecard.inputHash !== sha256(JSON.stringify(freeze)) || run.scorecard.mode !== 'LIVE' || run.scorecard.evaluationSet !== 'fresh-v1' || run.scorecard.audit.total || run.scorecard.cost.xrpDropsSpent) throw new Error('Wrong frozen fresh run or violated rail/gate')
  const quality = qualityMetrics(run.flow.results, run.sweep.dataset, run.scorecard.quality.falseCompleteRate)
  if (JSON.stringify(quality) !== JSON.stringify(run.scorecard.quality)) throw new Error('Metric reproduction mismatch')
  const ci = bootstrapQuality(run.flow.results, run.sweep.dataset, loadBank('eval/questions/bank.fresh.v1.json').questions)
  if (JSON.stringify(ci) !== JSON.stringify(run.scorecard.confidenceIntervals)) throw new Error('CI reproduction mismatch')
}
const paired = bootstrapQuality(before.flow.results, before.sweep.dataset, loadBank('eval/questions/bank.fresh.v1.json').questions, { results: after.flow.results, sweep: after.sweep.dataset })
const keep = (x: typeof before) => ({ scorecard: x.scorecard,
  flow: { results: x.flow.results.map(({ id, requested, spentMinor, refundedMinor, wastedMinor, firstBuy, expectedBuy, free, final, purchases }: typeof x.flow.results[number]) => ({ id, requested, spentMinor, refundedMinor, wastedMinor, firstBuy, expectedBuy, free, final, purchases })) },
  // Retain precisely the fields used to reproduce selection scoring and CIs.
  sweep: { dataset: x.sweep.dataset.map(({ questionId, factId, round, factOpen, selected, threshold, value, priceMinor, resourceId, labels, originality, verdict }: typeof x.sweep.dataset[number]) => ({ questionId, factId, round, factOpen, selected, threshold, value, priceMinor, resourceId, labels, originality, verdict })) } })
const out = outputFile ?? 'eval/scorecard/fresh-results.json'
writeFileSync(out, JSON.stringify({ schema: 'tftf.fresh-comparison/v1', before: keep(before), after: keep(after), pairedDelta95: paired }) + '\n')
assertNoSecrets([out])
console.log(JSON.stringify({ before: before.scorecard.quality, after: after.scorecard.quality, paired }, null, 2))
