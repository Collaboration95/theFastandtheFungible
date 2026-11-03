// One policy-selected purchase, real XRPL Testnet; research uses labelled fixtures.
import 'dotenv/config'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Wallet } from 'xrpl'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createPublisherApp } from '../publisher/routes.ts'
import { loadWriterCorpus } from '../publisher/corpus.ts'
import { createApiApp } from '../server/routes.ts'
import { XrplPayer } from '../server/xrpl.ts'
import { testnetLedger, lookupTx } from '../shared/xrpl.ts'
import { Store } from '../server/store.ts'
import { startMcpHttp } from '../mcp/http.ts'
import { USE_CASES } from '../tests/scenarios/use-cases.ts'
Object.assign(process.env, { LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', SPENDING_PAUSED: '0' })
const dir = resolve('data/app-mcp-http-proof')
if (existsSync(resolve(dir, 'app.db'))) throw new Error('Proof store already exists; inspect evidence instead of making another purchase')
mkdirSync(dir, { recursive: true, mode: 0o700 })
const ledger = testnetLedger()
const payer = new XrplPayer(ledger, Wallet.fromSeed(process.env.XRPL_PAYER_SEED), { pollMs: 1000, timeoutMs: 120000 })
const publisher = createPublisherApp({ writers: await loadWriterCorpus(), journal: resolve(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger, env: process.env })
await publisher.locals.ready
const listen = async app => { const s = app.listen(0, '127.0.0.1'); await new Promise((done, fail) => { s.once('listening', done); s.once('error', fail) }); return s }
const pub = await listen(publisher)
const api = await createApiApp({ payer, dbPath: resolve(dir, 'app.db'), publisherUrl: `http://127.0.0.1:${pub.address().port}` })
const backend = await listen(api.app)
const store = new Store(resolve(dir, 'app.db'))
const agent = store.addAgent({ name: 'HTTP proof', maxMinor: 100, dailyMinor: 100 })
const http = await startMcpHttp({ apiUrl: `http://127.0.0.1:${backend.address().port}`, store })
const client = new Client({ name: 'app-http-proof', version: '1' })
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(http.url), { requestInit: { headers: { Authorization: `Bearer ${agent.token}` } } }))
  const result = await client.callTool({ name: 'ask_expert', arguments: { question: USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), budget_sgd: 999, idempotency_key: 'single-testnet-purchase' } })
  if (result.isError) throw new Error('Proof ask failed; inspect durable state before retry')
  const run = JSON.parse(result.content[0].text)
  const purchases = store.getRun(run.run_id).receipts
  if (purchases.length !== 1 || !purchases[0].xrpl?.txHash) throw new Error('Expected exactly one Testnet purchase')
  const hash = purchases[0].xrpl.txHash
  const tx = await lookupTx(ledger, hash)
  const evidence = { at: new Date().toISOString(), runId: run.run_id, principal: agent.id, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, labels: run.labels, txHash: hash, ledger: tx }
  writeFileSync('docs/evidence/app-mcp-http.md', `# App MCP HTTP proof\n\nReal XRPL Testnet settlement; fictional corpus and fixture research/decision providers. No mainnet funds or live model calls. SDK Streamable HTTP client → per-agent bearer → policy admission (requested S$999 clamped to S$1) → exactly one purchase. This proves the HTTP/payment path using the local Testnet payer, not a packaged Electron/Keychain acceptance run.\n\nTransaction: https://testnet.xrpl.org/transactions/${hash}\n\nCommand: OFFSET=900 node --import tsx scripts/app-mcp-proof.mjs\n\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\`\n`)
  console.log(JSON.stringify({ runId: run.run_id, txHash: hash, spentMinor: run.spentMinor }))
} finally {
  store.setAgentPaused(agent.id, true, true)
  await client.close(); await http.close(); store.close(); await api.drain()
  await new Promise(done => backend.close(done)); await api.close()
  await new Promise(done => pub.close(done)); publisher.locals.journal?.close(); await ledger.close()
}
