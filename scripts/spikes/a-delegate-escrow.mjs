import assert from 'node:assert/strict'
import { conditionFor, fulfillmentFor } from '../../shared/escrow.ts'
import { randomBytes } from 'node:crypto'
import { connect, funded, account, cancelAfter, submit, save } from './lib.mjs'
const c = await connect(), records = []
try {
  const v = await funded(c), g = await funded(c), w = await funded(c)
  const secret = randomBytes(32).toString('hex').toUpperCase()
  const send = async (wallet, tx, label) => { const r = await submit(c, wallet, tx, { label }); records.push(r.record); save('a', { at: new Date().toISOString(), records }); return r.record }
  const grant = await send(v, { TransactionType: 'DelegateSet', Account: v.address, Authorize: g.address, Permissions: [{ Permission: { PermissionValue: 'EscrowCreate' } }] }, 'grant EscrowCreate only')
  if (grant.result !== 'tesSUCCESS') { save('a', { verdict: 'fails', records }); process.exitCode = 1 }
  else {
    const before = await Promise.all([account(c, v), account(c, g)])
    const tx = { TransactionType: 'EscrowCreate', Account: v.address, Delegate: g.address, Destination: w.address, Amount: '100000', Condition: conditionFor(secret), CancelAfter: await cancelAfter(c) }
    const create = await send(g, tx, 'delegated create')
    const after = await Promise.all([account(c, v), account(c, g)])
    const deltas = { visitor: String(BigInt(after[0].Balance) - BigInt(before[0].Balance)), agent: String(BigInt(after[1].Balance) - BigInt(before[1].Balance)), fee: create.tx.Fee }
    assert.equal(create.result, 'tesSUCCESS'); assert.equal(deltas.visitor, '-100000'); assert.equal(deltas.agent, `-${create.tx.Fee}`)
    const finish = await send(w, { TransactionType: 'EscrowFinish', Account: w.address, Owner: v.address, OfferSequence: create.tx.Sequence, Condition: tx.Condition, Fulfillment: fulfillmentFor(secret) }, 'writer finish')
    assert.equal(finish.result, 'tesSUCCESS')
    const payment = await send(g, { TransactionType: 'Payment', Account: v.address, Delegate: g.address, Destination: w.address, Amount: '1' }, 'unauthorized Payment')
    assert.notEqual(payment.engine, 'tesSUCCESS')
    const revoke = await send(v, { TransactionType: 'DelegateSet', Account: v.address, Authorize: g.address, Permissions: [] }, 'revoke')
    assert.equal(revoke.result, 'tesSUCCESS')
    const denied = await send(g, tx, 'create after revocation')
    assert.notEqual(denied.engine, 'tesSUCCESS')
    save('a', { verdict: 'works', at: new Date().toISOString(), visitor: v.address, agent: g.address, writer: w.address, deltas, records })
  }
} finally { await c.disconnect() }
