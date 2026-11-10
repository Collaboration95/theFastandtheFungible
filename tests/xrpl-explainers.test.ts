import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { countWords } from '../shared/contracts/writers.js'
import { toSearchHit } from '../publisher/routes.js'
import { createManifests } from '../publisher/manifest.js'
import { PublisherJournal } from '../publisher/journal.js'
import { simulatedKeys } from '../publisher/registry.js'
import { verifyManifestSignature, verifyDelivery } from '../shared/manifest.js'

it('publishes sourced explainers through the ordinary signed delivery and public metadata boundary', async () => {
 const corpus = await loadWriterCorpus()
 const publisher = corpus.publishers.find(p => p.slug === 'team-xrpl-explainers')!
 expect(publisher.synthetic).toBe(false)
 expect(publisher.verification?.status).toBe('unverified')
 expect(publisher.bio).toBe('team-authored explainer · sources cited · not an independent writer · Testnet')
 const articles = corpus.articles.filter(a => a.publisherSlug === publisher.slug)
 expect(articles).toHaveLength(147)
 const journal = new PublisherJournal(':memory:')
 try {
  const manifests = createManifests(journal), keys = simulatedKeys(publisher.slug)
  for (const article of articles) {
   expect(countWords(article.body)).toBeGreaterThanOrEqual(150)
   expect(countWords(article.body)).toBeLessThanOrEqual(3000)
   expect(article.sources!.length).toBeGreaterThan(0)
   for (const source of article.sources!) {
    expect(source.accessedAt).toBe(article.publishedAt)
    expect(article.body).toContain('[' + String(article.sources!.indexOf(source) + 1) + ']')
   }
   const manifest = manifests.manifestFor({ publisher: { ...publisher, wallet: keys.wallet, pubKey: keys.publicKey }, keys }, article, 0)!
   expect(verifyManifestSignature(manifest)).toBe(true)
   if (article.publishedAt === '2026-11-10') expect(manifest.claims.some(c => c.id === 'p1:named-source' && c.covers)).toBe(true)
   expect(verifyDelivery(article.body, article.passages, manifests.saltsFor(article), manifest).ok).toBe(true)
   const hit = toSearchHit(article, 0, 'keyword', manifest)
   expect(hit.sources).toEqual(article.sources)
   expect(hit).not.toHaveProperty('body')
   expect(hit).not.toHaveProperty('passages')
  }
 } finally { journal.close() }
})

// Coverage is pinned to public source indexes, never a judge question bank.
it('covers the captured transaction and account-flag indexes exactly once', async () => {
 const indexes = JSON.parse(readFileSync('docs/evidence/c3-index-corpus/indexes.json', 'utf8'))
 const coverage = JSON.parse(readFileSync('docs/evidence/c3-index-corpus/coverage.json', 'utf8')) as { category: string; item: string; articleId: string; existing?: boolean }[]
 const corpus = await loadWriterCorpus()
 expect(indexes.transactionItems).toHaveLength(79)
 expect(coverage.filter(c => c.category === 'transaction').map(c => c.item).sort()).toEqual([...indexes.transactionItems].sort())
 expect(coverage.filter(c => c.category === 'account flag').map(c => c.item).sort()).toEqual([...new Set([...indexes.accountSetOptions.map((f: string) => f.slice(3)), ...indexes.accountRootFlags.map((f: string) => f.slice(3).replace(/^RequireDestTag$/, 'RequireDest'))])].sort())
 expect(new Set(coverage.map(c => c.articleId)).size).toBe(coverage.length)
 for (const entry of coverage) {
  const article = corpus.articles.find(a => a.articleId === entry.articleId)!
  expect(article, entry.item).toBeDefined()
  expect(article.priceMinor).toBe(40)
  if (!entry.existing) {
   expect(countWords(article.body)).toBeLessThanOrEqual(300)
   expect(article.body).toContain('Author interpretation:')
   expect(article.body).toContain('Sources accessed 10 November 2026.')
   expect(article.factMenu?.p1, entry.item).toBeDefined()
  }
 }
})
