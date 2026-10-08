// #203: the in-domain question bank is versioned, records its generator, and every requested fact is
// established by the real corpus (scripted check). Facts are matched by needle and article id, so the
// corpus PR's contradiction fixes (#198) and price change (#204) keep these tests green.
import { describe, expect, it } from 'vitest'
import { bankSummary, loadArticles, loadBank, resolveFact, verifyBank } from '../../eval/questions/bank.js'

const bank = loadBank()
const articles = loadArticles()

describe('question bank (#203)', () => {
  it('is versioned, has at least 40 questions, and records a generator from a different vendor than the judged models', () => {
    expect(bank.version).toBe(1)
    expect(bank.questions.length).toBeGreaterThanOrEqual(40)
    expect(bank.generator.vendor).toBe('Anthropic')
    for (const judged of bank.generator.judgedModels) expect(judged).not.toMatch(/anthropic|claude/i)
    expect(bank.humanReview.sample.every(id => bank.questions.some(q => q.id === id))).toBe(true)
  })
  it('covers UC1–UC3 variants, free-sufficient and paid-needed questions, and every #213 hard case', () => {
    const s = bankSummary(bank)
    for (const uc of ['UC1', 'UC2', 'UC3']) expect(s.byUseCase[uc]).toBeGreaterThanOrEqual(3)
    expect(s.byKind['free-sufficient']).toBeGreaterThanOrEqual(5)
    expect(s.byKind['paid-needed']).toBeGreaterThanOrEqual(5)
    for (const hard of ['topic-only', 'forecast-as-fact', 'wrong-date', 'wrong-entity', 'conflicting']) expect(s.hardCases[hard]).toBeGreaterThanOrEqual(1)
    // The UC verbatim questions come from the story bible.
    const bible = ['What did the Bank of Japan change at its last meeting, and how did 10-year JGB yields react?', "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC?", "Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia getting shorter?"]
    for (const question of bible) expect(bank.questions.some(q => q.question === question)).toBe(true)
  })
  it('verifies every requested fact against the corpus by article id, with no errors', () => {
    const problems = verifyBank(bank, articles)
    expect(problems.filter(p => p.severity === 'error')).toEqual([])
    // A trap or conflict that stops matching is only expected for corpus-sensitive questions (#198).
    for (const w of problems.filter(p => p.severity === 'warning')) expect(bank.questions.find(q => q.id === w.questionId)?.corpusSensitive).toBeDefined()
    for (const q of bank.questions) for (const fact of q.requested) for (const source of resolveFact(fact, articles)) expect(source.passageIds.length).toBeGreaterThan(0)
  })
  it('keeps the answer out of the frozen need text and names only PAID articles as purchases', () => {
    for (const q of bank.questions) {
      for (const fact of q.requested) for (const n of fact.needles.filter(x => /\d/.test(x))) expect(fact.need).not.toContain(n)
      for (const id of [q.expect.buy, ...(q.expect.avoid ?? [])].filter(Boolean) as string[]) expect(articles.get(id)?.tier).toBe('PAID')
    }
  })
  it('stores no prices, so the UC3 price change (#204) cannot stale it', () => {
    expect(JSON.stringify(bank)).not.toMatch(/priceMinor|amountMinor/)
  })
  it('flags a fact the corpus does not hold', () => {
    const broken = structuredClone(bank)
    broken.questions[0].requested[0].needles = ['9.99% that no article says']
    expect(verifyBank(broken, articles).some(p => p.severity === 'error' && p.questionId === broken.questions[0].id)).toBe(true)
  })
})
