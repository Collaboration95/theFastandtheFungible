import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ connects: 0, disconnects: 0, release: () => {} }))
vi.mock('xrpl', async importOriginal => ({
  ...await importOriginal<typeof import('xrpl')>(),
  Client: class {
    connected = false
    isConnected() { return this.connected }
    async connect() { state.connects++; await new Promise<void>(done => { state.release = done }); this.connected = true }
    async request() { return { result: {} } }
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
