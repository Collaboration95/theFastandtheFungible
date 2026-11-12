// Real CPU inference and production ranking against the existing 162-query bank.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { buildIndex, searchIndex, embeddingKey, embeddingText, loadEmbeddingCache } from '../publisher/search.js'
import { createLocalEmbedder, LOCAL_MODELS, modelRoot } from '../server/embeddings/local.js'
import { sha256 } from '../shared/manifest.js'
const queries = JSON.parse(readFileSync('eval/queries.json', 'utf8')) as Record<string, { publisher: string; keyword: string; question: string }>
const cloudQueries = JSON.parse(readFileSync('eval/query-vectors.json', 'utf8')) as Record<string, number[]>
const corpus = await loadWriterCorpus(undefined, { allowMini: false })
const bank = Object.entries(queries).flatMap(([id, q]) => [q.keyword, q.question].map(term => ({ id, publisher: q.publisher, term })))
const publishers = [...new Set(corpus.articles.map(a => a.publisherSlug))]
const pct = (xs: number[], p: number) => [...xs].sort((a,b) => a-b)[Math.floor((xs.length-1)*p)]
const bytes = (dir: string): number => readdirSync(dir).reduce((sum, f) => sum + (statSync(join(dir,f)).isDirectory() ? bytes(join(dir,f)) : statSync(join(dir,f)).size), 0)
const model = process.argv[2] as keyof typeof LOCAL_MODELS | undefined
const rssBefore = process.memoryUsage().rss
const t = performance.now()
const embed = model ? createLocalEmbedder(model) : undefined
if (embed) await embed(['warm up'])
const coldMs = performance.now()-t, rssDelta = process.memoryUsage().rss-rssBefore
const vectors: Record<string, { hash: string; vector: number[] }> = {}
if (embed) for (let i=0; i<corpus.articles.length; i+=4) {
  const articles = corpus.articles.slice(i,i+4), vs = await embed(articles.map(embeddingText))
  articles.forEach((a,j) => { vectors[embeddingKey(a)] = {hash:sha256(embeddingText(a)),vector:vs[j]} })
}
const cache = model ? {model,dims:384,vectors} : undefined
const indices = new Map(await Promise.all(publishers.map(async p => [p,await buildIndex(corpus.articles.filter(a=>a.publisherSlug===p), cache)] as const)))
const cloudIndices = model ? undefined : new Map(await Promise.all(publishers.map(async p => [p,await buildIndex(corpus.articles.filter(a=>a.publisherSlug===p),loadEmbeddingCache())] as const)))
let rr=0, r5=0, cloudRr=0, cloudR5=0
const latency: number[] = [], queryVectors: Record<string,number[]> = {}
for (const q of bank) {
  const start=performance.now(), vector = embed ? (await embed([q.term]))[0] : undefined
  latency.push(performance.now()-start)
  if (vector) queryVectors[q.term]=vector
  const r=await searchIndex(indices.get(q.publisher)!,q.term,10,vector), rank=r.ranked.findIndex(h=>h.articleId===q.id)
  rr+=rank<0?0:1/(rank+1); r5+=rank>=0&&rank<5?1:0
  if (cloudIndices) {
    const c=await searchIndex(cloudIndices.get(q.publisher)!,q.term,10,cloudQueries[q.term]), i=c.ranked.findIndex(h=>h.articleId===q.id)
    cloudRr+=i<0?0:1/(i+1); cloudR5+=i>=0&&i<5?1:0
  }
}
const metrics={ model:model??'keyword', n:bank.length, recall5:r5/bank.length, MRR:rr/bank.length, ...(cloudIndices?{cloudflareRecorded:{recall5:cloudR5/bank.length,MRR:cloudRr/bank.length}}:{}),coldMs,rssDelta,embedP50Ms:pct(latency,.5),embedP95Ms:pct(latency,.95), ...(model?{weightBytes:bytes(join(modelRoot(),model))}:{}) }
writeFileSync(`docs/evidence/models/retrieval-${model?.split('/')[1]??'baseline'}.json`,JSON.stringify(metrics,null,2)+'\n')
if (model) {
  writeFileSync(join(modelRoot(),`${model.split('/')[1]}-vectors.json`),JSON.stringify(cache)+'\n')
  writeFileSync(join(modelRoot(),`${model.split('/')[1]}-queries.json`),JSON.stringify(queryVectors)+'\n')
}
console.log(JSON.stringify(metrics,null,2))
