// Two live product runs. Durable journals + stable idempotency keys make recovery safe.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { Wallet } from 'xrpl'
import { createPublisherApp } from '../../publisher/routes.ts'
import { loadWriterCorpus } from '../../publisher/corpus.ts'
import { createApiApp } from '../../server/routes.ts'
import { XrplPayer } from '../../server/xrpl.ts'
import { testnetLedger, lookupTx } from '../../shared/xrpl.ts'
import { productionProvider } from '../../eval/decisions/providers/production.ts'
import { enableLive, assertNoSecrets } from '../../eval/decisions/transport.ts'
import { USE_CASES } from '../../tests/scenarios/use-cases.ts'
import { auditRuns } from '../gate-audit.ts'

const dir = resolve('scratch/numbers-v7/testnet'); mkdirSync(dir, { recursive: true, mode: 0o700 })
Object.assign(process.env, { EVAL_OUT: dir, EVAL_LIVE: '1', EVAL_SPEND_CAP_USD: '0.75', EVAL_OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  LLM_PROVIDER: 'deepseek', DECISION_PROVIDER: 'openai', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', SPENDING_PAUSED: '0', WALLET_DAILY_CAP_MINOR: '400', RA_API_TOKEN: randomBytes(32).toString('hex'), LLM_SYNTHESIS_TIMEOUT_MS: '120000' })
enableLive()
// Upper-bound each DeepSeek request by UTF-8 input bytes + 3000 output tokens;
// stop before cumulative reservations exceed $0.75 (dated harness rates).
const usageFile = resolve(dir, 'deepseek-usage.json')
const modelCalls = existsSync(usageFile) ? JSON.parse(readFileSync(usageFile)) : []
const pending = [], realFetch = globalThis.fetch, observations = []
globalThis.fetch = async (url, init) => {
  const target = new URL(String(url))
  if (target.hostname === 'api.deepseek.com') {
    const bound = Buffer.byteLength(init.body) * 0.30 / 1e6 + 3000 * 1.20 / 1e6
    assert(modelCalls.reduce((s,c) => s + c.boundUsd, 0) + bound <= 0.75, 'DeepSeek reservation cap')
    const row = { at: new Date().toISOString(), boundUsd: bound, usd: bound, estimated: true }
    modelCalls.push(row); writeFileSync(usageFile, JSON.stringify(modelCalls, null, 2))
    const r = await realFetch(url, init)
    row.status = r.status
    pending.push(r.clone().text().then(text => {
      for (const line of text.split('\n')) { if (!line.startsWith('data: {')) continue
        const frame = JSON.parse(line.slice(6)); if (!frame.usage) continue
        row.inputTokens = frame.usage.prompt_tokens; row.outputTokens = frame.usage.completion_tokens
        row.usd = (row.inputTokens * 0.30 + row.outputTokens * 1.20) / 1e6; row.estimated = false
        assert(row.usd <= bound, 'DeepSeek actual cost exceeds reservation')
      }
      writeFileSync(usageFile, JSON.stringify(modelCalls, null, 2))
    }))
    return r
  }
  const response = await realFetch(url, init)
  if (target.hostname === '127.0.0.1' && target.pathname.endsWith('/search')) {
    const raw = await response.clone().text(); observations.push({ kind: 'search hit', raw, grants: [] })
  }
  return response
}
const ledger = testnetLedger(), corpus = await loadWriterCorpus(), network = (await ledger.request({ command: 'server_info' })).result.info
assert.equal(network.network_id, 1)
const payer = new XrplPayer(ledger, Wallet.fromSeed(process.env.XRPL_PAYER_SEED), { pollMs: 1000, timeoutMs: 120000 })
const publisher = createPublisherApp({ writers: corpus, journal: resolve(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger, env: process.env })
await publisher.locals.ready
const listen = async (app, port) => { const s = app.listen(port, '127.0.0.1'); await once(s, 'listening'); return s }
const offset = Number(process.env.OFFSET); assert.equal(offset, 700)
const pub = await listen(publisher, 8790 + offset)
const api = await createApiApp({ payer, provider: productionProvider({ phase: 'testnet-sanity' }), publisherUrl: `http://127.0.0.1:${pub.address().port}`, dbPath: resolve(dir, 'app.db') })
const server = await listen(api.app, 8788 + offset), base = `http://127.0.0.1:${server.address().port}`
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RA_API_TOKEN}` }
const json = async (path, data) => { const r = await fetch(base + path, { headers: { ...headers, ...(path === '/runs' ? { 'Idempotency-Key': data.idempotencyKey } : {}) }, ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(150000) }); assert(r.ok, `HTTP ${r.status}`); return r.json() }
const summaries = []
try {
  for (const id of ['UC2', 'UC3']) {
    const spec = USE_CASES[id], scope = await json('/api/scope', { question: spec.question, clarify: 'never' })
    assert.match(scope.label, /DeepSeek/i, 'scope fixture fallback')
    // Product scope/plan/writer stay live; the story-bible clarify answer is explicit input.
    const existing = api.store.listRuns().find(r => r.question === spec.question)
    const start = existing ?? await json('/runs', { question: spec.question, budgetMinor: 200, ...(spec.answers ? { answers: spec.answers } : {}), idempotencyKey: `numbers-v7-${id}` })
    let run = start
    const deadline = Date.now() + 360000
    while (!['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) {
      assert(Date.now() < deadline, 'terminal timeout; preserve journals before recovery')
      await new Promise(r => setTimeout(r, 250)); run = await json(`/runs/${start.runId}`)
    }
    assert.equal(run.phase, 'DONE'); assert(run.answers.length)
    assert(run.answers.every(a => a.provider !== 'fixture'), 'writer fallback')
    assert(run.decisions.every(d => d.provider === 'openai' && !d.fallbackReason), 'decision fallback')
    assert(!run.events.some(e => e.type === 'DECISION_UNAVAILABLE'))
    assert(run.receipts.length, 'no purchase settled')
    const transactions = []
    for (const intent of run.intents.filter(i => i.txHash)) {
      for (const [kind, hash] of [['purchase', intent.txHash], ['refund', intent.refund?.txHash]]) {
        if (!hash) continue
        const tx = await lookupTx(ledger, hash); assert.equal(tx.state, 'validated'); assert.equal(tx.meta.TransactionResult, 'tesSUCCESS')
        transactions.push({ kind, resourceId: intent.resourceId, hash, ledgerIndex: tx.ledgerIndex, result: tx.meta.TransactionResult, amount: tx.meta.delivered_amount, feeDrops: String(tx.tx.Fee) })
      }
    }
    summaries.push({ id, runId: run.runId, labels: run.labels, spentMinor: run.spentMinor, refundedMinor: run.refundedMinor, coverage: run.checkpoint.coverage, purchases: run.intents.map(i => ({ resourceId: i.resourceId, status: i.status, txHash: i.txHash, refundTxHash: i.refund?.txHash })), finalAnswer: { provider: run.answers.at(-1).provider, version: run.answers.at(-1).version, claims: run.answers.at(-1).claims.length, citations: run.answers.at(-1).claims.flatMap(c => c.citations) }, transactions })
    console.log(JSON.stringify({ id, phase: run.phase, transactions }))
  }
  await Promise.all(pending)
  const audit = auditRuns(api.store.listRuns(), corpus, observations), chain = api.store.auditVerify()
  assert.equal(audit.total, 0); assert(chain.ok)
  const report = { at: new Date().toISOString(), labels: 'LIVE DeepSeek scope/planner/writer; LIVE Luna decisions/coverage; keyword search; SYNTHETIC corpus; real XRPL TESTNET settlement, no real value. Two sanity runs are not a statistical validation of the held-out percentage.', runs: summaries, gateAudit: audit, auditChain: chain, deepseekUsage: modelCalls }
  writeFileSync('docs/evidence/numbers-v7-testnet.json', JSON.stringify(report, null, 2) + '\n'); assertNoSecrets(['docs/evidence/numbers-v7-testnet.json'])
} finally {
  await Promise.all(pending); globalThis.fetch = realFetch
  server.closeAllConnections(); pub.closeAllConnections(); await Promise.all([new Promise(r => server.close(r)), new Promise(r => pub.close(r))]); await api.close(); publisher.locals.journal.close(); await ledger.close()
}
