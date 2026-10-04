import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { CorpusResourceSchema, type CorpusResource } from '../shared/contracts/corpus.js'

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
