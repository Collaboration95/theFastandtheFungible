// Opt-in live XRP Testnet proof. Never prints wallet material or private K.
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { Wallet } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { ledgerTime } from '../shared/escrow.js'
import { testnetLedger, lookupTx } from '../shared/xrpl.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { alphaLeakCorpus } from '../tests/fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle } from '../tests/fixtures/pay-path.js'
process.env.ESCROW_MODE = 'key-reveal'
const ledger = testnetLedger('wss://s.altnet.rippletest.net:51233')
const out = 'docs/evidence/round2-r'
mkdirSync(out, { recursive: true })
const app = createPublisherApp({ journal: 'scratch/key-reveal-proof-publisher.db', rail: 'xrpl-testnet', ledger, writers: alphaLeakCorpus, env: { ...process.env, ESCROW_MODE: 'key-reveal' }, escrowWriters: ['load-factor', 'alphaleak'] })
await app.locals.ready
const server = app.listen(0, '127.0.0.1')
await new Promise(r => server.once('listening', r))
const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
const store = new Store('scratch/key-reveal-proof-buyer.db')
const manager = new PurchaseManager(store, client, new XrplPayer(ledger, Wallet.fromSeed(process.env.XRPL_PAYER_SEED!)))
const transactions: Record<string, unknown>[] = []
try {
  const candidate = await candidateFrom(client.origin, honestArticle)
  for (const noShow of [false, true]) {
    const run = store.createRun('SYNTHETIC article · live key reveal Testnet proof', 200)
    store.updateRun(run.runId, { candidates: [candidate] })
    const intentId = `key-reveal-${noShow ? 'no-show' : 'happy'}-${run.runId}`
    const original = client.paidGet.bind(client)
    if (noShow) client.paidGet = async () => { throw new Error('Intentional writer no-show') }
    await manager.purchase({ runId: run.runId, candidate, intentId, escrow: true })
    client.paidGet = original
    let intent = store.getIntent(intentId)!
    const deadline = Date.now() + 240_000
    while (intent.status === 'SUBMITTING' && Date.now() < deadline) {
      if (noShow && await ledgerTime(ledger) <= intent.escrow!.cancelAfter) await new Promise(r => setTimeout(r, 4000))
      else { await manager.reconcile(); await new Promise(r => setTimeout(r, 1000)) }
      intent = store.getIntent(intentId)!
    }
    if (noShow ? intent.escrow?.state !== 'CANCELLED' : intent.status !== 'VERIFIED') throw new Error('Live path did not reach expected terminal state')
    const snapshot = store.getRun(run.runId), source = snapshot.contents[0]
    store.addAnswer(run.runId, { conclusion: noShow ? 'No delivery; cancelled and principal refunded.' : 'SYNTHETIC cited delivery, decrypted from validated ledger key.', claims: source ? [{ id: 'delivery', text: source.spans[0].text, stance: 'SUPPORTS', citations: [{ resourceId: source.resourceId, version: source.version, spanId: source.spans[0].id }] }] : [], openGaps: [], version: 1, provider: 'fixture', model: 'extractive-fixture' })
    writeFileSync(`${out}/${noShow ? 'no-show' : 'happy'}-receipt.json`, JSON.stringify(receiptBundle(store, run.runId), null, 2) + '\n')
    for (const hash of [intent.escrow?.createHash, intent.escrow?.finishHash, intent.escrow?.cancelHash].filter(Boolean)) {
      const found = await lookupTx(ledger, hash!)
      if (found.state !== 'validated') throw new Error('Missing validated evidence')
      transactions.push({ hash, ledgerIndex: found.ledgerIndex, type: found.tx.TransactionType, sequence: found.tx.Sequence, result: found.meta.TransactionResult, feeDrops: found.tx.Fee, account: found.tx.Account, destination: found.tx.Destination, amount: found.tx.Amount, fulfillmentBytes: found.tx.Fulfillment ? String(found.tx.Fulfillment).length / 2 : 0, condition: found.tx.Condition, owner: found.tx.Owner, offerSequence: found.tx.OfferSequence, path: noShow ? 'no-show' : 'happy' })
    }
    writeFileSync(`${out}/transactions.json`, JSON.stringify({ label: 'XRPL TESTNET · no real value · SYNTHETIC article, fixture answer', transactions }, null, 2) + '\n')
    console.log(`${noShow ? 'no-show' : 'happy'}: ${intent.status}; ${transactions.length} validated transaction records saved`)
  }
} finally {
  server.closeAllConnections(); server.close(); app.locals.journal.close(); store.close(); await ledger.close()
}
