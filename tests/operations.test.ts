import { afterEach, expect, it, vi } from 'vitest'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { metrics } from '../server/metrics.js'
import { logMoneyEvent, reportModelFallback, reportModelUsage, withModelUsage } from '../server/telemetry.js'
import { createApiApp } from '../server/routes.js'
import { once } from 'node:events'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
it('projects costs, unknowns and fallbacks without content, even with Langfuse off', async () => {
  const store = new Store(':memory:'); cleanup.push(() => store.close())
  const run = store.createRun('PRIVATE_QUESTION_CANARY', 0)
  vi.stubEnv('LANGFUSE_ENABLED', '0')
  vi.stubEnv('MODEL_INPUT_USD_PER_MILLION', '1')
  vi.stubEnv('MODEL_OUTPUT_USD_PER_MILLION', '2')
  await withModelUsage(data => store.appendEvent(run.runId, { type: data.fallback ? 'MODEL_FALLBACK' : 'MODEL_USAGE', label: 'usage', data }), async () => {
    reportModelUsage(100, 50)
    reportModelFallback()
  })
  const view = metrics(store, new PurchaseManager(store, new PublisherClient()))
  expect(view.modelUsageByRun).toEqual([{ runId: run.runId, reportedCalls: 1, inputTokens: 100, outputTokens: 50, estimatedUsd: 0.0002 }])
  expect(view.fallbacks.llm).toBe(1)
  expect(view.settleLatencyMs).toEqual({ samples: 0, p50: null, p95: null })
  expect(JSON.stringify(view)).not.toContain('PRIVATE_QUESTION_CANARY')
  vi.stubEnv('MODEL_INPUT_USD_PER_MILLION', undefined)
  await withModelUsage(data => store.appendEvent(run.runId, { type: 'MODEL_USAGE', label: 'usage', data }), async () => reportModelUsage(100, 50))
  expect(metrics(store, new PurchaseManager(store, new PublisherClient())).modelUsageByRun[0].estimatedUsd).toBeNull()
})
it('writes allowlisted JSON money metadata to stderr and masks configured secrets', () => {
  const store = new Store(':memory:'); cleanup.push(() => store.close())
  const run = store.createRun('private', 0)
  vi.stubEnv('LOG_FORMAT', 'json'); vi.stubEnv('RA_API_TOKEN', 'secret-canary-287')
  const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
  const event = { id: 1, at: new Date().toISOString(), runId: run.runId, type: 'PURCHASE', label: 'premium body trap', data: { intentId: 'secret-canary-287', body: 'premium body trap' } }
  logMoneyEvent(event, store)
  expect(stderr).toHaveBeenCalledTimes(1)
  const raw = stderr.mock.calls[0][0]
  expect(JSON.parse(raw)).toMatchObject({ event: 'money', runId: run.runId, intentId: '[RA_API_TOKEN]' })
  expect(raw).not.toContain('premium body trap')
  expect(raw).not.toContain('secret-canary-287')
})
it('reports database write failure as down, publisher failure as degraded, without raw errors', async () => {
  const api = await createApiApp({ dbPath: ':memory:' })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await api.close() })
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/health?deep=1`
  vi.spyOn(api.purchases.client, 'registry').mockRejectedValue(new Error('SECRET_PROVIDER_BYTES'))
  const response = await fetch(url), degraded = await response.json()
  expect(degraded).toMatchObject({ status: 'degraded', publisher: 'down' })
  expect(JSON.stringify(degraded)).not.toContain('SECRET_PROVIDER_BYTES')
  vi.spyOn(api.store, 'checkWritable').mockImplementation(() => { throw new Error('SECRET_DB_PATH') })
  const failed = await fetch(url)
  expect(failed.status).toBe(503)
  expect(await failed.json()).toMatchObject({ status: 'down', database: 'down' })
})
