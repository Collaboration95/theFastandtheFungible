import { z } from 'zod'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const xrplAddress = z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/)

/**
 * The seller of record (D21). `wallet` and `pubKey` are bound when the publisher
 * starts (#122), never written into roster files. `domain` is display only.
 */
export const PublisherSchema = z.object({
  slug, name: z.string().min(1), kind: z.enum(['masthead', 'independent', 'records']),
  domain: z.string().min(1), wallet: xrplAddress.optional(), pubKey: z.string().regex(/^[0-9A-F]{66}$/i).optional(),
  prices: z.record(z.string(), z.number().int().nonnegative()), licence: z.string().min(1),
  accent: z.string().min(1), heroQuote: z.string().min(1), bio: z.string().min(1), synthetic: z.literal(true),
})
/** For an independent writer, writer = publisher (same slug). */
export const WriterSchema = z.object({ slug, name: z.string().min(1), publisherSlug: slug, bio: z.string().min(1), voice: z.string().min(1) })
export const PassageSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9._-]+$/), heading: z.string().optional(), text: z.string().min(1) })
/** `articleId` is globally unique across publishers: citations bind by resourceId (= articleId) + version only. */
export const ArticleSchema = z.object({
  articleId: z.string().regex(/^[A-Za-z0-9._-]+$/), version: z.string().min(1), publisherSlug: slug, writerSlug: slug,
  title: z.string().min(1), publishedAt: z.string().min(1), tier: z.enum(['FREE', 'PAID']), priceMinor: z.number().int().nonnegative(),
  abstract: z.string().min(1).max(220), tags: z.array(z.string().min(1)), family: z.string().min(1), derivedFrom: z.string().optional(),
  body: z.string().min(1), passages: z.array(PassageSchema).min(4),
})
export type Publisher = z.infer<typeof PublisherSchema>
export type Writer = z.infer<typeof WriterSchema>
export type Passage = z.infer<typeof PassageSchema>
export type Article = z.infer<typeof ArticleSchema>
export type WriterCorpus = { publishers: Publisher[]; writers: Writer[]; articles: Article[] }

export const MIN_WORDS = 600
export const MAX_WORDS = 1400
/** The gate 1 guard: an abstract may not share this many consecutive words with its body. */
export const ABSTRACT_LEAK_WORDS = 8

const tokens = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []
export const countWords = (text: string) => tokens(text).length

/** True when `a` and `b` share a run of `n` or more consecutive words. */
export function sharesRun(a: string, b: string, n = ABSTRACT_LEAK_WORDS): boolean {
  const grams = (t: string[]) => new Set(t.slice(0, Math.max(0, t.length - n + 1)).map((_, i) => t.slice(i, i + n).join(' ')))
  const fromB = grams(tokens(b))
  return [...grams(tokens(a))].some(gram => fromB.has(gram))
}

/** Rule violations for one article; empty when valid. `relaxWordLimits` is for test fixtures only. */
export function articleProblems(article: Article, publisher: Publisher | undefined, options: { relaxWordLimits?: boolean } = {}): string[] {
  const problems: string[] = []
  const words = countWords(article.body)
  if (!options.relaxWordLimits && (words < MIN_WORDS || words > MAX_WORDS)) problems.push(`body has ${words} words, outside ${MIN_WORDS}–${MAX_WORDS}`)
  if (article.passages.length < 4) problems.push('needs at least 4 passages')
  for (const p of article.passages) if (!article.body.includes(p.text)) problems.push(`passage ${p.id} is not an exact substring of the body`)
  if (new Set(article.passages.map(p => p.id)).size !== article.passages.length) problems.push('passage ids must be unique')
  if (!publisher || publisher.slug !== article.publisherSlug) problems.push(`unknown publisher ${article.publisherSlug}`)
  // The wallet is bound at publisher start (#122), so offline validation checks the kind instead.
  if (article.tier === 'PAID' && (publisher?.kind ?? 'records') === 'records') problems.push('a PAID article needs a publisher that is not kind records')
  if (article.tier === 'PAID' && article.priceMinor <= 0) problems.push('a PAID article needs a price above 0')
  if (article.tier === 'FREE' && article.priceMinor !== 0) problems.push('a FREE article has price 0')
  if (sharesRun(article.abstract, article.body)) problems.push(`abstract shares ${ABSTRACT_LEAK_WORDS}+ consecutive words with the body`)
  return problems
}

/** Parses and validates a whole corpus; throws with every problem listed. Replaces publisher/corpus.ts validateCorpus rules. */
export function validateWriterCorpus(input: unknown, options: { relaxWordLimits?: boolean } = {}): WriterCorpus {
  const corpus = z.object({ publishers: z.array(PublisherSchema), writers: z.array(WriterSchema), articles: z.array(ArticleSchema) }).parse(input)
  const publishers = new Map(corpus.publishers.map(p => [p.slug, p]))
  const writers = new Map(corpus.writers.map(w => [w.slug, w]))
  const articles = new Map(corpus.articles.map(a => [a.articleId, a]))
  const problems: string[] = []
  if (publishers.size !== corpus.publishers.length) problems.push('publisher slugs must be unique')
  if (writers.size !== corpus.writers.length) problems.push('writer slugs must be unique')
  if (articles.size !== corpus.articles.length) problems.push('articleId must be globally unique')
  for (const w of corpus.writers) {
    const publisher = publishers.get(w.publisherSlug)
    if (!publisher) problems.push(`writer ${w.slug}: unknown publisher ${w.publisherSlug}`)
    else if (publisher.kind === 'independent' && w.slug !== publisher.slug) problems.push(`writer ${w.slug}: an independent writer is its own publisher`)
  }
  for (const a of corpus.articles) {
    const writer = writers.get(a.writerSlug)
    if (!writer || writer.publisherSlug !== a.publisherSlug) problems.push(`${a.articleId}: writer ${a.writerSlug} does not write for ${a.publisherSlug}`)
    if (a.derivedFrom !== undefined && articles.get(a.derivedFrom)?.family !== a.family) problems.push(`${a.articleId}: derivedFrom must point to an article in family ${a.family}`)
    problems.push(...articleProblems(a, publishers.get(a.publisherSlug), options).map(p => `${a.articleId}: ${p}`))
  }
  if (problems.length) throw new Error(`Invalid writer corpus:\n${problems.join('\n')}`)
  return corpus
}
