import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { FactCoverSchema } from '../../shared/contracts/manifest.js'
import { authorFactMenu } from './fact-menu.js'
import { sha256 } from '../../shared/manifest.js'
import { countWords, sharesRun, validateWriterCorpus, type Article, type WriterCorpus } from '../../shared/contracts/writers.js'

const examples: Record<string, string> = { title: 'My evidence note', abstract: 'A summary of the topic, without the paid answer.', tier: 'PAID', price: '0.10', tags: 'energy, methodology', synthetic: 'false', questions: 'What changed?', entity: 'electricity', measure: 'share' }
const Meta = z.object({
  title: z.string().min(1).max(160),
  abstract: z.string().min(1).max(220),
  tier: z.enum(['FREE', 'PAID']),
  price: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  tags: z.string().default(''),
  synthetic: z.enum(['true', 'false']).default('false'),
  // Public questions/topics only. Never put the answer in a heading or this field.
  questions: z.string().default(''),
  entity: FactCoverSchema.shape.entity.optional(),
  measure: FactCoverSchema.shape.measure.optional(),
}).strict()

/** Deliberately small front matter: scalar key: value lines, no YAML execution/coercion. */
export function parseMarkdown(text: string, slug: string, id: string, publishedAt = new Date().toISOString(), options: { relax?: boolean; validateBody?: boolean } = {}): Article & { synthetic: boolean } {
  const match = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/)
  if (!match) throw new Error('front matter: expected --- delimiters, fields, then Markdown body. Example: run init my-notes for two complete notes.')
  const raw: Record<string, string> = {}
  const problems: string[] = []
  for (const line of match[1].split('\n').filter(l => l.trim() && !l.startsWith('#'))) {
    const pair = line.match(/^([a-z]+):\s*(.*?)\s*$/)
    if (!pair || Object.hasOwn(raw, pair[1])) { problems.push(`${pair?.[1] ?? 'front matter'}: use one unique key: value per line. Example: title: My evidence note`); continue }
    raw[pair[1]] = pair[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
  }
  const result = Meta.safeParse(raw)
  if (!result.success) problems.push(...result.error.issues.map(i => `${i.path.join('.') || 'front matter'}: ${i.message}. Example: ${String(i.path[0])}: ${examples[String(i.path[0])] ?? 'use only documented fields'}`))
  const priceMinor = Math.round(Number(raw.price) * 100)
  if (raw.price && /^\d+(?:\.\d{1,2})?$/.test(raw.price)) {
    if (!Number.isSafeInteger(priceMinor)) problems.push('price: price is too large. Example: price: 0.10')
    if (raw.tier === 'PAID' && priceMinor <= 0) problems.push('price: a PAID article needs a price above 0. Example: price: 0.10')
    if (raw.tier === 'FREE' && priceMinor !== 0) problems.push('price: a FREE article has price 0. Example: price: 0')
  }
  const words = countWords(match[2])
  const real = raw.synthetic !== 'true'
  if (options.validateBody && !(real && options.relax) && (words < (real ? 150 : 600) || words > (real ? 3000 : 1400))) problems.push(`body: ${words} words; ${real ? 'real-writer limit 150–3,000' : 'fictional corpus limit 600–1,400'}. Example: four paragraphs totalling ${real ? 300 : 900} words.${real ? ' Use --relax to waive only this length check.' : ''}`)
  if (options.validateBody && match[2].trim().split(/\n\s*\n/).length < 4) problems.push('body.passages: needs at least 4 paragraphs. Example: separate paragraphs with a blank line.')
  const body = match[2].trim()
  const blocks = body.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  const passages = blocks.map((text, i) => ({ id: `p${i + 1}`, text }))
  // Headings and explicitly authored topics feed the public fact menu; never copy body sentences.
  const headings = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1])
  const tags = [...new Set([...(raw.tags ?? '').split(','), ...(raw.questions ?? '').split('|'), ...headings].map(t => t.trim()).filter(Boolean))]
  if (tags.some(t => t.length > 160) || tags.length > 32) problems.push('tags/questions/headings: use at most 32 public topics, each at most 160 characters. Example: tags: energy, methodology')
  if (raw.tier === 'PAID' && sharesRun(JSON.stringify({ title: raw.title, abstract: raw.abstract, tags }), body)) problems.push('title/abstract/tags/questions/headings: public fields share 8+ consecutive words with premium text. Example: tags: methodology; use a separate abstract.')
  if (problems.length || !result.success) throw new Error(problems.join('\n'))
  const meta = result.data
  const article = {
    articleId: `${slug}-${id}`, version: sha256(JSON.stringify({ body, meta, publishedAt })).slice(0, 16),
    publisherSlug: slug, writerSlug: slug, title: meta.title,
    publishedAt, tier: meta.tier, priceMinor,
    abstract: meta.abstract, tags, family: `${slug}-${id}`, body, passages,
    factMenu: authorFactMenu({ tier: meta.tier, passages }, tags, { entity: meta.entity, measure: meta.measure }),
    synthetic: meta.synthetic === 'true',
  }
  // Public headings are intentionally repeated in the body. Gate 1 still forbids an 8-word run.
  if (article.tier === 'PAID' && sharesRun(JSON.stringify({ title: article.title, abstract: article.abstract, tags, factMenu: article.factMenu }), body)) {
    throw new Error('title/abstract/tags/questions/entity/measure: public fields share 8+ consecutive words with premium text. Example: tags: methodology; use a separate abstract.')
  }
  return article
}

export async function markdownCorpus(folder: string, slug: string, name: string, options: { relax?: boolean } = {}): Promise<WriterCorpus> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) throw new Error('Writer slug: use at most 64 lowercase letters, numbers and hyphens. Example: --slug my-notes')
  const entries = await readdir(folder, { withFileTypes: true })
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name))
  if (!files.length) throw new Error('folder: no .md articles found. Example: init my-notes, then publish my-notes --testnet')
  const results = await Promise.allSettled(files.map(async file => {
    const id = basename(file.name, '.md')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`filename: ${file.name} must use lowercase letters, numbers and hyphens. Example: my-note.md`)
    try { return parseMarkdown(await readFile(join(folder, file.name), 'utf8'), slug, id, (await stat(join(folder, file.name))).mtime.toISOString(), { ...options, validateBody: true }) }
    catch (error) { throw new Error(`${file.name}: ${error instanceof Error ? error.message : 'Invalid Markdown'}`, { cause: error }) }
  }))
  const errors = results.filter(r => r.status === 'rejected').map(r => String(r.reason.message))
  if (errors.length) throw new Error(errors.join('\n'))
  const articles = results.map(r => (r as PromiseFulfilledResult<Article & { synthetic: boolean }>).value)
  const synthetic = articles.every(a => a.synthetic)
  if (articles.some(a => a.synthetic !== synthetic)) throw new Error('synthetic: use the same label across all articles in a writer folder. Example: synthetic: false for your own notes.')
  return validateWriterCorpus({
    publishers: [{ slug, name, kind: 'independent', domain: 'localhost', prices: Object.fromEntries(articles.map(a => [a.articleId, a.priceMinor])),
      licence: 'Author supplied; attribution required', accent: '#64748b', heroQuote: 'Expertise for agents',
      bio: synthetic ? 'SYNTHETIC starter writer' : options.relax ? 'Locally published writer · real-writer length waiver (--relax)' : 'Locally published writer', synthetic, ...(!synthetic && options.relax ? { realWordLimitsRelaxed: true } : {}), verification: 'unverified writer' }],
    writers: [{ slug, publisherSlug: slug, name, bio: 'Unverified local writer', voice: 'Author supplied' }], articles,
  }, { realWriter: !synthetic, relaxWordLimits: !synthetic && options.relax })
}
