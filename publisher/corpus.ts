import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { z } from 'zod'
import { CorpusResourceSchema, type CorpusResource } from '../shared/contracts/corpus.js'
import { validateWriterCorpus, type WriterCorpus } from '../shared/contracts/writers.js'

const dataDirectory = new URL('../data/', import.meta.url)
const miniCorpusFile = new URL('../tests/fixtures/corpus-mini/corpus.json', import.meta.url)

async function jsonFiles(dir: URL): Promise<unknown[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.json') && e.name !== 'embeddings.json')
    .map(e => `${e.parentPath}/${e.name}`).sort()
  return Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8')) as unknown))
}
const asList = (value: unknown, key: string): unknown[] => Array.isArray(value) ? value
  : value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key]) ? (value as Record<string, unknown[]>)[key]
  : value === undefined ? [] : [value]

/**
 * The v2 writer corpus (#122): one roster file per publisher in data/writers/
 * ({ publisher, writers } or a publisher object with a `writers` array) and the
 * articles anywhere under data/corpus/v2/ (one article, an array, or { articles }).
 * Falls back to the mini corpus while the roster or the articles are missing.
 */
export async function loadWriterCorpus(root = dataDirectory, options: { allowMini?: boolean } = {}): Promise<WriterCorpus> {
  const roster = await jsonFiles(new URL('writers/', root))
  const articles = (await jsonFiles(new URL('corpus/v2/', root))).flatMap(file => asList(file, 'articles'))
    .filter(item => item && typeof item === 'object' && 'articleId' in item)
  if (roster.length && articles.length) {
    const publishers = roster.map(file => {
      const { writers: _w, publisher, ...rest } = file as Record<string, unknown>
      return publisher ?? rest
    })
    const writers = roster.flatMap(file => asList((file as Record<string, unknown>).writers, 'writers'))
    return validateWriterCorpus({ publishers, writers, articles })
  }
  if (options.allowMini === false || !existsSync(miniCorpusFile)) throw new Error('No writer corpus: data/writers/ and data/corpus/v2/ are empty')
  console.warn('Writer corpus not generated yet; serving the mini corpus (SYNTHETIC test fixture)')
  return validateWriterCorpus(JSON.parse(await readFile(miniCorpusFile, 'utf8')), { relaxWordLimits: true })
}

// TODO(#128): everything below is the legacy profile loader behind the /v1 x402-shaped
// flow. It stays as a compat export until the x402 v2 routes replace /v1.

const corpusDirectory = new URL('../data/corpus/', import.meta.url)
const variants = new Set(['open-sufficient', 'contradiction', 'unchanged', 'injection'])
const profiles = new Map([
  ['public-records', 'FREE'], ['supplier-wire', 'PAID'], ['grid-research', 'PAID'],
])
const OverrideSchema = CorpusResourceSchema.partial().extend({ resourceId: z.string().min(1) }).strict()

/** Publisher-only validation: bodies must never be imported by the buyer API. */
export function validateCorpus(input: unknown): CorpusResource[] {
  const resources = z.array(CorpusResourceSchema.strict()).min(1).parse(input)
  const byId = new Map<string, CorpusResource>()
  for (const resource of resources) {
    const fail = (reason: string): never => { throw new Error(`Invalid corpus resource ${resource.resourceId}: ${reason}`) }
    if (byId.has(resource.resourceId)) fail('duplicate resource ID')
    byId.set(resource.resourceId, resource)
    if (profiles.get(resource.profileId) !== resource.tier) fail('unknown profile or inconsistent tier')
    if ((resource.tier === 'FREE') !== (resource.price.amountMinor === 0)) fail('price must match tier')
    if ((resource.tier === 'PAID') !== (resource.wallet !== undefined)) fail('paid resources need a publisher wallet; free ones have none')
    const wordCount = resource.body.trim().split(/\s+/u).length
    if (wordCount < 250 || wordCount > 700) fail('body must contain 250–700 words')
    if (resource.spans.length < 2 || resource.spans.length > 4) fail('expected 2–4 spans')
    const spanIds = new Set<string>()
    for (const span of resource.spans) {
      if (spanIds.has(span.id)) fail('duplicate span ID')
      spanIds.add(span.id)
      if (!resource.body.includes(span.text)) fail(`span ${span.id} is not an exact body substring`)
    }
    if (new Set(resource.facets).size !== resource.facets.length || resource.facets.length === 0) fail('facets must be nonempty and unique')
    if (resource.license.kind !== 'SYNTHETIC') fail('demo resources must be labelled synthetic')
  }

  const familyRoots = new Map<string, string>()
  for (const resource of resources) {
    const visited = new Set<string>()
    let current = resource
    while (current.derivedFrom !== undefined) {
      if (visited.has(current.resourceId)) throw new Error(`Cyclic derivedFrom for ${resource.resourceId}`)
      visited.add(current.resourceId)
      const parent = byId.get(current.derivedFrom)
      if (!parent) throw new Error(`Missing derivedFrom ${current.derivedFrom} for ${current.resourceId}`)
      if (parent.family !== current.family) throw new Error(`Cross-family derivedFrom for ${current.resourceId}`)
      current = parent
    }
    const root = familyRoots.get(resource.family)
    if (root !== undefined && root !== current.resourceId) throw new Error(`Family ${resource.family} has multiple independent roots`)
    familyRoots.set(resource.family, current.resourceId)
  }
  return resources
}

/** Partial, top-level overrides preserve unrelated resources and public metadata. */
export function applyCorpusOverrides(base: CorpusResource[], input: unknown): CorpusResource[] {
  const overrides = z.array(OverrideSchema).parse(input)
  const byId = new Map(base.map(resource => [resource.resourceId, resource]))
  const seen = new Set<string>()
  for (const override of overrides) {
    if (seen.has(override.resourceId)) throw new Error(`Duplicate override ${override.resourceId}`)
    seen.add(override.resourceId)
    const original = byId.get(override.resourceId)
    if (!original) throw new Error(`Unknown override resource ${override.resourceId}`)
    byId.set(override.resourceId, { ...original, ...override })
  }
  return validateCorpus([...byId.values()])
}

export async function loadCorpus(variant = process.env.CORPUS_VARIANT): Promise<CorpusResource[]> {
  if (variant && !variants.has(variant)) throw new Error(`Unknown corpus variant: ${variant}`)
  const base = validateCorpus(JSON.parse(await readFile(new URL('resources.json', corpusDirectory), 'utf8')))
  if (!variant) return base
  const overrides: unknown = JSON.parse(await readFile(new URL(`variants/${variant}.json`, corpusDirectory), 'utf8'))
  return applyCorpusOverrides(base, overrides)
}
