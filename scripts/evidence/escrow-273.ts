// Testnet product integration, SYNTHETIC mini corpus. Durable state is private/ignored.
import 'dotenv/config'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { Wallet } from 'xrpl'
import { createPublisherApp } from '../../publisher/routes.js'
import { testnetLedger, lookupTx } from '../../shared/xrpl.js'
import { ledgerTime } from '../../shared/escrow.js'
import { Store } from '../../server/store.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { PurchaseManager } from '../../server/purchases.js'
import { XrplPayer } from '../../server/xrpl.js'
import { alphaLeakCorpus } from '../../tests/fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle, alphaLeakArticle } from '../../tests/fixtures/pay-path.js'

process.env.LANGFUSE_ENABLED = '0'
const dir = 'scratch/escrow-273'
mkdirSync(dir, { recursive: true, mode: 0o700 })
const ledger = testnetLedger(), store = new Store(`${dir}/buyer.db`)
const statePath = `${dir}/run.json`
const state: { runId?: string; started?: Record<string, number> } = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {}
const save = () => writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 })
let stage = 'configure'
let closePublisher: (() => Promise<void>) | undefined
try {
  if (!process.env.XRPL_PAYER_SEED) throw new Error('Missing signer')
  const wallet = Wallet.fromSeed(process.env.XRPL_PAYER_SEED)
  const info = (await ledger.request({ command: 'server_info' })).result.info
  if (info.network_id !== 1) throw new Error('Wrong network')
  const app = createPublisherApp({ journal: `${dir}/publisher.db`, rail: 'xrpl-testnet', ledger, writers: alphaLeakCorpus, escrowWriters: ['load-factor', 'alphaleak'], env: process.env })
  await app.locals.ready
  const port = 8790 + Number(process.env.OFFSET ?? 1600)
  const server = app.listen(port, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  closePublisher = () => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); app.locals.journal.close() })
  const baseUrl = `http://127.0.0.1:${port}`
  if (!state.runId) { state.runId = store.createRun('SYNTHETIC #273 honest and failed-proof escrow demonstration', 200).runId; save() }
  state.started ??= {}
  const manager = new PurchaseManager(store, new PublisherClient({ baseUrl }), new XrplPayer(ledger, wallet))
  for (const [name, article] of [['finish', honestArticle], ['cancel', alphaLeakArticle]] as const) {
    stage = name
    const intentId = `escrow-273:${name}`
    if (!store.getIntent(intentId)) {
      const candidate = await candidateFrom(baseUrl, article)
      if (candidate.price.amountMinor * 1000 > 100000) throw new Error('Demo spend ceiling')
      state.started[name] = Date.now(); save()
      await manager.purchase({ runId: state.runId, candidate, intentId, escrow: true })
    } else await manager.reconcile()
    console.log(JSON.stringify({ stage, state: store.getIntent(intentId)?.escrow?.state }))
  }
  // Cancellation demonstrates writer independence, with the HTTP publisher shut down.
  await closePublisher(); closePublisher = undefined
  stage = 'cancel recovery with writer offline'
  const deadline = Date.now() + 240000
  while (store.getIntent('escrow-273:cancel')?.escrow?.state !== 'CANCELLED') {
    if (Date.now() > deadline) throw new Error('Pending cancellation; rerun same state')
    await manager.reconcile()
    console.log(JSON.stringify({ stage, ledgerTime: await ledgerTime(ledger), cancelAfter: store.getIntent('escrow-273:cancel')?.escrow?.cancelAfter }))
    await new Promise(r => setTimeout(r, 5000))
  }
  stage = 'public evidence'
  const transactions = []
  for (const row of store.escrowOutbox()) {
    const found = await lookupTx(ledger, row.txHash)
    if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS') throw new Error('Not validated')
    type AccountNode = { LedgerEntryType: string; FinalFields?: { Account?: string; Balance?: string; OwnerCount?: number }; PreviousFields?: { Balance?: string; OwnerCount?: number } }
    const nodes = found.meta.AffectedNodes as { ModifiedNode?: AccountNode }[]
    const buyer = nodes.map(n => n.ModifiedNode).find(n => n?.LedgerEntryType === 'AccountRoot' && n.FinalFields?.Account === wallet.classicAddress)
    transactions.push({ buyerBalanceChangeDrops: buyer?.FinalFields?.Balance && buyer?.PreviousFields?.Balance ? Number(buyer.FinalFields.Balance) - Number(buyer.PreviousFields.Balance) : null,
      ownerCountBefore: buyer?.PreviousFields?.OwnerCount ?? buyer?.FinalFields?.OwnerCount, ownerCountAfter: buyer?.FinalFields?.OwnerCount,
      intentId: row.intentId, operation: row.operation, hash: row.txHash, ledgerIndex: found.ledgerIndex, result: found.meta.TransactionResult, feeDrops: String(found.tx.Fee), amountDrops: found.tx.Amount, owner: found.tx.Owner ?? found.tx.Account, createSequence: found.tx.OfferSequence ?? found.tx.Sequence, ledgerDate: found.tx.date })
  }
  const run = store.getRun(state.runId)
  if (run.intents.find(i => i.intentId === 'escrow-273:finish')?.escrow?.state !== 'RELEASED' || run.contents.length !== 1) throw new Error('Finish access gate not proven')
  const feeDrops = transactions.reduce((n, t) => n + Number(t.feeDrops), 0)
  const principalPaid = run.receipts.reduce((n, r) => n + Number(r.xrpl?.amountDrops ?? 0), 0)
  if (principalPaid + feeDrops >= 1000000) throw new Error('Spend ceiling exceeded')
  const objects = (await ledger.request({ command: 'account_objects', account: wallet.classicAddress, type: 'escrow', ledger_index: 'validated' })).result.account_objects
  const latencies = ['finish', 'cancel'].map(name => {
    const intentId = `escrow-273:${name}`
    const created = run.events.find(e => e.type === 'ESCROW_CREATE' && e.data?.intentId === intentId)!
    const terminal = run.events.find(e => e.type === `ESCROW_${name.toUpperCase()}` && e.data?.intentId === intentId)!
    return { intentId, purchaseStartToCreateObservedMs: Date.parse(created.at) - state.started![name], purchaseStartToTerminalObservedMs: Date.parse(terminal.at) - state.started![name], createObservedToTerminalObservedMs: Date.parse(terminal.at) - Date.parse(created.at),
      createObservedAt: created.at, terminalObservedAt: terminal.at }
  })
  const publicReport = { latencies, timingDefinition: 'Local purchase start (before quote) to observed validated create/terminal; includes RPC, delivery/proof, polling and expiry wait. Not isolated submit latency or p95.', label: 'XRPL TESTNET · no real value; SYNTHETIC mini-corpus, real product purchase path; no model calls', observedAt: new Date().toISOString(), buyer: wallet.classicAddress, transactions, feeDrops, principalPaidDrops: principalPaid, cancellationWriterOffline: true, openEscrowCountForBuyer: objects.length,
    outcomes: run.intents.map(i => ({ intentId: i.intentId, escrow: i.escrow, status: i.status })), receipts: run.receipts.map(r => ({ intentId: r.intentId, escrow: r.escrow, amountMinor: r.amountMinor })) }
  mkdirSync('docs/evidence', { recursive: true })
  writeFileSync('docs/evidence/escrow-273.json', JSON.stringify(publicReport, null, 2) + '\n')
  console.log(JSON.stringify({ stage: 'complete', feeDrops, principalPaidDrops: principalPaid, transactions: transactions.map(t => ({ operation: t.operation, hash: t.hash })) }))
} catch {
  console.error(`Escrow demo stopped at ${stage}; private recovery state retained, rerun same command`)
  process.exitCode = 1
} finally { await closePublisher?.(); store.close(); await ledger.close() }
