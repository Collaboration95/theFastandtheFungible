import { afterEach, expect, it, vi } from 'vitest'
import { Wallet, decode } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { chain } from './fixtures/key-reveal-ledger.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle } from './fixtures/pay-path.js'
import type { Ledger } from '../shared/xrpl.js'
const cleanup: (() => Promise<unknown> | unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.unstubAllEnvs() })
async function setup(budget = 200, active = true) {
  vi.stubEnv('WALLET_MODE', 'delegated'); vi.stubEnv('ESCROW_MODE', 'key-reveal')
  const c = chain(), agent = Wallet.generate(), visitor = Wallet.generate(), writer = Wallet.generate()
  let permitted = active
  const ledger: Ledger = { request: r => r.command === 'account_objects' ? Promise.resolve({ result: { account_objects: permitted ? [{ Account: visitor.address, Authorize: agent.address, Permissions: [{ Permission: { PermissionValue: 'EscrowCreate' } }] }] : [] } }) : c.ledger.request(r) }
  const env = { ESCROW_MODE: 'key-reveal', XRPL_PUBLISHER_LOAD_FACTOR_SEED: writer.seed, XRPL_PUBLISHER_ALPHALEAK_SEED: Wallet.generate().seed }
  const app = createPublisherApp({ rail: 'xrpl-testnet', ledger, journal: ':memory:', writers: alphaLeakCorpus, env, escrowWriters: ['load-factor', 'alphaleak'] })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); app.locals.journal.close() })
  const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
  const store = new Store(':memory:'); cleanup.push(() => store.close())
  const run = store.createRun('SYNTHETIC delegated escrow', budget)
  store.updateRun(run.runId, { checkpoint: { delegatedOwner: visitor.address } })
  const payer = new XrplPayer(ledger, agent, { pollMs: 1, timeoutMs: 10 }), manager = new PurchaseManager(store, client, payer)
  const candidate = await candidateFrom(client.origin, honestArticle)
  return { c, store, run, agent, visitor, payer, client, revoke: () => { permitted = false }, buy: (intentId = 'delegated-one') => manager.purchase({ runId: run.runId, candidate, intentId }) }
}
it('refuses a delegated purchase with zero policy budget before any signature or grant', async () => {
  const s = await setup(0); await s.buy()
  expect(s.c.txs.size).toBe(0); expect(s.store.getRun(s.run.runId).spentMinor).toBe(0)
  expect(s.store.getRun(s.run.runId).grants).toHaveLength(0)
})
it('refuses an already-revoked grant before signing, even with policy budget', async () => {
  const s = await setup(200, false); const intent = await s.buy()
  expect(intent.status).toBe('FAILED_NOT_SETTLED'); expect(s.c.txs.size).toBe(0)
  expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
})
it('does not restore an unresolved visitor create into the agent sequence queue', async () => {
  const s = await setup(); s.c.state.validate = false
  const pending = await s.buy()
  expect(pending.status).toBe('SUBMITTING')
  expect(s.store.escrowOutbox(pending.intentId)).toHaveLength(1)
  new PurchaseManager(s.store, s.client, s.payer)
  const independent = await s.payer.escrow({ TransactionType: 'EscrowCreate', Amount: '1', Destination: Wallet.generate().address, FinishAfter: s.c.state.now + 100, CancelAfter: s.c.state.now + 300 }, 1, submission => submission, async () => undefined)
  expect(decode(independent.submission.txBlob).Account).toBe(s.agent.address)
})
it('binds visitor ownership, charges once, and refuses a later create after revocation', async () => {
  const s = await setup(); const result = await s.buy(); await s.buy()
  expect(result).toMatchObject({ status: 'VERIFIED', escrow: { owner: s.visitor.address, state: 'RELEASED' } })
  const txs = [...s.c.txs.values()].map(t => t.tx_json)
  expect(txs.filter(t => t.TransactionType === 'EscrowCreate')).toHaveLength(1)
  expect(txs[0]).toMatchObject({ Account: s.visitor.address, Delegate: s.agent.address })
  const signed = decode(s.store.escrowOutbox(result.intentId)[0].txBlob)
  expect(signed.SigningPubKey).toBe(s.agent.publicKey)
  expect(s.store.getRun(s.run.runId).receipts).toHaveLength(1)
  expect(JSON.stringify(s.store.getRun(s.run.runId))).not.toContain(s.visitor.seed)
  s.revoke(); await s.buy('after-revoke')
  expect([...s.c.txs.values()].filter(t => t.tx_json.TransactionType === 'EscrowCreate')).toHaveLength(1)
})
it('binds wallet proof to its session and consumes challenges once', async () => {
  const { default: express } = await import('express')
  const { sign } = await import('ripple-keypairs')
  const { delegatedWallets } = await import('../server/delegated-wallet.js')
  vi.stubEnv('WALLET_MODE', 'delegated')
  const visitor = Wallet.generate(), agent = Wallet.generate()
  let disabled = false, active = true
  const ledger: Ledger = { request: async () => ({ result: { account_data: { Flags: disabled ? 0x00100000 : 0 }, account_objects: active ? [{ Authorize: agent.address, Permissions: [{ Permission: { PermissionValue: 'EscrowCreate' } }] }] : [] } }) }
  const context = { payer: new XrplPayer(ledger, agent) } as import('../server/api/context.js').ApiContext
  const app = express(); app.use(express.json()); app.use((req, res, next) => { res.locals.hostedSession = { principal: req.get('test-principal') }; next() })
  app.use(delegatedWallets(context).router)
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const post = (path: string, body: unknown, principal = 'one') => fetch(base + '/api/wallet/delegation/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'test-principal': principal }, body: JSON.stringify(body) })
  const { message } = await (await post('challenge', {})).json()
  const proof = { address: visitor.address, publicKey: visitor.publicKey, signature: sign(message, visitor.privateKey) }
  expect((await post('connect', proof, 'two')).status).toBe(403)
  expect((await post('connect', proof)).status).toBe(200)
  expect((await post('connect', proof)).status).toBe(403)
  const status = await (await fetch(base + '/api/wallet/delegation', { headers: { 'test-principal': 'two' } })).json()
  expect(status.address).toBeUndefined(); expect(JSON.stringify(status)).not.toContain(visitor.seed)
  const connected = await (await fetch(base + '/api/wallet/delegation', { headers: { 'test-principal': 'one' } })).json()
  expect(connected.address).toBe(visitor.address)
  active = false
  const revoked = await (await fetch(base + '/api/wallet/delegation', { headers: { 'test-principal': 'one' } })).json()
  expect(revoked).toMatchObject({ enabled: true, agent: agent.address }); expect(revoked.address).toBeUndefined()
  active = true
  const cleared = await (await fetch(base + '/api/wallet/delegation', { headers: { 'test-principal': 'one' } })).json()
  expect(cleared.address).toBeUndefined() // Refresh clears a stale binding even if disconnect was lost.
  disabled = true
  const fresh = await (await post('challenge', {})).json()
  expect((await post('connect', { ...proof, signature: sign(fresh.message, visitor.privateKey) })).status).toBe(403)
})
