import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { encodePaymentRequiredHeader, decodePaymentRequiredHeader, XRPLPresignedPaymentPayer, jsonCanonicalStringify } from 'x402-xrpl'
import { Wallet } from 'xrpl'
import { seal, open, conditionFor, checkOffer, checkCreate, run } from './example.mjs'

test('ciphertext quarantined until the ledger key matches; tampering fails closed', () => {
  const { key, envelope } = seal(Buffer.from('synthetic paid bytes'))
  const condition = conditionFor(key), finish = { Condition: condition, Fulfillment: `A0228020${key.toString('hex').toUpperCase()}` }
  assert.ok(!JSON.stringify(envelope).includes('synthetic paid bytes'))
  assert.equal(open(envelope, finish, condition), 'synthetic paid bytes')
  assert.throws(() => open(envelope, { ...finish, Fulfillment: `A0228020${'00'.repeat(32)}` }, condition))
  assert.throws(() => open(envelope, finish, conditionFor(Buffer.alloc(32))))
  assert.throws(() => open({ ...envelope, tag: '00'.repeat(16) }, finish, condition))
  assert.throws(() => open({ ...envelope, plaintextHash: '00'.repeat(32) }, finish, condition))
})
test('pinned t54 header codec preserves custom terms; exact payer refuses the scheme', () => {
  const req = { scheme: 'key-reveal-escrow', network: 'xrpl:1', asset: 'XRP', amount: '1000',
    payTo: Wallet.generate().classicAddress, maxTimeoutSeconds: 60,
    extra: { buyer: Wallet.generate().classicAddress, condition: conditionFor(Buffer.alloc(32)), cancelAfter: 124, invoiceId: 'synthetic' } }
  const offer = { x402Version: 2, resource: { url: 'http://127.0.0.1/article' }, accepts: [req], extensions: { keyReveal: seal(Buffer.from('fixture')).envelope } }
  const decoded = decodePaymentRequiredHeader(encodePaymentRequiredHeader(offer))
  assert.deepEqual(decoded.accepts[0], req); assert.deepEqual(decoded.extensions, offer.extensions)
  const payer = new XRPLPresignedPaymentPayer({ wallet: Wallet.generate(), network: 'xrpl:1', wsUrl: 'wss://s.altnet.rippletest.net:51233' })
  assert.equal(payer.supports(req), false)
  checkOffer(req, req.payTo, req.extra.buyer, 100)
  for (const patch of [{ amount: '1001' }, { network: 'xrpl:0' }, { scheme: 'exact' }, { payTo: req.extra.buyer },
    { extra: { ...req.extra, cancelAfter: 100 } }, { extra: { ...req.extra, buyer: req.payTo } }]) {
    assert.throws(() => checkOffer({ ...req, ...patch }, req.payTo, req.extra.buyer, 100))
  }
  // Missing the envelope/invoice commitment must fail before seller settlement.
  const tx = { TransactionType: 'EscrowCreate', Account: req.extra.buyer,
    Destination: req.payTo, Amount: req.amount, Condition: req.extra.condition, CancelAfter: 124 }
  assert.throws(() => checkCreate(tx, offer))
  tx.Memos = [{ Memo: { MemoData: createHash('sha256').update(jsonCanonicalStringify(offer)).digest('hex').toUpperCase() } }]
  checkCreate({ ...tx, date: 100, ctid: 'synthetic', ledger_index: 42 }, offer) // RPC annotations are not signed fields.
  assert.throws(() => checkCreate({ ...tx, Amount: '999' }, offer))
})
test('Testnet: create, reveal, decrypt, replay and CancelAfter principal refund', {
  skip: process.env.XRPL_KEY_REVEAL_TESTNET !== '1', timeout: 180000,
}, async () => {
  const result = await run()
  assert.equal(result.receipts.length, 4)
  for (const receipt of result.receipts) assert.match(receipt.hash, /^[A-F0-9]{64}$/)
})
