import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, ResearchAgentError } from '../sdk/index.js'
import { startEngine } from '../server/engine.js'
import { Store } from '../server/store.js'
import { USE_CASES } from './scenarios/use-cases.js'

afterEach(() => vi.unstubAllEnvs())
it('exposes explicit SDK methods without internal settlement commands', () => {
  expect(Object.keys(createClient({ baseUrl: 'http://localhost' })).sort())
    .toEqual(['ask', 'getRun', 'hire', 'pay', 'receipts', 'search', 'verify', 'wallet', 'walletStatus', 'watch'])
})
it('follows a fixture ask to cited, granted delivery and reuses the intent', async () => {
  vi.stubEnv('MCP_MAX_BUDGET_MINOR', '200')
  vi.stubEnv('MCP_DAILY_CAP_MINOR', '200')
  const dataDir = mkdtempSync(join(tmpdir(), 'sdk-'))
  const engine = await startEngine({ dataDir })
  let streams = 0
  const client = createClient({ baseUrl: engine.apiUrl, token: engine.apiToken, fetch: (url, init) => {
    if (String(url).endsWith('/events')) streams++
    return fetch(url, init)
  } })
  try {
    const hits = await client.search(USE_CASES.UC2.question)
    expect(hits.hits.length).toBeGreaterThan(0)
    expect(Object.keys(hits.hits[0]).sort()).toEqual(['abstract', 'priceMinor', 'relevance', 'tier', 'title', 'untrusted', 'url', 'writer'])
    const question = USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?')
    const run = await client.ask(question, { budgetSgd: 2, idempotencyKey: 'sdk-uc2' })
    expect(streams).toBeGreaterThan(0)
    expect(run.phase).toBe('DONE')
    expect(run.labels.settlement).toContain('SIMULATED')
    expect(run.clamped).toBe(false)
    expect(run.citations.length).toBeGreaterThan(0)
    expect(run.purchases.filter(p => p.status === 'VERIFIED')).toHaveLength(1)
    expect(run.purchases.every(p => p.txHash === null)).toBe(true)
    const store = new Store(join(dataDir, 'app.db'))
    try {
      const snapshot = store.getRun(run.run_id)
      for (const c of run.citations) {
        expect(snapshot.contents.find(d => d.resourceId === c.resourceId && d.version === c.version)?.spans.find(s => s.id === c.spanId)?.text).toBe(c.passage)
      }
    } finally { store.close() }
    const retry = await client.ask(question, { budgetSgd: 999, idempotencyKey: 'sdk-uc2' })
    expect(retry.run_id).toBe(run.run_id)
    expect(retry.purchases).toEqual(run.purchases)
    expect(retry.clamped).toBe(true)
    expect((await client.getRun(run.run_id)).citations).toEqual(run.citations)
    const events = []
    for await (const event of client.watch(run.run_id)) events.push(event)
    expect(events.length).toBeGreaterThan(0)
    expect(new Set(events.map(e => e.id)).size).toBe(events.length)
    expect((await client.wallet()).spentMinor).toBe(run.spentMinor)
    // Block only SSE: polling must finish the same admission, with no automatic POST retry.
    let posts = 0
    const polling = createClient({ baseUrl: engine.apiUrl, token: engine.apiToken, fetch: (url, init) => {
      if (String(url).endsWith('/events')) return Promise.resolve(new Response('', { status: 503 }))
      if (init?.method === 'POST') posts++
      return fetch(url, init)
    } })
    expect((await polling.ask('What is available?', { budgetSgd: 0 })).phase).toBe('DONE')
    expect(posts).toBe(1)
    await expect(client.getRun('missing')).rejects.toMatchObject({ code: 'not_found' })
    // The unchanged backend returns a generic 500 for an idempotency conflict.
    await expect(client.ask(question + ' changed', { budgetSgd: 2, idempotencyKey: 'sdk-uc2' })).rejects.toMatchObject({ code: 'backend_unavailable' })
    await expect(client.ask(question, { budgetSgd: -1 })).rejects.toMatchObject({ code: 'invalid' })
  } finally { await engine.close(); rmSync(dataDir, { recursive: true, force: true }) }
}, 30_000)

it.each([[401, 'unauthorized'], [403, 'unauthorized'], [404, 'not_found'], [400, 'invalid'], [503, 'backend_unavailable']])('maps HTTP %s without exposing backend bodies', async (status, code) => {
  const client = createClient({ baseUrl: 'http://localhost', token: 'test-token', fetch: async (_url, init) => {
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' })
    return new Response('private-backend-detail', { status: Number(status) })
  } })
  await expect(client.wallet()).rejects.toEqual(new ResearchAgentError(code as ResearchAgentError['code']))
})

it('maps malformed responses and transport failure to a typed error', async () => {
  for (const transport of [async () => new Response('{}'), async () => { throw new Error('private-url') }]) {
    await expect(createClient({ baseUrl: 'http://localhost', fetch: transport }).wallet()).rejects.toMatchObject({ code: 'backend_unavailable' })
  }
})
