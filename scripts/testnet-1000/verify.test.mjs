import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkPair, verify, checkHistory } from './verify.mjs'
import { append, rows, receiptIndex, atomic } from './state.mjs'
import { ResourceScope } from '../../shared/resource-scope.ts'
const sha = hex => createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex').toUpperCase()
function fixture() {
  const key = 'AB'.repeat(32), fulfillment = 'A0228020' + key, condition = 'A0258020' + sha(key) + '810120'
  const receipt = { schemaVersion: 1, network: 'xrpl-testnet', intentId: 'one', priceMinor: 40, priceCurrency: 'SGD', asset: 'XRP', amountDrops: '40000', payer: 'buyer', payee: 'writer', createHash: 'A'.repeat(64), finishHash: 'B'.repeat(64), createLedger: 10, finishLedger: 11, createSequence: 2, condition, fulfillmentSha256: sha(fulfillment), fulfillmentHashMatch: true, grantSeq: 10, firstReadPaidSeq: 11, grantAt: '2026-11-12T00:00:00Z', firstReadPaidAt: '2026-11-12T00:00:00Z', createMs: 10, finishMs: 10, endToEndMs: 30, retries: 0, outcome: 'success' }
  const create = { hash: receipt.createHash, ledger_index: 10, validated: true, meta: { TransactionResult: 'tesSUCCESS' }, tx_json: { TransactionType: 'EscrowCreate', Account: 'buyer', Destination: 'writer', Amount: '40000', Sequence: 2, Condition: condition, Fee: '12' } }
  const finish = { hash: receipt.finishHash, ledger_index: 11, validated: true, meta: { TransactionResult: 'tesSUCCESS' }, tx_json: { TransactionType: 'EscrowFinish', Owner: 'buyer', OfferSequence: 2, Condition: condition, Fulfillment: fulfillment, Fee: '423' } }
  receipt.resourceId = 'article'
  finish.tx_json.Account = receipt.payee
  create.tx_json.Memos = [{ Memo: { MemoType: Buffer.from('researchagent/escrow-v1').toString('hex'), MemoData: Buffer.from(JSON.stringify({ intentId: receipt.intentId, articleId: receipt.resourceId, payer: receipt.payer, payTo: receipt.payee, amount: receipt.amountDrops, asset: receipt.asset, condition })).toString('hex') } }]
  return { receipt, create, finish }
}
test('independent verification rejects adversarial transaction and receipt edits', () => {
  const good = fixture(); assert.deepEqual(checkPair(good.receipt, good.create, good.finish), [])
  for (const mutate of [
    f => { f.create.validated = false }, f => { f.finish.meta.TransactionResult = 'tecNO_TARGET' },
    f => { f.create.tx_json.Amount = '39999' }, f => { f.create.tx_json.Destination = 'attacker' },
    f => { f.finish.tx_json.OfferSequence++ }, f => { f.finish.tx_json.Fulfillment = 'A0228020' + 'CD'.repeat(32) },
    f => { f.receipt.condition = 'bad' }, f => { f.receipt.fulfillmentSha256 = 'bad' },
    f => { f.receipt.firstReadPaidSeq = 9 }, f => { f.receipt.priceMinor = 41 },
    f => { f.receipt.finishHash = 'C'.repeat(64) }, f => { f.receipt.createLedger = 12 },
  ]) { const f = fixture(); mutate(f); assert.ok(checkPair(f.receipt, f.create, f.finish).length > 0) }
})
test('history scan detects an omitted second create even when receipts alone look unique', async () => {
  const f = fixture(), row = { ...f.create, validated: true }
  assert.equal((await checkHistory([f.receipt], async () => ({ transactions: [row] }), 12)).errors.length, 0)
  const extra = structuredClone(row); extra.hash = 'C'.repeat(64); extra.tx_json.Sequence++
  const result = await checkHistory([f.receipt], async () => ({ transactions: [row, extra] }), 12)
  assert.equal(result.errors.length, 3)
})
test('duplicate intents, duplicate creates, missing ledger history and aggregate tampering fail', async () => {
  const f = fixture(), request = async h => h === f.receipt.createHash ? f.create : f.finish
  assert.equal((await verify([f.receipt], request)).success, true)
  assert.equal((await verify([f.receipt, f.receipt], request)).success, false)
  assert.equal((await verify([f.receipt, { ...f.receipt, createHash: 'C'.repeat(64) }], request)).success, false)
  assert.equal((await verify([f.receipt], async () => { throw Error('offline') })).success, false)
  assert.equal((await verify([{ ...f.receipt, amountDrops: '1' }], request)).success, false)
  assert.equal((await verify([], request)).success, false)
})
test('resume retains complete receipts and rejects duplicate charge records', async () => {
  const scope = new ResourceScope(), root = scope.tempDir('t1000-test-')
  try {
    const file = join(root, 'receipts.jsonl'), cp = join(root, 'checkpoint.json')
    append(file, { intentId: 'one', createHash: 'same' }); atomic(cp, { complete: 1 })
    writeFileSync(file, '{"intentId":', { flag: 'a' })
    assert.throws(() => rows(file)); assert.equal(rows(file, true).length, 1)
    assert.equal(receiptIndex(rows(file)).get('one').createHash, 'same')
    assert.throws(() => receiptIndex([...rows(file), ...rows(file)]))
    assert.deepEqual(JSON.parse(readFileSync(cp, 'utf8')), { complete: 1 })
  } finally { await scope.close() }
})
