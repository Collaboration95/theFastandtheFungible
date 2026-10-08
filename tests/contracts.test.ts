import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { AnswerSchema, ArticleSchema, AskSchema, DecisionRowSchema, ModeLabelsSchema, PublisherSchema, PurchaseIntentSchema, ReputationRecordSchema, ScopeSchema, articleProblems, sharesRun, validateWriterCorpus, type Article, type Publisher } from '../shared/contracts/index.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import raw from './fixtures/corpus-mini/corpus.json'

const clone = () => structuredClone(raw) as unknown as { publishers: Publisher[]; writers: { slug: string; publisherSlug: string }[]; articles: Article[] }
const paid = () => miniCorpus.articles.find(a => a.tier === 'PAID')!
const masthead = () => miniCorpus.publishers.find(p => p.slug === paid().publisherSlug)!
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
const relax = { relaxWordLimits: true }

describe('writer corpus contracts (#112)', () => {
  it('loads the mini corpus: 3 publishers, 8 articles, one PAID and one rewrite, all SYNTHETIC', () => {
    expect(miniCorpus.publishers).toHaveLength(3)
    expect(miniCorpus.articles).toHaveLength(8)
    expect(miniCorpus.articles.filter(a => a.tier === 'PAID')).toHaveLength(1)
    expect(miniCorpus.articles.filter(a => a.derivedFrom)).toHaveLength(1)
    expect(miniCorpus.publishers.every(p => p.synthetic && !p.wallet)).toBe(true)
  })

  it('enforces 600–1,400 body words unless relaxed for fixtures', () => {
    const at = (n: number) => ({ ...paid(), body: `${paid().passages.map(p => p.text).join(' ')} ${words(n)}` })
    expect(articleProblems(paid(), masthead())).toContainEqual(expect.stringMatching(/words, outside/))
    expect(articleProblems(paid(), masthead(), relax)).toEqual([])
    expect(articleProblems(at(700), masthead())).toEqual([])
    expect(articleProblems(at(1500), masthead())).toContainEqual(expect.stringMatching(/words, outside/))
  })

  it('needs at least 4 passages, each an exact substring of the body', () => {
    expect(ArticleSchema.safeParse({ ...paid(), passages: paid().passages.slice(0, 3) }).success).toBe(false)
    const changed = { ...paid(), passages: paid().passages.map((p, i) => i ? p : { ...p, text: p.text.replace('three', 'four') }) }
    expect(articleProblems(changed, masthead(), relax)).toContainEqual(expect.stringMatching(/not an exact substring/))
  })

  it('PAID needs a non-records publisher and a price; FREE has price 0', () => {
    const records = miniCorpus.publishers.find(p => p.kind === 'records')!
    expect(articleProblems({ ...paid(), publisherSlug: records.slug }, records, relax)).toContainEqual(expect.stringMatching(/not kind records/))
    expect(articleProblems({ ...paid(), priceMinor: 0 }, masthead(), relax)).toContainEqual(expect.stringMatching(/price above 0/))
    const free = miniCorpus.articles.find(a => a.tier === 'FREE' && a.publisherSlug === masthead().slug)!
    expect(articleProblems({ ...free, priceMinor: 10 }, masthead(), relax)).toContainEqual(expect.stringMatching(/FREE article has price 0/))
  })

  it('caps the abstract at 220 chars and rejects an 8-word run shared with the body (gate 1)', () => {
    expect(ArticleSchema.safeParse({ ...paid(), abstract: 'x'.repeat(221) }).success).toBe(false)
    const leak = paid().passages[0].text.split(' ').slice(0, 8).join(' ')
    expect(articleProblems({ ...paid(), abstract: `Teaser: ${leak}` }, masthead(), relax)).toContainEqual(expect.stringMatching(/8\+ consecutive words/))
    expect(sharesRun('a b c d e f g', 'a b c d e f g h')).toBe(false)
    expect(sharesRun('A, b c d e f g h!', 'x a b c d e f g h y')).toBe(true)
  })

  it('derivedFrom must point to an article in the same family', () => {
    const bad = clone()
    bad.articles.find(a => a.derivedFrom)!.derivedFrom = 'mt-boj-band'
    expect(() => validateWriterCorpus(bad, relax)).toThrow(/derivedFrom must point/)
  })

  it('articleId is globally unique across publishers', () => {
    const bad = clone()
    bad.articles[1].articleId = bad.articles[0].articleId
    expect(() => validateWriterCorpus(bad, relax)).toThrow(/globally unique/)
  })

  it('an independent writer is its own publisher; publisher wallet stays optional', () => {
    const bad = clone()
    bad.writers.push({ slug: 'ghost', publisherSlug: 'mira-tan', ...{ name: 'Ghost', bio: 'b', voice: 'v' } } as never)
    expect(() => validateWriterCorpus(bad, relax)).toThrow(/independent writer is its own publisher/)
    expect(PublisherSchema.safeParse({ ...masthead(), synthetic: false }).success).toBe(false)
  })
})

describe('run, decision, reputation and scope contracts (#115)', () => {
  it('gaps are free text up to 160 chars with optional tags', () => {
    const answer = { conclusion: 'c', claims: [], version: 1, provider: 'fixture', model: 'm' }
    expect(AnswerSchema.safeParse({ ...answer, openGaps: [{ text: 'Analyst view on packaging capacity.' }] }).success).toBe(true)
    expect(AnswerSchema.safeParse({ ...answer, openGaps: [{ text: 'x'.repeat(161) }] }).success).toBe(false)
  })

  it('decision rows accept SKIP_LOW_TRUST and carry writer identity and reputation', () => {
    const candidate = { ...exampleCandidate, publisherSlug: 'load-factor', writerSlug: 'sara-lim', url: '/w/load-factor/articles/lf-kestrel-tsmc-deal', reputation: { H: 0.4, C: 1, T: 0.4, status: 'quarantined' } }
    const row = DecisionRowSchema.parse({ candidate, judgment: { addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 1 }, value: 0.5, valuePerDollar: 1, verdict: 'SKIP_LOW_TRUST', reason: 'H < 0.5' })
    expect(row.candidate.writerSlug).toBe('sara-lim')
  })

  it('intents carry proof statuses, failed claims and a refund', () => {
    const intent = { intentId: 'i', runId: 'r', profileId: 'p', resourceId: 'a', version: 'v1', amountMinor: 60, status: 'REFUNDED', failedClaimIds: ['c1'], refund: { txHash: 'A'.repeat(64), amountMinor: 60 } }
    expect(PurchaseIntentSchema.parse(intent).refund?.amountMinor).toBe(60)
    for (const status of ['CLAIM_FAILED', 'CHALLENGED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED']) expect(PurchaseIntentSchema.safeParse({ ...intent, status }).success).toBe(true)
  })

  it('scope allows at most 2 questions of 2–4 options and a plan of 1–3 sub-queries', () => {
    const plan = { restatement: 'r', subqueries: ['a'] }
    const q = { id: 'q1', text: 'Which market?', options: ['JGBs', 'USTs'] }
    expect(ScopeSchema.safeParse({ questions: [q, q], plan }).success).toBe(true)
    expect(ScopeSchema.safeParse({ questions: [q, q, q], plan }).success).toBe(false)
    expect(ScopeSchema.safeParse({ questions: [{ ...q, options: ['one'] }], plan }).success).toBe(false)
    expect(ScopeSchema.safeParse({ questions: [], plan: { ...plan, subqueries: ['a', 'b', 'c', 'd'] } }).success).toBe(false)
    expect(AskSchema.parse({ question: 'q', budgetMinor: 100, answers: { q1: 'JGBs' }, plan }).plan).toEqual(plan)
    // The budget is any 5-cent step from S$0 to S$5 (articles cost from S$0.05); nothing else is accepted.
    for (const budgetMinor of [0, 5, 10, 35, 200, 495, 500]) expect(AskSchema.safeParse({ question: 'q', budgetMinor }).success).toBe(true)
    for (const budgetMinor of [-5, 3, 12, 2.5, 505, 1000]) expect(AskSchema.safeParse({ question: 'q', budgetMinor }).success).toBe(false)
  })

  it('labels the search mode and keeps the reputation record shape', () => {
    expect(ModeLabelsSchema.safeParse({ research: 'r', decision: 'd', publisher: 'local', settlement: 'SIMULATED SGD · no real funds', search: 'keyword only (embeddings unavailable)' }).success).toBe(true)
    expect(ReputationRecordSchema.safeParse({ publisherSlug: 'p', wallet: 'r', r: 0, s: 0, passes: 0, fails: 0, refunds: 0, refusals: 0, brierSum: 0, n: 0, H: 0.8, C: 1, T: 0.8, status: 'active', updatedAt: 'now' }).success).toBe(true)
  })

  it('the facet enum schema is gone from code outside docs/archive (D10; docs may still name it)', () => {
    const name = ['Facet', 'Schema'].join('')
    let hits = ''
    try { hits = execFileSync('git', ['grep', '-l', name, '--', '.', ':!docs/archive', ':!*.md'], { encoding: 'utf8' }) } catch { /* exit 1: no match */ }
    expect(hits).toBe('')
  })
})
