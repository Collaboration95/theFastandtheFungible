// Local fixture writer/content and policy purchase; real XRPL Testnet settlement. No model calls.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { once } from 'node:events'
import { Wallet } from 'xrpl'
import { testnetLedger } from '../../shared/xrpl.js'
import { TestnetProvisioner } from '../../publisher/publishing/testnet-funding.js'
import { isolatedEnv } from '../testnet-wallets.js'
import { createPublisherApp } from '../../publisher/routes.js'
import { Store } from '../../server/store.js'
import { PurchaseManager } from '../../server/purchases.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { XrplPayer } from '../../server/xrpl.js'
import { receiptBundle } from '../../server/receipt-bundle.js'
import { verifyAnswer } from '../../sdk/verify.js'
import { candidateFrom, honestArticle } from '../../tests/fixtures/pay-path.js'
import { alphaLeakCorpus } from '../../tests/fixtures/corpus-mini/index.js'

const label = process.argv[2]
if (!['before', 'after'].includes(label)) throw Error('Usage: node --import tsx scripts/speed/measure.ts before|after')
const output = resolve(`docs/evidence/speed/${label}.json`)
mkdirSync(resolve('docs/evidence/speed'), { recursive: true })
const ledger = testnetLedger()
const samples: unknown[] = process.argv.includes('--resume') && existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')).samples : []
let server: ReturnType<ReturnType<typeof createPublisherApp>['listen']> | undefined
let store: Store | undefined, journal: { close(): void } | undefined
try {
  const seeds = await new TestnetProvisioner({ ledger: testnetLedger(), faucet: fetch, walletStore: { file: resolve('scratch/speed/wallets.private.json'), allowedRoot: resolve('scratch') } }).prepare({ writers: ['load-factor'] })
  Object.assign(process.env, Object.fromEntries(Object.entries(isolatedEnv(seeds)).filter(([, value]) => value !== undefined)), { SETTLEMENT_TIMING: '1', ANCHOR_RAIL: 'off', WALLET_DAILY_CAP_MINOR: '10000' })
  const app = createPublisherApp({ journal: ':memory:', rail: 'xrpl-testnet', ledger, writers: { ...alphaLeakCorpus, publishers: alphaLeakCorpus.publishers.filter(p => p.slug === 'load-factor'), writers: alphaLeakCorpus.writers.filter(w => w.publisherSlug === 'load-factor'), articles: alphaLeakCorpus.articles.filter(a => a.publisherSlug === 'load-factor') }, env: process.env, escrowWriters: ['load-factor'] })
  journal = app.locals.journal
  await app.locals.ready
  server = app.listen(8790 + Number(process.env.OFFSET ?? 900), '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  store = new Store(':memory:')
  const manager = new PurchaseManager(store, new PublisherClient({ baseUrl: base }), new XrplPayer(ledger, Wallet.fromSeed(seeds.buyer)))
  const candidate = await candidateFrom(base, honestArticle)
  for (let i = samples.length; i < 30; i++) {
    const run = store.createRun('Local fixture content; real Testnet settlement speed sample', 200, { settlement: 'XRPL TESTNET · no real value', research: 'fixture', decision: 'fixture', publisher: 'fixture writer' })
    store.updateRun(run.runId, { candidates: [candidate] })
    const intent = await manager.purchase({ runId: run.runId, candidate, intentId: `${label}-${i}`, escrow: true })
    if (intent.status !== 'VERIFIED') throw Error(`Sample ${i}: ${intent.status}; ${intent.error}`)
    const source = store.getRun(run.runId).contents[0]
    store.addAnswer(run.runId, { conclusion: 'Purchased fixture passage', claims: [{ id: 'sample', text: source.spans[0].text, stance: 'SUPPORTS', citations: [{ resourceId: source.resourceId, version: source.version, spanId: source.spans[0].id }] }], openGaps: [], version: 1, provider: 'fixture', model: 'extractive-fixture' })
    const verified = await verifyAnswer(receiptBundle(store, run.runId))
    const failed = verified.checks.filter(c => c.status === 'FAIL')
    if (failed.length) throw Error(`Offline receipt failed: ${JSON.stringify(failed)}`)
    samples.push({ sample: i + 1, timing: store.getIntent(intent.intentId)!.timing, createHash: intent.escrow!.createHash, finishHash: intent.escrow!.finishHash, streamActive: ledger.streamActive?.() ?? false, streamDiagnostics: ledger.diagnostics?.(), offlineReceipt: { failed: failed.length, checks: verified.checks.length } })
    writeFileSync(output, JSON.stringify({ label, method: '30 sequential policy purchases; fixture content; local writer; XRP Testnet; offset 900; no LLM; observation clocks on one host', stream: process.env.XRPL_STREAM_WAITS === '1', samples }, null, 2) + '\n')
    console.log(`${label} ${i + 1}/30 ${intent.escrow!.createHash} ${intent.escrow!.finishHash}`)
  }
} finally {
  if (server) { server.closeAllConnections(); await new Promise<void>(r => server!.close(() => r())) }
  store?.close(); journal?.close(); await ledger.close()
}
