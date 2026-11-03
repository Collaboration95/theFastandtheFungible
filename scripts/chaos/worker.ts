// Test-only process. No dotenv and no network ledger or live model factory.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { Wallet } from 'xrpl'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../../mcp/tools.js'
import { createApiApp } from '../../server/routes.js'
import { createPublisherApp } from '../../publisher/routes.js'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import { seedEnvName } from '../../publisher/registry.js'
import { XrplPayer } from '../../server/xrpl.js'
import { createClient } from '../../sdk/index.js'
import { payAndFetch } from '../../sdk/x402.js'
import { openPaymentJournal } from '../../sdk/x402-journal.js'
import { auditRuns, readRuns } from '../gate-audit.js'
import { assertNoLeaks } from '../../tests/scenarios/harness.js'
import { USE_CASES, type UseCaseId } from '../../tests/scenarios/use-cases.js'
import type { HireAuditRecord } from '../../server/hire/audit.js'
import { snapshotCollector } from './observations.js'
import { fixtureLedger } from './ledger.js'

const [dir, fault, uc, seed] = process.argv.slice(2)
const phaseMetrics: { phase: string; rss: number; heapUsed: number; handles: number }[] = []
function phase(name: string) {
  const { rss, heapUsed } = process.memoryUsage()
  const row = { phase: name, rss, heapUsed, handles: process.getActiveResourcesInfo().length }
  phaseMetrics.push(row); writeFileSync(join(dir, 'phase.json'), JSON.stringify(phaseMetrics)); console.error(JSON.stringify(row))
}
phase('imports-ready')
const marker = join(dir, 'fault.json')
const state: { fired: boolean; count: number } = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')) : { fired: false, count: 0 }
function inject(name: string) {
  if (fault !== name || state.fired) return false
  state.fired = true; state.count++; writeFileSync(marker, JSON.stringify(state))
  return true
}
const kill = (name: string) => { if (inject(name)) process.kill(process.pid, 'SIGKILL') }
const wallet = (name: string) => Wallet.fromEntropy(createHash('sha256').update(`chaos-fixture-only:${seed}:${name}`).digest().subarray(0, 16))
const chain = fixtureLedger(join(dir, 'ledger.db'))
const request = chain.ledger.request.bind(chain.ledger)
chain.ledger.request = async r => {
  if (r.command === 'submit') {
    kill('kill-after-sign')
    if (inject('submit-timeout-before')) throw new Error('Injected submit timeout before apply')
  }
  const result = await request(r)
  if (r.command === 'submit') {
    kill('kill-after-submit')
    if (inject('submit-timeout-after')) throw new Error('Injected submit timeout after apply')
    if (inject('duplicate-submit')) await request(r)
  }
  return result
}
const buyerLedger = { async request(r: Record<string, unknown>) {
  if (r.command === 'fee') kill('kill-before-sign')
  const result = await chain.ledger.request(r)
  if (r.command === 'tx' && result.result.validated) kill('kill-after-validation')
  return result
} }
const corpus = await loadWriterCorpus(); phase('corpus-ready')
const env = Object.fromEntries(corpus.publishers.map(p => [seedEnvName(p.slug), wallet(p.slug).seed]))
const pub = createPublisherApp({ writers: corpus, rail: 'xrpl-testnet', ledger: chain.ledger, journal: join(dir, 'publisher.db'), env,
  facilitatorTiming: { pollMs: 1, timeoutMs: 80 } })
await pub.locals.ready
const pubServer = pub.listen(0, '127.0.0.1'); await once(pubServer, 'listening')
const origin = `http://127.0.0.1:${(pubServer.address() as AddressInfo).port}`
// HTTP transport seam: faults are confined to this proxy, never global fetch.
const proxy = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/provider/')) { inject('provider-down'); res.writeHead(503).end(); return }
    if (req.url?.includes('/articles/') && req.headers['payment-signature']) {
      if (inject('publisher-down')) { res.writeHead(503).end(); return }
      if (inject('publisher-slow')) await new Promise(done => setTimeout(done, 40))
    }
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.from(c))
    const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers['content-length']
    const response = await fetch(origin + req.url, { signal: AbortSignal.timeout(5000), method: req.method, headers: headers as Record<string, string>,
      ...(['GET', 'HEAD'].includes(req.method!) ? {} : { body: Buffer.concat(chunks) }) })
    res.writeHead(response.status, Object.fromEntries([...response.headers].filter(([k]) => !['content-encoding','transfer-encoding','content-length','connection'].includes(k))))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch { res.writeHead(503).end() }
})
proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening')
const publisherUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
if (fault === 'provider-down') Object.assign(process.env, { LLM_PROVIDER: 'deepseek', LLM_BASE_URL: publisherUrl + '/provider', LLM_API_KEY: 'synthetic-unused-key', LLM_TIMEOUT_MS: '100', LLM_SYNTHESIS_TIMEOUT_MS: '100' })
const payer = new XrplPayer(buyerLedger, wallet('buyer'), { pollMs: 1, timeoutMs: 100 })
const api = await createApiApp({ dbPath: join(dir, 'app.db'), reportDir: join(dir, 'reports'), publisherUrl, payer, reconcileIntervalMs: 20,
  ...(fault === 'decision-down' ? { provider: { name: 'openai', model: 'unavailable-fixture', async judgeCoverage() { inject('decision-down'); throw new Error('Injected unavailable decision model') }, async judgeRound() { inject('decision-down'); throw new Error('Injected unavailable decision model') }, async judgeCandidate() { throw new Error('Injected unavailable decision model') } } } : {}) })
phase('api-ready')
const apiServer = api.app.listen(0, '127.0.0.1'); await once(apiServer, 'listening')
const baseUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`
const collector = snapshotCollector(), observations = collector.observations
let streams = 0
const sdk = createClient({ baseUrl, token: 'chaos-fixture-token', fetch: async (url, init) => {
  const response = await fetch(url, init)
  if (String(url).endsWith('/events')) {
    streams++
    if (inject('sse-drop')) { await response.body?.cancel(); return new Response('', { status: 503 }) }
    let pending = ''
    return new Response(response.body!.pipeThrough(new TransformStream({ transform(chunk, controller) {
      pending += new TextDecoder().decode(chunk)
      let end: number
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, end); pending = pending.slice(end + 2)
        if (!frame.startsWith('event: snapshot')) continue
        const raw = frame.split('\n').find(l => l.startsWith('data: '))!.slice(6)
        const run = JSON.parse(raw)
        collector.add({ kind: 'SSE', raw, runId: run.runId, grants: run.grants.filter((g: { intentId: string }) => run.intents.some((i: { intentId: string; status: string }) => i.intentId === g.intentId && i.status === 'VERIFIED')) })
      }
      controller.enqueue(chunk)
    } })), { headers: response.headers })
  }
  return response
} })
const question = uc === 'UC2' ? USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?') : USE_CASES[uc as UseCaseId].question
let hireResult: (HireAuditRecord['result'] & { run_id: string }) | undefined
try {
  if (fault === 'hire-replay') {
    const journal = openPaymentJournal(join(dir, 'caller.db'))
    const opts = { wallet: wallet('caller'), journal, ledger: chain.ledger, maxDrops: '220000', method: 'POST',
      headers: { Authorization: 'Bearer chaos-fixture-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, budgetMinor: 200 }), idempotencyKey: 'chaos-hire' }
    try {
      const [a, b] = await Promise.all([payAndFetch(baseUrl + '/v1/ask', opts), payAndFetch(baseUrl + '/v1/ask', opts)])
      const result = await a.response.json(); assert.equal(a.response.status, 200); assert.deepEqual(await b.response.json(), result)
      const count = chain.transactions().length
      assert.deepEqual(await (await payAndFetch(baseUrl + '/v1/ask', opts)).response.json(), result)
      assert.equal(chain.transactions().length, count); inject('hire-replay'); hireResult = result
    } finally { journal.close() }
  } else if (fault === 'mcp-retry') {
    const server = createMcpServer(baseUrl, 'chaos-fixture-token'), client = new Client({ name: 'chaos-fixture', version: '1' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(a); await client.connect(b)
    try {
      const args = { name: 'ask_expert', arguments: { question, budget_sgd: 2, idempotency_key: 'chaos-ask' } }
      const [one, two] = await Promise.all([client.callTool(args), client.callTool(args)])
      assert.equal(one.isError, undefined); assert.deepEqual(one.structuredContent, two.structuredContent); inject('mcp-retry')
    } finally { await client.close(); await server.close() }
  } else {
    const budgetSgd = fault === 'caps' ? 999 : 2
    const opts = { budgetSgd, idempotencyKey: 'chaos-ask', waitMs: 10_000 }
    const result = fault === 'identical-intents' ? (await Promise.all(Array.from({length: 8}, () => sdk.ask(question, opts))))[0] : await sdk.ask(question, opts)
    kill('engine-restart')
    if (['sdk-retry','identical-intents','refund-replay','caps'].includes(fault)) {
      const before = chain.transactions().length
      const repeats = await Promise.all(Array.from({ length: 5 }, () => sdk.ask(question, opts)))
      for (const repeat of repeats) assert.equal(repeat.run_id, result.run_id)
      assert.equal(chain.transactions().length, before)
      if (fault === 'refund-replay') {
        const refunded = api.store.listIntents().find(i => i.status === 'REFUNDED')
        assert(refunded, 'UC3 must actually refund')
        const manifest = api.store.getManifest(refunded.intentId)!, delivered = api.store.getDelivery(refunded.intentId)!
        const claim = manifest.claims.find(c => refunded.failedClaimIds?.includes(c.id))!, index = manifest.leaves.indexOf(claim.leaf)
        const body = { intentId: refunded.intentId, txHash: refunded.txHash!, claimId: claim.id, leaf: claim.leaf, salt: delivered.salts[index], passageId: delivered.content.spans[index].id, passageText: delivered.content.spans[index].text }
        const replies = await Promise.all(Array.from({length: 4}, () => api.purchases.client.challenge(refunded.profileId, body, 500)))
        for (const reply of replies) assert.equal(reply.refundTxHash, refunded.refund!.txHash)
        assert.equal(chain.transactions().length, before)
      }
      inject(fault)
    }
  }
  phase('ask-complete')
  // Exercise the running reconciler, then explicit recovery; never clear a reservation by hand.
  let stuckReservations = 0
  for (let tick = 0; tick < 6; tick++) {
    await api.reconcileOnce()
    await api.purchases.drain()
    if (tick >= 3) stuckReservations = Math.max(stuckReservations, api.store.listIntents('SUBMITTING').length)
  }
  for (const i of api.store.listIntents()) if (i.status === 'DELIVERY_FAILED') await api.purchases.retryDelivery(i.intentId)
  if (fault === 'caps') {
    const replies = await Promise.all(Array.from({length: 6}, (_, n) => sdk.ask(question, {budgetSgd: 999, idempotencyKey: `cap-${n}`})))
    assert(replies.every(r => r.clamped))
    await api.purchases.drain()
  }
  const runs = api.store.listRuns()
  for (const r of runs) for (const content of r.contents) {
    if (corpus.articles.some(a => a.articleId === content.resourceId && a.tier === 'PAID')) assert(r.grants.some(g => g.resourceId === content.resourceId && r.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED')))
  }
  const metricsResponse = await fetch(baseUrl + '/api/metrics', { signal: AbortSignal.timeout(5000), headers: { Authorization: 'Bearer chaos-fixture-token' } })
  assert.equal(metricsResponse.status, 200)
  const metrics = await metricsResponse.json()
  assert.equal(metrics.reconcileBacklog.count, 0, 'Reservations/delivery backlog held after recovery: '+JSON.stringify(api.store.listIntents().map(i => ({status:i.status,error:i.error}))))
  phase('before-audit')
  const audit = auditRuns(readRuns(join(dir, 'app.db')), corpus, observations,
    hireResult ? [{ runId: hireResult.run_id, budgetMinor: 200, result: hireResult }] : [])
  assert.equal(audit.total, 0, JSON.stringify(audit.violations))
  const txs = chain.transactions()
  let payments = 0, refunds = 0
  for (const r of runs) {
    for (const i of r.intents) {
      const charged = txs.filter(t => t.tx.Account === payer.address && t.tx.InvoiceID === i.quote?.quoteHash)
      assert(charged.length <= 1, 'Double charge for intent')
      assert.equal(r.receipts.filter(x => x.intentId === i.intentId).length, charged.length, 'Confirmed payment missing/duplicate receipt')
      payments += charged.length
      const refund = txs.filter(t => t.tx.InvoiceID === i.txHash && t.tx.Destination === payer.address)
      assert(refund.length <= 1, 'Double refund'); refunds += refund.length
    }
    assert(r.spentMinor + r.reservedMinor <= r.budgetMinor)
  }
  for (const payment of txs.filter(t => t.tx.Account === payer.address)) {
    assert(runs.some(r => r.receipts.some(receipt => receipt.xrpl?.txHash === payment.hash)
      || api.store.policyPayments(r.runId).some(p => p.submission?.txHash === payment.hash)), 'Unaccounted confirmed buyer payment')
  }
  phase('after-audit')
  assertNoLeaks(observations, corpus)
  phase('after-leak-check')
  assert(api.store.walletStatus().spentMinor + api.store.walletStatus().reservedMinor <= 1000)
  const held = Object.values(metrics.spendTodayBySurface as Record<string,{reservedMinor:number}>).reduce((n,s) => n+s.reservedMinor,0)
  assert.equal(held,0,'Wallet authority held after run end')
  const result = { fault, useCase: uc, faultsInjected: state.count, payments, refunds, streams, stuckReservations,
    reservationsHeld: held, violations: audit.total, metrics,
    phaseMetrics, observationBytes: observations.reduce((n, o) => n+Buffer.byteLength(o.raw), 0), observations: observations.length,
    rss: process.memoryUsage().rss, handles: process.getActiveResourcesInfo().length }
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result))
} finally {
  phase('closing'); await api.close()
  for (const s of [apiServer, proxy, pubServer]) { s.closeAllConnections(); await new Promise<void>(done => s.close(() => done())) }
  pub.locals.journal.close(); chain.close()
}
