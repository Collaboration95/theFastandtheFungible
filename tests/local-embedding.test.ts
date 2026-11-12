import { expect, it, vi } from 'vitest'
import { createLocalEmbedder } from '../server/embeddings/local.js'
import { loadConfig } from '../server/config.js'
import { buildIndex, searchIndex } from '../publisher/search.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
it('accepts the opt-in local provider without changing defaults', () => {
  expect(loadConfig({ EMBEDDING_PROVIDER: 'local' }).EMBEDDING_PROVIDER).toBe('local')
  expect(loadConfig({}).EMBEDDING_PROVIDER).toBeUndefined()
})
it('fails closed without baked weights and never requests the network', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'))
  vi.stubEnv('EMBEDDING_MODEL_DIR', '/nonexistent/researchagent-models')
  try {
    await expect(createLocalEmbedder()(['test'])).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore(); vi.unstubAllEnvs() }
})
it('does not use a query vector from a different embedding space', async () => {
  const index = await buildIndex(miniCorpus.articles)
  expect((await searchIndex(index, 'Kestrel', 5, [1,2])).mode).toBe('keyword')
})
