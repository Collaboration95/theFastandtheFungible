// Explicit opt-in only. Run with Node 22: node --import tsx scripts/testnet-1000/run.mjs --testnet --count 20
import { mkdirSync, existsSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import express from 'express'
import { Wallet, decode, hashes } from 'xrpl'
import { atomic, append, rows, receiptIndex, delay, cause } from './state.mjs'
import { fundingPlan } from './funding.mjs'

const args = process.argv.slice(2)
if (!args.includes('--testnet') || args.some(a => a.startsWith('--') && !['--testnet', '--count', '--state', '--receipts'].includes(a))) throw Error('Use --testnet --count 20|1000 [--state /tmp/PRIVATE_DIRECTORY] [--receipts FILE.jsonl]')
const count = Number(args[args.indexOf('--count') + 1])
if (!Number.isSafeInteger(count) || count < 1 || count > 1100) throw Error('count must be 1..1100')
const root = resolve(args.includes('--state') ? args[args.indexOf('--state') + 1] : '/tmp/researchagent-testnet-1000')
if (!root.startsWith('/tmp/') && !root.startsWith('/private/tmp/')) throw Error('Private state must be under /tmp')
process.umask(0o077)
mkdirSync(root, { recursive: true, mode: 0o700 })
writeFileSync(join(root, '.gitignore'), '*\n', { mode: 0o600 })
// Acquire before opening any product DB or recovering the public receipt tail.
const lock = join(root, 'runner.lock')
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, 'utf8'))
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('Invalid lock; inspect private state')
  try { process.kill(pid, 0); throw Error('Another runner owns this state') } catch (e) { if (e.code !== 'ESRCH') throw e }
  unlinkSync(lock)
}
const lockFd = openSync(lock, 'wx', 0o600)
const { writeSync } = await import('node:fs'); writeSync(lockFd, String(process.pid)); closeSync(lockFd)
const checkpoint = join(root, 'checkpoint.json'), rpcFile = join(root, 'rpc.jsonl')
const receiptsFile = resolve(args.includes('--receipts') ? args[args.indexOf('--receipts') + 1] : 'data/evidence/testnet-1000/receipts.jsonl')
if (!receiptsFile.endsWith('.jsonl') || !['/tmp/', '/private/tmp/', resolve('data/evidence/testnet-1000') + '/'].some(prefix => receiptsFile.startsWith(prefix))) throw Error('Receipts must be JSONL under /tmp or data/evidence/testnet-1000')
mkdirSync(resolve(receiptsFile, '..'), { recursive: true })
const state = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : { version: 1, batch: `t1000-${Date.now()}`, jobs: [], publisherPort: 0, workers: 8 }
const workers = 8
state.workers = workers
let stopped = false
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopped = true })
const servers = [], stores = [], publishers = []
let ledger
try {
  // No owner .env, model, hosted, or wallet configuration is inherited into product policy.
  for (const key of Object.keys(process.env)) if (/^(XRPL_|ESCROW_|HOSTED|PUBLISHER_|APP_DB|SPENDING_|WALLET_|TESTNET_IOU|RA_API|LLM_|DECISION_|SEARCH_|LANGFUSE_|LOCAL_WRITERS)/.test(key)) delete process.env[key]
  Object.assign(process.env, { DOTENV_CONFIG_PATH: '.testnet-no-env', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', SETTLEMENT_RAIL: 'xrpl-testnet', ESCROW_MODE: 'key-reveal', ESCROW_ASSET: 'XRP', WALLET_DAILY_CAP_MINOR: '100000', LOCAL_WRITERS_DIR: join(root, 'no-local-writers') })
  const { testnetLedger, lookupTx, signPayment } = await import('../../shared/xrpl.ts')
  const { TestnetProvisioner } = await import('../../publisher/publishing/testnet-funding.ts')
  const { loadWriterCorpus } = await import('../../publisher/corpus.ts')
  const { createPublisherApp } = await import('../../publisher/routes.ts')
  const { PublisherClient } = await import('../../server/publisher-client.ts')
  const { Store } = await import('../../server/store.ts')
  const { XRPL_LABEL } = await import('../../shared/contracts/publisher.ts')
  const { PurchaseManager } = await import('../../server/purchases.ts')
  const { XrplPayer } = await import('../../server/xrpl.ts')
  const { retrieve } = await import('../../server/agents/research.ts')
  const publicRows = receiptIndex(rows(receiptsFile, true)), observations = rows(rpcFile, true)
  if ([...publicRows.keys()].some(id => !id.startsWith(state.batch + '-'))) throw Error('Evidence belongs to a different private batch; retain its original state')
  const submitted = new Map(), validated = new Map()
  for (const r of observations) { if (r.kind === 'submit' && !submitted.has(r.hash)) submitted.set(r.hash, r.at); if (r.kind === 'validated' && !validated.has(r.hash)) validated.set(r.hash, r.at) }
  const raw = testnetLedger()
  let active = 0
  const queue = []
  async function slot(fn) {
    if (active >= 8) await new Promise(resolve => queue.push(resolve)); else active++
    try { return await fn() } finally { if (queue.length) queue.shift()(); else active-- }
  }
  ledger = { close: () => raw.close(), request: request => slot(async () => {
    let hash
    if (request.command === 'submit') {
      const tx = decode(request.tx_blob)
      hash = hashes.hashSignedTx(request.tx_blob).toUpperCase()
      if (!submitted.has(hash)) { const at = Date.now(); submitted.set(hash, at); append(rpcFile, { kind: 'submit', hash, at, type: tx.TransactionType }) }
    }
    for (let retry = 0; ; retry++) {
      try {
        const response = await raw.request(request)
        const result = response.result
        if (request.command === 'tx' && result.validated && !validated.has(request.transaction)) {
          const at = Date.now(); validated.set(request.transaction, at); append(rpcFile, { kind: 'validated', hash: request.transaction, at, ledger: result.ledger_index })
        }
        return response
      } catch (error) {
        if (['txnNotFound', 'actNotFound', 'entryNotFound', 'objectNotFound'].includes(error?.data?.error)) throw error
        append(rpcFile, { kind: 'retry', at: Date.now(), command: request.command, hash: hash ?? request.transaction ?? null, cause: cause(error), retry: retry + 1 })
        if (retry >= 5) throw Error('Public Testnet RPC retry limit; same intent retained', { cause: error })
        await delay(Math.min(30000, 1000 * 2 ** retry))
      }
    }
  }) }
  const slug = 'team-xrpl-explainers'
  // Reuse the faucet provisioning helper; the fresh buyer funds the other identities.
  let seeds
  for (let attempt = 0; ; attempt++) {
    try {
      if (state.provisioned || state.walletsProvisioned) { seeds = JSON.parse(readFileSync(join(root, 'wallets.private.json'), 'utf8')); break }
      seeds = await new TestnetProvisioner({ ledger: { ...ledger, close: async () => {} }, faucet: fetch, walletStore: { file: join(root, 'wallets.private.json'), allowedRoot: root } }).prepare({ writers: [...Array.from({ length: workers - 1 }, (_, i) => `payer-${i + 1}`), slug, ...Array.from({ length: workers - 1 }, (_, i) => `writer-${i + 1}`)] })
      state.walletsProvisioned = true; atomic(checkpoint, state)
      break
    } catch (error) {
      append(rpcFile, { kind: 'funding-retry', at: Date.now(), cause: cause(error), retry: attempt + 1 })
      if (attempt >= 5) throw Error('Faucet provisioning blocked; private identities saved', { cause: error })
      await delay(Math.min(60000, 5000 * 2 ** attempt))
    }
  }
  const payerNames = ['buyer', ...Array.from({ length: workers - 1 }, (_, i) => `payer-${i + 1}`)]
  // Top-ups have the same persist-before-submit rule as purchases.
  const fundingFile = join(root, 'funding.json')
  const funding = existsSync(fundingFile) ? JSON.parse(readFileSync(fundingFile, 'utf8')) : {}
  const transfers = [
    // Existing provisioned batches keep their historical funding plan on resume.
    ...(!state.provisioned ? [{ name: 'writer-to-buyer', signer: slug, destination: 'buyer', amount: fundingPlan.writerToBuyerDrops }] : []),
    ...payerNames.slice(1).map(name => ({ name, signer: 'buyer', destination: name, amount: fundingPlan.buyerToPayerDrops })),
  ]
  for (const { name, signer, destination, amount } of transfers) {
    if (!funding[name]) { funding[name] = await signPayment(Wallet.fromSeed(seeds[signer]), { Destination: Wallet.fromSeed(seeds[destination]).classicAddress, Amount: amount, InvoiceID: createHash('sha256').update(state.batch + name).digest('hex').toUpperCase() }, ledger); atomic(fundingFile, funding) }
    const tx = funding[name]
    let found = await lookupTx(ledger, tx.txHash)
    if (found.state !== 'validated') await ledger.request({ command: 'submit', tx_blob: tx.txBlob })
    const deadline = Date.now() + 90000
    while (found.state !== 'validated' && Date.now() < deadline) { await delay(1000); found = await lookupTx(ledger, tx.txHash) }
    if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS') throw Error('Funding unresolved; same signed top-up retained')
  }
  state.provisioned = true; atomic(checkpoint, state)
  process.env[`XRPL_PUBLISHER_TEAM_XRPL_EXPLAINERS_SEED`] = seeds[slug]
  const corpus = await loadWriterCorpus()
  const writers = { publishers: corpus.publishers.filter(p => p.slug === slug), writers: corpus.writers.filter(w => w.publisherSlug === slug), articles: corpus.articles.filter(a => a.publisherSlug === slug) }
  state.publisherPorts ??= [state.publisherPort, 0, 0, 0]
  state.candidates ??= [state.candidate, null, null, null]
  const clients = []
  for (let shard = 0; shard < workers; shard++) {
    const publisher = createPublisherApp({ writers, journal: join(root, shard ? `publisher-${shard}.db` : 'publisher.db'), ledger, rail: 'xrpl-testnet', escrowWriters: [slug], env: { ...process.env, XRPL_PUBLISHER_TEAM_XRPL_EXPLAINERS_SEED: seeds[shard ? `writer-${shard}` : slug] } })
    publishers.push(publisher); await publisher.locals.ready
    const ps = publisher.listen(state.publisherPorts[shard] ?? 0, '127.0.0.1'); servers.push(ps); await once(ps, 'listening')
    state.publisherPorts[shard] = ps.address().port; atomic(checkpoint, state)
    const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${ps.address().port}`, timeoutMs: 60000 }); clients.push(client)
    if (!state.candidates[shard]) {
      const article = [...writers.articles].filter(a => a.tier === 'PAID').sort((a, b) => a.priceMinor - b.priceMinor)[0]
      const retrieved = await retrieve(client, article.title)
      state.candidates[shard] = retrieved.candidates.find(c => c.resourceId === article.articleId && c.tier === 'PAID')
      if (!state.candidates[shard]) throw Error('Known paid article not discoverable')
      atomic(checkpoint, state)
    }
  }
  const lanes = payerNames.map((name, i) => {
    const store = new Store(join(root, name + '.db')); stores.push(store)
    const manager = new PurchaseManager(store, clients[i], new XrplPayer(ledger, Wallet.fromSeed(seeds[name])))
    return { store, manager }
  })
  const api = express()
  api.get('/health', (_req, res) => res.json({ network: 'xrpl-testnet', count: publicRows.size }))
  api.get('/runs/:id', (req, res) => { const lane = state.jobs.find(j => j?.runId === req.params.id)?.worker; if (lane === undefined) return res.sendStatus(404); res.json(lanes[lane].store.getRun(req.params.id)) })
  const as = api.listen(0, '127.0.0.1'); servers.push(as); await once(as, 'listening')
  console.log(JSON.stringify({ network: 'xrpl-testnet', publisherPorts: state.publisherPorts, apiPort: as.address().port, target: count, complete: publicRows.size, workers }))
  async function work(worker) {
    const { store } = lanes[worker]
    for (let i = worker; i < count && !stopped; i += workers) {
      const intentId = `${state.batch}-${String(i + 1).padStart(4, '0')}`
      if (publicRows.has(intentId)) continue
      let job = state.jobs[i]
      if (!job) {
        const candidate = state.candidates[worker]
        const run = store.createRun('Deterministic Testnet settlement proof: ' + candidate.title, candidate.price.amountMinor, { research: 'fixture', decision: 'fixture', publisher: 'local', settlement: XRPL_LABEL })
        store.updateRun(run.runId, { candidates: [candidate] })
        job = state.jobs[i] = { worker, shard: worker, intentId, runId: run.runId, startedAt: Date.now(), retries: 0 }
        atomic(checkpoint, state)
      }
      if (job.worker !== worker) throw Error('Pending job worker assignment differs; reconcile with original worker count')
      const shard = job.shard ?? 0, client = clients[shard], candidate = state.candidates[shard]
      const manager = shard === worker ? lanes[worker].manager : new PurchaseManager(store, client, lanes[worker].manager.payer)
      if (!job.challengeChecked) {
        const first = await client.paidGet(PublisherClient.paidPath(candidate))
        if (first.status !== 402 || !first.required?.accepts.some(t => t.scheme === 'escrow-v1')) throw Error('Expected real x402 escrow 402; refusing purchase')
        job.challengeChecked = true; atomic(checkpoint, state)
      }
      let intent
      for (;;) {
        if (stopped) return
        intent = await manager.purchase({ runId: job.runId, candidate, intentId, escrow: true })
        if (intent.status !== 'SUBMITTING') break
        job.retries++; atomic(checkpoint, state)
        if (job.retries > 40) throw Error('Unresolved escrow; stop and resume this same state')
        await delay(Math.min(30000, 1000 * 2 ** Math.min(job.retries, 5)))
      }
      const snapshot = store.getRun(job.runId) // actual paid-read release boundary, no body logging
      const e = store.getEscrow(intentId), status = intent.escrow
      const createHash = status?.createHash ?? store.escrowOutbox(intentId).find(t => t.operation === 'create')?.txHash ?? null
      const finishHash = status?.finishHash ?? null
      const create = createHash ? await lookupTx(ledger, createHash) : null
      const finish = finishHash ? await lookupTx(ledger, finishHash) : null
      const audit = store.auditEntries().filter(r => r.intentId === intentId)
      const grant = audit.find(r => r.kind === 'grant'), read = audit.find(r => r.kind === 'read_paid')
      const phase = hash => hash && submitted.has(hash) && validated.has(hash) ? validated.get(hash) - submitted.get(hash) : null
      const fulfillment = finish?.state === 'validated' ? String(finish.tx.Fulfillment ?? '') : ''
      const match = /^A0228020[0-9A-F]{64}$/.test(fulfillment) && `A0258020${createHashDigest(fulfillment.slice(8))}810120` === e?.quote.terms.condition
      const success = intent.status === 'VERIFIED' && status?.keyVerified === true && status?.decryptVerified === true && snapshot.contents.length > 0 && match && grant && read && grant.seq < read.seq
      const receipt = { schemaVersion: 1, network: 'xrpl-testnet', intentId, resourceId: candidate.resourceId, priceMinor: candidate.price.amountMinor, priceCurrency: 'SGD', asset: 'XRP', amountDrops: e?.quote.terms.amount ?? String(candidate.price.amountMinor * 1000), payer: manager.payer.address, payee: candidate.wallet, createHash, createLedger: create?.state === 'validated' ? create.ledgerIndex : null, createSequence: status?.createSequence ?? null, finishHash, finishLedger: finish?.state === 'validated' ? finish.ledgerIndex : null, condition: e?.quote.terms.condition ?? null, fulfillmentSha256: fulfillment ? createHashDigest(fulfillment) : null, fulfillmentHashMatch: match, grantAt: grant?.at ?? null, firstReadPaidAt: read?.at ?? null, grantSeq: grant?.seq ?? null, firstReadPaidSeq: read?.seq ?? null, createMs: phase(createHash), finishMs: phase(finishHash), endToEndMs: Date.now() - job.startedAt, outcome: success ? 'success' : 'failure', failureCause: success ? null : intent.error ?? intent.status, retries: job.retries }
      append(receiptsFile, receipt); publicRows.set(intentId, receipt)
      job.complete = true; atomic(checkpoint, state)
      console.log(JSON.stringify({ complete: publicRows.size, intentId, outcome: receipt.outcome, createHash, finishHash, endToEndMs: receipt.endToEndMs }))
      if (!success) throw Error('Purchase failed; receipt retained. Inspect before extending run')
    }
  }
  const results = await Promise.allSettled(lanes.map((_, i) => work(i).catch(error => { stopped = true; throw error })))
  if (results.some(r => r.status === 'rejected')) {
    for (const r of results) if (r.status === 'rejected') console.error(String(r.reason?.message ?? 'Worker failed').replace(/s[1-9A-HJ-NP-Za-km-z]{28}/g, '[private]').slice(0, 1500))
    throw Error('Run stopped with unresolved or failed purchase; inspect journals and resume')
  }
  if (stopped) process.exitCode = 130
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally {
  for (const server of servers.reverse()) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  for (const store of stores) store.close()
  for (const publisher of publishers) publisher.locals.journal.close()
  await ledger?.close()
  unlinkSync(lock)
}
function createHashDigest(hex) { return createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex').toUpperCase() }
