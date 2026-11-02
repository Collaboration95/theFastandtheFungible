// Gate 1 (#124): /search never returns 8 consecutive words of any paid body.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { ABSTRACT_LEAK_WORDS, sharesRun } from '../shared/contracts/writers.js'

// Match sharesRun's tokenization exactly; index bodies once, not once per response.
function runs(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []
  return new Set(Array.from({ length: Math.max(0, words.length - ABSTRACT_LEAK_WORDS + 1) }, (_, i) => words.slice(i, i + ABSTRACT_LEAK_WORDS).join(' ')))
}

/** Seeded so a failure is reproducible. */
function rng(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 }
}

type UseCase = { question: string; clarify: { options: string[] } | null }
const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8')) as { useCases: (UseCase & { focusedQueryExample?: string })[] }
// Story-bible UC questions plus one clarify-angle sub-query per option, and UC4's question and focused follow-up query (#211).
const QUESTIONS = [
  ...bible.useCases.flatMap(uc => [uc.question, ...(uc.clarify?.options ?? []).map(angle => `${uc.question} ${angle}`)]),
  ...bible.useCases.flatMap(uc => uc.focusedQueryExample ? [uc.focusedQueryExample] : []),
]

describe('search leak gate (#124)', async () => {
  // Iterates loadWriterCorpus(); until #120 lands the roster has no articles, so the mini corpus stands in.
  const loaded = await loadWriterCorpus()
  const corpus = loaded.articles.some(a => a.tier === 'PAID') ? loaded : miniCorpus
  const paid = corpus.articles.filter(a => a.tier === 'PAID')
  const random = rng(124)
  const words = corpus.articles.flatMap(a => a.body.split(/\s+/)).filter(Boolean)
  // 20 random queries drawn from the bodies themselves, paid ones included: the hardest case.
  const randomQueries = Array.from({ length: 20 }, () => Array.from({ length: 3 + Math.floor(random() * 10) }, () => words[Math.floor(random() * words.length)]).join(' '))
  const paidRuns = paid.map(a => a.body.split(/\s+/).slice(0, 40).join(' '))

  const paidIndex = paid.map(article => runs(article.body))
  let base: string
  let cleanup: () => Promise<void>
  beforeAll(async () => {
    const app = createPublisherApp({ secret: 'leak-test', journal: ':memory:', rail: 'simulated', writers: corpus, env: {} })
    await app.locals.ready
    await app.locals.writersReady
    const server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    cleanup = async () => { await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() }
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  })
  afterAll(async () => { await cleanup?.() })

  it('indexed comparisons agree with sharesRun on paid bodies and token boundaries', () => {
    const samples = [paidRuns[0], '', 'one two three four five six seven', "ONE two three four five six seven can't", "one, two three four five six seven can’t"]
    for (const sample of samples) {
      const sampleRuns = runs(sample)
      expect([...sampleRuns].some(run => paidIndex[0].has(run))).toBe(sharesRun(sample, paid[0].body))
    }
  })

  it('the oracle catches a leak', () => {
    expect(paid.length).toBeGreaterThan(0)
    expect(sharesRun(JSON.stringify({ abstract: paidRuns[0] }), paid[0].body, ABSTRACT_LEAK_WORDS)).toBe(true)
  })

  it(`no search response shares ${ABSTRACT_LEAK_WORDS} consecutive words with any paid body`, async () => {
    let responses = 0
    for (const publisher of corpus.publishers) {
      for (const q of [...QUESTIONS, ...randomQueries, ...paidRuns]) {
        const response = await fetch(`${base}/w/${publisher.slug}/search?${new URLSearchParams({ q: q.slice(0, 300), k: '10' })}`)
        expect(response.status).toBe(200)
        const text = await response.text()
        responses++
        const responseRuns = runs(text)
        for (const [i, article] of paid.entries()) expect([...responseRuns].some(run => paidIndex[i].has(run)), `${publisher.slug} leaked ${article.articleId} for "${q}"`).toBe(false)
      }
    }
    expect(responses).toBe(corpus.publishers.length * (QUESTIONS.length + 20 + paidRuns.length))
  }, 120_000)

  it.each([
    ['missing q', ''],
    ['empty q', 'q=%20%20'],
    ['q over 300 characters', `q=${'a'.repeat(301)}`],
    ['k = 0', 'q=kestrel&k=0'],
    ['k over 10', 'q=kestrel&k=11'],
    ['k not a number', 'q=kestrel&k=five'],
    ['repeated q', 'q=a&q=b'],
  ])('rejects %s with 400', async (_name, query) => {
    const response = await fetch(`${base}/w/load-factor/search?${query}`)
    expect(response.status).toBe(400)
  })

  it('caps results at k', async () => {
    const hits = await (await fetch(`${base}/w/load-factor/search?q=TSMC%20kestrel%20capacity&k=1`)).json() as unknown[]
    expect(hits).toHaveLength(1)
  })
})
