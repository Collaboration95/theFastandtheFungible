// Policy-only CredentialDelete: ours-only issuer, Testnet only, failed claims only, one signature per intent.
import { beforeEach, expect, it, vi } from 'vitest'
import { Store } from '../server/store.js'
import { XrplPayer } from '../server/xrpl.js'

const verification = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../server/writer-credentials.js', () => ({ writerVerification: async () => verification.value }))
const { revokeBrokenCredential } = await import('../server/revoke-credential.js')

const ISSUER = 'rIssuer', WRITER = 'rWriter'
const node = { LedgerEntryType: 'Credential', Subject: WRITER, Issuer: ISSUER, CredentialType: 'AA' }
function setup(overrides: { issuer?: string; network?: number; failed?: string[] } = {}) {
  const store = new Store(':memory:')
  const requests: string[] = []
  const ledger = { request: async (q: { command: string }) => { requests.push(q.command); return q.command === 'server_info' ? { result: { info: { network_id: overrides.network ?? 1 } } } : { result: { validated: true, node } } } }
  const signed: unknown[] = []
  const payer = Object.assign(Object.create(XrplPayer.prototype), { address: ISSUER, ledger, revokeCredential: vi.fn(async (_subject: string, _type: string, persist: (s: unknown) => unknown, send: (s: unknown) => Promise<unknown>) => {
    const s = { txHash: 'AB'.repeat(32), txBlob: '00', lastLedgerSequence: 9 }; signed.push(persist(s)); return { sent: send(s) }
  }) })
  const intent = { runId: 'run', intentId: 'intent', failedClaimIds: overrides.failed ?? ['claim'], escrow: { mode: 'key-reveal' }, quote: { payment: { rail: 'xrpl-testnet', payTo: WRITER } } }
  return { store, payer, intent: intent as never, requests, signed, run: () => { verification.value = { status: 'verified', issuer: overrides.issuer ?? ISSUER, credentialType: 'AA' }; return revokeBrokenCredential({ store, payer } as never, intent as never) } }
}
beforeEach(() => { verification.value = {} })

it('signs one CredentialDelete only for our own issuer after a failed key-reveal proof', async () => {
  const t = setup()
  await t.run(); await t.run()
  expect(t.payer.revokeCredential).toHaveBeenCalledTimes(1)
  expect(t.store.credentialRevocation('intent')).toMatchObject({ txBlob: '00' })
})
it('does nothing for another issuer, a non-Testnet network or a passed proof', async () => {
  for (const t of [setup({ issuer: 'rSomeoneElse' }), setup({ network: 0 }), setup({ failed: [] })]) { await t.run(); expect(t.payer.revokeCredential).not.toHaveBeenCalled() }
})
