import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z, ZodError } from 'zod'
import type { FixtureLicense, Source } from '../src/domain.js'

const nonEmpty = z.string().trim().min(1)
const score = z.number().int().min(0).max(100)

export const FixtureLicenseSchema = z.object({
  kind: z.literal('SYNTHETIC_FIXTURE'),
  label: nonEmpty,
  attribution: nonEmpty,
  bodyAccess: z.enum(['OPEN', 'SERVER_ONLY_UNTIL_PURCHASE']),
}).strict()

export const FixtureSpanSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: nonEmpty,
  text: nonEmpty,
}).strict()

export const FixtureArticleSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publisher: nonEmpty,
  siteKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: nonEmpty,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['ARTICLE', 'REPORT', 'DATASET_QUERY']),
  accessTier: z.enum(['OPEN', 'PREMIUM']),
  priceCents: z.number().int().min(0),
  xrpDrops: z.number().int().min(0),
  preview: nonEmpty,
  article: nonEmpty,
  quote: nonEmpty,
  spans: z.array(FixtureSpanSchema).min(1),
  tags: z.array(nonEmpty).min(1),
  entities: z.array(nonEmpty).min(1),
  authority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  originality: z.enum(['ORIGINAL', 'DERIVATIVE']),
  familyId: z.string().regex(/^family-[a-z0-9-]+$/),
  familyLabel: nonEmpty,
  relevance: score,
  gapMatch: score,
  novelty: score,
  trustNote: nonEmpty,
  license: FixtureLicenseSchema,
}).strict().superRefine((article, ctx) => {
  const [year, month, day] = article.date.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    ctx.addIssue({ code: 'custom', path: ['date'], message: 'must be a valid calendar date' })
  }
  const expectedDrops = article.priceCents * 1_000
  if (article.xrpDrops !== expectedDrops) {
    ctx.addIssue({ code: 'custom', path: ['xrpDrops'], message: `must equal priceCents × 1,000 (${expectedDrops})` })
  }
  const expectedBodyAccess = article.accessTier === 'OPEN' ? 'OPEN' : 'SERVER_ONLY_UNTIL_PURCHASE'
  if (article.license.bodyAccess !== expectedBodyAccess) {
    ctx.addIssue({ code: 'custom', path: ['license', 'bodyAccess'], message: `must be ${expectedBodyAccess} for ${article.accessTier} access` })
  }
  const spanIds = new Set<string>()
  for (const [index, span] of article.spans.entries()) {
    if (spanIds.has(span.id)) ctx.addIssue({ code: 'custom', path: ['spans', index, 'id'], message: `duplicate span id ${span.id}` })
    spanIds.add(span.id)
  }
  if (article.accessTier === 'OPEN' && article.spans.some((span) => !span.id.endsWith('-open'))) {
    ctx.addIssue({ code: 'custom', path: ['spans'], message: 'open evidence spans must use an -open suffix' })
  }
})

export type FixtureArticle = z.infer<typeof FixtureArticleSchema>

const catalogSchema = z.array(FixtureArticleSchema).min(1)
const here = dirname(fileURLToPath(import.meta.url))
export const DEFAULT_FIXTURE_CATALOG_PATH = join(here, '..', 'data', 'mock-articles.json')

function formatValidationError(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ')
}

export function validateFixtureCatalog(input: unknown, sourceLabel = 'fixture catalog'): FixtureArticle[] {
  try {
    const articles = catalogSchema.parse(input)
    const ids = new Set<string>()
    const spanIds = new Set<string>()
    for (const [index, article] of articles.entries()) {
      if (ids.has(article.id)) throw new Error(`duplicate article id ${article.id} at index ${index}`)
      ids.add(article.id)
      for (const span of article.spans) {
        if (spanIds.has(span.id)) throw new Error(`duplicate evidence span id ${span.id} at article index ${index}`)
        spanIds.add(span.id)
      }
    }
    return articles
  } catch (error) {
    const detail = error instanceof ZodError ? formatValidationError(error) : (error as Error).message
    throw new Error(`Fixture catalog validation failed (${sourceLabel}): ${detail}`)
  }
}

export function toSource(article: FixtureArticle): Source {
  const { article: _body, quote: _quote, spans: _spans, ...metadata } = article
  return { ...metadata, fixture: true }
}

export function toPublicSpans(article: FixtureArticle): Source['evidenceSpans'] {
  return article.accessTier === 'OPEN' ? article.spans : undefined
}

export function toPurchasedSpans(article: FixtureArticle): NonNullable<Source['evidenceSpans']> {
  return article.spans
}

export type FixtureCatalog = {
  articles: FixtureArticle[]
  sources: Source[]
  byId: Map<string, FixtureArticle>
  siteKeys: string[]
}

export function buildFixtureCatalog(input: unknown, sourceLabel = 'fixture catalog'): FixtureCatalog {
  const articles = validateFixtureCatalog(input, sourceLabel)
  return {
    articles,
    sources: articles.map(toSource),
    byId: new Map(articles.map((article) => [article.id, article])),
    siteKeys: [...new Set(articles.map((article) => article.siteKey))],
  }
}

export async function loadFixtureCatalog(filePath = DEFAULT_FIXTURE_CATALOG_PATH): Promise<FixtureCatalog> {
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(`Fixture catalog could not be read (${filePath}): ${(error as Error).message}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Fixture catalog JSON is invalid (${filePath}): ${(error as Error).message}`)
  }
  return buildFixtureCatalog(parsed, filePath)
}

export function licenseFor(article: FixtureArticle): FixtureLicense {
  return article.license
}
