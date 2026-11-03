// One existing Testnet payer, two MCP stdio clients and an SDK caller. No model/provider calls.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { Wallet } from 'xrpl'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createPublisherApp } from '../../publisher/routes.ts'
import { loadWriterCorpus } from '../../publisher/corpus.ts'
import { createApiApp } from '../../server/routes.ts'
import { XrplPayer } from '../../server/xrpl.ts'
import { testnetLedger, lookupTx } from '../../shared/xrpl.ts'
import { createClient } from '../../sdk/index.ts'
import { USE_CASES } from '../../tests/scenarios/use-cases.ts'
import { auditRuns } from '../gate-audit.ts'
import { auditAgentAuthority } from '../../server/agent-audit.ts'
import { toCsv, toJsonl } from '../../server/audit.ts'

Object.assign(process.env, { LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', SPENDING_PAUSED: '0', WALLET_DAILY_CAP_MINOR: '600', RA_API_TOKEN: randomBytes(32).toString('hex') })
const dir = resolve('scratch/agents-280'); mkdirSync(dir, { recursive: true, mode: 0o700 })
const ledger = testnetLedger(), corpus = await loadWriterCorpus()
const payer = new XrplPayer(ledger, Wallet.fromSeed(process.env.XRPL_PAYER_SEED), { pollMs: 1000, timeoutMs: 120000 })
const publisher = createPublisherApp({ writers: corpus, journal: resolve(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger, env: process.env })
await publisher.locals.ready
const listen = async (app, port) => { const server = app.listen(port, '127.0.0.1'); await once(server, 'listening'); return server }
const offset = Number(process.env.OFFSET || 2000)
const pub = await listen(publisher, 8790 + offset)
const api = await createApiApp({ payer, dbPath: resolve(dir, 'app.db'), publisherUrl: `http://127.0.0.1:${pub.address().port}` })
const server = await listen(api.app, 8788 + offset), baseUrl = `http://127.0.0.1:${server.address().port}`
const clients = []
let stage = 'configure'
try {
  const info = (await ledger.request({ command: 'server_info' })).result.info
  assert.equal(info.network_id, 1)
  const keyFile = resolve(dir, 'keys.private.json')
  const keys = existsSync(keyFile) ? JSON.parse(readFileSync(keyFile, 'utf8')) : [
    api.store.addAgent({ name: 'MCP A', maxMinor: 100, dailyMinor: 100 }),
    api.store.addAgent({ name: 'SDK and MCP B', maxMinor: 200, dailyMinor: 300 }),
  ]
  if (!existsSync(keyFile)) writeFileSync(keyFile, JSON.stringify(keys), { mode: 0o600 })
  for (const key of keys) {
    const c = new Client({ name: key.name, version: '1' })
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', resolve('mcp/server.ts')],
      env: { PATH: process.env.PATH, RA_BACKEND_URL: baseUrl, RA_API_TOKEN: key.token }, stderr: 'pipe' })
    transport.stderr?.on('data', () => {})
    await c.connect(transport); clients.push(c)
  }
  const call = async (client, name, args = {}) => { const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 150000 }); assert(!r.isError); return JSON.parse(r.content[0].text) }
  const question = USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?')
  stage = 'MCP A'
  let a
  if (!api.store.agentKeys.get(keys[0].id).revoked) a = await call(clients[0], 'ask_expert', { question, budget_sgd: 5, idempotency_key: 'agents-280-A' })
  else { const admission = api.store.listRuns().find(r => api.store.runPrincipal(r.runId)?.principal === keys[0].id); a = { run_id: admission.runId, budgetMinor: admission.budgetMinor, spentMinor: admission.spentMinor } }
  assert.equal(a.budgetMinor, 100)
  stage = 'SDK B'
  const sdk = createClient({ baseUrl, token: keys[1].token })
  let b = await sdk.ask(question, { budgetSgd: 5, idempotencyKey: 'agents-280-B', signal: AbortSignal.timeout(150000) })
  stage = 'MCP B same-intent retry'
  const retry = await call(clients[1], 'ask_expert', { question, budget_sgd: 5, idempotency_key: 'agents-280-B' })
  assert.equal(b.run_id, retry.run_id); assert.equal(b.spentMinor, retry.spentMinor)
  assert.equal(b.budgetMinor, 200)
  for (const id of [a.run_id, b.run_id]) assert(api.store.getRun(id).receipts.length > 0)
  stage = 'revoke A'
  api.store.setAgentPaused(keys[0].id, true, true)
  const blocked = await clients[0].callTool({ name: 'ask_expert', arguments: { question, budget_sgd: 5, idempotency_key: 'revoked-new' } })
  assert(blocked.isError)
  stage = 'verify'
  const rows = api.store.receiptRows(), transactions = []
  for (const row of rows) {
    const tx = await lookupTx(ledger, row.txHash)
    assert.equal(tx.state, 'validated'); assert.equal(tx.meta.TransactionResult, 'tesSUCCESS')
    transactions.push({ principal: row.principal, hash: row.txHash, amountDrops: row.amountDrops, ledgerIndex: tx.ledgerIndex, result: tx.meta.TransactionResult, feeDrops: String(tx.tx.Fee) })
  }
  const audit = auditRuns(api.store.listRuns(), corpus), agentGate = auditAgentAuthority(api.store.auditEntries()), chain = api.store.auditVerify()
  assert.equal(audit.total, 0); assert.equal(agentGate.length, 0); assert(chain.ok)
  const agents = keys.map(key => api.store.agentStatus(key.id))
  for (const agent of agents) assert(agent.spentMinor + agent.reservedMinor <= agent.dailyMinor)
  const report = { label: 'XRPL TESTNET · no real value; SYNTHETIC corpus and fixture research/decisions; real stdio MCP clients, SDK and product payment path. No Claude model invoked.', observedAt: new Date().toISOString(), payer: payer.address,
    wallet: api.store.walletStatus(), agents, transactions, totalPrincipalDrops: transactions.reduce((s,t) => s + Number(t.amountDrops), 0), feeDrops: transactions.reduce((s,t) => s + Number(t.feeDrops), 0),
    demo: { mcpA: { runId: a.run_id, budgetMinor: a.budgetMinor, spentMinor: a.spentMinor }, sdkB: { runId: b.run_id, budgetMinor: b.budgetMinor, spentMinor: b.spentMinor }, mcpBRetrySameRun: true, revokedANewAdmissionBlocked: true }, gateAudit: audit, agentAuthorityViolations: agentGate, auditChain: chain }
  writeFileSync('docs/evidence/agents-280.json', JSON.stringify(report, null, 2) + '\n')
  writeFileSync('docs/evidence/agents-280-receipts.csv', toCsv(rows))
  writeFileSync('docs/evidence/agents-280-receipts.jsonl', toJsonl(rows))
  console.log(JSON.stringify({ result: 'PASS', agents: agents.length, principalDrops: report.totalPrincipalDrops, feeDrops: report.feeDrops, hashes: transactions.map(t => t.hash), gateViolations: audit.total + agentGate.length }))
} catch { console.error(`Two-agent demo stopped at ${stage}; private recovery state retained. Rerun the same command.`); process.exitCode = 1 }
finally {
  for (const c of clients) await c.close()
  server.closeAllConnections(); await new Promise(r => server.close(r)); await api.close()
  pub.closeAllConnections(); await new Promise(r => pub.close(r)); publisher.locals.journal.close()
}
