import { expect, it } from 'vitest'
import { bootstrapQuality } from '../../eval/scorecard/uncertainty.js'
import type { QuestionResult } from '../../eval/decisions/offline.js'
import type { Question } from '../../eval/questions/bank.js'
it('resamples whole source groups, preserves null waste and yields zero paired deltas on identical data', () => {
  const result = (id: string) => ({ id, spentMinor: 0, wastedMinor: 0, requested: 1, firstBuy: null, expectedBuy: null, free: { supported: [] }, final: { supported: [] } } as unknown as QuestionResult)
  const results = [result('Q01'), result('Q02'), result('Q03')]
  const questions = results.map((r, i) => ({ id: r.id, lane: i < 2 ? 'source:a' : 'source:b' } as Question))
  const ci = bootstrapQuality(results, [], questions, undefined, 100)
  expect(ci.clusters).toBe(2)
  expect(ci.intervals.wastedSpendPct).toEqual({ low: null, high: null, validReplicates: 0 })
  const delta = bootstrapQuality(results, [], questions, { results, sweep: [] }, 100)
  expect(delta.intervals.selectionF1Flow).toEqual({ low: 0, high: 0, validReplicates: 100 })
  expect(() => bootstrapQuality(results, [], questions, { results: results.slice(1), sweep: [] })).toThrow('identical ordered questions')
})
