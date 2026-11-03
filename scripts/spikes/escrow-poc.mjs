// Standalone #261 research. No product wiring. Faucet XRP has no real value.
// Run: node --import tsx scripts/spikes/escrow-poc.mjs
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client, Wallet } from 'xrpl'
import { leafHash, manifestRoot, signManifest, verifyDelivery, verifyManifestSignature } from '../../shared/manifest.ts'
import { ManifestSchema } from '../../shared/contracts/manifest.ts'

// Intentionally ignore .env and endpoint overrides. Never use an existing wallet.
const endpoint = 'wss://s.altnet.rippletest.net:51233'
const client = new Client(endpoint, { connectionTimeout: 20_000, timeout: 20_000 })
const dir = resolve('scratch/escrow-261') // ignored; includes private recovery state
const privatePath = resolve(dir, 'private.json')
const publicPath = resolve('docs/spikes/escrow-testnet.json')
const amount = '10000' // 0.01 faucet XRP per case
let stage = 'connect'
mkdirSync(dir, { recursive: true, mode: 0o700 })
const state = existsSync(privatePath) ? JSON.parse(readFileSync(privatePath, 'utf8')) : {
  buyerSeed: Wallet.generate().seed, writerSeed: Wallet.generate().seed,
  cases: {}, transactions: {},
}
const report = existsSync(privatePath) && existsSync(publicPath)
  ? JSON.parse(readFileSync(publicPath, 'utf8'))
  : { label: 'XRPL TESTNET · no real value; SYNTHETIC article proof', endpoint,
    startedAt: new Date().toISOString(), transactions: [], cases: {} }
function atomic(path, value) {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  renameSync(`${path}.tmp`, path)
}
function save() { atomic(privatePath, state); atomic(publicPath, report) }
save() // wallet identities persist before faucet calls
const buyer = Wallet.fromSeed(state.buyerSeed), writer = Wallet.fromSeed(state.writerSeed)
const hex = text => Buffer.from(text).toString('hex').toUpperCase()
const sha = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase()
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// DER for a fixed 32-byte PREIMAGE-SHA-256, not a general ASN.1 encoder.
function cryptoCondition(secret) {
  assert.equal(secret.length, 32)
  return { condition: `A0258020${sha(secret)}810120`, fulfillment: `A0228020${secret.toString('hex').toUpperCase()}` }
}
async function account(wallet) {
  const { result } = await client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' })
  return { balanceDrops: result.account_data.Balance, ownerCount: result.account_data.OwnerCount }
}
async function ledger() {
  return (await client.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger
}
async function escrowObjects() {
  return (await client.request({ command: 'account_objects', account: buyer.classicAddress, ledger_index: 'validated', type: 'escrow' })).result.account_objects
}
async function fund(wallet) {
  try { await account(wallet) } catch (error) {
    if (error.data?.error !== 'actNotFound') throw error
    await client.fundWallet(wallet) // seed stays inside xrpl.js and private state
  }
}
async function lookup(hash) {
  try {
    const { result } = await client.request({ command: 'tx', transaction: hash })
    return result.validated ? result : undefined
  } catch (error) {
    if (error.data?.error !== 'txnNotFound') throw error
  }
}
async function transact(key, tx, expected = 'tesSUCCESS') {
  stage = key
  let entry = state.transactions[key]
  if (!entry) {
    const prepared = await client.autofill({ ...tx, Account: buyer.classicAddress })
    assert.ok(BigInt(prepared.Fee) <= 2000n, 'fee cap exceeded')
    const signed = buyer.sign(prepared)
    entry = state.transactions[key] = { tx: prepared, hash: signed.hash, blob: signed.tx_blob }
    save() // exact blob and Sequence BEFORE any network submission
  }
  let found = await lookup(entry.hash)
  if (!found) {
    entry.submittedAt ??= new Date().toISOString()
    save()
    // Never print a raw response/error: it may contain a signed fulfillment.
    await client.submit(entry.blob)
    const deadline = Date.now() + 120_000
    while (!(found = await lookup(entry.hash))) {
      assert.ok(Date.now() < deadline, 'pending transaction; rerun to reconcile SAME blob')
      assert.ok(Number((await ledger()).ledger_index) <= entry.tx.LastLedgerSequence,
        'expired transaction unresolved; inspect ledger, never automatically re-sign')
      await sleep(1000)
    }
  }
  if (!entry.record) {
    const closed = await ledger()
    entry.record = {
      key, type: entry.tx.TransactionType, hash: entry.hash,
      url: `https://testnet.xrpl.org/transactions/${entry.hash}`,
      result: found.meta.TransactionResult, feeDrops: entry.tx.Fee,
      sequence: entry.tx.Sequence, ledgerIndex: found.ledger_index,
      submittedAt: entry.submittedAt, observedValidatedAt: new Date().toISOString(),
      submitToObservedValidationMs: Date.now() - Date.parse(entry.submittedAt),
      observedLedgerCloseTime: closed.close_time,
    }
    report.transactions.push(entry.record)
    save()
    console.log(JSON.stringify(entry.record))
  }
  assert.equal(entry.record.result, expected)
  return entry
}
function proofFixture(broken) {
  const body = 'SYNTHETIC escrow spike article promises a reproducible proof.'
  const passages = [{ id: 'p1', text: body }], salts = ['synthetic-spike-salt']
  const leaves = [leafHash(salts[0], 0, passages[0].id, body)]
  const manifest = ManifestSchema.parse(signManifest({ root: manifestRoot(leaves), leaves,
    wordCount: body.split(/\s+/).length, claims: [], wallet: writer.classicAddress, pubKey: writer.publicKey,
    publisherSlug: 'escrow-spike', articleId: 'synthetic', version: 'v1',
    priceMinor: 1, publishedAt: '2026-11-03', relevance: 1,
  }, writer.privateKey))
  assert.ok(verifyManifestSignature(manifest))
  const delivered = broken ? [{ id: 'p1', text: 'SYNTHETIC altered delivery' }] : passages
  return verifyDelivery(body, delivered, salts, manifest)
}
async function runCase(name, broken, negativeProbes = true) {
  if (report.cases[name]?.complete) return
  let item = state.cases[name]
  if (!item) {
    const secret = randomBytes(32)
    item = state.cases[name] = { ...cryptoCondition(secret), cancelAfter: Number((await ledger()).close_time) + (broken ? 45 : 300) }
    save()
  }
  const evidence = report.cases[name] ??= {
    amountDrops: amount, cancelAfter: item.cancelAfter, condition: item.condition,
    before: { buyer: await account(buyer), writer: await account(writer) },
  }
  save()
  const invoice = `researchagent:escrow-spike:v1:${name}` // opaque, no private research
  const created = await transact(`${name}.create`, {
    TransactionType: 'EscrowCreate', Destination: writer.classicAddress, Amount: amount,
    Condition: item.condition, CancelAfter: item.cancelAfter,
    Memos: [{ Memo: { MemoType: hex('researchagent/escrow-v1'), MemoData: hex(invoice) } }],
  })
  evidence.locked ??= { buyer: await account(buyer), objects: await escrowObjects() }
  save()
  const common = { Owner: buyer.classicAddress, OfferSequence: created.tx.Sequence }
  if (!broken && negativeProbes) {
    await transact(`${name}.wrong-preimage`, { TransactionType: 'EscrowFinish', ...common,
      Condition: item.condition, Fulfillment: cryptoCondition(Buffer.alloc(32)).fulfillment }, 'tecCRYPTOCONDITION_ERROR')
  } else if (broken && negativeProbes) {
    await transact(`${name}.early-cancel`, { TransactionType: 'EscrowCancel', ...common }, 'tecNO_PERMISSION')
  }
  evidence.proof = proofFixture(broken)
  assert.equal(evidence.proof.ok, !broken)
  save()
  if (broken) {
    const deadline = Date.now() + 120_000
    // Expiry uses parent-ledger time, not this machine's clock; add strict margin.
    while (Number((await ledger()).close_time) <= item.cancelAfter) {
      assert.ok(Date.now() < deadline, 'ledger time stalled; rerun to cancel')
      await sleep(1000)
    }
    await transact(`${name}.expired-finish`, { TransactionType: 'EscrowFinish', ...common,
      Condition: item.condition, Fulfillment: item.fulfillment }, 'tecNO_PERMISSION')
  }
  const terminal = await transact(`${name}.${broken ? 'cancel' : 'finish'}`, broken
    ? { TransactionType: 'EscrowCancel', ...common }
    : { TransactionType: 'EscrowFinish', ...common, Condition: item.condition, Fulfillment: item.fulfillment })
  evidence.after = { buyer: await account(buyer), writer: await account(writer), objects: await escrowObjects() }
  assert.equal(evidence.locked.buyer.ownerCount, evidence.before.buyer.ownerCount + 1)
  assert.equal(evidence.after.buyer.ownerCount, evidence.before.buyer.ownerCount)
  assert.equal(evidence.after.objects.length, 0)
  const fees = report.transactions.filter(tx => tx.key.startsWith(`${name}.`)).reduce((sum, tx) => sum + BigInt(tx.feeDrops), 0n)
  assert.equal(BigInt(evidence.after.buyer.balanceDrops), BigInt(evidence.before.buyer.balanceDrops) - fees - (broken ? 0n : BigInt(amount)))
  assert.equal(BigInt(evidence.after.writer.balanceDrops), BigInt(evidence.before.writer.balanceDrops) + (broken ? 0n : BigInt(amount)))
  evidence.totalFeeDropsIncludingNegativeProbes = String(fees)
  evidence.createSubmitToTerminalValidatedMs = Date.parse(terminal.record.observedValidatedAt) - Date.parse(created.record.submittedAt)
  // Replay exact create blob after completion: never another escrow or payment.
  const replay = await client.submit(created.blob)
  evidence.replayEngineResult = replay.result.engine_result
  assert.equal((await lookup(created.hash)).ledger_index, created.record.ledgerIndex)
  assert.equal((await escrowObjects()).length, 0)
  evidence.complete = true
  save()
}
try {
  report.offlineFixtureChecks = { passed: proofFixture(false), altered: proofFixture(true) }
  assert.equal(report.offlineFixtureChecks.passed.ok, true)
  assert.equal(report.offlineFixtureChecks.altered.ok, false)
  await client.connect()
  const { result: { info } } = await client.request({ command: 'server_info' })
  assert.equal(info.network_id, 1, 'refuse any network except Testnet')
  report.network ??= { networkId: info.network_id, buildVersion: info.build_version, reserve: info.validated_ledger }
  const { result } = await client.request({ command: 'feature' })
  report.escrowAmendments = Object.entries(result.features).filter(([, f]) => /Escrow/.test(f.name)).map(([id, f]) => ({ id, ...f }))
  report.accounts = { buyer: buyer.classicAddress, writer: writer.classicAddress }
  save()
  await fund(buyer)
  await fund(writer)
  await runCase('release', false)
  await runCase('cancel', true)
  await runCase('release-clean', false, false)
  report.completedAt = new Date().toISOString()
  save()
  console.log(`Complete: ${publicPath}. Private recovery state stays in ignored scratch/escrow-261.`)
} catch {
  console.error(`Escrow spike stopped at ${stage}. Inspect public evidence; rerun reconciles saved hashes. No fresh signatures for pending transactions.`)
  process.exitCode = 1
} finally {
  await client.disconnect()
}
