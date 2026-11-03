import { expect, it } from 'vitest'
import { once } from 'node:events'
import { createApiApp } from '../server/routes.js'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PublisherClient } from '../server/publisher-client.js'
import { PurchaseManager } from '../server/purchases.js'
import { RunLoop } from '../server/agents/loop.js'
import { freeDraft, writeAnswer } from '../server/agents/research.js'
import { exampleCandidate, exampleContent, exampleRun } from '../shared/contracts/examples.js'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import type { RunSnapshot } from '../shared/contracts/index.js'

it('publishes a cited free draft while the composer is still blocked', async () => {
  const store = new Store(':memory:')
  const run = store.createRun(exampleRun.question, 0)
  const client = {} as PublisherClient
  let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  let entered!: () => void
  const composing = new Promise<void>(resolve => { entered = resolve })
  const loop = new RunLoop(store, client, new PurchaseManager(store, client), undefined, {
    retrieve: async () => ({ candidates: [exampleCandidate], contents: [exampleContent] }),
    writeAnswer: async input => { entered(); await blocked; return writeAnswer(input) },
  })
  const work = loop.start(run.runId)
  try {
    await composing
    const snapshot = store.getRun(run.runId)
    expect(snapshot.answers).toHaveLength(0)
    const draft = snapshot.events.find(e => e.type === 'FREE_DRAFT')
    expect(JSON.stringify(draft)).toContain(exampleContent.body)
    expect(draft?.data?.answer).toMatchObject({ provider: 'fixture', version: 1 })
    expect(snapshot.grants).toHaveLength(0)
  } finally { release(); await work; store.close() }
})

it('UC3 SSE never emits paid passage bytes before a verified grant, and never emits refunded passages', async () => {
  const publisher = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
  await publisher.locals.ready; await publisher.locals.writersReady
  const pub = publisher.listen(0, '127.0.0.1'); await once(pub, 'listening')
  const api = await createApiApp({ dbPath: ':memory:', publisherUrl: `http://127.0.0.1:${(pub.address() as { port: number }).port}`, reconcileIntervalMs: 0 })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const abort = new AbortController()
  const snapshots: RunSnapshot[] = []
  try {
    const response = await fetch(url + '/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: DEMO_QUESTIONS[2].text, budgetMinor: 200 }) })
    expect(response.status).toBe(201)
    const run = await response.json() as RunSnapshot
    const stream = await fetch(`${url}/runs/${run.runId}/events`, { signal: abort.signal })
    const reader = stream.body!.getReader(), decoder = new TextDecoder()
    let buffer = ''
    outer: for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let end: number
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
        if (!frame.startsWith('event: snapshot\n')) continue
        const snapshot = JSON.parse(frame.slice(frame.indexOf('data: ') + 6)) as RunSnapshot
        snapshots.push(snapshot)
        if (snapshot.phase === 'DONE') break outer
      }
    }
    const final = snapshots.at(-1)!
    expect(final.phase).toBe('DONE')
    expect(final.intents.some(i => i.status === 'REFUNDED')).toBe(true)
    expect(snapshots.some(s => s.events.some(e => e.type === 'FREE_DRAFT') && !s.grants.length)).toBe(true)
    const paid = final.contents.filter(c => final.candidates.some(p => p.resourceId === c.resourceId && p.tier === 'PAID'))
    expect(paid.length).toBeGreaterThan(0)
    for (const snapshot of snapshots) {
      const serialized = JSON.stringify(snapshot)
      for (const content of paid) if (!snapshot.grants.some(g => g.resourceId === content.resourceId && snapshot.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))) {
        expect(serialized).not.toContain(JSON.stringify(content.body).slice(1, -1))
        for (const span of content.spans.filter(s => s.text.length > 100)) expect(serialized).not.toContain(JSON.stringify(span.text).slice(1, -1))
      }
      for (const intent of final.intents.filter(i => i.status === 'REFUNDED')) {
        expect(snapshot.contents.some(c => c.resourceId === intent.resourceId)).toBe(false)
        expect(snapshot.answers.some(a => a.claims.some(c => c.citations.some(ref => ref.resourceId === intent.resourceId)))).toBe(false)
      }
    }
  } finally {
    abort.abort()
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()))
    await api.close()
    pub.closeAllConnections(); await new Promise<void>(r => pub.close(() => r()))
    publisher.locals.journal.close()
  }
}, 30000)

it('the fast draft rejects paid contents even if a caller accidentally supplies them', () => {
  const paid = { ...exampleCandidate, resourceId: 'paid-canary', tier: 'PAID' as const }
  const content = { ...exampleContent, resourceId: paid.resourceId, body: 'PAID_PASSAGE_CANARY', spans: [{ id: 'paid', text: 'PAID_PASSAGE_CANARY' }] }
  const draft = freeDraft({ question: exampleRun.question, version: 1, candidates: [exampleCandidate, paid], contents: [exampleContent, content] })
  expect(draft.claims.length).toBeGreaterThan(0)
  expect(JSON.stringify(draft)).not.toContain('PAID_PASSAGE_CANARY')
})
