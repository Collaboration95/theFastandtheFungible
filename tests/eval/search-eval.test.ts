import { expect, it } from 'vitest'
import { CHOSEN_CONFIGS, rank } from '../../eval/run-eval.mjs'
import queries from '../../eval/queries.json'
import vectors from '../../eval/query-vectors.json'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import { buildIndex, loadEmbeddingCache, searchIndex } from '../../publisher/search.js'

it('the chosen eval configs reproduce production ranking and relevance on stored queries', async () => {
  const corpus = await loadWriterCorpus(undefined, { allowMini: false })
  const cache = loadEmbeddingCache()!
  // Exercise two publishers, keyword queries and natural-language paraphrases, in both modes.
  for (const query of [queries['notft-kestrel-tsmc-deal-margins'], queries['fab-floor-kestrel-penang-lead-times']]) {
    const index = await buildIndex(corpus.articles.filter(a => a.publisherSlug === query.publisher), cache)
    for (const term of [query.keyword, query.question]) for (const [, config] of CHOSEN_CONFIGS) {
      const vector = config.mode === 'hybrid' ? (vectors as Record<string, number[]>)[term] : undefined
      const actual = await searchIndex(index, term, 10, vector)
      const evaluated = await rank(query.publisher, term, config)
      expect(evaluated).toEqual(actual.ranked.map(hit => ({ id: hit.articleId, rel: hit.relevance })))
    }
  }
})
