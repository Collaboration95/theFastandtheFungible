import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { checkCorpus } from '../scripts/check-corpus.mjs'

const root = join(import.meta.dirname, '..')
const fab = 'data/corpus/v2/articles/the-fab-floor/fab-floor-kestrel-penang-lead-times.json'

describe('committed v2 corpus (#120)', () => {
  it('passes the self-check: schema, golden facts, claims, planted AlphaLeak claim, abstracts', () => {
    expect(checkCorpus(root)).toEqual([])
  })

  it('catches a missing golden fact and a leaking paid abstract', () => {
    const copy = mkdtempSync(join(tmpdir(), 'corpus-v2-'))
    for (const dir of ['data/writers', 'data/corpus/v2']) cpSync(join(root, dir), join(copy, dir), { recursive: true })
    const file = join(copy, fab), article = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...article, abstract: 'Lead times fell to 18 weeks.', body: article.body.replaceAll('26 weeks', '27 weeks'), passages: article.passages.map((p: { text: string }) => ({ ...p, text: p.text.replaceAll('26 weeks', '27 weeks') })) }))
    const problems = checkCorpus(copy) as string[]
    expect(problems.some(p => p.includes('missing golden text "26 weeks"'))).toBe(true)
    expect(problems.some(p => p.includes('abstract leaks "18 weeks"'))).toBe(true)
  })
})
