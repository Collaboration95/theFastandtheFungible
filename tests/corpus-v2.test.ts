import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { checkCorpus, goldenFactProblems } from '../scripts/check-corpus.mjs'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { buildIndex, searchIndex } from '../publisher/search.js'

const root = join(import.meta.dirname, '..')
const fab = 'data/corpus/v2/articles/the-fab-floor/fab-floor-kestrel-penang-lead-times.json'
type Passage = { id: string; text: string }
type ArticleJson = { articleId: string; body: string; passages: Passage[] }

/** A copy of the roster and the v2 corpus in a temp dir, so a test can plant problems in it. */
function corpusCopy() {
  const copy = mkdtempSync(join(tmpdir(), 'corpus-v2-'))
  for (const dir of ['data/writers', 'data/corpus/v2']) cpSync(join(root, dir), join(copy, dir), { recursive: true })
  return copy
}
/** Rewrites one sentence in an article's body and passages (passages must stay exact substrings). */
function plant(copy: string, file: string, from: string, to: string) {
  const path = join(copy, file), article = JSON.parse(readFileSync(path, 'utf8')) as ArticleJson
  expect(article.body, `${article.articleId} has "${from}"`).toContain(from)
  writeFileSync(path, JSON.stringify({ ...article, body: article.body.replaceAll(from, to), passages: article.passages.map(p => ({ ...p, text: p.text.replaceAll(from, to) })) }))
}

describe('committed v2 corpus (#120)', () => {
  it('passes the self-check: schema, golden facts, claims, planted AlphaLeak claim, abstracts', () => {
    expect(checkCorpus(root)).toEqual([])
  })

  it('catches a missing golden fact and a leaking paid abstract', () => {
    const copy = corpusCopy()
    const file = join(copy, fab), article = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...article, abstract: 'Lead times fell to 18 weeks.', body: article.body.replaceAll('26 weeks', '27 weeks'), passages: article.passages.map((p: { text: string }) => ({ ...p, text: p.text.replaceAll('26 weeks', '27 weeks') })) }))
    const problems = checkCorpus(copy) as string[]
    expect(problems.some(p => p.includes('missing golden text "26 weeks"'))).toBe(true)
    expect(problems.some(p => p.includes('abstract leaks "18 weeks"'))).toBe(true)
  })
})

describe('golden facts (#198)', () => {
  const bible = JSON.parse(readFileSync(join(root, 'data/corpus/v2/story-bible.json'), 'utf8')) as { goldenFacts: { facts: { id: string; values: string[]; pattern: string }[] } }
  const facts = bible.goldenFacts.facts

  it('flags each contradiction the 7 Oct audit found, and accepts the corrected wording', () => {
    const before = [
      'The yield on the 10-year JGB rose by 3 basis points to 0.85%.',
      'showed that one member proposed raising the policy rate by 25 bp, while eight members voted to maintain the current target of 0.5%.',
      'the five brokers covering the Hsinchu-based fabless designer fell to 55.2%',
      'Kestrel agreed to advance US$1.1 billion against future wafer deliveries, payable in two tranches before the end of the March 2027 quarter.',
      'The board vote was 8–1, with one member favouring a pause.',
    ].map((body, i) => ({ articleId: `planted-${i}`, body }))
    const flagged = (goldenFactProblems(facts, before) as string[]).map(p => p.split(':')[0])
    expect(new Set(flagged)).toEqual(new Set(before.map(a => a.articleId)))
    const after = [
      'The yield on the 10-year JGB rose by 9 basis points to 2.14%.',
      'showed that seven members voted to raise the policy rate by 25 bp to 1.00%, while two members preferred to keep it at 0.75%.',
      'the five brokers covering the Singapore-based fabless designer fell to 55.2%',
      'payable in three instalments, the last of them due by the end of April 2027.',
      'The board vote was 7–2, with two members favouring a pause.',
    ].map((body, i) => ({ articleId: `fixed-${i}`, body }))
    expect(goldenFactProblems(facts, after)).toEqual([])
  })

  it('fails check-corpus on a contradiction planted in a golden-path article', () => {
    const copy = corpusCopy()
    plant(copy, 'data/corpus/v2/articles/open-records/or-boj-statement-2026-09-18.json', 'rose by 9 basis points to 2.14%', 'rose by 3 basis points to 0.85%')
    plant(copy, 'data/corpus/v2/articles/notfinancialtimes/notft-kestrel-tsmc-deal-margins.json', 'payable in three instalments', 'payable in two tranches')
    const problems = checkCorpus(copy) as string[]
    expect(problems.filter(p => p.startsWith('or-boj-statement-2026-09-18: states jgb-10y-move-18-sep "3"'))).toHaveLength(1)
    expect(problems.filter(p => p.startsWith('or-boj-statement-2026-09-18: states jgb-10y-level-18-sep "0.85"'))).toHaveLength(1)
    expect(problems.filter(p => p.startsWith('notft-kestrel-tsmc-deal-margins: states prepayment-installments "two"'))).toHaveLength(1)
  })

  it('fails check-corpus when a FREE body repeats 8+ words of a PAID body', () => {
    const copy = corpusCopy()
    const sentence = 'Kestrel agreed to advance US$1.1 billion against future wafer deliveries'
    expect((JSON.parse(readFileSync(join(root, 'data/corpus/v2/articles/notfinancialtimes/notft-kestrel-tsmc-deal-margins.json'), 'utf8')) as ArticleJson).body).toContain(sentence)
    plant(copy, 'data/corpus/v2/articles/open-records/or-kestrel-tsmc-filing-2026-09-29.json', 'The previous contract covered 16,000 wafers a month.', `The previous contract covered 16,000 wafers a month. ${sentence}.`)
    expect(checkCorpus(copy)).toContain('or-kestrel-tsmc-filing-2026-09-29: shares 8+ consecutive words with paid notft-kestrel-tsmc-deal-margins')
  })
})

describe('UC4 content: the missing fact is free, but only a focused search finds it (#211)', async () => {
  type Uc4 = { question: string; focusedQueryExample: string; missingFact: string; requestedFacts: { id: string; coveredBy: string }[]; expectedPicks: { wouldHaveBought: string } }
  const uc4 = (JSON.parse(readFileSync(join(root, 'data/corpus/v2/story-bible.json'), 'utf8')) as { useCases: (Uc4 & { id: string })[] }).useCases.find(u => u.id === 'UC4')!
  const hidden = uc4.requestedFacts.find(f => f.id === uc4.missingFact)!.coveredBy
  const corpus = await loadWriterCorpus(undefined, { allowMini: false })
  const loadFactor = corpus.articles.filter(a => a.publisherSlug === 'load-factor')
  const ranked = async (q: string, k: number) => (await searchIndex(await buildIndex(loadFactor), q, k)).ranked.map(r => r.articleId)

  it('keeps the free article out of the first search: below the per-publisher cut of 5 for the question', async () => {
    const top = await ranked(uc4.question, 5)
    expect(top).not.toContain(hidden)
    expect(top).toContain(uc4.expectedPicks.wouldHaveBought)
    expect(top).toContain('lf-penang-grid-connection')
  })

  it('finds it in the top 3 of its publisher for a focused query, where BM25 reads past the embedded 1,500 characters', async () => {
    expect((await ranked(uc4.focusedQueryExample, 3))).toContain(hidden)
    const article = loadFactor.find(a => a.articleId === hidden)!
    const head = `${article.title} ${article.abstract} ${article.tags.join(' ')} ${article.body.slice(0, 1500)}`
    for (const word of ['Kestrel', 'Penang', 'renewable']) expect(head).not.toContain(word)
  })
})
