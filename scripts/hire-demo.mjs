// node --import tsx scripts/hire-demo.mjs [--live]. Testnet only; never prints seeds.
import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client, Wallet } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.ts'
import { loadWriterCorpus } from '../publisher/corpus.ts'
import { seedEnvName } from '../publisher/registry.ts'
import { createApiApp } from '../server/routes.ts'
import { XrplPayer } from '../server/xrpl.ts'
import { testnetLedger, testnetUrl, lookupTx } from '../shared/xrpl.ts'
import { payAndFetch } from '../sdk/x402.ts'
import { openPaymentJournal } from '../sdk/x402-journal.ts'
import { hireLedger } from '../tests/fixtures/hire-ledger.ts'
import { USE_CASES } from '../tests/scenarios/use-cases.ts'
import { auditRuns } from './gate-audit.ts'

const live = process.argv.includes('--live')
const dir = resolve(process.env.HIRE_DEMO_DIR || (live ? 'data/hire-demo-live' : 'data/hire-demo-fixture'))
mkdirSync(dir, { recursive: true, mode: 0o700 })
const walletFile = resolve(dir, 'caller.private.json')
let caller
if (existsSync(walletFile)) caller = Wallet.fromSeed(JSON.parse(readFileSync(walletFile, 'utf8')).seed)
else {
  caller = Wallet.generate()
  writeFileSync(walletFile, JSON.stringify({ seed: caller.seed }), { mode: 0o600 })
}
if (live) {
  const faucet = new Client(testnetUrl())
  try {
    await faucet.connect()
    try { await faucet.request({ command: 'account_info', account: caller.classicAddress, ledger_index: 'validated' }) }
    catch (error) {
      if (error?.data?.error !== 'actNotFound') throw new Error('Caller balance check failed', { cause: error })
      await faucet.fundWallet(caller)
    }
  } finally { await faucet.disconnect() }
}
// Research is deliberately fixture: the payment chain is what this demo measures.
Object.assign(process.env, { LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', SPENDING_PAUSED: '0' })
const corpus = await loadWriterCorpus()
const synthetic = live ? undefined : hireLedger()
const ledger = live ? testnetLedger() : synthetic.ledger
const env = { ...process.env }
if (!live) for (const p of corpus.publishers) env[seedEnvName(p.slug)] = Wallet.generate().seed
const payer = new XrplPayer(ledger, live ? Wallet.fromSeed(process.env.XRPL_PAYER_SEED) : Wallet.generate(), { pollMs: live ? 1000 : 1, timeoutMs: 120000 })
const publisher = createPublisherApp({ writers: corpus, journal: resolve(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger, env })
await publisher.locals.ready
const listen = async (app, port) => {
  const server = app.listen(port, '127.0.0.1')
  await new Promise((done, fail) => { server.once('listening', done); server.once('error', fail) })
  return server
}
const offset = Number(process.env.OFFSET || 1300)
const pub = await listen(publisher, live ? 8790 + offset : 0)
const token = process.env.RA_API_TOKEN || 'local-fixture-hire-demo'
process.env.RA_API_TOKEN = token
const api = await createApiApp({ payer, dbPath: resolve(dir, 'app.db'), publisherUrl: `http://127.0.0.1:${pub.address().port}` })
const server = await listen(api.app, live ? 8788 + offset : 0)
const journal = openPaymentJournal(resolve(dir, 'caller.db'))
try {
  const url = `http://127.0.0.1:${server.address().port}/v1/ask`
  const opts = { wallet: caller, maxDrops: '220000', ledger, journal, method: 'POST',
    body: JSON.stringify({ question: USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), budgetMinor: 200 }),
    idempotencyKey: 'hire-demo-v1', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  const paid = await payAndFetch(url, opts)
  const result = await paid.response.json()
  if (!paid.response.ok || !result.moneyChain) throw new Error(`Hire failed: HTTP ${paid.response.status}`)
  const replay = await payAndFetch(url, opts)
  if (JSON.stringify(await replay.response.json()) !== JSON.stringify(result)) throw new Error('Replay changed result')
  const run = api.store.getRun(result.run_id)
  const audit = auditRuns([run], corpus, [], [{ runId: run.runId, budgetMinor: 200, result }])
  if (audit.total) throw new Error(`Gate audit found ${audit.total} violations`)
  const hashes = [result.moneyChain.inbound.txHash, ...result.purchases.map(p => p.txHash).filter(Boolean), ...result.moneyChain.payments.map(p => p.txHash)]
  const transactions = []
  for (const txHash of hashes) {
    const found = await lookupTx(ledger, txHash)
    if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS') throw new Error('Unvalidated demo transaction')
    transactions.push({ txHash, from: found.tx.Account, to: found.tx.Destination, amountDrops: found.meta.delivered_amount, feeDrops: found.tx.Fee, invoiceId: found.tx.InvoiceID, memos: found.tx.Memos, ledgerIndex: found.ledgerIndex, explorerUrl: live ? `https://testnet.xrpl.org/transactions/${txHash}` : null })
  }
  const totalDrops = transactions.reduce((s, t) => s + BigInt(t.amountDrops) + BigInt(t.feeDrops), 0n)
  if (totalDrops >= 1000000n) throw new Error('Demo exceeded one XRP gross movement plus fees')
  const evidence = { label: live ? 'XRPL TESTNET · no real value' : 'SIMULATED ledger · no network; hashes are synthetic', research: 'fixture · fictional corpus · extractive answer and metadata decisions', replayIdentical: true, gateAudit: audit, totalDrops: String(totalDrops), faucetFundingExcluded: true, transactions, result }
  writeFileSync(resolve(dir, 'chain.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  journal.close()
  server.closeAllConnections(); pub.closeAllConnections()
  await Promise.all([new Promise(done => server.close(done)), new Promise(done => pub.close(done))])
  await api.drain(); api.close(); publisher.locals.journal.close(); await ledger.close?.()
}
