import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { createApiApp } from '../server/routes.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { USE_CASES } from './scenarios/use-cases.js'
import type { ReceiptBundle } from '../shared/contracts/receipts.js'
import { createClient } from '../sdk/index.js'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); vi.unstubAllEnvs() })
async function bundle(uc: 'UC2' | 'UC3' = 'UC2') {
  vi.stubEnv('LLM_PROVIDER', 'fixture'); vi.stubEnv('DECISION_PROVIDER', 'fixture'); vi.stubEnv('SEARCH_EMBEDDINGS', 'off')
  const publisher = createPublisherApp({ writers: await loadWriterCorpus(), journal: ':memory:', rail: 'simulated', env: {} })
  await publisher.locals.ready
  const server = publisher.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); publisher.locals.journal.close() })
  const api = await createApiApp({ dbPath: ':memory:', publisherUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`, reconcileIntervalMs: 100000 })
  cleanup.push(() => api.close())
  const run = api.store.createRun(USE_CASES[uc].question, 200)
  if (USE_CASES[uc].answers) api.store.updateRun(run.runId, { checkpoint: { answers: USE_CASES[uc].answers } })
  await api.loop.start(run.runId)
  return { api, b: receiptBundle(api.store, run.runId) }
}
it.each(['UC2', 'UC3'] as const)('verifies all signed citations and the audit chain offline for %s', async uc => {
  const { b } = await bundle(uc)
  const result = await verifyAnswer(b)
  expect(result.checks.filter(c => c.status === 'FAIL')).toEqual([])
  expect(result.ok).toBe(true)
  expect(result.checks.some(c => c.check.startsWith('citation'))).toBe(true)
  expect(result.checks.find(c => c.check === 'testnet')?.status).toBe('SKIP')
  if (uc === 'UC3') expect(b.intents.some(i => i.refund)).toBe(true)
})
it('names the exact citation for a one-byte passage tamper; refuses amount, citation, signature, grant, refund and audit edits', async () => {
  const { b } = await bundle('UC3')
  const mutations: ((copy: ReceiptBundle) => void)[] = [
    c => { const ref = c.answers.at(-1)!.claims[0].citations[0]; const s = c.sources.find(s => s.resourceId === ref.resourceId)!; s.spans.find(s => s.id === ref.spanId)!.text += 'X' },
    c => { c.payments[0].amountDrops = '1' },
    c => { c.answers.at(-1)!.claims[0].citations[0].spanId = 'missing' },
    c => { c.proofs[0].manifest.sig = 'AA' },
    c => { c.grants = [] },
    c => { c.payments.find(p => p.refundTxHash)!.refundTxHash = '' },
    c => { const e = c.audit.entries.find(e => !('commitment' in e))!; e.hash = '0'.repeat(64) },
    c => { c.payments = []; c.intents = []; c.receipts = [] },
  ]
  for (const mutate of mutations) {
    const copy = structuredClone(b); mutate(copy)
    const result = await verifyAnswer(copy)
    expect(result.ok, JSON.stringify(result.checks)).toBe(false)
  }
  const copy = structuredClone(b); mutations[0](copy)
  expect((await verifyAnswer(copy)).checks.some(c => c.status === 'FAIL' && c.check.startsWith('citation answer'))).toBe(true)
})
it('pins an external audit head, treats simulated transactions as unverified on Testnet and rejects legacy reports', async () => {
  const { b } = await bundle()
  expect((await verifyAnswer(b, { expectHead: 'wrong' })).ok).toBe(false)
  const request = vi.fn().mockRejectedValue(new Error('offline'))
  const result = await verifyAnswer(b, { testnet: true, ledger: { request } })
  expect(result.ok).toBe(false)
  expect(request).not.toHaveBeenCalled()
  expect((await verifyAnswer({ sources: [] })).ok).toBe(false)
})
it('exports via API and SDK without exposing signed blobs or quarantined delivery', async () => {
  const { api, b } = await bundle('UC3')
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) })
  const sdk = createClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
  const exported = await sdk.receipts(b.runId)
  expect((await verifyAnswer(exported)).ok).toBe(true)
  expect(JSON.stringify(exported)).not.toMatch(/txBlob|signedTxBlob|privateKey/)
  for (const i of exported.intents.filter(i => i.status === 'REFUNDED')) expect(exported.sources.some(s => s.resourceId === i.resourceId)).toBe(false)
})
