import { randomBytes } from 'node:crypto'
import { deriveAddress, deriveKeypair, generateSeed } from 'ripple-keypairs'
import { decode } from 'xrpl'
import { describe, expect, it } from 'vitest'
import { ManifestSchema, SearchHitSchema, countWords, type ClaimKind, type Manifest } from '../shared/contracts/index.js'
import { CLAIM_KINDS, MANIFEST_DOMAIN, canonicalJson, leafHash, manifestMessage, manifestRoot, signManifest, verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'

const article = miniCorpus.articles.find(a => a.tier === 'PAID')!
const keys = deriveKeypair(generateSeed())
const wallet = deriveAddress(keys.publicKey)
const salts = article.passages.map(() => randomBytes(16).toString('hex'))
const leaves = article.passages.map((p, i) => leafHash(salts[i], i, p.id, p.text))
const kinds: ClaimKind[] = ['dated-figure', 'named-source', 'numeric-series']
const build = (claims = kinds.map((kind, i) => ({ id: `c${i + 1}`, kind, leaf: leaves[i] }))): Manifest => signManifest({
  publisherSlug: article.publisherSlug, articleId: article.articleId, version: article.version, wallet, pubKey: keys.publicKey,
  priceMinor: article.priceMinor, leaves, root: manifestRoot(leaves), claims, wordCount: countWords(article.body), publishedAt: article.publishedAt, relevance: 0.7,
}, keys.privateKey)

describe('manifest (#113)', () => {
  it('canonical JSON sorts keys at every depth with no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 'x' }], c: undefined } })).toBe('{"a":{"d":[2,{"y":"x","z":1}]},"b":1}')
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }))
  })

  it('sign → verify OK, and the manifest parses', () => {
    const manifest = build()
    expect(ManifestSchema.parse(manifest)).toEqual(manifest)
    expect(verifyManifestSignature(manifest)).toBe(true)
  })

  it('a tampered field fails', () => {
    const manifest = build()
    expect(verifyManifestSignature({ ...manifest, priceMinor: manifest.priceMinor + 1 })).toBe(false)
    expect(verifyManifestSignature({ ...manifest, relevance: 0.99 })).toBe(false)
  })

  it('a key that does not derive to the wallet fails, even with a valid signature', () => {
    const other = deriveKeypair(generateSeed())
    const forged = signManifest({ ...build(), pubKey: other.publicKey }, other.privateKey)
    expect(verifyManifestSignature(forged)).toBe(false)
  })

  it('a domain-prefixed message cannot decode as an XRPL transaction', () => {
    const message = manifestMessage(build())
    expect(Buffer.from(message, 'hex').toString('utf8').startsWith(MANIFEST_DOMAIN)).toBe(true)
    // XRPL signing payloads start with a hash prefix ('STX\0' single, 'SMT\0' multi).
    expect(message.startsWith('53545800')).toBe(false)
    expect(message.startsWith('534D5400')).toBe(false)
    let decoded: Record<string, unknown> | undefined
    try { decoded = decode(message) as Record<string, unknown> } catch { decoded = undefined }
    expect(decoded?.TransactionType).toBeUndefined()
  })

  it('an honest delivery verifies; one changed passage fails the root', () => {
    const manifest = build()
    expect(verifyDelivery(article.body, article.passages, salts, manifest)).toEqual({ ok: true, rootOk: true, wordCountOk: true, failedClaims: [] })
    const changed = article.passages[3].text.replace('packaging', 'testing')
    const body = article.body.replace(article.passages[3].text, changed)
    const passages = article.passages.map((p, i) => i === 3 ? { ...p, text: changed } : p)
    const result = verifyDelivery(body, passages, salts, manifest)
    expect(result.ok).toBe(false)
    expect(result.rootOk).toBe(false)
  })

  it('a claim whose passage lacks the pattern fails', () => {
    const manifest = build([{ id: 'bad', kind: 'named-source', leaf: leaves[2] }, { id: 'good', kind: 'numeric-series', leaf: leaves[2] }])
    expect(verifyDelivery(article.body, article.passages, salts, manifest)).toMatchObject({ ok: false, rootOk: true, failedClaims: ['bad'] })
  })

  it('claim-kind checkers match their pattern and reject plain prose', () => {
    expect(CLAIM_KINDS['dated-figure']('In Q3 2026 revenue rose 12%.')).toBe(true)
    expect(CLAIM_KINDS['dated-figure']('Shipments slip into 2027.')).toBe(false)
    expect(CLAIM_KINDS['named-source']('"Supply is tight," said Dana Okafor.')).toBe(true)
    expect(CLAIM_KINDS['named-source']('according to some people, it is fine.')).toBe(false)
    expect(CLAIM_KINDS['numeric-series']('Margins hit 52%, capex $1.2 billion and volume 15%.')).toBe(true)
    expect(CLAIM_KINDS['numeric-series']('Margins hit 52% this year.')).toBe(false)
  })
})

describe('search hit (#113)', () => {
  const free = miniCorpus.articles.find(a => a.tier === 'FREE')!
  const hit = (a: typeof article) => ({ publisherSlug: a.publisherSlug, writerSlug: a.writerSlug, articleId: a.articleId, version: a.version, url: `/w/${a.publisherSlug}/articles/${a.articleId}`, title: a.title, abstract: a.abstract, tags: a.tags, tier: a.tier, priceMinor: a.priceMinor, relevance: 0.5, publishedAt: a.publishedAt, family: a.family, searchMode: 'hybrid' })

  it('a PAID hit carries a manifest and never body or passages', () => {
    expect(SearchHitSchema.safeParse({ ...hit(article), manifest: build() }).success).toBe(true)
    expect(SearchHitSchema.safeParse(hit(article)).success).toBe(false)
    expect(SearchHitSchema.safeParse({ ...hit(article), manifest: build(), body: article.body }).success).toBe(false)
    expect(SearchHitSchema.safeParse({ ...hit(article), manifest: build(), passages: article.passages }).success).toBe(false)
  })

  it('a FREE hit has no passages inside the hit, and the url is root-relative', () => {
    expect(SearchHitSchema.safeParse(hit(free)).success).toBe(true)
    expect(SearchHitSchema.safeParse({ ...hit(free), passages: free.passages }).success).toBe(false)
    expect(SearchHitSchema.safeParse({ ...hit(free), url: `https://x.example/w/${free.publisherSlug}/articles/${free.articleId}` }).success).toBe(false)
  })
})
