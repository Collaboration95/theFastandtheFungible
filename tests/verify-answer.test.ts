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
    c => { const refunded = c.intents.find(i => i.refund)!; c.candidates.find(c => c.resourceId === refunded.resourceId)!.manifest!.sig = 'AA' },
    c => { c.grants = [] },
    c => { c.payments.find(p => p.refundTxHash)!.refundTxHash = '' },
    c => { const e = c.audit.entries.find(e => !('commitment' in e))!; e.hash = '0'.repeat(64) },
    c => { c.payments = []; c.intents = []; c.receipts = [] },
    c => { const p = c.payments.find(p => p.refundTxHash)!; p.refundTxHash = ''; p.refundAmountMinor = ''; c.intents.find(i => i.intentId === p.intentId)!.refund = undefined },
    c => { c.candidates.filter(c => c.tier === 'PAID').forEach(c => { c.tier = 'FREE' }); c.grants = [] },
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
  expect((await verifyAnswer(b, { onlineLedger: true, anchorLookup: request, ledger: { request } })).checks.find(c => c.check === 'audit anchor')?.status).toBe('SKIP')
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

it('reuses the ledger verifier for payments and refunds; rejects unvalidated, amount, writer, invoice and partial-refund proofs', async () => {
  const { readFileSync } = await import('node:fs')
  const recorded = JSON.parse(readFileSync('docs/evidence/verify-278/receipts.json', 'utf8')) as ReceiptBundle
  let fault = ''
  const ledger = { request: vi.fn(async (request: Record<string, unknown>) => {
    const row = recorded.payments.find(p => p.txHash === request.transaction || p.refundTxHash === request.transaction)!
    const refund = row.refundTxHash === request.transaction
    const amount = refund ? String(Number(row.refundAmountMinor) * 1000) : row.amountDrops
    return { result: { validated: fault !== 'unvalidated', ledger_index: row.ledgerIndex,
      tx_json: { TransactionType: 'Payment', Account: refund ? row.payee : row.payer, Destination: fault === 'writer' ? 'wrong' : refund ? row.payer : row.payee, Amount: amount, InvoiceID: fault === 'invoice' ? 'wrong' : refund ? row.txHash : row.invoiceId, Flags: refund && fault === 'partial-refund' ? 0x20000 : 0 },
      meta: { TransactionResult: 'tesSUCCESS', delivered_amount: fault === 'amount' ? '1' : amount } } }
  }) }
  expect((await verifyAnswer(recorded, { testnet: true, ledger })).ok).toBe(true)
  expect(ledger.request).toHaveBeenCalledTimes(3)
  for (fault of ['unvalidated', 'writer', 'invoice', 'amount', 'partial-refund']) {
    const result = await verifyAnswer(recorded, { testnet: true, ledger })
    expect(result.ok, fault).toBe(false)
    expect(result.checks.some(c => c.status === 'FAIL' && c.check.startsWith(fault === 'partial-refund' ? 'testnet refund' : 'testnet payment'))).toBe(true)
  }
})
it('authorizes receipt exports for the owning agent and conceals other runs', async () => {
  const { api } = await bundle()
  const a = api.store.addAgent({ name: 'A', maxMinor: 50, dailyMinor: 100 }), other = api.store.addAgent({ name: 'B', maxMinor: 50, dailyMinor: 100 })
  const admit = (id: string) => api.store.admit({ surface: 'agent', principal: id, question: 'free', requestedMinor: 0, maxMinor: 50, idempotencyKey: id }).run
  const ar = admit(a.id), br = admit(other.id)
  api.store.addAnswer(ar.runId, { conclusion: 'No findings', claims: [], openGaps: [], version: 1, provider: 'fixture', model: 'fixture' })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const sdk = createClient({ baseUrl: base, token: a.token })
  expect((await sdk.receipts(ar.runId)).runId).toBe(ar.runId)
  await expect(sdk.receipts(br.runId)).rejects.toMatchObject({ code: 'not_found' })
  const exported = JSON.stringify(await sdk.receipts(ar.runId))
  expect(exported).not.toContain(br.runId)
  expect(exported).not.toContain(other.id)
  const response = await fetch(`${base}/api/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` }, body: '{}' })
  expect(response.status).toBe(403)
})

it('CLI verifies the recorded JSON and PDF offline, rejects the exact citation tamper and detects PDF byte edits', async () => {
  const { spawn } = await import('node:child_process')
  const { mkdtempSync, readFileSync, writeFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const run = (path: string) => new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/verify-answer.ts', path])
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', reject)
    child.once('close', status => resolve({ status, stdout, stderr }))
  })
  const dir = mkdtempSync(join(tmpdir(), 'verify-pdf-'))
  try {
    const bytes = readFileSync('docs/evidence/verify-278/report.pdf'); bytes[20] ^= 1
    const path = join(dir, 'edited.pdf'); writeFileSync(path, bytes)
    // Independent offline CLI probes share the original 5 s deadline; no serial startup cost.
    const [json, pdf, bad, changed] = await Promise.all([
      run('docs/evidence/verify-278/report.json'), run('docs/evidence/verify-278/report.pdf'),
      run('docs/evidence/verify-278/tampered.json'), run(path),
    ])
    for (const result of [json, pdf]) {
      expect(result.status, result.stderr + result.stdout).toBe(0)
      expect(result.stdout).toContain('Payments/refunds NOT checked on ledger')
    }
    expect(bad.status).toBe(1)
    expect(bad.stdout).toContain('fab-floor-kestrel-penang-lead-times@v1#p1: Exact citation passage missing or hash mismatch')
    expect(changed.status).toBe(2)
    expect(changed.stderr).toContain('PDF byte hash differs')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
