import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, no declarations
import { generate } from '../scripts/generate-corpus.mjs'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import { validateWriterCorpus } from '../shared/contracts/writers.js'

const root = join(import.meta.dirname, '..')
const bible = JSON.parse(readFileSync(join(root, 'data/corpus/v2/story-bible.json'), 'utf8'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>
const filler = (n: number, seed: string) => Array.from({ length: n }, (_, i) => `${seed}${i}x`).join(' ')

/** Fake DeepSeek: plans N unique articles; writes ~750 words, omitting required text on the first attempt of `flaky`. */
function fakeLlm(opts: { flaky?: string; fail429?: { name: string; times: number } } = {}) {
  const log: string[] = []
  let rate = opts.fail429?.times ?? 0
  const llm = async (name: string, _system: string, input: Obj) => {
    log.push(name)
    if (opts.fail429 && name === opts.fail429.name && rate-- > 0) throw new Error('LLM returned 429')
    if (name.startsWith('plan:')) {
      return { articles: Array.from({ length: input.count }, (_, i) => ({
        title: `${input.publisher} piece ${i}`, writerSlug: input.writers[0].slug, publishedAt: i === 0 ? '1999-01-01' : '2026-08-1' + (i % 9), tags: ['t'], tier: i % 2 ? 'FREE' : 'PAID',
        family: `fam-${i}`, derivedFrom: input.sourceArticles?.[i % input.sourceArticles.length]?.articleId,
      })) }
    }
    const first = log.filter(n => n === name).length === 1
    const facts = name === `write:${opts.flaky}` && first ? [] : input.factStatements
    const paras = [`## One\n\n${facts.join(' ')} ${filler(150, 'a')}`, `## Two\n\n${filler(150, 'b')}`, `${filler(150, 'c')}`, `## Three\n\n${filler(150, 'd')}`, filler(150, 'e')]
    if (input.plantedParagraph && !opts.flaky) paras.splice(2, 0, input.plantedParagraph)
    return { abstract: 'A short teaser.', body: paras.join('\n\n') }
  }
  return { llm, log }
}
const run = (out: string, llm: (name: string, system: string, input: Obj) => Promise<unknown>, extra: Obj = {}) => generate({ llm, root, out, today: '2026-10-07', wait: async () => {}, log: () => {}, ...extra })
const files = (out: string) => readdirSync(join(out, 'articles'), { recursive: true }).filter(f => String(f).endsWith('.json')) as string[]

describe('corpus generator (#119)', () => {
  it('plans, writes valid articles within the call cap, forces golden facts and passages', async () => {
    const out = mkdtempSync(join(tmpdir(), 'corpus-'))
    const { llm, log } = fakeLlm()
    const r = await run(out, llm)
    expect(r.failed).toEqual([])
    expect(log.filter(n => n.startsWith('plan:'))).toHaveLength(8)
    expect(r.calls).toBeLessThanOrEqual(120)
    const articles = files(out).map(f => JSON.parse(readFileSync(join(out, 'articles', f), 'utf8')))
    expect(articles.length).toBeGreaterThanOrEqual(80)
    const roster = readdirSync(join(root, 'data/writers')).map(f => JSON.parse(readFileSync(join(root, 'data/writers', f), 'utf8')))
    validateWriterCorpus({ publishers: roster.map(f => f.publisher), writers: roster.flatMap(f => f.writers), articles })
    const byId = new Map(articles.map(a => [a.articleId, a]))
    expect(byId.get('notft-kestrel-tsmc-deal-margins').body).toContain('55.2%')
    expect(byId.get('mp-kestrel-deal-digest').derivedFrom).toBe('notft-kestrel-tsmc-deal-margins')
    expect(articles.filter(a => a.publisherSlug === 'marketpulse-digest' && a.derivedFrom).length).toBeGreaterThan(3)
    const plant = byId.get('alphaleak-kestrel-penang-lead-times')
    expect(plant.passages.find((p: Obj) => p.id === 'lead-times').text).toBe(bible.alphaLeakPlant.passageText)
    expect(byId.get('fab-floor-kestrel-penang-lead-times').passages.some((p: Obj) => p.id === 'lead-times' && p.text.includes('18 weeks'))).toBe(true)
    // planned dates outside the 6-month window are replaced
    expect(articles.every(a => a.publishedAt >= '2026-04-01')).toBe(true)
  })

  it('retries when a required fact is missing, and gives up after 2 retries without writing', async () => {
    const out = mkdtempSync(join(tmpdir(), 'corpus-'))
    const { llm, log } = fakeLlm({ flaky: 'notft-kestrel-tsmc-deal-margins' })
    const r = await run(out, llm, { only: 'notfinancialtimes' })
    expect(log.filter(n => n === 'write:notft-kestrel-tsmc-deal-margins')).toHaveLength(2)
    expect(JSON.parse(readFileSync(join(out, 'articles/notfinancialtimes/notft-kestrel-tsmc-deal-margins.json'), 'utf8')).body).toContain('55.2%')
    expect(r.failed).toEqual([])
    const out2 = mkdtempSync(join(tmpdir(), 'corpus-'))
    const bad = await run(out2, async (name: string, s: string, i: Obj) => name === 'write:notft-kestrel-tsmc-deal-margins' ? { abstract: 'x', body: filler(700, 'z') } : fakeLlm().llm(name, s, i), { only: 'notfinancialtimes' })
    expect(bad.failed).toHaveLength(1)
    expect(existsSync(join(out2, 'articles/notfinancialtimes/notft-kestrel-tsmc-deal-margins.json'))).toBe(false)
  })

  it('is idempotent: a second run makes no LLM calls and rewrites nothing', async () => {
    const out = mkdtempSync(join(tmpdir(), 'corpus-'))
    await run(out, fakeLlm().llm, { only: 'the-fab-floor' })
    const again = fakeLlm()
    const r = await run(out, again.llm, { only: 'the-fab-floor' })
    expect(again.log).toEqual([])
    expect(r.written).toBe(0)
    expect(r.skipped).toBeGreaterThan(5)
  })

  it('backs off on 429 and enforces the hard call cap', async () => {
    const out = mkdtempSync(join(tmpdir(), 'corpus-'))
    const waits: number[] = []
    const { llm } = fakeLlm({ fail429: { name: 'plan:kopi-contrarian', times: 2 } })
    const r = await run(out, llm, { only: 'kopi-contrarian', wait: async (ms: number) => { waits.push(ms) } })
    expect(waits).toEqual([5000, 15000])
    expect(r.failed).toEqual([])
    const capped = await run(mkdtempSync(join(tmpdir(), 'corpus-')), fakeLlm().llm, { only: 'kopi-contrarian', cap: 3 })
    expect(capped.calls).toBe(3)
    expect(capped.failed.length).toBeGreaterThan(0)
  })

  it('dry-run uses no LLM and writes nothing', async () => {
    const out = mkdtempSync(join(tmpdir(), 'corpus-'))
    const r = await run(out, async () => { throw new Error('network') }, { dryRun: true })
    expect(r.written).toBe(0)
    expect(existsSync(join(out, 'articles'))).toBe(false)
  })

  it('DEMO_QUESTIONS match the story bible wording', () => {
    expect(DEMO_QUESTIONS.map(q => q.text)).toEqual(bible.useCases.map((u: Obj) => u.question))
  })
})
