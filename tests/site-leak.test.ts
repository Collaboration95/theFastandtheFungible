// Gate 1 (#146): no HTML page shares 8 consecutive words with any paid body.
import { describe, expect, it } from 'vitest'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { sharesRun, ABSTRACT_LEAK_WORDS } from '../shared/contracts/writers.js'
import { articleUrl } from '../shared/contracts/manifest.js'
import { serve } from './site-serve.js'

describe('site leak gate (#146)', async () => {
  const loaded = await loadWriterCorpus()
  const corpus = loaded.articles.some(a => a.tier === 'PAID') ? loaded : miniCorpus
  const paid = corpus.articles.filter(a => a.tier === 'PAID')

  it('the oracle catches a leak', () => {
    expect(sharesRun(paid[0].body, paid[0].body, ABSTRACT_LEAK_WORDS)).toBe(true)
  })
  it('the paid page shows abstract and badge, and no HTML page leaks a paid body', async () => {
    const base = await serve(corpus)
    const paths = [`/w/`, ...corpus.publishers.flatMap(p => [`/w/${p.slug}/`, `/w/${p.slug}/about`, `/w/${p.slug}/contact`]),
      ...corpus.articles.map(a => articleUrl(a.publisherSlug, a.articleId))]
    for (const path of paths) {
      const html = await (await fetch(base + path)).text()
      for (const a of paid) expect(sharesRun(html, a.body), `${path} leaks ${a.articleId}`).toBe(false)
    }
    const html = await (await fetch(base + articleUrl(paid[0].publisherSlug, paid[0].articleId))).text()
    expect(html).toContain(paid[0].abstract.replace(/&/g, '&amp;'))
    expect(html).toContain('402 · agents pay')
    expect(html).not.toContain('id="p-')
  }, 30_000) // Every page of the full corpus: the 5 s default is too tight on a loaded machine.
})
