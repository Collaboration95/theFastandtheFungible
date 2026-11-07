import { ResourceScope, waitForOutput } from '../shared/resource-scope.js'
// Opt-in public faucet proof. Outputs only addresses, timings and transaction hashes.
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Wallet } from 'xrpl'
import { fundTestnetWallet } from '../publisher/publishing/publish.js'
import { PublisherClient } from '../server/publisher-client.js'
import { retrieve } from '../server/agents/research.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { XrplPayer } from '../server/xrpl.js'
import { testnetLedger, lookupTx } from '../shared/xrpl.js'
if (!process.argv.includes('--testnet')) throw Error('Requires --testnet; public faucet only')
process.env.ESCROW_MODE = 'key-reveal'
const scope = new ResourceScope()
try {
const root = scope.evidenceDir('writer-testnet-', 'Testnet wallets and potentially signed obligations; retain for manual reconciliation')
await cp('examples/writer-starter', join(root, 'writer-starter'), { recursive: true })
const started = performance.now()
const tgzPath = process.argv.find(a => a.endsWith('.tgz')), tgz = tgzPath && pathToFileURL(resolve(tgzPath)).href
const child = scope.spawn(tgz ? 'npx' : process.execPath, tgz ? ['-y', tgz, 'publish', './writer-starter', '--testnet', '--port', '0'] : ['--import', join(process.cwd(), 'node_modules/tsx/dist/loader.mjs'), join(process.cwd(), 'scripts/publish-site.ts'), './writer-starter', '--testnet', '--port', '0'], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, LOCAL_WRITERS_DIR: join(root, 'private'), DOTENV_CONFIG_PATH: '.no-env', npm_config_cache: join(root, 'npm-cache'), SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0' } })
let output = ''
const ledger = testnetLedger(), store = new Store(':memory:')
try {
  child.stdout.on('data', c => { output += c })
  child.stderr.resume()
  await waitForOutput(child, /Folder →/, 90000)
  const readySeconds = (performance.now() - started) / 1000
  const baseUrl = output.match(/PUBLISHER_URL=(http:\/\/127\.0\.0\.1:\d+)/)![1]
  const credentialHash = output.match(/CredentialCreate tx https:\/\/testnet.xrpl.org\/transactions\/([A-F0-9]{64})/)![1]
  const address = output.match(/Writer live · address (r\w+)/)![1]
  const credential = await lookupTx(ledger, credentialHash)
  if (credential.state !== 'validated' || credential.meta.TransactionResult !== 'tesSUCCESS') throw Error('Credential not validated')
  const buyer = Wallet.generate(); await fundTestnetWallet(buyer)
  const client = new PublisherClient({ baseUrl })
  const sources = await retrieve(client, 'Malaysia colocation facility solar renewable electricity contract')
  const candidate = sources.candidates.find(c => c.tier === 'PAID')!
  if (!candidate) throw Error('Writer not discoverable')
  const run = store.createRun('SYNTHETIC starter: solar electricity share', 100)
  store.updateRun(run.runId, { candidates: sources.candidates })
  const manager = new PurchaseManager(store, client, new XrplPayer(ledger, buyer))
  let intent = await manager.purchase({ runId: run.runId, candidate, intentId: `writer-${run.runId}`, escrow: true })
  const deadline = Date.now() + 60000
  while (intent.status === 'SUBMITTING' && Date.now() < deadline) { await manager.reconcile(); intent = store.getIntent(intent.intentId)! }
  if (intent.status !== 'VERIFIED' || intent.escrow?.mode !== 'key-reveal') throw Error(`Key reveal sale not verified: ${intent.status}, ${intent.escrow?.mode}, ${intent.failure?.code}`)
  const transactions = []
  for (const hash of [credentialHash, intent.escrow.createHash, intent.escrow.finishHash]) {
    const tx = await lookupTx(ledger, hash!)
    if (tx.state !== 'validated' || tx.meta.TransactionResult !== 'tesSUCCESS') throw Error('Sale not validated')
    transactions.push({ hash, type: tx.tx.TransactionType, ledgerIndex: tx.ledgerIndex, result: tx.meta.TransactionResult })
  }
  const proof = { label: 'Public faucet · Testnet · no real value · SYNTHETIC starter; no real consenting writer', address, readySeconds, totalSeconds: (performance.now() - started) / 1000, transactions }
  await mkdir('docs/evidence/round3-c', { recursive: true })
  await writeFile('docs/evidence/round3-c/onboarding.json', JSON.stringify(proof, null, 2) + '\n')
  console.log(JSON.stringify(proof))
} finally { store.close(); await ledger.close() }

} finally { await scope.close() }
