// Real SIGKILLs; simulated ledger and generated test wallets, no environment credentials.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Wallet } from 'xrpl'
import { chain } from '../../tests/fixtures/key-reveal-ledger.js'
import { alphaLeakCorpus } from '../../tests/fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle } from '../../tests/fixtures/pay-path.js'
import { createPublisherApp } from '../../publisher/routes.js'
import { Store } from '../../server/store.js'
import { PurchaseManager } from '../../server/purchases.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { XrplPayer } from '../../server/xrpl.js'
const [dir, boundary] = process.argv.slice(2)
if (!dir) {
  mkdirSync('scratch', { recursive: true })
  const results = []
  for (const point of ['create', 'reveal', 'decrypt']) {
    const work = mkdtempSync(resolve('scratch/key-reveal-kill-'))
    writeFileSync(join(work, 'test-wallets.json'), JSON.stringify({ buyer: Wallet.generate().seed, writer: Wallet.generate().seed, other: Wallet.generate().seed }), { mode: 0o600 })
    const env = { PATH: process.env.PATH, HOME: work, NODE_NO_WARNINGS: '1', ESCROW_MODE: 'key-reveal', LANGFUSE_ENABLED: '0' }
    const killed = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/chaos/key-reveal.ts', work, point], { env, timeout: 30_000 })
    if (killed.signal !== 'SIGKILL') throw new Error(`Expected SIGKILL at ${point}; ${killed.stderr.toString()}`)
    const recovered = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/chaos/key-reveal.ts', work, 'recover'], { env, timeout: 30_000 })
    if (recovered.status !== 0) throw new Error(`Recovery failed at ${point}: ${recovered.stderr.toString()}`)
    results.push({ boundary: point, signal: killed.signal, ...JSON.parse(readFileSync(join(work, 'result.json'), 'utf8')) })
  }
  mkdirSync('docs/evidence/round2-r', { recursive: true })
  writeFileSync('docs/evidence/round2-r/crash.json', JSON.stringify({ label: 'SIMULATED ledger; actual process SIGKILL; no live funds', results }, null, 2) + '\n')
  console.log('key-reveal chaos: 3 SIGKILL boundaries, zero violations, zero double charges')
} else {
  process.env.ESCROW_MODE = 'key-reveal'
  const wallets = JSON.parse(readFileSync(join(dir, 'test-wallets.json'), 'utf8'))
  const c = chain(join(dir, 'ledger.json'), type => { if (boundary === 'create' && type === 'EscrowCreate') process.kill(process.pid, 'SIGKILL') })
  const app = createPublisherApp({ journal: join(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger: c.ledger, writers: alphaLeakCorpus, env: { ESCROW_MODE: 'key-reveal', XRPL_PUBLISHER_LOAD_FACTOR_SEED: wallets.writer, XRPL_PUBLISHER_ALPHALEAK_SEED: wallets.other }, escrowWriters: ['load-factor', 'alphaleak'] })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
  const store = new Store(join(dir, 'buyer.db'))
  const candidate = await candidateFrom(client.origin, honestArticle)
  const run = store.listRuns()[0] ?? store.createRun('SYNTHETIC key reveal chaos', 200)
  const manager = new PurchaseManager(store, client, new XrplPayer(c.ledger, Wallet.fromSeed(wallets.buyer), { pollMs: 1, timeoutMs: 100 }))
  if (boundary === 'reveal') {
    const original = store.persistReveal.bind(store)
    store.persistReveal = (...args) => { original(...args); process.kill(process.pid, 'SIGKILL') }
  }
  if (boundary === 'decrypt') {
    const original = store.addGrant.bind(store)
    store.addGrant = (...args) => { original(...args); process.kill(process.pid, 'SIGKILL') }
  }
  try {
    await manager.purchase({ runId: run.runId, candidate, intentId: 'chaos-key-reveal', escrow: true })
    const final = store.getRun(run.runId), creates = [...c.txs.values()].filter(t => t.tx_json.TransactionType === 'EscrowCreate').length
    if (final.intents[0].status !== 'VERIFIED' || creates !== 1 || final.receipts.length !== 1 || final.contents.length !== 1 || final.spentMinor !== candidate.price.amountMinor) throw new Error('Key reveal invariant violation')
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ status: final.intents[0].status, creates, receipts: final.receipts.length, violations: 0, doubleCharges: 0 }))
  } finally { server.closeAllConnections(); server.close(); app.locals.journal.close(); store.close() }
}
