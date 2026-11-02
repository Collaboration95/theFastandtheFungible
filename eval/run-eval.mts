// Search tuning study: within-publisher ranking (MRR, R@1) and cross-publisher separability of relevance (AUC).
import fs from 'fs'; import path from 'path'
import { pathToFileURL } from 'node:url'
import { create, insertMultiple, search } from '@orama/orama'
import { cosine as cos, cosineRelevance, keywordRelevance, SEARCH_TUNING } from '../publisher/search.js'
const root = 'data/corpus/v2/articles'
const cache = JSON.parse(fs.readFileSync('data/corpus/v2/embeddings.json', 'utf8'))
const qv: Record<string, number[]> = JSON.parse(fs.readFileSync('eval/query-vectors.json', 'utf8'))
const Q = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8'))
const pubs: Record<string, any[]> = {}
for (const p of fs.readdirSync(root)) pubs[p] = fs.readdirSync(path.join(root, p)).map(f => JSON.parse(fs.readFileSync(path.join(root, p, f), 'utf8')))
const vec = (a: any) => cache.vectors[`${a.articleId}@${a.version}`]?.vector
export type Cfg = { mode: 'fulltext' | 'hybrid' | 'vector'; boost: any; bm25?: { k: number; b: number; d: number }; w?: number; sim?: number; body?: boolean; rel?: 'top' | 'cos' | 'sat' }
export const CHOSEN_CONFIGS: [string, Cfg][] = [
  ['production: hybrid, absolute cosine relevance', { mode: 'hybrid', boost: SEARCH_TUNING.boost, rel: 'cos' }],
  ['production: keyword fallback, absolute BM25 relevance', { mode: 'fulltext', boost: SEARCH_TUNING.boost, rel: 'sat' }],
]
const dbs: Record<string, any> = {}
async function db(p: string) { if (dbs[p]) return dbs[p]
  const d = create({ schema: { articleId: 'string', title: 'string', abstract: 'string', tags: 'string[]', body: 'string', embedding: 'vector[768]' } })
  await insertMultiple(d, pubs[p].map(a => ({ articleId: a.articleId, title: a.title, abstract: a.abstract, tags: a.tags, body: a.body, embedding: vec(a) })))
  return dbs[p] = d }
export async function rank(p: string, term: string, c: Cfg) {
  const props = c.body === false ? ['title', 'abstract', 'tags'] : ['title', 'abstract', 'tags', 'body']
  const base: any = { term, limit: 10, properties: props, boost: c.boost, threshold: SEARCH_TUNING.threshold, ...(c.bm25 ? { relevance: c.bm25 } : {}) }
  const r = c.mode === 'fulltext' ? await search(await db(p), { ...base, mode: 'fulltext' })
    : await search(await db(p), { ...base, mode: c.mode, vector: { value: qv[term], property: 'embedding' }, similarity: c.sim ?? SEARCH_TUNING.similarity, ...(c.mode === 'hybrid' ? { hybridWeights: c.w === undefined ? SEARCH_TUNING.hybridWeights : { text: 1 - c.w, vector: c.w } } : {}) })
  const top = Math.max(0, ...r.hits.map((h: any) => h.score))
  return r.hits.map((h: any) => { const a = pubs[p].find(x => x.articleId === h.document.articleId)
    const rel = c.rel === 'cos' ? cosineRelevance(cos(qv[term], vec(a))) : c.rel === 'sat' ? keywordRelevance(h.score) : top ? h.score / top : 0
    return { id: h.document.articleId, rel } })
}
function auc(pos: number[], neg: number[]) { let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0; return s / (pos.length * neg.length || 1) }
export async function evalCfg(c: Cfg) {
  let rr = 0, r1 = 0, n = 0; const pos: number[] = [], neg: number[] = []
  for (const [id, q] of Object.entries<any>(Q)) for (const term of [q.keyword, q.question]) {
    const own = await rank(q.publisher, term, c); const i = own.findIndex(h => h.id === id)
    rr += i >= 0 ? 1 / (i + 1) : 0; r1 += i === 0 ? 1 : 0; n++
    if (i >= 0) pos.push(own[i].rel)
    // other publishers' top hit for the same query, skipping a rewrite family of the target
    const fam = pubs[q.publisher].find(a => a.articleId === id)?.family
    for (const p of Object.keys(pubs)) if (p !== q.publisher) { const h = (await rank(p, term, c))[0]; const a = h && pubs[p].find(x => x.articleId === h.id); if (h && (!fam || a?.family !== fam)) neg.push(h.rel) }
  }
  return { MRR: +(rr / n).toFixed(3), R1: +(r1 / n).toFixed(3), AUC: +auc(pos, neg).toFixed(3) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const B = { title: 3, abstract: 2, tags: 2, body: 1 }
  const grid: [string, Cfg][] = process.argv[2] === '--chosen' ? CHOSEN_CONFIGS : JSON.parse(process.argv[2] ?? 'null') ?? [
    ...CHOSEN_CONFIGS,
    ['historical starting point: hybrid w.5 sim.3 boosts 3/2/2/1, top-normalised', { mode: 'hybrid', boost: B, w: 0.5, sim: 0.3, rel: 'top' }],
    ['keyword only, top-normalised', { mode: 'fulltext', boost: B, rel: 'top' }],
    ['vector only', { mode: 'vector', boost: B, sim: 0.3, rel: 'top' }],
  ]
  for (const [name, c] of grid) console.log(JSON.stringify(await evalCfg(c)), name)
  if (process.env.DIST) { // raw score distributions for the chosen config: own target vs other publishers' top hit
    const c: any = JSON.parse(process.env.DIST); const own: number[] = [], oth: number[] = []
    for (const [id, q] of Object.entries<any>(Q)) for (const term of [q.keyword, q.question]) {
      const raw = async (p: string) => { const r = await search(await db(p), { term, limit: 10, properties: ['title','abstract','tags','body'], boost: c.boost, threshold: SEARCH_TUNING.threshold, mode: 'fulltext' } as any); return r.hits.map((h: any) => ({ id: h.document.articleId, s: h.score, c: cos(qv[term], vec(pubs[p].find(x => x.articleId === h.document.articleId))) })) }
      const o = (await raw(q.publisher)).find(h => h.id === id); if (o) own.push(c.metric === 'cos' ? o.c : o.s)
      for (const p of Object.keys(pubs)) if (p !== q.publisher) { const h = (await raw(p))[0]; if (h) oth.push(c.metric === 'cos' ? h.c : h.s) }
    }
    const pct = (a: number[], p: number) => a.sort((x, y) => x - y)[Math.floor(p * (a.length - 1))].toFixed(3)
    console.log(c.metric, 'own p10/p50/p90', pct(own, .1), pct(own, .5), pct(own, .9), '| others p50/p90/p99', pct(oth, .5), pct(oth, .9), pct(oth, .99))
  }
}
