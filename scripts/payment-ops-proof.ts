// Small, reproducible #287 proof. No models. Testnet opt-in spends <=0.1 XRP once.
import 'dotenv/config'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { Wallet, decode, hashes } from 'xrpl'
import { XrplPayer, type Submission } from '../server/xrpl.js'
import { testnetLedger, type Ledger } from '../shared/xrpl.js'
import { createPublisherApp } from '../publisher/routes.js'
import { miniCorpus } from '../tests/fixtures/corpus-mini/index.js'
import { candidateFrom } from '../tests/fixtures/pay-path.js'
import { createApiApp } from '../server/routes.js'
import { Store } from '../server/store.js'
import { PublisherClient } from '../server/publisher-client.js'
import { PurchaseManager } from '../server/purchases.js'
import { percentile } from '../server/metrics.js'

process.env.LLM_PROVIDER = 'fixture'
process.env.DECISION_PROVIDER = 'fixture'
process.env.LANGFUSE_ENABLED = '0'
process.env.SEARCH_EMBEDDINGS = 'off'
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const dir = resolve('scratch/payment-ops-287')
mkdirSync(dir, { recursive: true })
if (process.argv.includes('--testnet')) {
  if (!process.env.XRPL_PAYER_SEED) throw new Error('Missing configured Testnet payer')
  const path = resolve(dir, 'buyer.db')
  if (existsSync(path)) throw new Error('Proof already started: reconcile its persisted blob; never rerun with a new intent')
  const ledger = testnetLedger()
  const app = createPublisherApp({ journal: resolve(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger, writers: miniCorpus, env: process.env })
  await app.locals.ready
  const server = app.listen(9990, '127.0.0.1'); await once(server, 'listening') // OFFSET=1200
  const store = new Store(path)
  try {
    const article = miniCorpus.articles.find(a => a.tier === 'PAID')!
    if (article.priceMinor * 1000 > 100000) throw new Error('Testnet proof exceeds 0.1 XRP')
    const candidate = await candidateFrom('http://127.0.0.1:9990', article)
    const payer = new XrplPayer(ledger, Wallet.fromSeed(process.env.XRPL_PAYER_SEED))
    const manager = new PurchaseManager(store, new PublisherClient({ baseUrl: 'http://127.0.0.1:9990' }), payer)
    const run = store.createRun('Fixture policy BUY: one signed source for operations validation', 100)
    const started = performance.now()
    const intent = await manager.purchase({ runId: run.runId, candidate, intentId: 'ops-proof-287' })
    const retry = await manager.purchase({ runId: run.runId, candidate, intentId: 'ops-proof-287' })
    const receipt = store.getRun(run.runId).receipts[0]
    const record = { label: 'XRPL TESTNET · no real value; synthetic mini article; fixture BUY policy; no model calls', status: intent.status,
      retryStatus: retry.status, receipts: store.getRun(run.runId).receipts.length, txHash: intent.txHash,
      amountDrops: receipt?.xrpl?.amountDrops, ledgerIndex: receipt?.xrpl?.ledgerIndex, elapsedMs: performance.now() - started }
    writeFileSync(resolve(dir, 'testnet-receipt.json'), JSON.stringify(record, null, 2) + '\n')
    console.log(JSON.stringify(record))
    if (intent.status !== 'VERIFIED' || !receipt?.xrpl || record.receipts !== 1) throw new Error('Proof did not verify; preserve journal and reconcile')
  } finally {
    store.close(); app.locals.journal.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await ledger.close()
  }
} else {
  // Compare #301's exact response-held queue with the new ledger-held queue.
  // A controlled 300 ms delivery delay follows immediate fixture-ledger validation.
  const samples = 10, slowWriterMs = 300
  const measure = async (legacy: boolean) => {
    const times: number[] = []
    for (let sample = 0; sample < samples; sample++) {
      const txs = new Map<string, Record<string, unknown>>()
      const ledger: Ledger = { async request(r) {
        if (r.command === 'account_info') return { result: { account_data: { Sequence: 7 + txs.size, Balance: '100000000', OwnerCount: 0 } } }
        if (r.command === 'server_info') return { result: { info: { validated_ledger: { age: 1, reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }
        if (r.command === 'ledger_current') return { result: { ledger_current_index: 100 } }
        if (r.command === 'ledger') return { result: { ledger_index: 100 } }
        if (r.command === 'fee') return { result: { drops: { open_ledger_fee: '12' } } }
        if (r.command === 'submit') { txs.set(hashes.hashSignedTx(String(r.tx_blob)), decode(String(r.tx_blob)) as unknown as Record<string, unknown>); return { result: {} } }
        if (r.command === 'tx') { const tx = txs.get(String(r.transaction)); return { result: { validated: !!tx, tx_json: tx, meta: { TransactionResult: 'tesSUCCESS' }, ledger_index: 100 } } }
        throw new Error('Unexpected fixture ledger call')
      } }
      const payer = new XrplPayer(ledger, Wallet.generate(), { pollMs: 1, timeoutMs: 50 })
      const terms = { rail: 'xrpl-testnet' as const, network: 'xrpl:1' as const, asset: 'XRP' as const, payTo: Wallet.generate().classicAddress, amountDrops: '10000', invoiceId: 'A'.repeat(64) }
      let queue: Promise<unknown> = Promise.resolve()
      const pay = (send: (s: Submission) => Promise<void>) => {
        const run = queue.then(async () => { const paid = await payer.pay(terms, signed => signed, send); if (legacy) await paid.sent; return paid })
        queue = run.catch(() => undefined)
        return run
      }
      const first = pay(async signed => { await ledger.request({ command: 'submit', tx_blob: signed.txBlob }); await pause(slowWriterMs) })
      const start = performance.now()
      const second = await pay(async signed => { await ledger.request({ command: 'submit', tx_blob: signed.txBlob }) })
      await second.sent
      times.push(performance.now() - start)
      await (await first).sent
    }
    return { samples, p50Ms: percentile(times, 0.5), p95Ms: percentile(times, 0.95) }
  }
  const result = { label: 'SYNTHETIC local ledger; queued payment until writer response; not network throughput', slowWriterMs,
    before: await measure(true), after: await measure(false) }
  writeFileSync(resolve(dir, 'lock-benchmark.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
  process.env.SETTLEMENT_RAIL = 'simulated'
  const publisher = createPublisherApp({ journal: ':memory:', rail: 'simulated', writers: miniCorpus, env: {} })
  await publisher.locals.ready
  const server = publisher.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const intervalMs = 50
  const api = await createApiApp({ dbPath: ':memory:', publisherUrl: base, reconcileIntervalMs: intervalMs })
  try {
    const article = miniCorpus.articles.find(a => a.tier === 'PAID')!
    const candidate = await candidateFrom(base, article)
    const run = api.store.createRun('Fixture policy recovery measurement', 100)
    const client = api.purchases.client, original = client.paidGet.bind(client)
    let lose = true
    client.paidGet = async (path, signature, observer) => {
      const response = await original(path, signature, observer)
      if (signature && lose) { lose = false; throw new Error('Injected lost settlement response') }
      return response
    }
    await api.purchases.purchase({ runId: run.runId, candidate, intentId: 'recovery-metric' })
    const start = performance.now()
    while (api.store.getIntent('recovery-metric')?.status !== 'VERIFIED') {
      if (performance.now() - start > 3000) throw new Error('Recovery timeout')
      await pause(1)
    }
    const recovery = { label: 'SIMULATED lost-response recovery, same running engine', before: 'restart required (baseline source)', intervalMs,
      recoveryMs: performance.now() - start, receipts: api.store.getRun(run.runId).receipts.length, defaultIntervalMs: 15000 }
    writeFileSync(resolve(dir, 'recovery-benchmark.json'), JSON.stringify(recovery, null, 2) + '\n')
    console.log(JSON.stringify(recovery))
  } finally { await api.close(); publisher.locals.journal.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) }
}
