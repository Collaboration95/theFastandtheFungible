import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ connects: 0, disconnects: 0, release: () => {}, requests: vi.fn() }))
vi.mock('xrpl', async importOriginal => ({
  ...await importOriginal<typeof import('xrpl')>(),
  Client: class {
    connected = false
    isConnected() { return this.connected }
    async connect() { state.connects++; await new Promise<void>(done => { state.release = done }); this.connected = true }
    async request(request: unknown) { state.requests(request); return { result: {} } }
    async disconnect() { state.disconnects++; this.connected = false }
  },
}))
import { testnetLedger } from '../shared/xrpl.js'
it('shares a connecting Testnet socket across parallel signing requests, then closes it', async () => {
  const ledger = testnetLedger()
  const pending = Promise.all(['account_info', 'fee', 'ledger_current'].map(command => ledger.request({ command })))
  expect(state.connects).toBe(1)
  state.release()
  await pending
  await ledger.close()
  expect(state.disconnects).toBe(1)
})

// The public dummy-finish fee probe uses a separate standalone research script.
// Application RPC must reject every Fulfillment, including binary requests.
import { encode } from 'xrpl'
it.each([
  { command: 'simulate', tx_json: { TransactionType: 'EscrowFinish', Fulfillment: 'A0228020' + '11'.repeat(32) } },
  { command: 'simulate', tx_json: { TransactionType: 'EscrowFinish', Fulfillment: null } },
  { command: 'simulate', tx_json: { TransactionType: 'EscrowFinish', Fulfillment: undefined } },
  { command: 'simulate', tx_blob: encode({ TransactionType: 'EscrowFinish', Account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', Owner: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', OfferSequence: 1, Fulfillment: 'A0228020' + '11'.repeat(32) }) },
])('refuses a simulate containing Fulfillment before connecting or sending: %j', async request => {
  const connects = state.connects, requests = state.requests.mock.calls.length
  const ledger = testnetLedger()
  await expect(ledger.request(request)).rejects.toThrow('Refusing simulate request containing Fulfillment')
  expect(state.connects).toBe(connects)
  expect(state.requests).toHaveBeenCalledTimes(requests)
  await ledger.close()
})
it.each(['EscrowCreate', 'EscrowCancel', 'AccountSet'])('allows secret-free %s simulations', async TransactionType => {
  const ledger = testnetLedger(), request = { command: 'simulate', tx_json: { TransactionType } }
  const pending = ledger.request(request)
  state.release()
  await pending
  expect(state.requests).toHaveBeenLastCalledWith(request)
  await ledger.close()
})
