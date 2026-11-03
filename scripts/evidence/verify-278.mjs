// Durable UC3 with a real Testnet refund and injected delivery fault; no live model calls.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { createPublisherApp } from '../../publisher/routes.ts'
import { loadWriterCorpus } from '../../publisher/corpus.ts'
import { createApiApp } from '../../server/routes.ts'
import { XrplPayer } from '../../server/xrpl.ts'
import { testnetLedger, lookupTx } from '../../shared/xrpl.ts'
import { receiptBundle } from '../../server/receipt-bundle.ts'
import { verifyAnswer, verificationText } from '../../sdk/verify.ts'
import { XRPL_LABEL } from '../../shared/contracts/index.ts'
import { USE_CASES } from '../../tests/scenarios/use-cases.ts'
import { auditRuns } from '../gate-audit.ts'
Object.assign(process.env, { LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', RA_API_TOKEN: randomBytes(32).toString('hex'), SPENDING_PAUSED: '0' })
const dir = resolve('scratch/verify-278'), out = resolve('docs/evidence/verify-278')
mkdirSync(dir, { recursive: true, mode: 0o700 }); mkdirSync(out, { recursive: true })
const corpus = await loadWriterCorpus(), ledger = testnetLedger()
const publisher = createPublisherApp({ writers: corpus, journal: resolve(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger, env: process.env })
await publisher.locals.ready
const offset = Number(process.env.OFFSET || 2200)
const pub = publisher.listen(8790 + offset, '127.0.0.1'); await once(pub, 'listening')
const api = await createApiApp({ payer: XrplPayer.fromEnv(), dbPath: resolve(dir, 'app.db'), publisherUrl: `http://127.0.0.1:${8790 + offset}`, reportDir: resolve(dir, 'reports'), reconcileIntervalMs: 1000000 })
const server = api.app.listen(8788 + offset, '127.0.0.1'); await once(server, 'listening')
let stage = 'run'
try {
  const idPath = resolve(dir, 'run-id.txt')
  const fresh = !existsSync(idPath)
  const runId = fresh ? api.store.createRun(USE_CASES.UC3.question, 200, { research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', publisher: 'local', settlement: XRPL_LABEL }).runId : readFileSync(idPath, 'utf8').trim()
  if (fresh) writeFileSync(idPath, runId, { mode: 0o600 })
  const client = api.purchases.client, original = client.paidGet.bind(client)
  let injected = false
  client.paidGet = async (path, signature, observer) => {
    const result = await original(path, signature, observer)
    if (!injected && signature && result.response?.success && !path.includes('alphaleak')) {
      injected = true
      writeFileSync(resolve(dir, 'fault.json'), JSON.stringify({ path, kind: 'injected delivery HTTP 503 after validated payment' }))
      return { ...result, status: 503, delivery: undefined }
    }
    return result
  }
  if (fresh) await api.loop.start(runId)
  client.paidGet = original
  const failed = api.store.getRun(runId)
  if (failed.phase === 'FAILED') {
    writeFileSync(resolve(out, 'before.json'), JSON.stringify({ phase: failed.phase, answers: failed.answers.length, receipts: failed.receipts.length, intents: failed.intents.map(i => ({ intentId: i.intentId, status: i.status, txHash: i.txHash })) }, null, 2))
    await api.reconcileOnce()
  }
  api.store.updateRun(runId, { labels: { ...api.store.getRun(runId).labels, settlement: XRPL_LABEL } })
  const run = api.store.getRun(runId)
  assert.equal(run.phase, 'DONE')
  assert(run.intents.some(i => i.status === 'REFUNDED'))
  assert(run.intents.some(i => i.status === 'VERIFIED'))
  assert.equal(run.receipts.length, 2)
  const b = receiptBundle(api.store, runId)
  stage = 'offline verification'
  const offline = await verifyAnswer(b)
  writeFileSync(resolve(out, 'offline.txt'), verificationText(offline) + '\n')
  assert(offline.ok, verificationText(offline))
  stage = 'Testnet verification'
  const online = await verifyAnswer(b, { testnet: true, ledger, expectHead: b.audit.head })
  writeFileSync(resolve(out, 'testnet.txt'), verificationText(online) + '\n')
  assert(online.ok, verificationText(online))
  const tampered = structuredClone(b), ref = tampered.answers.at(-1).claims[0].citations[0]
  const source = tampered.sources.find(s => s.resourceId === ref.resourceId && s.version === ref.version)
  source.spans.find(s => s.id === ref.spanId).text += 'X'
  const bad = await verifyAnswer(tampered)
  assert(!bad.ok)
  writeFileSync(resolve(out, 'receipts.json'), JSON.stringify(b, null, 2) + '\n')
  writeFileSync(resolve(out, 'tampered.json'), JSON.stringify(tampered, null, 2) + '\n')
  writeFileSync(resolve(out, 'tampered.txt'), verificationText(bad) + '\n')
  stage = 'gate audit'
  const gate = auditRuns([run], corpus); assert.equal(gate.total, 0)
  stage = 'PDF export'
  const response = await fetch(`http://127.0.0.1:${8788 + offset}/runs/${runId}/report`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.RA_API_TOKEN}` } })
  assert(response.ok)
  const report = await response.json()
  assert.equal(report.format, 'PDF')
  copyFileSync(resolve(dir, 'reports', `${runId}.pdf`), resolve(out, 'report.pdf'))
  copyFileSync(resolve(dir, 'reports', `${runId}.receipts.json`), resolve(out, 'report.json'))
  const transactions = []
  for (const intent of run.intents) for (const hash of [intent.txHash, intent.refund?.txHash].filter(Boolean)) {
    const tx = await lookupTx(ledger, hash); assert.equal(tx.state, 'validated')
    transactions.push({ hash, ledgerIndex: tx.ledgerIndex, feeDrops: tx.tx.Fee, delivered: tx.meta.delivered_amount })
  }
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify({ observedAt: new Date().toISOString(), label: 'XRPL TESTNET, no real value; SYNTHETIC articles, fixture research/decisions; injected HTTP delivery failure', runId, phase: run.phase, answers: run.answers.length, receipts: run.receipts.length, spentMinor: run.spentMinor, refundedMinor: run.refundedMinor, transactions, recovery: api.store.auditEntries().filter(e => e.kind === 'recovery'), gate, head: b.audit.head, tamper: { ...ref, appendedByte: 'X' }, offlineChecks: offline.checks.length, onlineChecks: online.checks.length }, null, 2) + '\n')
  console.log(JSON.stringify({ runId, phase: run.phase, checks: online.checks.length, receipts: run.receipts.length, refunds: run.intents.filter(i => i.refund).length, tamper: bad.ok ? 'UNEXPECTED PASS' : 'FAIL as expected' }))
} catch { console.error(`Evidence stopped at ${stage}. Preserve scratch/verify-278; rerun reuses the same run and intents.`); process.exitCode = 1 }
finally {
  server.closeAllConnections(); pub.closeAllConnections()
  await Promise.all([new Promise(r => server.close(r)), new Promise(r => pub.close(r))])
  await api.close(); publisher.locals.journal.close(); await ledger.close()
}
