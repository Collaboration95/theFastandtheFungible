import { expect, it } from 'vitest'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { assertNoLeaks } from './scenarios/harness.js'
it('allows the question restatement while detecting each repaired fixture canary before a grant', async () => {
  const corpus = await loadWriterCorpus(undefined, { allowMini: false })
  const observation = { kind: 'planner', runId: 'q02', grants: [], raw: 'The question asks how much the Bank of Japan raised its policy rate in September 2026 and what the new rate is.' }
  expect(() => assertNoLeaks([observation], corpus)).not.toThrow()
  for (const id of ['bp-jgb-curve-10s30s-analysis', 'mp-boj-hike-digest', 'notft-inside-boj-september-hike', 'load-analyzing-singapore-s-wholesale-price-spreads-for-2026', 'notfinancialtimes-singapore-s-corporate-bond-market-trends-and-outlook', 'basis-jgb-yield-curve-steepness-10-year-vs-30-year-dynamics', 'lf-kestrel-penang-phase2-power-deep-dive']) {
    const article = corpus.articles.find(a => a.articleId === id)!
    const token = article.passages.find(p => p.id === 'r3-canary')!.text
    expect(() => assertNoLeaks([{ ...observation, raw: article.articleId }], corpus)).not.toThrow()
    expect(article.passages.some(p => p.text.includes(token))).toBe(true)
    expect(() => assertNoLeaks([{ ...observation, raw: token }], corpus)).toThrow('before its run/version grant')
    expect(() => assertNoLeaks([{ ...observation, raw: article.passages[0].text }], corpus)).toThrow('before its run/version grant')
  }
})
