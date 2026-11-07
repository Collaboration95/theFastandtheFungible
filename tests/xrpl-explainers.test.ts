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
 expect(articles).toHaveLength(22)
 const journal = new PublisherJournal(':memory:')
 try {
  const manifests = createManifests(journal), keys = simulatedKeys(publisher.slug)
  for (const article of articles) {
   expect(countWords(article.body)).toBeGreaterThanOrEqual(150)
   expect(countWords(article.body)).toBeLessThanOrEqual(3000)
   expect(article.sources!.length).toBeGreaterThan(0)
   for (const source of article.sources!) {
    expect(source.accessedAt).toBe('2026-11-07')
    expect(article.body).toContain('[' + String(article.sources!.indexOf(source) + 1) + ']')
   }
   const manifest = manifests.manifestFor({ publisher: { ...publisher, wallet: keys.wallet, pubKey: keys.publicKey }, keys }, article, 0)!
   expect(verifyManifestSignature(manifest)).toBe(true)
   expect(verifyDelivery(article.body, article.passages, manifests.saltsFor(article), manifest).ok).toBe(true)
   const hit = toSearchHit(article, 0, 'keyword', manifest)
   expect(hit.sources).toEqual(article.sources)
   expect(hit).not.toHaveProperty('body')
   expect(hit).not.toHaveProperty('passages')
  }
 } finally { journal.close() }
})
