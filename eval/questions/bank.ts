// The in-domain question bank (#203): questions over the real v2 corpus, each with the facts it
// requests and the articles that establish them. Facts are needles, checked against the live corpus
// by article id, so a corpus edit that keeps the fact keeps the question valid (passage ids are
// resolved at load time, never stored).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const BANK_FILE = fileURLToPath(new URL('./bank.v1.json', import.meta.url))
const ARTICLES_DIR = fileURLToPath(new URL('../../data/corpus/v2/articles/', import.meta.url))

/** `need` is the requested fact as frozen text (no answer in it): what a judge or gap sees. `text` is the planted answer. */
/** `alt`: other needle sets that also establish the fact, for a value a pending corpus fix changes (for example #198). */
const FactSchema = z.object({ id: z.string(), need: z.string().min(1), text: z.string().min(1), needles: z.array(z.string().min(1)), alt: z.array(z.array(z.string().min(1)).min(1)).optional(), sources: z.array(z.string()) })
const TrapSchema = z.object({ factId: z.string(), articleId: z.string(), needles: z.array(z.string().min(1)).min(1), kind: z.enum(['topic-only', 'forecast-as-fact', 'wrong-date', 'wrong-entity']), note: z.string() })
const ConflictSchema = z.object({ factId: z.string(), articleId: z.string(), needles: z.array(z.string().min(1)).min(1), note: z.string() })
export const QuestionSchema = z.object({
  id: z.string().regex(/^Q\d{2,3}$/), lane: z.string(), kind: z.enum(['uc-variant', 'free-sufficient', 'paid-needed', 'hard-case']),
  hardCase: z.enum(['topic-only', 'forecast-as-fact', 'wrong-date', 'wrong-entity', 'conflicting']).optional(),
  useCase: z.enum(['UC1', 'UC2', 'UC3', 'UC4']).optional(), question: z.string().min(1), answers: z.record(z.string(), z.string()).optional(),
  requested: z.array(FactSchema).min(1), traps: z.array(TrapSchema).optional(), conflicts: z.array(ConflictSchema).optional(),
  expect: z.object({ buy: z.string().nullable(), storyRound1: z.string().optional(), avoid: z.array(z.string()).optional() }),
  corpusSensitive: z.string().optional(), notes: z.string().optional(),
})
export const BankSchema = z.object({
  version: z.number().int().positive(), corpus: z.string(), builtAt: z.string(), label: z.string(),
  generator: z.object({ author: z.string(), vendor: z.string(), judgedModels: z.array(z.string()), vendorDiffersFromJudged: z.literal(true), method: z.array(z.string()) }),
  humanReview: z.object({ status: z.enum(['pending', 'partial', 'done']), sample: z.array(z.string()), instructions: z.string() }),
  corpusSensitivity: z.record(z.string(), z.string()),
  questions: z.array(QuestionSchema).min(40),
})
export type Fact = z.infer<typeof FactSchema>
export type Trap = z.infer<typeof TrapSchema>
export type Question = z.infer<typeof QuestionSchema>
export type Bank = z.infer<typeof BankSchema>
/** The article fields the bank checks against; everything else in an article file is ignored. */
export type BankArticle = { articleId: string; version: string; publisherSlug: string; tier: 'FREE' | 'PAID'; priceMinor: number; title: string; derivedFrom?: string; passages: { id: string; text: string }[] }

export const loadBank = (file = BANK_FILE): Bank => BankSchema.parse(JSON.parse(readFileSync(file, 'utf8')))

/** Every article under data/corpus/v2/articles, by id. */
export function loadArticles(dir = ARTICLES_DIR): Map<string, BankArticle> {
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.json')).sort()
  return new Map(files.map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as BankArticle).map(a => [a.articleId, a]))
}

/** Tolerant matching: case, dash variants, non-breaking and thin spaces, and runs of whitespace are ignored. */
export const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\s\u00a0\u2009\u202f]+/g, ' ')
export const holds = (needles: string[], text: string) => needles.length > 0 && needles.every(n => normalize(text).includes(normalize(n)))
/** The passages of one article that contain every needle. */
export const passagesWith = (needles: string[], article: BankArticle | undefined) => article ? article.passages.filter(p => holds(needles, p.text)).map(p => p.id) : []
/** Where a fact is established: each source article with the passages that hold all its needles. */
/** A fact holds in a text when all its needles do, or all of one alternative set. */
export const factHolds = (fact: Pick<Fact, 'needles' | 'alt'>, text: string) => holds(fact.needles, text) || (fact.alt ?? []).some(set => holds(set, text))
export const factPassages = (fact: Pick<Fact, 'needles' | 'alt'>, article: BankArticle | undefined) => article ? article.passages.filter(p => factHolds(fact, p.text)).map(p => p.id) : []
export const resolveFact = (fact: Fact, articles: Map<string, BankArticle>) => fact.sources.map(articleId => ({ articleId, passageIds: factPassages(fact, articles.get(articleId)) }))

export type BankProblem = { questionId: string; severity: 'error' | 'warning'; message: string }
/**
 * Scripted check of the bank against the corpus. Errors: a schema rule, an unknown article, or a requested
 * fact whose needles no listed source holds. Warnings: a trap or conflict that no longer matches, which is
 * expected once a corpus fix lands (a corpusSensitive conflict), and otherwise worth a look.
 */
export function verifyBank(bank: Bank, articles = loadArticles()): BankProblem[] {
  const problems: BankProblem[] = []
  const ids = new Set<string>()
  for (const q of bank.questions) {
    const err = (message: string) => problems.push({ questionId: q.id, severity: 'error', message })
    if (ids.has(q.id)) err('duplicate question id')
    ids.add(q.id)
    const factIds = new Set(q.requested.map(f => f.id))
    for (const fact of q.requested) {
      if (!fact.id.startsWith(`${q.id}.`)) err(`fact id ${fact.id} must start with ${q.id}.`)
      if (!fact.sources.length !== !fact.needles.length) err(`${fact.id}: needles and sources must both be empty (unanswerable) or both set`)
      // The frozen need is what judges see: it must not give the answer away.
      if ([...fact.needles, ...(fact.alt ?? []).flat()].some(n => /\d/.test(n) && normalize(fact.need).includes(normalize(n)))) err(`${fact.id}: need text contains an answer needle`)
      for (const source of resolveFact(fact, articles)) {
        if (!articles.has(source.articleId)) err(`${fact.id}: unknown article ${source.articleId}`)
        else if (!source.passageIds.length) err(`${fact.id}: no passage of ${source.articleId} holds ${JSON.stringify(fact.needles)}`)
      }
    }
    for (const [kind, list] of [['trap', q.traps ?? []], ['conflict', q.conflicts ?? []]] as const) for (const item of list) {
      if (!factIds.has(item.factId)) err(`${kind} names unknown fact ${item.factId}`)
      if (!articles.has(item.articleId)) err(`${kind}: unknown article ${item.articleId}`)
      else if (!passagesWith(item.needles, articles.get(item.articleId)).length) problems.push({ questionId: q.id, severity: 'warning', message: `${kind} ${item.articleId} no longer holds ${JSON.stringify(item.needles)}${q.corpusSensitive ? ` (expected after ${q.corpusSensitive})` : ''}` })
    }
    for (const id of [q.expect.buy, q.expect.storyRound1, ...(q.expect.avoid ?? [])]) {
      if (id && !articles.has(id)) err(`expect names unknown article ${id}`)
      else if (id && articles.get(id)!.tier !== 'PAID') err(`expect names ${id}, which is not PAID`)
    }
  }
  return problems
}

/** Bank coverage: how many questions per kind, lane and use case, and the hard cases present. */
export function bankSummary(bank: Bank) {
  const count = (key: (q: Question) => string | undefined) => bank.questions.reduce<Record<string, number>>((acc, q) => { const k = key(q); if (k) acc[k] = (acc[k] ?? 0) + 1; return acc }, {})
  return { questions: bank.questions.length, requestedFacts: bank.questions.reduce((n, q) => n + q.requested.length, 0), byKind: count(q => q.kind), byLane: count(q => q.lane), byUseCase: count(q => q.useCase), hardCases: count(q => q.hardCase), traps: bank.questions.reduce((n, q) => n + (q.traps?.length ?? 0), 0), conflicts: bank.questions.reduce((n, q) => n + (q.conflicts?.length ?? 0), 0) }
}

/** `npm run eval:bank` verifies the bank; `-- --show Q09` prints one question's passages for human review. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bank = loadBank()
  const articles = loadArticles()
  const show = process.argv.indexOf('--show')
  if (show > 0) {
    const q = bank.questions.find(item => item.id === process.argv[show + 1])
    if (!q) throw new Error('Unknown question id')
    console.log(`${q.id} [${q.kind}${q.hardCase ? `/${q.hardCase}` : ''}] ${q.question}${q.answers ? ` · answers ${JSON.stringify(q.answers)}` : ''}`)
    const print = (label: string, articleId: string, needles: string[], alt?: string[][]) => {
      const article = articles.get(articleId)
      for (const id of factPassages({ needles, alt }, article)) console.log(`  ${label} ${articleId} (${article!.tier}) ${id}: ${article!.passages.find(p => p.id === id)!.text}`)
    }
    for (const fact of q.requested) { console.log(`- ${fact.id}: ${fact.text}`); for (const s of fact.sources) print('source', s, fact.needles, fact.alt) }
    for (const t of q.traps ?? []) { console.log(`- trap (${t.kind}) for ${t.factId}: ${t.note}`); print('trap', t.articleId, t.needles) }
    for (const c of q.conflicts ?? []) { console.log(`- conflict for ${c.factId}: ${c.note}`); print('conflict', c.articleId, c.needles) }
  } else {
    const problems = verifyBank(bank, articles)
    console.log(JSON.stringify({ version: bank.version, generator: bank.generator.vendor, ...bankSummary(bank), problems }, null, 2))
    if (problems.some(p => p.severity === 'error')) process.exitCode = 1
  }
}
