import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { signMultiBatch, encodeForSigningBatch, hashes } from 'xrpl'
import { sign } from 'ripple-keypairs'
import { conditionFor, fulfillmentFor } from '../../shared/escrow.ts'
import { connect, funded, cancelAfter, submit, save, escrows } from './lib.mjs'
const c = await connect(), records = [], observations = {}
try {
  const buyer = await funded(c), writer = await funded(c)
  const secret = randomBytes(32).toString('hex').toUpperCase(), condition = conditionFor(secret)
  const create = { TransactionType: 'EscrowCreate', Account: buyer.address, Destination: writer.address, Amount: '10000', Condition: condition, CancelAfter: await cancelAfter(c) }
  const send = async (wallet, tx, options) => { const r = await submit(c, wallet, tx, options); records.push(r.record); save('b', { observations, records }); return r }
  const batch = inner => ({ TransactionType: 'Batch', Account: buyer.address, Flags: 65536, RawTransactions: inner.map(tx => ({ RawTransaction: { ...tx, Flags: 1073741824, Fee: '0', SigningPubKey: '' } })) })
  const b1 = await send(buyer, batch([create, { ...create, Amount: '20000' }]), { label: 'B1 two escrow creates' })
  assert.equal(b1.record.result, 'tesSUCCESS')
  observations.b1Created = (await escrows(c, buyer)).length; assert.equal(observations.b1Created, 2)
  const fail = await send(buyer, batch([create, { ...create, Amount: '99999999999999999' }]), { label: 'B1 failing second create' })
  observations.b1AfterFailed = (await escrows(c, buyer)).length
  assert.equal(observations.b1AfterFailed, 2)
  observations.b1FailedMetadata = fail.meta
  const finish = { TransactionType: 'EscrowFinish', Account: writer.address, Owner: buyer.address, OfferSequence: 1, Condition: condition, Fulfillment: fulfillmentFor(secret) }
  const b2 = batch([create, finish])
  // Autofill reserves outer Sequence, then buyer's inner Sequence. Freeze it BEFORE signing writer's BatchSigners.
  const filled = await c.autofill(b2)
  filled.RawTransactions[1].RawTransaction.OfferSequence = filled.RawTransactions[0].RawTransaction.Sequence
  const both = await send(buyer, filled, { label: 'B2 create + writer finish', batchSigner: tx => {
    try { signMultiBatch(writer, tx) } catch (error) {
      observations.sdkSigningError = error.message
      // xrpl 4.7 passes the old signing payload to a codec requiring Batch V1_1 fields.
      const payload = encodeForSigningBatch({ account: tx.Account, sequence: tx.Sequence, flags: tx.Flags,
        txIDs: tx.RawTransactions.map(r => hashes.hashSignedTx(r.RawTransaction)), batchAccount: writer.address })
      tx.BatchSigners = [{ BatchSigner: { Account: writer.address, SigningPubKey: writer.publicKey, TxnSignature: sign(payload, writer.privateKey) } }]
    }
  } })
  observations.b2Metadata = both.meta
  observations.b2EscrowsAfter = (await escrows(c, buyer)).length
  const normalStart = performance.now(), normalLedger = await c.getLedgerIndex()
  const normal = await send(buyer, create, { label: 'B3 normal create' })
  assert.equal(normal.record.result, 'tesSUCCESS')
  const done = await send(writer, { ...finish, OfferSequence: normal.record.tx.Sequence }, { label: 'B3 normal finish' })
  assert.equal(done.record.result, 'tesSUCCESS')
  observations.normal = { ms: Math.round(performance.now() - normalStart), ledgers: done.record.ledger - normalLedger }
  observations.batch = { ms: both.record.ms, ledgers: both.record.ledgers, result: both.record.result, createsRemaining: observations.b2EscrowsAfter - 2 }
  save('b', { verdict: both.record.result === 'tesSUCCESS' && observations.b2EscrowsAfter === 2 ? 'works' : 'partial', at: new Date().toISOString(), buyer: buyer.address, writer: writer.address, observations, records })
} finally { await c.disconnect() }
