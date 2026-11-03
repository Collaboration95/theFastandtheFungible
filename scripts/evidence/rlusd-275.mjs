// Testnet only. Private recovery state is never copied into evidence.
import 'dotenv/config'
import { Client, Wallet } from 'xrpl'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { testnetUrl } from '../../shared/xrpl.ts'
import { ensureTrustLine } from '../rlusd-wallets.ts'
import { createPublisherApp } from '../../publisher/routes.ts'
import { Store } from '../../server/store.ts'
import { PurchaseManager } from '../../server/purchases.ts'
import { PublisherClient } from '../../server/publisher-client.ts'
import { XrplPayer } from '../../server/xrpl.ts'
import { testnetLedger, lookupTx } from '../../shared/xrpl.ts'
import { alphaLeakCorpus } from '../../tests/fixtures/corpus-mini/index.ts'
import { candidateFrom, honestArticle } from '../../tests/fixtures/pay-path.ts'
import { RLUSD_CURRENCY } from '../../shared/contracts/asset.ts'
const dir = 'scratch/rlusd-275'
mkdirSync(dir, { recursive: true, mode: 0o700 })
const file = `${dir}/issuer.private.json`
let issuer
if (existsSync(file)) issuer = Wallet.fromSeed(JSON.parse(readFileSync(file)).seed)
else { issuer = Wallet.generate(); writeFileSync(file, JSON.stringify({ seed: issuer.seed }), { mode: 0o600 }) }
const c = new Client(testnetUrl())
await c.connect()
const previousSetup = existsSync(`${dir}/setup-public.json`) ? JSON.parse(readFileSync(`${dir}/setup-public.json`)) : undefined
const setup = previousSetup?.setup ?? []
try {
  try { await c.request({ command: 'account_info', account: issuer.classicAddress, ledger_index: 'validated' }) }
  catch (e) { if (e.data?.error !== 'actNotFound') throw e; await c.fundWallet(issuer) }
  const account = (await c.request({ command: 'account_info', account: issuer.classicAddress, ledger_index: 'validated' })).result.account_data
  if (!(account.Flags & 0x00800000)) {
    const t = await c.autofill({ TransactionType: 'AccountSet', Account: issuer.classicAddress, SetFlag: 8 })
    if (Number(t.Fee) > 2000) throw new Error('Fee cap')
    const r = await c.submitAndWait(issuer.sign(t).tx_blob)
    if (r.result.meta.TransactionResult !== 'tesSUCCESS') throw new Error('Issuer setup failed')
    setup.push({ kind: 'issuer DefaultRipple', txHash: r.result.hash })
  }
  const payer = Wallet.fromSeed(process.env.XRPL_PAYER_SEED), writer = Wallet.fromSeed(process.env.XRPL_PUBLISHER_LOAD_FACTOR_SEED)
  for (const wallet of [payer, writer]) {
    const hash = await ensureTrustLine(c, wallet, issuer.classicAddress)
    if (hash) setup.push({ kind: 'trust line', account: wallet.classicAddress, txHash: hash })
  }
  const lines = (await c.request({ command: 'account_lines', account: payer.classicAddress, peer: issuer.classicAddress, ledger_index: 'validated' })).result.lines
  if (Number(lines.find(l => l.currency === RLUSD_CURRENCY)?.balance ?? 0) < 1) {
    const t = await c.autofill({ TransactionType: 'Payment', Account: issuer.classicAddress, Destination: payer.classicAddress, Amount: { currency: RLUSD_CURRENCY, issuer: issuer.classicAddress, value: '1' } })
    if (Number(t.Fee) > 2000) throw new Error('Fee cap')
    const r = await c.submitAndWait(issuer.sign(t).tx_blob)
    if (r.result.meta.TransactionResult !== 'tesSUCCESS') throw new Error('Mint failed')
    setup.push({ kind: 'stand-in mint', txHash: r.result.hash })
  }
  const before = (await c.request({ command: 'account_lines', account: writer.classicAddress, peer: issuer.classicAddress, ledger_index: 'validated' })).result.lines
  writeFileSync(`${dir}/setup-public.json`, JSON.stringify({ label: 'test USD (substitute for RLUSD) · XRPL Testnet · no value or dollar backing', issuer: issuer.classicAddress, officialIssuer: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', officialFaucet: 'https://tryrlusd.com/api/mint-xrpl', officialFaucetResult: 'HTTP 401 Authentication required', issuerFlags: account.Flags | 0x800000, setup, writer: writer.classicAddress, writerBalanceBefore: previousSetup?.writerBalanceBefore ?? before.find(l => l.currency === RLUSD_CURRENCY)?.balance }, null, 2))
} finally { await c.disconnect() }
if (!existsSync(`${dir}/hire/chain.json`)) {
const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/hire-demo.mjs', '--live', '--deny-writer'], { stdio: 'inherit', env: { ...process.env, OFFSET: '1900', HIRE_DEMO_DIR: `${dir}/hire`, XRPL_PUBLISHER_LOAD_FACTOR_CURRENCY: 'RLUSD', XRPL_RLUSD_ISSUER: issuer.classicAddress } })
const code = await new Promise(resolve => child.once('exit', resolve))
if (code) throw new Error('Hire demo failed')
}
const chain = JSON.parse(readFileSync(`${dir}/hire/chain.json`)), provision = JSON.parse(readFileSync(`${dir}/setup-public.json`))
const ledger = testnetLedger(), store = new Store(`${dir}/rlusd-buyer.db`)
const app = createPublisherApp({ journal: `${dir}/rlusd-publisher.db`, rail: 'xrpl-testnet', ledger, writers: alphaLeakCorpus, env: { ...process.env, XRPL_PUBLISHER_LOAD_FACTOR_CURRENCY: 'RLUSD', XRPL_RLUSD_ISSUER: issuer.classicAddress } })
await app.locals.ready
const server = app.listen(8790 + Number(process.env.OFFSET || 1900), '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
let purchase
try {
 const baseUrl = `http://127.0.0.1:${server.address().port}`
 const run = store.listRuns()[0] ?? store.createRun('SYNTHETIC article purchase for RLUSD Testnet integration', 100)
 const manager = new PurchaseManager(store, new PublisherClient({ baseUrl }), new XrplPayer(ledger, Wallet.fromSeed(process.env.XRPL_PAYER_SEED)))
 const intentId = 'rlusd-275:article'
 const start = Date.now()
 if (!store.getIntent(intentId)) await manager.purchase({ runId: run.runId, candidate: await candidateFrom(baseUrl, honestArticle), intentId })
 else await manager.reconcile()
 const intent = store.getIntent(intentId)
 if (intent.status !== 'VERIFIED') throw new Error(`Issued purchase did not verify: ${intent.status} ${intent.error}`)
 const paid = await lookupTx(ledger, intent.txHash)
 if (paid.state !== 'validated' || paid.meta.TransactionResult !== 'tesSUCCESS' || typeof paid.meta.delivered_amount !== 'object') throw new Error('Issued settlement not proven')
 const replay = await manager.purchase({ runId: run.runId, candidate: await candidateFrom(baseUrl, honestArticle), intentId })
 if (replay.txHash !== intent.txHash) throw new Error('Replay changed payment')
 const after = (await ledger.request({ command: 'account_lines', account: provision.writer, peer: issuer.classicAddress, ledger_index: 'validated' })).result.lines
 purchase = { label: 'test USD (substitute for RLUSD) · SYNTHETIC article · XRPL Testnet', txHash: intent.txHash, ledgerIndex: paid.ledgerIndex, result: paid.meta.TransactionResult, deliveredAmount: paid.meta.delivered_amount, payer: paid.tx.Account, writer: paid.tx.Destination, feeDrops: paid.tx.Fee, writerBalanceBefore: provision.writerBalanceBefore, writerBalanceAfter: after.find(l => l.currency === RLUSD_CURRENCY)?.balance, elapsedMs: Date.now() - start, replayIdentical: true, proofVerified: true, audit: store.auditVerify() }
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); app.locals.journal.close(); store.close(); await ledger.close() }
const evidence = { ...provision, ...chain, issuedPurchase: purchase }
writeFileSync('docs/evidence/rlusd-275-refund-310.json', JSON.stringify(evidence, null, 2))
console.log(JSON.stringify({ evidence: 'docs/evidence/rlusd-275-refund-310.json', issuer: issuer.classicAddress, hashes: chain.transactions.map(t => t.txHash) }))
