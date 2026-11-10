// Development-only retrieval measurement for the C5 lane: does the candidate pool (what the
// fixture run hands to the decision step) contain an article that holds the bank's gold phrase?
// Runs the real publisher and the real `retrieve` on an ephemeral port with keyword search only
// (SEARCH_EMBEDDINGS=off). It never runs the decision, payment or answer steps, so it is cheap.
//
// Banks are the USED development banks only (v1, v3, v3-dev, v5 and their negatives); v5 was
// run once as the blind held-out bank and is development data from here on. Every number is
// labelled development: nothing here is a held-out claim.
//
//   npx tsx scripts/c5-recall.ts <out.json>
import { once } from 'node:events'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { PublisherClient } from '../server/publisher-client.js'
import { retrieve } from '../server/agents/research.js'
import { fixturePlan } from '../server/agents/scope.js'

const out = resolve(process.argv[2] ?? 'c5-recall.json')
const banks = ['v1', 'v3', 'v3-dev', 'v3-negatives', 'v5', 'v5-negatives'] as const
type Q = { id: string; question: string; gold?: string; expect?: string }
const norm = (text: string) => text.toLowerCase().replace(/\s+/gu, ' ').trim()

const corpus = await loadWriterCorpus()
const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
await app.locals.ready; await app.locals.writersReady
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
const report: Record<string, unknown> = {}
try {
  for (const bank of banks) {
    const questions: Q[] = JSON.parse(readFileSync(`eval/questions/judge-xrpl.${bank}.json`, 'utf8')).questions
    const rows = []
    for (const q of questions) {
      const start = performance.now()
      const result = await retrieve(client, q.question, fixturePlan(q.question, {}))
      const ms = Math.round(performance.now() - start)
      const ids = result.candidates.map(c => c.resourceId)
      const holders = q.gold ? corpus.articles.filter(a => norm(a.body).includes(norm(q.gold!))).map(a => a.articleId) : []
      const paidCandidates = result.candidates.filter(c => c.tier === 'PAID').length
      rows.push({ id: q.id, gold: q.gold, candidates: ids.length, paidCandidates, holders: holders.length,
        found: holders.filter(id => ids.includes(id)), hit: holders.some(id => ids.includes(id)), ms,
        ...(q.expect ? { expect: q.expect } : {}) })
    }
    const withGold = rows.filter(r => r.gold)
    const answerable = withGold.filter(r => r.holders > 0)
    report[bank] = {
      N: rows.length, withGold: withGold.length, answerable: answerable.length,
      recall: answerable.filter(r => r.hit).length,
      meanCandidates: Number((rows.reduce((n, r) => n + r.candidates, 0) / rows.length).toFixed(2)),
      maxMs: Math.max(...rows.map(r => r.ms)), meanMs: Math.round(rows.reduce((n, r) => n + r.ms, 0) / rows.length),
      misses: answerable.filter(r => !r.hit).map(r => r.id), rows,
    }
    const s = report[bank] as { recall: number; answerable: number; withGold: number; meanCandidates: number; meanMs: number; misses: string[] }
    console.log(bank.padEnd(14), `recall@candidates ${s.recall}/${s.answerable} (gold ${s.withGold})`, `mean candidates ${s.meanCandidates}`, `mean ${s.meanMs} ms`, s.misses.length ? `miss ${s.misses.join(' ')}` : '')
  }
} finally {
  server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); app.locals.journal.close()
}
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(report, null, 2))
