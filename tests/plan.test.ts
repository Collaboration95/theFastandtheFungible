import { afterEach, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import type { RunSnapshot } from '../shared/contracts/index.js'
import { fixturePlan, plan } from '../server/agents/scope.js'
import { createApiApp } from '../server/routes.js'
import { createPublisherApp } from '../publisher/routes.js'
import { miniCorpus } from './fixtures/corpus-mini/index.js'

const uc = (id: string) => DEMO_QUESTIONS.find(q => q.id === id)!.text
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('plan and run start (#137)', () => {
  it('fixture: each UC gets its expected generic sub-queries (≤ 120 chars, no user identity)', () => {
    expect(fixturePlan(uc('UC1')).subqueries).toEqual(['Bank Japan change meeting', '10-year JGB yields react'])
    expect(fixturePlan(uc('UC2')).subqueries).toEqual(['analyst outlook Kestrel Semiconductor deal TSMC'])
    // The story bible's expected angle pick folds into the plan.
    expect(fixturePlan(uc('UC2'), { angle: 'pricing & margins' })).toEqual({
      restatement: `${uc('UC2')} Focus: pricing & margins.`,
      subqueries: ['analyst outlook Kestrel Semiconductor deal TSMC', 'analyst outlook Kestrel Semiconductor deal TSMC pricing margins'],
    })
    expect(fixturePlan(uc('UC3')).subqueries).toEqual(['Kestrel Semiconductor advanced-packaging lead times Malaysia shorter'])
    const long = fixturePlan(`${'semiconductor '.repeat(20)}?`, { a: 'x', b: 'y', c: 'z' })
    expect(long.subqueries.length).toBeLessThanOrEqual(3)
    expect(long.subqueries.every(q => q.length <= 120)).toBe(true)
  })
  it('a model plan is clipped to 120 chars and refused when it mentions spending', async () => {
    vi.stubEnv('LLM_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'test-only')
    const reply = (value: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(value) } }] })}\n\ndata: [DONE]\n\n`)))
    reply({ restatement: 'r', subqueries: ['word '.repeat(40)] })
    const clipped = await plan(uc('UC1'))
    expect(clipped.subqueries[0].length).toBeLessThanOrEqual(120)
    expect(clipped.label).toBe('DeepSeek · deepseek-flash')
    reply({ restatement: 'r', subqueries: ['buy the NotFT article now'] })
    expect(await plan(uc('UC1'))).toMatchObject({ label: 'fixture · scope-fixture', subqueries: fixturePlan(uc('UC1')).subqueries })
  })
  it('POST /runs plans server-side when no plan is given, stores it, and searches the registry with it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plan-test-'))
    const publisher = createPublisherApp({ secret: 'plan-test', journal: ':memory:', rail: 'simulated', corpus: [], writers: miniCorpus, env: {} })
    await publisher.locals.ready; await publisher.locals.writersReady
    const pubServer = publisher.listen(0, '127.0.0.1'); await once(pubServer, 'listening')
    const api = await createApiApp({ dbPath: join(dir, 'api.db'), publisherUrl: `http://127.0.0.1:${(pubServer.address() as { port: number }).port}`, reportDir: join(dir, 'reports') })
    const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const ask = (body: unknown) => fetch(`${base}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json() as Promise<RunSnapshot>)
    const settled = async (runId: string) => {
      for (let i = 0; i < 100; i++) {
        const run = await fetch(`${base}/runs/${runId}`).then(r => r.json() as Promise<RunSnapshot>)
        if (['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) return run
        await new Promise(done => setTimeout(done, 50))
      }
      throw new Error('run did not settle')
    }
    try {
      const run = await settled((await ask({ question: uc('UC2'), answers: { angle: 'pricing & margins' }, budgetMinor: 0 })).runId)
      expect(run.checkpoint.plan).toEqual(fixturePlan(uc('UC2'), { angle: 'pricing & margins' }))
      expect(run.events.find(e => e.type === 'PLAN')?.label).toContain('analyst outlook Kestrel Semiconductor deal TSMC')
      expect(run.labels.search).toBe('keyword only (embeddings unavailable)')
      expect(run.candidates.some(c => c.resourceId === 'lf-kestrel-tsmc-deal' && c.tier === 'PAID')).toBe(true)
      expect(run.spentMinor).toBe(0)
      const given = { restatement: 'BoJ band', subqueries: ['BoJ band widened'] }
      const second = await settled((await ask({ question: uc('UC1'), plan: given, budgetMinor: 0 })).runId)
      expect(second.checkpoint.plan).toEqual(given)
      expect(second.contents.some(c => c.resourceId === 'mt-boj-band')).toBe(true)
    } finally {
      server.close(); api.close(); pubServer.close(); publisher.locals.journal.close(); rmSync(dir, { recursive: true, force: true })
    }
  })
})
