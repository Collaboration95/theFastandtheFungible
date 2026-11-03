import { expect, it } from 'vitest'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { assertNoLeaks } from './scenarios/harness.js'
import { resolveCitation } from '../server/agents/citations.js'

it('preserves the strict lexical flag for a public-fact paraphrase observed in live UC3', async () => {
  const corpus = await loadWriterCorpus(undefined, { allowMini: false })
  const free = corpus.articles.find(a => a.articleId === 'or-penang-packaging-output-2026-q3')!
  expect(free.tier).toBe('FREE')
  const passage = free.passages.find(p => p.text.includes('Phase 2 plant was commissioned on 15 August 2026'))!
  expect(passage).toBeDefined()
  const citation = { resourceId: free.articleId, version: free.version, spanId: passage.id }
  expect(resolveCitation(citation, [{ title: free.title, publisher: free.publisherSlug, profileId: 'public', resourceId: free.articleId, version: free.version, body: free.body, spans: free.passages }])).toEqual(passage)
  const observation = (raw: string) => [{ kind: 'public fact', raw, runId: 'public-fact', grants: [] }]
  expect(() => assertNoLeaks(observation(passage.text), corpus)).not.toThrow()
  // Removing one word preserves the public fact but crosses the existing exact 8-word detector.
  // This expected failure documents the finding without weakening or bypassing that detector.
  expect(() => assertNoLeaks(observation('Phase 2 was commissioned on 15 August 2026'), corpus)).toThrow('lf-kestrel-penang-phase2-power-deep-dive')
})
