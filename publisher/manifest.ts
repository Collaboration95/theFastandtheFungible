// Signed manifests for PAID articles (#125, D4). Node only.
import type { ClaimKind, Manifest } from '../shared/contracts/manifest.js'
import { countWords, type Article } from '../shared/contracts/writers.js'
import { sha256, manifestMessage, CLAIM_KINDS, leafHash, manifestRoot, signManifest } from '../shared/manifest.js'
import { plantedClaims } from './bad-actors.js'
import type { PublisherJournal } from './journal.js'
import type { PublisherKeys } from './registry.js'

type ManifestPublisher = { publisher: { slug: string; wallet?: string; pubKey?: string }; keys?: PublisherKeys }

type Unsigned = Omit<Manifest, 'sig' | 'relevance'>
const kinds = Object.keys(CLAIM_KINDS) as ClaimKind[]

/**
 * Salts are generated once per article version and kept in publisher.db; they leave
 * only with the paid body (#129). The proofs are cached per article version; only
 * `relevance` changes per query, so each search signs a fresh copy.
 */
export function createManifests(journal: PublisherJournal) {
  const cache = new Map<string, Unsigned>()
  const signed = new Map<string, Manifest>()
  const saltsFor = (article: Pick<Article, 'articleId' | 'version' | 'passages'>) => journal.salts(`${article.articleId}@${article.version}`, article.passages.length)

  function proofs(entry: ManifestPublisher, article: Article): Unsigned {
    const key = `${article.articleId}@${article.version}:${sha256(JSON.stringify(article))}`
    const cached = cache.get(key)
    if (cached) return cached
    const salts = saltsFor(article)
    const leaves = article.passages.map((p, i) => leafHash(salts[i], i, p.id, p.text))
    const claims = [
      ...article.passages.flatMap((p, i) => kinds.filter(kind => CLAIM_KINDS[kind](p.text)).map(kind => ({ id: `${p.id}:${kind}`, kind, leaf: leaves[i], ...(article.factMenu?.[p.id] ? { covers: article.factMenu[p.id] } : {}) }))),
      ...plantedClaims(entry.publisher.slug, article.articleId, article.passages.map(p => p.id)).map(c => ({ id: c.id, kind: c.kind, leaf: leaves[c.passageIndex], ...(c.covers ? { covers: c.covers } : {}) })),
    ]
    const unsigned: Unsigned = {
      schemaVersion: 2, publisherSlug: entry.publisher.slug, articleId: article.articleId, version: article.version,
      wallet: entry.publisher.wallet!, pubKey: entry.publisher.pubKey!, priceMinor: article.priceMinor,
      leaves, root: manifestRoot(leaves), claims, wordCount: countWords(article.body), publishedAt: article.publishedAt,
    }
    cache.set(key, unsigned)
    return unsigned
  }

  /** The signed manifest for a PAID hit; undefined for FREE articles or a publisher without keys. */
  function manifestFor(entry: ManifestPublisher, article: Article, relevance: number): Manifest | undefined {
    if (article.tier !== 'PAID' || !entry.keys || !entry.publisher.wallet || !entry.publisher.pubKey) return undefined
    const unsigned = { ...proofs(entry, article), relevance }
    const key = sha256(manifestMessage(unsigned))
    let manifest = signed.get(key)
    if (!manifest) {
      manifest = signManifest(unsigned, entry.keys.privateKey)
      if (signed.size >= 256) signed.delete(signed.keys().next().value!)
      signed.set(key, manifest)
    }
    return structuredClone(manifest)
  }
  return { manifestFor, saltsFor }
}
export type Manifests = ReturnType<typeof createManifests>
