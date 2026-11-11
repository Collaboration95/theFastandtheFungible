// A writer passage is untrusted input. One very long token must not stall lead selection: the file-path
// skip rule in shared/lead-finding.ts was quadratic in token length (47,000 characters took 3.9 s; this
// 200,000-character token would take over a minute) and now starts a match only where a word starts.
import { expect, it } from 'vitest'
import { summarizeAnswer } from '../shared/answer-summary.js'
import { exampleAnswer, exampleCandidate, exampleContent } from '../shared/contracts/examples.js'

it('scans a 200,000-character token in well under a second', () => {
  const text = 'XRP ' + 'x'.repeat(200_000) + '.'
  const content = { ...exampleContent, title: 'XRP', body: text, spans: [{ id: 'p1', text }] }
  const started = performance.now()
  const answer = summarizeAnswer('What is XRP?', exampleAnswer, [content], [{ ...exampleCandidate, title: 'XRP' }])
  expect(performance.now() - started).toBeLessThan(1000)
  expect(answer.lead).toEqual([])
})
