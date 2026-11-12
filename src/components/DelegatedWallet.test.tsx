// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Wallet, decode } from 'xrpl'
import DelegatedWallet from './DelegatedWallet'
const state = vi.hoisted(() => ({ calls: [] as { path: string; body: unknown }[], blobs: [] as string[], funded: 0, address: undefined as string | undefined }))
vi.mock('xrpl', async original => {
  const actual = await original<typeof import('xrpl')>()
  return { ...actual, Client: class {
    async connect() {} async disconnect() {}
    async request(r: { command: string }) { if (r.command === 'server_info') return { result: { info: { network_id: 1 } } }; if (!state.funded) throw { data: { error: 'actNotFound' } }; return { result: {} } }
    async fundWallet() { state.funded++ }
    async autofill(tx: unknown) { return { ...(tx as object), Fee: '12', Sequence: 1, LastLedgerSequence: 20 } }
    async submitAndWait(blob: string) { state.blobs.push(blob); return { result: { meta: { TransactionResult: 'tesSUCCESS' } } } }
  } }
})
vi.mock('../api', () => ({ walletRequest: async (path: string, body?: { address?: string }) => {
  state.calls.push({ path, body })
  if (path.endsWith('/challenge')) return { message: 'AB'.repeat(32) }
  if (path.endsWith('/connect')) { state.address = body?.address; return { address: state.address } }
  if (path.endsWith('/disconnect')) state.address = undefined
  return { enabled: true, agent: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', address: state.address }
} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); state.calls = []; state.blobs = []; state.funded = 0; state.address = undefined })
it('keeps a generated Testnet seed in this browser, sends public proof only, and signs an empty revocation', async () => {
  // Node crypto returns Node-realm byte arrays; align jsdom's constructor for noble's instanceof guard.
  vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor)
  const ready = vi.fn(); render(<DelegatedWallet onReady={ready} />)
  const connect = await screen.findByRole('button', { name: 'Create or import wallet' })
  await waitFor(() => expect(connect.hasAttribute('disabled')).toBe(false)); fireEvent.click(connect)
  await screen.findByText(/Connected/)
  const saved = JSON.parse(localStorage.getItem('researchagent.Testnet.wallet.v1')!)
  expect(saved.network).toBe('Testnet'); expect(Wallet.fromSeed(saved.seed).address).toBe(state.address)
  expect(JSON.stringify(state.calls)).not.toContain(saved.seed)
  expect(state.funded).toBe(1)
  expect(decode(state.blobs[0]).Permissions).toEqual([{ Permission: { PermissionValue: 'EscrowCreate' } }])
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
  await screen.findByText(/Access not connected/)
  expect(decode(state.blobs[1]).Permissions).toEqual([])
  expect(ready).toHaveBeenLastCalledWith(false)
})
