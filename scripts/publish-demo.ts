// Reproducible publishing demo: real retrieval and fixture policy, optionally real Testnet settlement.
import 'dotenv/config'
import { existsSync } from 'node:fs'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Wallet } from 'xrpl'
import { publishSite, fundTestnetWallet } from '../publisher/publishing/publish.js'
import { PublisherClient } from '../server/publisher-client.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { RunLoop } from '../server/agents/loop.js'
import { XrplPayer } from '../server/xrpl.js'
import { testnetLedger } from '../shared/xrpl.js'

const testnet = process.argv.includes('--testnet')
// No paid model calls: the decision and extractive writer remain visibly fixture-backed.
process.env.LLM_PROVIDER = 'fixture'
process.env.DECISION_PROVIDER = 'fixture'
process.env.LANGFUSE_ENABLED = '0'
process.env.SEARCH_EMBEDDINGS = 'off'
const root = resolve(process.env.LOCAL_WRITERS_DIR || 'scratch/published-demo')
const slug = testnet ? 'publish-demo-testnet' : 'publish-demo-notes'
if (testnet && existsSync(resolve(root, slug, 'demo-buyer.db'))) throw new Error('A Testnet demo already started here. Reconcile its stored intent; do not pay again.')
const folder = resolve(`scratch/${slug}`)
await mkdir('scratch', { recursive: true })
let payerWallet: Wallet | undefined
if (testnet) {
  if (!process.env.XRPL_PAYER_SEED) throw new Error('Demo needs XRPL_PAYER_SEED in the ignored .env; never pass a seed on the command line')
  payerWallet = Wallet.fromSeed(process.env.XRPL_PAYER_SEED)
  await fundTestnetWallet(payerWallet)
}
const started = performance.now()
await cp('examples/writer-starter', folder, { recursive: true })
console.log(`# Recipe: cp -R examples/writer-starter scratch/${slug}`)
console.log(`# Recipe: OFFSET=800 npm run publish:site -- scratch/${slug}${testnet ? '' : ' --rail simulated'}`)
const site = await publishSite({ folder, slug, root, rail: testnet ? 'xrpl-testnet' : 'simulated', port: 9590 })
const store = new Store(resolve(site.dir, 'demo-buyer.db'))
const ledger = testnet ? testnetLedger() : undefined
try {
  const client = new PublisherClient({ baseUrl: site.baseUrl })
  const payer = ledger ? new XrplPayer(ledger, payerWallet) : undefined
  const manager = new PurchaseManager(store, client, payer)
  const question = 'What share of electricity comes from solar renewable contracts for a Malaysia colocation facility?'
  const run = store.createRun(question, 10)
  const loop = new RunLoop(store, client, manager)
  await loop.start(run.runId)
  const result = store.getRun(run.runId)
  console.log(JSON.stringify({ gaps: result.answers[0]?.openGaps, decisions: result.decisions.map(d => ({selected:d.selectedResourceId, rows:d.rows.map(r => ({id:r.candidate.resourceId,verdict:r.verdict,reason:r.reason,value:r.value}))})), error: result.error }))
  const receipt = result.receipts[0]
  const record = { mode: testnet ? 'XRPL TESTNET · no real value' : 'SIMULATED · no Testnet transaction', research: result.labels.research,
    decision: result.labels.decision, question, budgetMinor: 10, spentMinor: result.spentMinor,
    statuses: result.intents.map(i => i.status), receipts: result.receipts.length, grants: result.grants.length,
    txHash: receipt?.xrpl?.txHash, ledgerIndex: receipt?.xrpl?.ledgerIndex, amountDrops: receipt?.xrpl?.amountDrops,
    payTo: receipt?.xrpl?.payTo, folderToPayableSeconds: site.seconds, folderToPaidReadSeconds: (performance.now() - started) / 1000,
    citations: result.answers.at(-1)?.claims.flatMap(c => c.citations) ?? [],
  }
  console.log(JSON.stringify(record, null, 2))
  await writeFile(resolve(site.dir, 'demo-public-receipt.json'), JSON.stringify(record, null, 2))
  if (result.intents.length !== 1 || result.intents[0].status !== 'VERIFIED' || result.spentMinor !== 10) throw new Error(`Demo did not produce one verified purchase; phase ${result.phase}, error ${result.error ?? 'none'}`)
} finally {
  await ledger?.close()
  store.close()
  site.server.closeAllConnections()
  await new Promise<void>(done => site.server.close(() => done()))
}
