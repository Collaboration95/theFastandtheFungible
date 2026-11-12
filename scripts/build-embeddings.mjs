// Builds the article embedding cache (#123): `make embeddings`. Needs CLOUDFLARE_API_TOKEN
// (and CLOUDFLARE_ACCOUNT_ID if the token sees several accounts). Only articles whose
// articleId@version + embedded-text hash (title, abstract, tags, body head) are not cached yet are embedded; stale entries are dropped.
// Optional: --queries <file.json> (array of strings, or { queries: [...] }) also records
// query vectors to tests/fixtures/query-vectors.json for the golden-ranking test.
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { loadWriterCorpus } from '../publisher/corpus.ts'
import { cachedVector, embeddingKey, embeddingText, embedTexts, EMBEDDING_DIMS, EMBEDDING_MODEL, loadEmbeddingCache, normaliseQuery } from '../publisher/search.ts'
import { LOCAL_MODEL, LOCAL_DIMS, localCacheFile } from '../server/embeddings/local.ts'
import { sha256 } from '../shared/manifest.ts'

const local = process.env.EMBEDDING_PROVIDER === 'local'
const model = local ? LOCAL_MODEL : EMBEDDING_MODEL
const dims = local ? LOCAL_DIMS : EMBEDDING_DIMS
const BATCH = local ? 4 : 50
const cacheFile = local ? localCacheFile() : new URL('../data/corpus/v2/embeddings.json', import.meta.url)
const queryFile = local ? new URL('../data/models/query-vectors.json', import.meta.url) : new URL('../tests/fixtures/query-vectors.json', import.meta.url)

async function embedAll(texts) {
  const out = []
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...await embedTexts(texts.slice(i, i + BATCH)))
    console.log(`  embedded ${Math.min(i + BATCH, texts.length)}/${texts.length}`)
  }
  return out
}

const corpus = await loadWriterCorpus(undefined, { allowMini: false })
const previous = loadEmbeddingCache(cacheFile)
const vectors = {}
const missing = []
for (const article of corpus.articles) {
  const vector = cachedVector(previous, article)
  if (vector) vectors[embeddingKey(article)] = { hash: sha256(embeddingText(article)), vector }
  else missing.push(article)
}
console.log(`${corpus.articles.length} articles · ${missing.length} to embed with ${model}`)
const fresh = await embedAll(missing.map(embeddingText))
missing.forEach((article, i) => { vectors[embeddingKey(article)] = { hash: sha256(embeddingText(article)), vector: fresh[i] } })
const sorted = Object.fromEntries(Object.entries(vectors).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(cacheFile, `${JSON.stringify({ model, dims, vectors: sorted })}\n`)
console.log(`Wrote ${Object.keys(sorted).length} vectors to ${cacheFile}`)

const flag = process.argv.indexOf('--queries')
if (flag > 0) {
  const input = JSON.parse(readFileSync(process.argv[flag + 1], 'utf8'))
  const queries = [...new Set((Array.isArray(input) ? input : input.queries).map(normaliseQuery))].sort()
  const recorded = await embedAll(queries)
  writeFileSync(queryFile, `${JSON.stringify({ model, dims, vectors: Object.fromEntries(queries.map((q, i) => [q, recorded[i]])) })}\n`)
  console.log(`Wrote ${queries.length} query vectors to tests/fixtures/query-vectors.json`)
}
