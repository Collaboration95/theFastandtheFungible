// Record the real fixture engine through its public HTTP/SSE path. No .env or live services.
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
process.env.DOTENV_CONFIG_PATH = '.browser-demo-no-env'
process.env.LLM_PROVIDER = 'fixture'
process.env.DECISION_PROVIDER = 'fixture'
process.env.SETTLEMENT_RAIL = 'simulated'
process.env.SEARCH_EMBEDDINGS = 'off'
process.env.LANGFUSE_ENABLED = '0'
const { createApiApp } = await import('../server/routes.js')
const { createPublisherApp } = await import('../publisher/routes.js')
const { DEMO_QUESTIONS } = await import('../shared/contracts/examples.js')
import type { RunSnapshot } from '../shared/contracts/index.js'
const publisher = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
await publisher.locals.ready; await publisher.locals.writersReady
const pub = publisher.listen(0, '127.0.0.1'); await once(pub, 'listening')
const pubUrl = `http://127.0.0.1:${(pub.address() as { port: number }).port}`
try {
  for (const question of DEMO_QUESTIONS.slice(0, 3)) {
    const api = await createApiApp({ dbPath: ':memory:', publisherUrl: pubUrl, reconcileIntervalMs: 0 })
    const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const get = async (path: string, body?: unknown) => (await fetch(url + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json()
    const abort = new AbortController()
    try {
      const scope = await get('/api/scope', { question: question.text })
      const created = await get('/runs', { question: question.text, budgetMinor: 200, plan: scope.plan, ...(question.id === 'UC2' ? { answers: { angle: 'pricing & margins' } } : {}) })
      const response = await fetch(`${url}/runs/${created.runId}/events`, { signal: abort.signal })
      const reader = response.body!.getReader(), decoder = new TextDecoder()
      let buffer = '', run: RunSnapshot | undefined
      outer: for (;;) {
        const { value, done } = await reader.read()
        if (done) throw new Error('Stream ended before DONE')
        buffer += decoder.decode(value, { stream: true })
        let end: number
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
          if (!frame.startsWith('event: snapshot\n')) continue
          run = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
          if (run?.phase === 'FAILED') throw new Error('Fixture failed')
          if (run?.phase === 'DONE') break outer
        }
      }
      const cards: Record<string, unknown> = {}
      for (const slug of new Set(run!.candidates.map(c => c.publisherSlug).filter(Boolean))) {
        const path = `/w/${slug}/.well-known/agent-publisher.json`
        cards[path] = await (await fetch(pubUrl + path)).json()
      }
      await writeFile(`demo/traces/${question.id}.json`, JSON.stringify({ provenance: { source: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), capturedAt: new Date().toISOString(), transport: 'HTTP SSE snapshot + persisted event trace', mode: 'fixture providers · fictional writers · simulated payments' }, scope, health: await get('/api/health'), reputation: await get('/api/reputation'), cards, run }) + '\n')
      console.log(`${question.id}: ${run!.events.length} events, ${run!.grants.length} grants, ${run!.refundedMinor} refunded`)
    } finally {
      abort.abort(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await api.close()
    }
  }
} finally { pub.closeAllConnections(); await new Promise<void>(r => pub.close(() => r())); publisher.locals.journal.close() }
