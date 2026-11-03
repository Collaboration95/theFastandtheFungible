// Recompute the paired comparison from raw scorecard reports. No provider calls.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadBank } from '../eval/questions/bank.js'
import { bootstrapQuality } from '../eval/scorecard/uncertainty.js'
import { assertNoSecrets } from '../eval/decisions/transport.js'
const [beforeFile, afterFile] = process.argv.slice(2)
if (!beforeFile || !afterFile) throw new Error('Usage: report-numbers.ts <before report.json> <after report.json>')
const before = JSON.parse(readFileSync(beforeFile, 'utf8')), after = JSON.parse(readFileSync(afterFile, 'utf8'))
if (before.scorecard.inputHash !== after.scorecard.inputHash || before.scorecard.split !== after.scorecard.split) throw new Error('Before/after must share frozen inputs and split')
const paired = bootstrapQuality(before.flow.results, before.sweep.dataset, loadBank().questions, { results: after.flow.results, sweep: after.sweep.dataset })
const keep = (x: typeof before) => ({ scorecard: x.scorecard,
  flow: { results: x.flow.results.map(({ id, requested, spentMinor, wastedMinor, firstBuy, expectedBuy, free, final, purchases }: typeof x.flow.results[number]) => ({ id, requested, spentMinor, wastedMinor, firstBuy, expectedBuy, free, final, purchases })) },
  // Retain precisely the fields used to reproduce selection scoring and CIs.
  sweep: { dataset: x.sweep.dataset.map(({ questionId, factId, round, factOpen, selected, threshold, value, priceMinor, resourceId, labels, originality, verdict }: typeof x.sweep.dataset[number]) => ({ questionId, factId, round, factOpen, selected, threshold, value, priceMinor, resourceId, labels, originality, verdict })) } })
const out = 'eval/scorecard/numbers-results.json'
writeFileSync(out, JSON.stringify({ schema: 'tftf.numbers-comparison/v1', before: keep(before), after: keep(after), pairedDelta95: paired }) + '\n')
assertNoSecrets([out])
console.log(JSON.stringify({ before: before.scorecard.quality, after: after.scorecard.quality, paired }, null, 2))
