import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Wallet } from 'xrpl'
import { compareKey, shortHex, verifyKeyOnLedger, type LedgerFor, type ReadOnlyLedger } from '../src/verify/key-on-ledger'
import { chain } from './fixtures/key-reveal-ledger'

// "Check the key yourself" (T1): sha256(key) = lock, from two public transactions. The fixture chain is the repo's
// deterministic ledger SIMULATION; it stores the EscrowCreate and EscrowFinish exactly as signed and answers `tx` the
// way a public node does (including `txnNotFound`). The real-node run is recorded in docs/evidence/key-on-ledger.
const conditionOf = (key: Buffer) => `A0258020${createHash('sha256').update(key).digest('hex').toUpperCase()}810120`
const fulfillmentOf = (key: Buffer) => `A0228020${key.toString('hex').toUpperCase()}`

type Options = { key?: Buffer; published?: Buffer; finishCondition?: string; offerSequence?: number; skipFinish?: boolean; failFinish?: boolean; validate?: boolean }
function scenario(options: Options = {}) {
  const c = chain(), payer = Wallet.generate(), writer = Wallet.generate(), key = options.key ?? randomBytes(32)
  c.state.validate = options.validate ?? true
  const sign = (wallet: Wallet, tx: Record<string, unknown>) => wallet.sign(tx as never)
  const submit = (blob: string) => c.ledger.request({ command: 'submit', tx_blob: blob })
  const create = sign(payer, { TransactionType: 'EscrowCreate', Account: payer.classicAddress, Destination: writer.classicAddress, Amount: '400000', Condition: conditionOf(key), CancelAfter: 800000600, Sequence: 7, Fee: '12' })
  const finish = sign(writer, { TransactionType: 'EscrowFinish', Account: writer.classicAddress, Owner: payer.classicAddress, OfferSequence: options.offerSequence ?? 7, Condition: options.finishCondition ?? conditionOf(key), Fulfillment: fulfillmentOf(options.published ?? key), Sequence: 3, Fee: '330' })
  return { c, create, finish, key, ready: (async () => {
    await submit(create.tx_blob)
    if (!options.skipFinish) {
      if (options.failFinish) c.state.now = 800000700 // after CancelAfter: the finish does not succeed
      await submit(finish.tx_blob)
    }
  })() }
}
const hashes = (s: ReturnType<typeof scenario>) => ({ create: s.create.hash, finish: s.finish.hash })
const only = (ledger: ReadOnlyLedger): LedgerFor => () => ledger
const NODES = ['wss://one.rippletest.net:51233', 'wss://two.rippletest.net:51233']

describe('sha256(key) = lock from recorded transactions', () => {
  it('passes for the key the writer published, with the ledger it came from', async () => {
    const s = scenario(); await s.ready
    const result = await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(s.c.ledger) })
    expect(result).toMatchObject({ status: 'match', lock: createHash('sha256').update(s.key).digest('hex').toUpperCase(), key: s.key.toString('hex').toUpperCase() })
    expect(result.status === 'match' && result.ledger).toBeGreaterThan(100)
  })

  it('reads the flat (API v1) and the tx_json (API v2) answer shapes the same way', async () => {
    const s = scenario(); await s.ready
    const v2 = (await s.c.ledger.request({ command: 'tx', transaction: s.create.hash })).result
    const v2finish = (await s.c.ledger.request({ command: 'tx', transaction: s.finish.hash })).result
    const flat = (result: Record<string, unknown>) => ({ ...(result.tx_json as object), validated: result.validated, ledger_index: result.ledger_index, meta: result.meta })
    expect((await compareKey(v2, v2finish)).status).toBe('match')
    expect((await compareKey(flat(v2), flat(v2finish))).status).toBe('match')
  })

  it('a tampered fulfillment does not match and is never a ✓', async () => {
    const key = randomBytes(32), other = Buffer.from(key); other[0] ^= 1
    const s = scenario({ key, published: other }); await s.ready
    const result = await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(s.c.ledger) })
    expect(result).toMatchObject({ status: 'mismatch', why: 'key' })
  })

  it('compares the EscrowCreate lock with the lock named on the finish', async () => {
    const s = scenario({ finishCondition: conditionOf(randomBytes(32)) }); await s.ready
    expect(await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(s.c.ledger) })).toMatchObject({ status: 'mismatch', why: 'lock' })
  })

  it('refuses a finish that releases some other escrow', async () => {
    const c = chain(), payer = Wallet.generate(), writer = Wallet.generate(), key = randomBytes(32)
    const create = payer.sign({ TransactionType: 'EscrowCreate', Account: payer.classicAddress, Destination: writer.classicAddress, Amount: '1', Condition: conditionOf(key), CancelAfter: 800000600, Sequence: 7, Fee: '12' } as never)
    // The write-once simulation only accepts a finish for an existing escrow, so record a second one to point at.
    const second = payer.sign({ TransactionType: 'EscrowCreate', Account: payer.classicAddress, Destination: writer.classicAddress, Amount: '1', Condition: conditionOf(key), CancelAfter: 800000600, Sequence: 8, Fee: '12' } as never)
    const finish = writer.sign({ TransactionType: 'EscrowFinish', Account: writer.classicAddress, Owner: payer.classicAddress, OfferSequence: 8, Condition: conditionOf(key), Fulfillment: fulfillmentOf(key), Sequence: 3, Fee: '330' } as never)
    for (const tx of [create, second, finish]) await c.ledger.request({ command: 'submit', tx_blob: tx.tx_blob })
    // create (sequence 7) + a finish whose OfferSequence is 8
    expect(await verifyKeyOnLedger({ create: create.hash, finish: finish.hash }, { endpoints: NODES, ledgerFor: only(c.ledger) })).toMatchObject({ status: 'mismatch', why: 'escrow' })
  })

  it('a finish that did not succeed on the ledger is not a ✓', async () => {
    const s = scenario({ failFinish: true }); await s.ready
    expect(await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(s.c.ledger) })).toMatchObject({ status: 'mismatch', why: 'failed' })
  })

  it('a transaction in the wrong place is not a key check', async () => {
    const s = scenario(); await s.ready
    expect(await verifyKeyOnLedger({ create: s.finish.hash, finish: s.create.hash }, { endpoints: NODES, ledgerFor: only(s.c.ledger) })).toMatchObject({ status: 'mismatch', why: 'escrow' })
  })

  it('a malformed hash is unreadable, with no lookup', async () => {
    let asked = 0
    const ledger: ReadOnlyLedger = { async request() { asked++; throw new Error('should not be asked') } }
    expect(await verifyKeyOnLedger({ create: 'nope', finish: 'A'.repeat(64) }, { endpoints: NODES, ledgerFor: only(ledger) })).toEqual({ status: 'unreadable' })
    expect(asked).toBe(0)
  })
})

describe('network states', () => {
  it('txnNotFound is pending ("not found yet"), never a failure', async () => {
    const s = scenario({ skipFinish: true }); await s.ready
    const result = await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(s.c.ledger) })
    expect(result).toEqual({ status: 'pending', why: 'not-found' })
  })

  it('a transaction the node has not finalised is pending too', async () => {
    const s = scenario({ validate: false }); await s.ready
    expect(await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(s.c.ledger) })).toEqual({ status: 'pending', why: 'not-validated' })
  })

  it('asks the next public node when the first has not got the transaction', async () => {
    const s = scenario(); await s.ready
    const asked: string[] = []
    const empty: ReadOnlyLedger = { async request() { throw Object.assign(new Error('missing'), { data: { error: 'txnNotFound' } }) } }
    const ledgerFor: LedgerFor = endpoint => { asked.push(endpoint); return endpoint === NODES[0] ? empty : s.c.ledger }
    expect((await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor })).status).toBe('match')
    expect(asked).toEqual(NODES)
  })

  it('joins a create found on one node with a finish found on another', async () => {
    const s = scenario(); await s.ready
    const only = (name: 'create' | 'finish'): ReadOnlyLedger => ({ request: request => request.transaction === s[name].hash ? s.c.ledger.request(request as never) : Promise.reject(Object.assign(new Error('missing'), { data: { error: 'txnNotFound' } })) })
    const ledgerFor: LedgerFor = endpoint => only(endpoint === NODES[0] ? 'create' : 'finish')
    expect((await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor })).status).toBe('match')
  })

  it('no reachable public node says nothing is checked, with no ✓', async () => {
    const s = scenario(); await s.ready
    const down: ReadOnlyLedger = { async request() { throw new Error('Read-only Testnet lookup unavailable') } }
    expect(await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(down) })).toEqual({ status: 'unreachable' })
    expect(await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: () => { throw new Error('socket') } })).toEqual({ status: 'unreachable' })
    const slow: ReadOnlyLedger = { async request() { throw new Error('Ledger timeout') } }
    expect(await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor: only(slow) })).toEqual({ status: 'unreachable' })
  })

  it('closes every lookup it opens', async () => {
    const s = scenario(); await s.ready
    let closed = 0
    const ledgerFor: LedgerFor = () => ({ request: request => s.c.ledger.request(request as never), close: () => { closed++ } })
    await verifyKeyOnLedger(hashes(s), { endpoints: NODES, ledgerFor })
    expect(closed).toBe(1)
  })
})

describe('short hex', () => {
  it('keeps the first and last 8 characters', () => {
    expect(shortHex('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe('A1B2C3D4…6D7E8F90')
    expect(shortHex('abcd')).toBe('ABCD')
  })
})
