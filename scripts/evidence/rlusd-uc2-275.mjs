// Full API/SDK UC2, fixture research and genuine Testnet issued settlement.
import 'dotenv/config'
import { Client, Wallet } from 'xrpl'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createPublisherApp } from '../../publisher/routes.ts'
import { createApiApp } from '../../server/routes.ts'
import { loadWriterCorpus } from '../../publisher/corpus.ts'
import { createClient } from '../../sdk/index.ts'
import { XrplPayer } from '../../server/xrpl.ts'
import { testnetUrl, testnetLedger, lookupTx } from '../../shared/xrpl.ts'
import { RLUSD_CURRENCY } from '../../shared/contracts/asset.ts'
import { ensureTrustLine } from '../rlusd-wallets.ts'
import { USE_CASES } from '../../tests/scenarios/use-cases.ts'
import { auditRuns } from '../gate-audit.ts'
const dir = 'scratch/rlusd-275/uc2', publicPath = 'docs/evidence/rlusd-275-refund-310.json'
mkdirSync(dir, { recursive: true, mode: 0o700 })
const issuer = Wallet.fromSeed(JSON.parse(readFileSync('scratch/rlusd-275/issuer.private.json')).seed)
const writer = Wallet.fromSeed(process.env.XRPL_PUBLISHER_NOTFINANCIALTIMES_SEED)
const payerWallet = Wallet.fromSeed(process.env.XRPL_PAYER_SEED)
const c = new Client(testnetUrl())
await c.connect()
let trustHash, writerBefore
try {
 trustHash = await ensureTrustLine(c, writer, issuer.classicAddress)
 const lines = (await c.request({ command: 'account_lines', account: writer.classicAddress, peer: issuer.classicAddress, ledger_index: 'validated' })).result.lines
 writerBefore = lines.find(l => l.currency === RLUSD_CURRENCY)?.balance
} finally { await c.disconnect() }
const beforePath = `${dir}/before-public.json`
if (!existsSync(beforePath)) writeFileSync(beforePath, JSON.stringify({ writerBefore, trustHash }))
const before = JSON.parse(readFileSync(beforePath))
Object.assign(process.env, { LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '500', XRPL_RLUSD_ISSUER: issuer.classicAddress, XRPL_PUBLISHER_NOTFINANCIALTIMES_CURRENCY: 'RLUSD' })
const corpus = await loadWriterCorpus(), ledger = testnetLedger()
const publisher = createPublisherApp({ journal: `${dir}/publisher.db`, writers: corpus, rail: 'xrpl-testnet', ledger, env: process.env })
await publisher.locals.ready
const offset = Number(process.env.OFFSET || 1900)
const listen = async (app, port) => { const s = app.listen(port, '127.0.0.1'); await new Promise((resolve,reject) => { s.once('listening', resolve); s.once('error', reject) }); return s }
const pub = await listen(publisher, 8790 + offset)
const api = await createApiApp({ payer: new XrplPayer(ledger, payerWallet), publisherUrl: `http://127.0.0.1:${pub.address().port}`, dbPath: `${dir}/app.db` })
const server = await listen(api.app, 8788 + offset)
try {
 const sdk = createClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, token: process.env.RA_API_TOKEN })
 const question = USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?')
 const result = await sdk.ask(question, { budgetSgd: 2, idempotencyKey: 'rlusd-275-uc2' })
 const run = api.store.getRun(result.run_id), intent = run.intents.find(i => i.status === 'VERIFIED')
 if (!intent || intent.quote.payment.asset === 'XRP') throw new Error('UC2 did not buy issued currency')
 const gate = auditRuns([run], corpus)
 if (gate.total || !api.store.auditVerify().ok) throw new Error('UC2 gate/audit failed')
 const replay = await sdk.ask(question, { budgetSgd: 2, idempotencyKey: 'rlusd-275-uc2' })
 if (JSON.stringify(replay.purchases) !== JSON.stringify(result.purchases)) throw new Error('UC2 replay changed purchase')
 const tx = await lookupTx(ledger, intent.txHash)
 if (tx.state !== 'validated' || tx.meta.TransactionResult !== 'tesSUCCESS') throw new Error('UC2 unvalidated')
 const after = (await ledger.request({ command: 'account_lines', account: writer.classicAddress, peer: issuer.classicAddress, ledger_index: 'validated' })).result.lines
 const e = JSON.parse(readFileSync(publicPath))
 e.uc2IssuedPurchase = { label: 'test USD (substitute for RLUSD) · fixture research · SYNTHETIC corpus · XRPL Testnet', runId: run.runId, txHash: intent.txHash, ledgerIndex: tx.ledgerIndex, deliveredAmount: tx.meta.delivered_amount, feeDrops: tx.tx.Fee, writer: writer.classicAddress, writerBefore: before.writerBefore, writerAfter: after.find(l => l.currency === RLUSD_CURRENCY)?.balance, trustLineTxHash: before.trustHash, replayIdentical: true, gateAudit: gate, auditChain: api.store.auditVerify(), result }
 writeFileSync(publicPath, JSON.stringify(e,null,2))
 console.log(JSON.stringify({ uc2TxHash: intent.txHash, delivered: tx.meta.delivered_amount, gateViolations: gate.total }))
} finally {
 server.closeAllConnections(); pub.closeAllConnections()
 await Promise.all([new Promise(r => server.close(r)), new Promise(r => pub.close(r))])
 await api.close(); publisher.locals.journal.close(); await ledger.close()
}
