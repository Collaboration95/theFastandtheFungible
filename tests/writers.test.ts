import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateWriterCorpus, type Publisher, type Writer } from '../shared/contracts/writers.js'

const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const files = readdirSync(new URL('../data/writers', import.meta.url)).filter(f => f.endsWith('.json')).map(f => read(`data/writers/${f}`)) as { publisher: Publisher; writers: Writer[]; topics: { topic: string; lane: string }[] }[]
const publishers = files.map(f => f.publisher)

describe('writer roster (#117)', () => {
  it('has the fixed 8 publishers and validates against the W0 schemas', () => {
    expect(publishers.map(p => p.slug).sort()).toEqual(['alphaleak', 'basis-points', 'kopi-contrarian', 'load-factor', 'marketpulse-digest', 'notfinancialtimes', 'open-records', 'the-fab-floor'])
    const corpus = validateWriterCorpus({ publishers, writers: files.flatMap(f => f.writers), articles: [] })
    expect(corpus.writers.filter(w => w.publisherSlug === 'notfinancialtimes').length).toBeGreaterThanOrEqual(2)
    expect(corpus.writers.filter(w => w.publisherSlug === 'notfinancialtimes').length).toBeLessThanOrEqual(3)
  })
  it('gives each publisher 6-10 topics in the three lanes, and every lane at least 3 publishers', () => {
    const lanes = new Set(['rates', 'power', 'semis'])
    for (const f of files) {
      expect(f.topics.length, f.publisher.slug).toBeGreaterThanOrEqual(6)
      expect(f.topics.length, f.publisher.slug).toBeLessThanOrEqual(10)
      expect(f.topics.every(t => lanes.has(t.lane))).toBe(true)
    }
    for (const lane of lanes) expect(files.filter(f => f.topics.some(t => t.lane === lane)).length, lane).toBeGreaterThanOrEqual(3)
  })
  it('has exactly one records publisher and the FINAL-PUSH §10 prices', () => {
    expect(publishers.filter(p => p.kind === 'records').map(p => p.slug)).toEqual(['open-records'])
    const price = (slug: string) => Math.max(...Object.values(publishers.find(p => p.slug === slug)!.prices))
    expect(Object.fromEntries(publishers.map(p => [p.slug, price(p.slug)]))).toEqual({ notfinancialtimes: 90, 'load-factor': 60, 'basis-points': 40, 'the-fab-floor': 40, 'kopi-contrarian': 10, 'marketpulse-digest': 20, alphaleak: 30, 'open-records': 0 })
    // Owner, 8 Oct (#204): The Fab Floor's standard posts stay S$0.25; its Penang lead-time article is a S$0.40 data deep-dive.
    expect(publishers.find(p => p.slug === 'the-fab-floor')!.prices).toEqual({ standard: 25, 'data-deep-dive': 40 })
  })
})

type Fact = { text: string; needles: string[] }
type Art = { articleId: string; publisherSlug: string; writerSlug: string; tier: string; priceMinor: number; role: string; family: string; derivedFrom?: string; facts: Fact[]; expectedRelevance?: number }
type Uc = { id: string; question: string; articles: Art[]; expectedPicks: { round1: string | null; round2: string | null; skippedRewrite: string }; expectedImpact: string | null; expectedSpendMinor: number; clarify: null | { options: string[]; expectedUserPick: string } }
const bible = read('data/corpus/v2/story-bible.json') as { alphaLeakPlant: { articleId: string; relevance: number; priceMinor: number; passageText: string; manifestClaim: { kind: string; passageId: string } }; useCases: Uc[] }

describe('story bible (#118)', () => {
  const writers = new Set(files.flatMap(f => f.writers.map(w => `${w.publisherSlug}/${w.slug}`)))
  const all = bible.useCases.flatMap(u => u.articles)
  it('locks four questions: UC1 bond, UC2 and UC3 semis, UC4 power (the focused free search, #211)', () => {
    expect(bible.useCases.map(u => u.id)).toEqual(['UC1', 'UC2', 'UC3', 'UC4'])
    expect(bible.useCases[3]!.question).toMatch(/Kestrel Semiconductor.*Penang Phase 2.*renewable/)
    expect(bible.useCases[0]!.question).toMatch(/Bank of Japan.*10-year JGB/)
    expect(bible.useCases[1]!.question).toMatch(/Kestrel Semiconductor.*TSMC/)
    expect(bible.useCases[2]!.question).toMatch(/Kestrel Semiconductor.*advanced-packaging lead times in Malaysia/)
  })
  it('uses roster writers, matching prices, unique ids and rewrite families', () => {
    expect(new Set(all.map(a => a.articleId)).size).toBe(all.length)
    for (const a of all) {
      expect(writers.has(`${a.publisherSlug}/${a.writerSlug}`), a.articleId).toBe(true)
      const pub = publishers.find(p => p.slug === a.publisherSlug)!
      if (a.tier === 'PAID') expect(Object.values(pub.prices), a.articleId).toContain(a.priceMinor)
      else expect(a.priceMinor).toBe(0)
      if (a.derivedFrom) expect(all.find(x => x.articleId === a.derivedFrom)?.family).toBe(a.family)
    }
  })
  it('gives each UC 2+ decoys, one winner (UC2/UC3), a skipped rewrite, and picks that exist', () => {
    // UC4 is the follow-up story: no purchase, so no decoys, winner or skipped rewrite (checked below).
    for (const u of bible.useCases.filter(u => u.id !== 'UC4')) {
      const ids = new Set(u.articles.map(a => a.articleId))
      expect(u.articles.filter(a => ['decoy', 'alternative'].includes(a.role)).length, u.id).toBeGreaterThanOrEqual(2)
      expect(u.articles.some(a => a.tier === 'FREE' && a.role === 'free-source'), u.id).toBe(true)
      expect(u.articles.find(a => a.articleId === u.expectedPicks.skippedRewrite)?.derivedFrom, u.id).toBeTruthy()
      for (const pick of [u.expectedPicks.round1, u.expectedPicks.round2]) if (pick) expect(ids.has(pick)).toBe(true)
    }
    const [uc1, uc2, uc3] = bible.useCases as [Uc, Uc, Uc]
    expect(uc1.expectedSpendMinor).toBe(0)
    expect(uc1.expectedPicks.round1).toBeNull()
    expect(uc2.clarify!.options).toContain(uc2.clarify!.expectedUserPick)
    expect(uc2.expectedSpendMinor).toBe(uc2.articles.find(a => a.articleId === uc2.expectedPicks.round1)!.priceMinor)
    const spend = (uc3.expectedPicks.round1 ? uc3.articles.find(a => a.articleId === uc3.expectedPicks.round1)!.priceMinor : 0) + uc3.articles.find(a => a.articleId === uc3.expectedPicks.round2)!.priceMinor
    expect(uc3.expectedSpendMinor).toBe(spend)
    expect(['QUALIFIES', 'STRENGTHENS']).toContain(uc2.expectedImpact)
    expect(['QUALIFIES', 'STRENGTHENS']).toContain(uc3.expectedImpact)
  })
  it('gives every winner and free source dated figures as needles', () => {
    for (const a of all.filter(x => x.role === 'winner' || x.role === 'free-source')) {
      expect(a.facts.length, a.articleId).toBeGreaterThan(0)
      for (const f of a.facts) for (const n of f.needles) expect(f.text, `${a.articleId}: ${n}`).toContain(n)
    }
    for (const a of all.filter(x => x.role === 'winner')) expect(a.facts.some(f => /\b20\d\d\b/.test(f.text) && /\d/.test(f.text)), a.articleId).toBe(true)
  })
  it('plants AlphaLeak: cheaper than the truth, relevance 0.96, dated-figure claim on a passage with no date-plus-number sentence', () => {
    const plant = bible.alphaLeakPlant, art = all.find(a => a.articleId === plant.articleId)!
    expect(art.priceMinor).toBe(30)
    expect(plant.relevance).toBe(0.96)
    expect(art.expectedRelevance).toBe(0.96)
    expect(plant.manifestClaim.kind).toBe('dated-figure')
    expect(plant.passageText).not.toMatch(/\d/)
    expect(plant.passageText).not.toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/i)
    const truth = all.find(a => a.articleId === 'fab-floor-kestrel-penang-lead-times')!
    expect(truth.tier).toBe('PAID')
    // #204: the truth is the S$0.40 deep-dive, dearer than AlphaLeak but within the S$1 per-source cap.
    expect(truth.priceMinor).toBe(40)
    expect(truth.priceMinor).toBeGreaterThan(plant.priceMinor)
    expect(truth.priceMinor).toBeLessThanOrEqual(100)
    expect(truth.facts.some(f => /\d+ weeks on \d+ \w+ 2026/.test(f.text))).toBe(true)
  })
  it('adds UC4 as a use case: 3 requested facts, 2 read first, the 3rd free only on a focused search, a paid article that would have been bought (#211)', () => {
    type FollowUp = Uc & { requestedFacts: { id: string; text: string; coveredBy: string; foundBy: string; needles: string[] }[]; missingFact: string; expectedOutcome: string; expectedPicks: { wouldHaveBought: string } }
    const cases = (read('data/corpus/v2/story-bible.json') as { useCases: FollowUp[]; followUpCases?: unknown }).useCases
    const uc4 = cases.find(u => u.id === 'UC4')
    expect(cases.at(-1)).toBe(uc4)
    expect(uc4!.id).toBe('UC4')
    expect(uc4!.requestedFacts).toHaveLength(3)
    expect(uc4!.requestedFacts.filter(f => f.foundBy === 'initial search')).toHaveLength(2)
    const missing = uc4!.requestedFacts.find(f => f.id === uc4!.missingFact)!
    expect(missing.foundBy).toBe('focused follow-up search')
    for (const f of uc4!.requestedFacts) for (const n of f.needles) expect(f.text, `${f.id}: ${n}`).toContain(n)
    const followUp = uc4!.articles.find(a => a.articleId === missing.coveredBy)!
    const paid = uc4!.articles.find(a => a.articleId === uc4!.expectedPicks.wouldHaveBought)!
    expect([followUp.tier, paid.tier]).toEqual(['FREE', 'PAID'])
    expect(uc4!.expectedSpendMinor).toBe(0)
    expect(uc4!.expectedOutcome).toBe('3 of 3 · found free on a focused search · nothing bought')
    for (const a of uc4!.articles) {
      expect(writers.has(`${a.publisherSlug}/${a.writerSlug}`), a.articleId).toBe(true)
      expect(bible.useCases.filter(u => u.id !== 'UC4').flatMap(u => u.articles).some(x => x.articleId === a.articleId), `${a.articleId} is also a UC1–UC3 article`).toBe(false)
      if (a.tier === 'PAID') expect(Object.values(publishers.find(p => p.slug === a.publisherSlug)!.prices)).toContain(a.priceMinor)
    }
  })
})
