// R8-B: a decline whose answer was written from offline extracts can be shared, and a run that cannot be shared says why
// before the button is offered (VID: "Publish proof page" failed twice with a generic line). Real loop, real publisher,
// fixture rail; the language model is "configured" but unreachable, so the writer falls back the way the hosted demo's does.
import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { request as http } from 'node:http'
import { join } from 'node:path'
import { createApiApp } from '../server/routes.js'
import { verifyAnswer } from '../sdk/verify.js'
import { nearMatchDecline, refusalEligibility } from '../shared/refusal-proof.js'
import type { RunSnapshot } from '../shared/contracts/index.js'
import { standInAnchor } from './helpers/stand-in-anchor.js'
import { resources } from './helpers/resource-scope.js'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.unstubAllEnvs() })
type Reply = { status: number; text: string; json: <T = Record<string, unknown>>() => T }
const wire = (url: string, method = 'GET', body?: unknown) => new Promise<Reply>((resolve, reject) => {
  const req = http(url, { method, headers: { 'Content-Type': 'application/json' } }, res => { let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode!, text, json: <T>() => JSON.parse(text) as T })) })
  req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body))
})

/** The app with the real loop and the real publisher, and a writer model that is configured but cannot be reached. */
async function offlineWriterApp() {
  const dir = resources().tempDir('r8b-proof-')
  const port = await new Promise<number>(resolve => { const probe = createServer(); probe.listen(0, '127.0.0.1', () => { const { port } = probe.address() as { port: number }; probe.close(() => resolve(port)) }) })
  for (const [key, value] of Object.entries({ SETTLEMENT_RAIL: 'simulated', LLM_PROVIDER: 'openai-compatible', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_API_KEY: 'unreachable-test-key', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', DOTENV_CONFIG_PATH: '.playwright/no-env', PUBLISHER_URL: `http://127.0.0.1:${port}`, PUBLISHER_PORT: String(port), PUBLISHER_DB: join(dir, 'publisher.db') })) vi.stubEnv(key, value)
  resources().spawn(process.execPath, ['--import', 'tsx', 'publisher/server.ts'], { env: process.env })
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)) }
  const api = await createApiApp({ dbPath: join(dir, 'app.db'), publisherUrl: `http://127.0.0.1:${port}` })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await api.close() })
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  /** Asks, waits for the run to end, and stands in for the Testnet anchor (the simulated rail never anchors). */
  const decline = async (question: string, budgetMinor = 10) => {
    const { runId } = (await wire(url + '/runs', 'POST', { question, budgetMinor })).json<{ runId: string }>()
    for (let i = 0; i < 150 && !['DONE', 'FAILED', 'STOPPED'].includes(api.store!.getRun(runId).phase); i++) await new Promise(r => setTimeout(r, 200))
    standInAnchor(api.store!, runId)
    return runId
  }
  return { url, api, decline }
}

it('shares a decline whose answer was written from offline extracts, and the receipts verify on their own', async () => {
  const { url, api, decline } = await offlineWriterApp()
  const runId = await decline('What is the XRPL base reserve today, and how much does each owned object add?')
  const run = api.store!.getRun(runId)
  // The writer really fell back: a model-fallback event, and the answer is the fixture writer's.
  expect(run.events.some(event => event.type === 'MODEL_FALLBACK')).toBe(true)
  expect(run.labels.research).toMatch(/^fixture/)
  expect(run.spentMinor).toBe(0)
  expect((await wire(url + `/api/runs/${runId}/proof`)).json()).toEqual({ eligible: true })
  const made = await wire(url + `/api/runs/${runId}/proof`, 'POST')
  expect(made.status).toBe(201)
  const { path } = made.json<{ proof: { path: string } }>().proof
  expect((await wire(url + path)).status).toBe(200)
  const receipts = await wire(url + `${path}/receipts.json`)
  expect((await verifyAnswer(receipts.json() as never)).ok).toBe(true)
}, 60_000)

it('tells a run that cannot be packaged why, before the button is offered, and the POST says the same', async () => {
  const { url, api, decline } = await offlineWriterApp()
  const runId = await decline('Who won the 2026 Singapore Grand Prix?', 100)
  expect((await wire(url + `/api/runs/${runId}/proof`)).json()).toEqual({ eligible: true })
  // An answer changed after it was anchored no longer matches the on-ledger commitment: the receipts cannot be verified.
  api.store!.addAnswer(runId, { version: 2, conclusion: 'Changed after anchoring', claims: [], openGaps: [], provider: 'fixture', model: 'extractive-fixture' })
  const status = (await wire(url + `/api/runs/${runId}/proof`)).json<{ eligible: boolean; code: string; message: string }>()
  expect(status).toMatchObject({ eligible: false, code: 'verification_failed' })
  expect(status.message).toMatch(/did not pass the offline checks, so it can’t be shared/)
  const refused = await wire(url + `/api/runs/${runId}/proof`, 'POST')
  expect(refused.status).toBe(409)
  expect(refused.json()).toEqual({ error: 'verification_failed', message: status.message })
  expect(api.store!.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM refusal_proofs').get()!.n))).toBe(0)
}, 60_000)

it('does not offer a refusal that a reader can see was wrong: a declined article titled almost like the question', () => {
  const row = (title: string, verdict: string, tier = 'PAID') => ({ verdict, candidate: { title, tier } })
  const run = (question: string, rows: ReturnType<typeof row>[]) => ({ question, decisions: [{ rows }] }) as unknown as Pick<RunSnapshot, 'question' | 'decisions'>
  // The mock-judge case: the exact article, declined as "wouldn't add enough".
  expect(nearMatchDecline(run('How can I stop a prompt-injected AI agent from draining its wallet?', [row('How does ResearchAgent stop prompt injection from draining an agent wallet?', 'SKIP_LOW_VALUE')]))).toMatch(/prompt injection/)
  expect(nearMatchDecline(run('What does an x402 402 response contain, and can my agent pay it with XRP on Testnet?', [row('What does an x402 402 Payment Required response contain?', 'SKIP_LOW_VALUE')]))).toBeDefined()
  // Not a near match: an off-topic question, an unrelated title, a decline for budget or trust, a free article.
  expect(nearMatchDecline(run('Who won the 2026 Singapore Grand Prix?', [row('How does ResearchAgent stop prompt injection from draining an agent wallet?', 'SKIP_LOW_VALUE')]))).toBeUndefined()
  expect(nearMatchDecline(run('How can I stop a prompt-injected AI agent from draining its wallet?', [row('How does ResearchAgent stop prompt injection from draining an agent wallet?', 'SKIP_OVER_BUDGET')]))).toBeUndefined()
  expect(nearMatchDecline(run('How can I stop a prompt-injected AI agent from draining its wallet?', [row('How does ResearchAgent stop prompt injection from draining an agent wallet?', 'SKIP_LOW_VALUE', 'FREE')]))).toBeUndefined()
  expect(nearMatchDecline(run('What is the XRPL base reserve today?', [row('Which public server URLs and faucet does XRPL Testnet use?', 'SKIP_LOW_VALUE')]))).toBeUndefined()
  // The eligibility rule uses it, with its own code and a plain reason.
  const base = { phase: 'DONE', spentMinor: 0, reservedMinor: 0, budgetMinor: 100, receipts: [], grants: [], intents: [], answers: [], labels: { settlement: 'XRPL TESTNET · no real value' }, events: [], question: 'How can I stop a prompt-injected AI agent from draining its wallet?', decisions: [{ rows: [row('How does ResearchAgent stop prompt injection from draining an agent wallet?', 'SKIP_LOW_VALUE')] }] } as unknown as RunSnapshot
  expect(refusalEligibility(base)).toMatchObject({ ok: false, code: 'near_match', message: expect.stringMatching(/^Not offered: the closest article looked relevant/) })
})
