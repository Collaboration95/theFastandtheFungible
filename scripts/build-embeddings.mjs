// Builds the article embedding cache (#123): `make embeddings`. Needs CLOUDFLARE_API_TOKEN
// (and CLOUDFLARE_ACCOUNT_ID if the token sees several accounts). Only articles whose
// articleId@version + body hash are not cached yet are embedded; stale entries are dropped.
// Optional: --queries <file.json> (array of strings, or { queries: [...] }) also records
// query vectors to tests/fixtures/query-vectors.json for the golden-ranking test.
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { loadWriterCorpus } from '../publisher/corpus.ts'
import { cachedVector, embeddingKey, embeddingText, embedTexts, EMBEDDING_DIMS, EMBEDDING_MODEL, loadEmbeddingCache, normaliseQuery } from '../publisher/search.ts'
import { sha256 } from '../shared/manifest.ts'

const BATCH = 50
const cacheFile = new URL('../data/corpus/v2/embeddings.json', import.meta.url)
const queryFile = new URL('../tests/fixtures/query-vectors.json', import.meta.url)

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
  if (vector) vectors[embeddingKey(article)] = { hash: sha256(article.body), vector }
  else missing.push(article)
}
console.log(`${corpus.articles.length} articles · ${missing.length} to embed with ${EMBEDDING_MODEL}`)
const fresh = await embedAll(missing.map(embeddingText))
missing.forEach((article, i) => { vectors[embeddingKey(article)] = { hash: sha256(article.body), vector: fresh[i] } })
const sorted = Object.fromEntries(Object.entries(vectors).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(cacheFile, `${JSON.stringify({ model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS, vectors: sorted })}\n`)
console.log(`Wrote ${Object.keys(sorted).length} vectors to data/corpus/v2/embeddings.json`)

const flag = process.argv.indexOf('--queries')
if (flag > 0) {
  const input = JSON.parse(readFileSync(process.argv[flag + 1], 'utf8'))
  const queries = [...new Set((Array.isArray(input) ? input : input.queries).map(normaliseQuery))].sort()
  const recorded = await embedAll(queries)
  writeFileSync(queryFile, `${JSON.stringify({ model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS, vectors: Object.fromEntries(queries.map((q, i) => [q, recorded[i]])) })}\n`)
  console.log(`Wrote ${queries.length} query vectors to tests/fixtures/query-vectors.json`)
}
