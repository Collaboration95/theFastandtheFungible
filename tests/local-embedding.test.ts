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

it('hosted accepts local CPU inference while still refusing remote embeddings', async () => {
  const { validateHosted } = await import('../server/hosted/bootstrap.js')
  const base = { HOSTED_ORIGIN: 'https://example.test', HOSTED_IP_HMAC_KEY: 'x'.repeat(32), HOSTED_TRUSTED_PROXY: '127.0.0.1', SEARCH_EMBEDDINGS: 'live' }
  expect(() => validateHosted(loadConfig(base))).toThrow('remote embedding')
  expect(() => validateHosted(loadConfig({ ...base, EMBEDDING_PROVIDER: 'local' }))).not.toThrow()
})

it('loads only the configured local cache and rejects a remote embedding space', async () => {
  const { writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { resources } = await import('./helpers/resource-scope.js')
  const { loadEmbeddingCache } = await import('../publisher/search.js')
  const { LOCAL_MODEL, LOCAL_DIMS } = await import('../server/embeddings/local.js')
  const dir = resources().tempDir('local-cache-')
  const env = { EMBEDDING_PROVIDER: 'local', EMBEDDING_MODEL_DIR: dir }
  expect(loadEmbeddingCache(undefined, env)).toBeUndefined()
  writeFileSync(join(dir, 'corpus-vectors.json'), JSON.stringify({model:LOCAL_MODEL,dims:LOCAL_DIMS,vectors:{}}))
  expect(loadEmbeddingCache(undefined, env)?.model).toBe(LOCAL_MODEL)
  writeFileSync(join(dir, 'corpus-vectors.json'), JSON.stringify({model:'remote',dims:768,vectors:{}}))
  expect(loadEmbeddingCache(undefined, env)).toBeUndefined()
})

it('respects an explicit remote publisher provider even when the process opts into local', async () => {
  const { embedTexts, EMBEDDING_DIMS } = await import('../publisher/search.js')
  const vector = Array(EMBEDDING_DIMS).fill(0.1)
  const fetch = vi.fn(async () => new Response(JSON.stringify({ result: { data: [vector] } })))
  vi.stubEnv('EMBEDDING_PROVIDER', 'local')
  try {
    expect(await embedTexts(['query'], { provider: 'cloudflare', token: 'fixture', accountId: 'fixture', fetch })).toEqual([vector])
    expect(fetch).toHaveBeenCalledOnce()
  } finally { vi.unstubAllEnvs() }
})
