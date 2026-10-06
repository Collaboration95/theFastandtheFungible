// Every publisher in one process (#122): roster, keys and one search index each.
import { createHash } from 'node:crypto'
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs'
import type { Rail } from '../shared/contracts/publisher.js'
import type { Article, Publisher, Writer, WriterCorpus } from '../shared/contracts/writers.js'
import { buildIndex, type EmbeddingCache, type PublisherIndex } from './search.js'

export type PublisherKeys = { wallet: string; publicKey: string; privateKey: string; simulated: boolean }
export type PublisherEntry = { publisher: Publisher; writers: Writer[]; articles: Article[]; index: PublisherIndex; keys?: PublisherKeys }

/** Public, test-only salt: these keys are SIMULATED and never accepted on the Testnet rail. */
const SIMULATED_SALT = 'researchagent-simulated-publisher-key-v1:'
export const SIMULATED_KEY_LABEL = 'SIMULATED publisher key · test only'
export const seedEnvName = (slug: string) => `XRPL_PUBLISHER_${slug.toUpperCase().replace(/-/g, '_')}_SEED`

const keysFromSeed = (seed: string, simulated: boolean): PublisherKeys => {
  const { publicKey, privateKey } = deriveKeypair(seed)
  return { wallet: deriveAddress(publicKey), publicKey, privateKey, simulated }
}
export const simulatedSeed = (slug: string) => generateSeed({ entropy: createHash('sha256').update(SIMULATED_SALT + slug).digest().subarray(0, 16), algorithm: 'ed25519' })
export const simulatedKeys = (slug: string) => keysFromSeed(simulatedSeed(slug), true)

/**
 * Simulated rail: deterministic test keys. Testnet rail: the seed from
 * XRPL_PUBLISHER_<SLUG>_SEED, refused when missing or equal to the simulated key.
 */
export function publisherKeys(slug: string, rail: Rail, env: NodeJS.ProcessEnv = process.env): PublisherKeys {
  if (rail === 'simulated') return simulatedKeys(slug)
  const seed = env[seedEnvName(slug)]
  if (!seed) throw new Error(`${seedEnvName(slug)} is required on the xrpl-testnet rail`)
  const keys = keysFromSeed(seed, false)
  if (keys.wallet === simulatedKeys(slug).wallet) throw new Error(`${seedEnvName(slug)} is the simulated test key; refused on the xrpl-testnet rail`)
  return keys
}

/** Publishers with at least one PAID article get keys; their wallet and pubKey are bound here. */
export async function buildRegistry(corpus: WriterCorpus, options: { rail: Rail; env?: NodeJS.ProcessEnv; embeddings?: EmbeddingCache }): Promise<Map<string, PublisherEntry>> {
  const entries = await Promise.all(corpus.publishers.map(async (publisher): Promise<PublisherEntry> => {
    const articles = corpus.articles.filter(a => a.publisherSlug === publisher.slug)
    const keys = articles.some(a => a.tier === 'PAID') ? publisherKeys(publisher.slug, options.rail, options.env) : undefined
    return {
      publisher: keys ? { ...publisher, wallet: keys.wallet, pubKey: keys.publicKey } : publisher,
      writers: corpus.writers.filter(w => w.publisherSlug === publisher.slug),
      articles, keys, index: await buildIndex(articles, options.embeddings),
    }
  }))
  return new Map(entries.map(entry => [entry.publisher.slug, entry]))
}
