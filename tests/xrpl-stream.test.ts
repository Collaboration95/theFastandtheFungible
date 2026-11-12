import { afterEach, expect, it, vi } from 'vitest'
import { Wallet } from 'xrpl'
const state = vi.hoisted(() => ({ emit: (_name: string, _payload?: unknown) => {}, submits: 0, requests: [] as string[], connected: false, validated: false, index: 100, sequence: 1, failSubscribe: false }))
vi.mock('xrpl', async original => {
  const { EventEmitter } = await import('node:events')
  return { ...await original<typeof import('xrpl')>(), Client: class extends EventEmitter {
    constructor() { super(); state.emit = (name, payload) => { if (name === 'disconnected') state.connected = false; this.emit(name, payload) } }
    isConnected() { return state.connected }
    async connect() { state.connected = true }
    async disconnect() { state.connected = false; this.emit('disconnected') }
    async request(r: Record<string, unknown>) {
      state.requests.push(String(r.command))
      if (r.command === 'subscribe' && state.failSubscribe) throw Error('subscription refused')
      if (r.command === 'account_info') return { result: { account_data: { Sequence: state.sequence } } }
      if (r.command === 'submit') { state.submits++; return { result: {} } }
      if (r.command === 'ledger') return { result: { ledger_index: state.index } }
      if (r.command === 'tx') {
        if (state.validated) return { result: { ...event, tx_json: event.transaction } }
        throw Object.assign(Error('missing'), { data: { error: 'txnNotFound' } })
      }
      return { result: {} }
    }
  } }
})
import { autofillHint, testnetLedger, lookupTx, streamTransaction, waitForTx } from '../shared/xrpl.js'
import { XrplPayer } from '../server/xrpl.js'
const hash = 'A'.repeat(64)
const event = { hash, validated: true, ledger_index: 100, transaction: { TransactionType: 'EscrowCreate', Account: Wallet.generate().classicAddress, Sequence: 1, hash }, meta: { TransactionResult: 'tesSUCCESS' } }
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); vi.unstubAllEnvs(); state.requests = []; state.validated = false; state.connected = false; state.submits = 0; state.index = 100; state.sequence = 1; state.failSubscribe = false; vi.restoreAllMocks() })
async function ledger() { vi.stubEnv('XRPL_STREAM_WAITS', '1'); const l = testnetLedger(); cleanup.push(() => l.close()); await l.request({ command: 'server_info' }); return l }
const submission = { txHash: hash, txBlob: '', lastLedgerSequence: 120 }
it('wakes on exact validated transaction amid proposed, unrelated, reordered and duplicate events, and reuses metadata', async () => {
  const l = await ledger(), payer = new XrplPayer(l, Wallet.generate(), { pollMs: 1000, timeoutMs: 1000 })
  const pending = payer.waitFor(submission)
  await new Promise(r => setTimeout(r, 5))
  state.emit('ledgerClosed', { ledger_index: 102 })
  state.emit('transaction', { ...event, hash: 'B'.repeat(64) })
  state.emit('transaction', { ...event, validated: false })
  expect(l.cachedTx?.(hash)).toBeUndefined()
  state.emit('transaction', event); state.emit('transaction', event)
  expect(await pending).toEqual({ state: 'success', ledgerIndex: 100 })
  const reads = state.requests.length
  expect((await lookupTx(l, hash)).state).toBe('validated')
  expect(state.requests).toHaveLength(reads)
  expect(state.submits).toBe(0)
  // A stale duplicate cannot replace the first validated observation.
  state.emit('transaction', { ...event, ledger_index: 99, meta: { TransactionResult: 'tecFAILED' } })
  expect(await payer.status(submission)).toEqual({ state: 'success', ledgerIndex: 100 })
})
it('handles validation that arrives before waiter registration, including API v2 tx_json', async () => {
  const l = await ledger()
  state.emit('transaction', { ...event, transaction: undefined, tx_json: event.transaction })
  const reads = state.requests.length
  expect((await waitForTx(l, hash)).state).toBe('validated')
  expect(state.requests).toHaveLength(reads)
})
it('reconnects and polls after disconnect without signing or submitting', async () => {
  const l = await ledger(), payer = new XrplPayer(l, Wallet.generate(), { pollMs: 2, timeoutMs: 100 })
  const pending = payer.waitFor(submission)
  await new Promise(r => setTimeout(r, 5))
  state.validated = true; state.emit('disconnected')
  expect(await pending).toEqual({ state: 'success', ledgerIndex: 100 })
  expect(state.requests.filter(c => c === 'subscribe')).toHaveLength(2)
  expect(state.submits).toBe(0)
})
it('bounds a silent stream, stays pending and removes its waiter', async () => {
  const l = await ledger(), payer = new XrplPayer(l, Wallet.generate(), { pollMs: 1, timeoutMs: 20 })
  expect(await payer.waitFor(submission)).toEqual({ state: 'pending' })
  state.emit('transaction', { ...event, validated: false })
  expect(l.cachedTx?.(hash)).toBeUndefined()
  expect(state.submits).toBe(0)
})
it.each([{ ...event, validated: false }, { ...event, meta: undefined }, { ...event, ledger_index: 0 }, { ...event, hash: 'bad' }])('refuses incomplete stream proof %#', input => {
  expect(streamTransaction(input)).toBeUndefined()
})

it('ignores ledger event order for expiry, requiring a validated account sequence proof', async () => {
  const l = await ledger(), wallet = Wallet.generate()
  const tx = wallet.sign({ TransactionType: 'AccountSet', Account: wallet.classicAddress, Sequence: 1, Fee: '12', LastLedgerSequence: 120 })
  const signed = { txHash: tx.hash, txBlob: tx.tx_blob, lastLedgerSequence: 120 }
  const payer = new XrplPayer(l, wallet)
  state.emit('ledgerClosed', { ledger_index: 999 })
  expect(await payer.status(signed)).toEqual({ state: 'pending' })
  state.index = 121
  expect(await payer.status(signed)).toEqual({ state: 'expired' })
  state.sequence = 2
  expect(await payer.status(signed)).toEqual({ state: 'pending' })
  expect(state.submits).toBe(0)
})
it('falls back to polling when subscribe is refused', async () => {
  state.failSubscribe = true
  const l = await ledger(), payer = new XrplPayer(l, Wallet.generate(), { pollMs: 1, timeoutMs: 100 })
  expect(l.streamActive?.()).toBe(false)
  const pending = payer.waitFor(submission)
  setTimeout(() => { state.validated = true }, 5)
  expect(await pending).toEqual({ state: 'success', ledgerIndex: 100 })
  expect(l.diagnostics?.().subscriptionFailures).toBe(1)
  expect(state.submits).toBe(0)
})
it('coalesces fee/index hints for only 750 ms and evicts failed reads', async () => {
  const l = await ledger(), clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
  await Promise.all([autofillHint(l, 'fee'), autofillHint(l, 'fee')])
  expect(state.requests.filter(c => c === 'fee')).toHaveLength(1)
  clock.mockReturnValue(1750)
  await autofillHint(l, 'fee')
  expect(state.requests.filter(c => c === 'fee')).toHaveLength(2)
  const read = vi.spyOn(l, 'request').mockRejectedValueOnce(Error('disconnected'))
  await expect(autofillHint(l, 'ledger_current')).rejects.toThrow('disconnected')
  await autofillHint(l, 'ledger_current')
  expect(read).toHaveBeenCalledTimes(2)
})
it('bounds an RPC that never responds and does not submit', async () => {
  expect(await waitForTx({ request: () => new Promise(() => {}) }, hash, { timeoutMs: 10, pollMs: 1 })).toEqual({ state: 'pending' })
  expect(state.submits).toBe(0)
})

it('wakes only the matching transaction waiter, while ledger close wakes all', async () => {
  const l = await ledger(), first = vi.fn(), second = vi.fn()
  const removeFirst = l.activity!(first, hash), removeSecond = l.activity!(second, 'B'.repeat(64))
  state.emit('transaction', event)
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).not.toHaveBeenCalled()
  state.emit('ledgerClosed', { ledger_index: 100 })
  expect(first).toHaveBeenCalledTimes(2)
  expect(second).toHaveBeenCalledTimes(1)
  removeFirst(); removeSecond()
})

it('continues the read-only fallback after a transient RPC disconnect', async () => {
  const request = vi.fn().mockRejectedValueOnce(Error('disconnected')).mockResolvedValue({ result: { ...event, tx_json: event.transaction } })
  expect((await waitForTx({ request }, hash, { pollMs: 1, timeoutMs: 100 })).state).toBe('validated')
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls.every(([r]) => r.command === 'tx')).toBe(true)
})
