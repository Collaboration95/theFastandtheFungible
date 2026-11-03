import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Wallet, decode, hashes } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { newRecord } from '../server/reputation.js'
import { auditRuns } from '../scripts/gate-audit.js'
import { matchesCreate, escrowMemo, safeSignature } from '../shared/escrow.js'
import type { Ledger } from '../shared/xrpl.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle, alphaLeakArticle } from './fixtures/pay-path.js'

// A deterministic ledger SIMULATION. Production protocol, signer, journal and HTTP publisher.
function chain() {
  const state = { now: 800000000, index: 100, balance: 100000000, owners: 0, submitEnabled: true, validate: true, terminalFail: false }
  const txs = new Map<string, Record<string, any>>() // eslint-disable-line @typescript-eslint/no-explicit-any
  const objects = new Map<number, Record<string, unknown>>()
  const ledger: Ledger = { async request(r) {
    switch (r.command) {
      case 'server_info': return { result: { info: { network_id: 1, validated_ledger: { age: 1, reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }
      case 'account_info': return { result: { account_data: { Sequence: 7 + txs.size, Balance: String(state.balance), OwnerCount: state.owners } } }
      case 'ledger': return { result: { ledger_index: state.index, ledger: { close_time: state.now } } }
      case 'ledger_current': return { result: { ledger_current_index: state.index } }
      case 'fee': return { result: { drops: { open_ledger_fee: '12' } } }
      case 'account_tx': return { result: { transactions: [...txs].map(([hash, row]) => ({ ...row, hash })) } }
      case 'ledger_entry': return { result: { node: objects.get((r.escrow as { seq: number }).seq) } }
      case 'tx': {
        const found = txs.get(String(r.transaction))
        if (!found) throw Object.assign(new Error('missing'), { data: { error: 'txnNotFound' } })
        return { result: found }
      }
      case 'submit': {
        if (!state.submitEnabled) throw new Error('network fault')
        const blob = String(r.tx_blob), hash = hashes.hashSignedTx(blob)
        if (!txs.has(hash)) {
          const t = decode(blob), op = t.TransactionType
          const success = op === 'Payment' || op === 'EscrowCreate' || !state.terminalFail && objects.has(Number(t.OfferSequence)) && (op === 'EscrowCancel' ? state.now > Number(objects.get(Number(t.OfferSequence))!.CancelAfter) : state.now < Number(objects.get(Number(t.OfferSequence))!.CancelAfter))
          txs.set(hash, { validated: state.validate, tx_json: t, ledger_index: ++state.index, meta: { TransactionResult: success ? 'tesSUCCESS' : 'tecNO_PERMISSION', delivered_amount: t.Amount } })
          if (success && op === 'EscrowCreate') { objects.set(Number(t.Sequence), t); state.owners++; state.balance -= Number(t.Amount) }
          if (success && ['EscrowCancel', 'EscrowFinish'].includes(String(op))) { if (op === 'EscrowCancel') state.balance += Number(objects.get(Number(t.OfferSequence))!.Amount); objects.delete(Number(t.OfferSequence)); state.owners-- }
          state.balance -= Number(t.Fee)
        }
        return { result: { engine_result: 'tesSUCCESS' } }
      }
    }
    throw new Error('unexpected RPC')
  } }
  return { state, ledger, txs, objects }
}
const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.restoreAllMocks() })
async function setup(options: { opted?: boolean; broken?: boolean; budget?: number } = {}) {
  const c = chain(), dir = mkdtempSync(join(tmpdir(), 'escrow-'))
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  const env = { XRPL_PUBLISHER_LOAD_FACTOR_SEED: Wallet.generate().seed!, XRPL_PUBLISHER_ALPHALEAK_SEED: Wallet.generate().seed! }
  const app = createPublisherApp({ journal: join(dir, 'publisher.db'), rail: 'xrpl-testnet', ledger: c.ledger, writers: alphaLeakCorpus, env, escrowWriters: options.opted === false ? [] : ['load-factor', 'alphaleak'], facilitatorTiming: { pollMs: 1, timeoutMs: 10 } })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  cleanup.push(() => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); app.locals.journal.close() }))
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const client = new PublisherClient({ baseUrl }), wallet = Wallet.generate()
  const db = join(dir, 'buyer.db')
  let store = new Store(db)
  cleanup.push(() => store.close())
  const payer = () => new XrplPayer(c.ledger, wallet, { pollMs: 1, timeoutMs: 10 })
  let manager = new PurchaseManager(store, client, payer())
  const candidate = await candidateFrom(baseUrl, options.broken ? alphaLeakArticle : honestArticle)
  const run = store.createRun('SYNTHETIC escrow check', options.budget ?? 200)
  const buy = (intentId = 'escrow-one', escrow = true) => manager.purchase({ runId: run.runId, candidate, intentId, escrow })
  return { c, client, candidate, run, wallet, buy, get store() { return store }, get manager() { return manager }, restart() { store.close(); store = new Store(db); manager = new PurchaseManager(store, client, payer()) } }
}
describe('escrow-v1 hybrid', () => {
  it('finishes once after a private conditional grant and proof; duplicates and restart keep one principal', async () => {
    const s = await setup()
    const [a,b] = await Promise.all([s.buy(), s.buy()])
    expect(a).toEqual(b)
    expect(a).toMatchObject({ status: 'VERIFIED', escrow: { state: 'RELEASED', proofOk: true } })
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate', 'EscrowFinish'])
    const r = s.store.getRun(s.run.runId)
    expect(r.spentMinor).toBe(s.candidate.price.amountMinor); expect(r.reservedMinor).toBe(0)
    expect(r.contents).toHaveLength(1); expect(r.receipts).toHaveLength(1)
    const privateState = s.store.getEscrow(a.intentId)!
    expect(JSON.stringify(r)).not.toContain(privateState.secret)
    expect(JSON.stringify(r)).not.toContain(s.wallet.seed!)
    const create = decode(s.store.escrowOutbox(a.intentId)[0].txBlob)
    expect(matchesCreate(create, privateState.quote.terms)).toBe(true)
    expect(safeSignature(s.store.escrowOutbox(a.intentId)[0].txBlob)).toBe(true)
    expect(matchesCreate({ ...create, Memos: escrowMemo({ ...privateState.quote.terms, intentId: 'replay' }) }, privateState.quote.terms)).toBe(false)
    s.restart(); await s.manager.reconcile(); await s.buy()
    expect(s.c.txs.size).toBe(2); expect(s.c.objects.size).toBe(0)
  })
  it('never signs finish on failed proof; cancels after ledger deadline without writer cooperation', async () => {
    const s = await setup({ broken: true })
    const i = await s.buy()
    expect(i).toMatchObject({ status: 'SUBMITTING', escrow: { state: 'CANCEL_DUE', proofOk: false } })
    let r = s.store.getRun(s.run.runId)
    expect(r.contents).toHaveLength(0); expect(r.spentMinor).toBe(0); expect(r.reservedMinor).toBe(i.amountMinor)
    expect(s.store.escrowOutbox(i.intentId).map(t => t.operation)).toEqual(['create'])
    expect(s.store.getReputation(s.candidate.wallet!)?.status).toBe('quarantined')
    s.restart()
    vi.spyOn(s.client, 'paidGet').mockRejectedValue(new Error('writer offline'))
    await s.manager.reconcile(); expect(s.c.txs.size).toBe(1)
    s.c.state.now = i.escrow!.cancelAfter + 1
    await s.manager.reconcile()
    r = s.store.getRun(s.run.runId)
    expect(r.intents[0].escrow?.state).toBe('CANCELLED')
    expect(r.contents).toHaveLength(0); expect(r.spentMinor).toBe(0); expect(r.reservedMinor).toBe(0)
    expect(r.receipts[0]).toMatchObject({ amountMinor: 0, escrow: { state: 'CANCELLED' } })
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate', 'EscrowCancel'])
    await s.buy(); expect(s.c.txs.size).toBe(2)
  })
  it('recovers a crash between create and delivery using the durable identity', async () => {
    const s = await setup()
    s.c.state.validate = false
    const i = await s.buy()
    expect(i.escrow?.state).toBe('PREPARED')
    expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
    const hash = s.store.escrowOutbox(i.intentId)[0].txHash
    s.c.txs.get(hash)!.validated = true; s.c.state.validate = true
    s.restart(); await s.manager.reconcile()
    expect(s.store.getIntent(i.intentId)?.escrow?.state).toBe('RELEASED')
    expect(s.c.txs.size).toBe(2)
  })
  it('recovers an escaped finish despite Stop; before finish Stop cancels', async () => {
    const s = await setup()
    const persist = s.store.recordEscrowSubmission.bind(s.store)
    vi.spyOn(s.store, 'recordEscrowSubmission').mockImplementation((id, op, signed) => {
      const result = persist(id, op, signed)
      if (op === 'finish') { s.c.state.submitEnabled = false; s.store.updateRun(s.run.runId, { stopped: true }) }
      return result
    })
    const i = await s.buy()
    expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
    expect(s.store.escrowOutbox(i.intentId)).toHaveLength(2)
    s.c.state.submitEnabled = true
    s.restart(); await s.manager.reconcile()
    expect(s.store.getIntent(i.intentId)?.escrow?.state).toBe('RELEASED')
    expect(s.c.txs.size).toBe(2)
  })
  it('Stop after create cancels and never reveals a finish fulfillment', async () => {
    const s = await setup()
    const persist = s.store.recordEscrowSubmission.bind(s.store)
    vi.spyOn(s.store, 'recordEscrowSubmission').mockImplementation((id, op, signed) => {
      const row = persist(id, op, signed)
      if (op === 'create') s.store.updateRun(s.run.runId, { stopped: true })
      return row
    })
    const i = await s.buy()
    expect(i.escrow?.state).toBe('CANCEL_DUE')
    expect(s.store.escrowOutbox(i.intentId)).toHaveLength(1)
    s.c.state.now = i.escrow!.cancelAfter + 1
    await s.manager.reconcile()
    expect(s.store.getIntent(i.intentId)?.escrow?.state).toBe('CANCELLED')
    expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
  })
  it('expired unsigned-on-ledger finish falls back to cancel of the same create', async () => {
    const s = await setup()
    const persist = s.store.recordEscrowSubmission.bind(s.store)
    vi.spyOn(s.store, 'recordEscrowSubmission').mockImplementation((id, op, signed) => {
      const row = persist(id, op, signed)
      if (op === 'finish') s.c.state.submitEnabled = false
      return row
    })
    const i = await s.buy(), original = s.store.escrowOutbox(i.intentId)[0].txHash
    s.c.state.index += 100; s.c.state.now = i.escrow!.cancelAfter + 1; s.c.state.submitEnabled = true
    s.restart()
    await s.manager.reconcile() // proves finish expiry; retires its signature
    await s.manager.reconcile() // same owner/create sequence, cancel only
    expect(s.store.getIntent(i.intentId)?.escrow?.state).toBe('CANCELLED')
    expect(s.store.escrowOutbox(i.intentId)[0].txHash).toBe(original)
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate', 'EscrowCancel'])
  })
  it('does not recycle cancelled budget and the gate audit rejects finish without proof', async () => {
    const s = await setup({ broken: true, budget: alphaLeakArticle.priceMinor })
    const i = await s.buy()
    s.c.state.now = i.escrow!.cancelAfter + 1
    await s.manager.reconcile()
    s.store.resetReputation() // Isolate budget authority from the independent quarantine gate.
    const next = await s.buy('new-intent')
    expect(next.status).toBe('SKIPPED')
    expect(s.c.txs.size).toBe(2)
    const run = s.store.getRun(s.run.runId)
    run.intents[0].escrow = { ...run.intents[0].escrow!, state: 'RELEASED', proofOk: false }
    expect(auditRuns([run], alphaLeakCorpus).byRule.escrow_finish_without_verified_proof).toBe(1)
  })
  it('refuses tampered signed quote terms before signing', async () => {
    const s = await setup()
    const quote = s.client.escrowQuote.bind(s.client)
    vi.spyOn(s.client, 'escrowQuote').mockImplementation(async (...args) => { const q = await quote(...args); q.terms.amount = '1'; return q })
    await expect(s.buy()).rejects.toThrow('binding rejected')
    expect(s.c.txs.size).toBe(0)
  })
  it('keeps a verified delivery quarantined when the finish margin has closed', async () => {
    const s = await setup()
    const get = s.client.paidGet.bind(s.client)
    vi.spyOn(s.client, 'paidGet').mockImplementation(async (...args) => {
      const r = await get(...args)
      s.c.state.now = s.store.getEscrow('escrow-one')!.publicStatus.cancelAfter - 15
      return r
    })
    const i = await s.buy()
    expect(i.escrow).toMatchObject({ state: 'CANCEL_DUE', proofOk: true })
    expect(s.store.getRun(s.run.runId).contents).toHaveLength(0)
    expect(s.store.escrowOutbox(i.intentId)).toHaveLength(1)
    s.c.state.now += 16; await s.manager.reconcile()
    expect(s.store.getIntent(i.intentId)?.escrow?.state).toBe('CANCELLED')
  })
  it('recovers a finish relayed by another account without signing cancel or another principal', async () => {
    const s = await setup()
    const persist = s.store.recordEscrowSubmission.bind(s.store)
    vi.spyOn(s.store, 'recordEscrowSubmission').mockImplementation((id, op, signed) => {
      const row = persist(id, op, signed)
      if (op === 'finish') s.c.state.submitEnabled = false
      return row
    })
    const i = await s.buy()
    const finish = decode(s.store.escrowOutbox(i.intentId).find(t => t.operation === 'finish')!.txBlob)
    const relayWallet = Wallet.generate()
    const relay = relayWallet.sign({ TransactionType: 'EscrowFinish', Account: relayWallet.classicAddress, Owner: finish.Owner as string, OfferSequence: Number(finish.OfferSequence), Condition: finish.Condition as string, Fulfillment: finish.Fulfillment as string, Sequence: 1, Fee: '423', LastLedgerSequence: 200 })
    s.c.state.submitEnabled = true
    await s.c.ledger.request({ command: 'submit', tx_blob: relay.tx_blob })
    s.restart(); await s.manager.reconcile()
    expect(s.store.getIntent(i.intentId)?.escrow).toMatchObject({ state: 'RELEASED', finishHash: relay.hash })
    expect(s.store.getRun(s.run.runId).contents).toHaveLength(1)
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate', 'EscrowFinish'])
  })
  it('keeps missing-object recovery pending when terminal history is unavailable', async () => {
    const s = await setup({ broken: true })
    const i = await s.buy()
    s.c.objects.clear(); s.c.state.now = i.escrow!.cancelAfter + 1
    await s.manager.reconcile()
    expect(s.store.getIntent(i.intentId)?.status).toBe('SUBMITTING')
    expect(s.store.getRun(s.run.runId).reservedMinor).toBe(i.amountMinor)
    expect(s.c.txs.size).toBe(1)
  })
  it('checks 0.2 XRP owner reserve plus principal and both fees before any signature', async () => {
    const s = await setup()
    s.c.state.balance = 1000000 + 200000 + s.candidate.price.amountMinor * 1000 + 3999
    expect((await s.buy()).status).toBe('FAILED_NOT_SETTLED')
    expect(s.c.txs.size).toBe(0); expect(s.store.escrowOutbox()).toHaveLength(0)
  })
  it('uses the hybrid threshold and refuses an escrow opt-in on a simulated payer', async () => {
    const s = await setup()
    const simulated = new PurchaseManager(s.store, s.client)
    const refused = await simulated.purchase({ runId: s.run.runId, candidate: s.candidate, intentId: 'simulated', escrow: true })
    expect(refused.status).toBe('SKIPPED'); expect(s.c.txs.size).toBe(0)
    s.store.putReputation({ ...newRecord(s.candidate.profileId, s.candidate.wallet!), passes: 1 })
    const direct = await s.buy('established', true)
    expect(direct.status).toBe('VERIFIED')
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['Payment'])
  })
  it('keeps direct payment the default and refuses unsupported escrow without paid fallback', async () => {
    const s = await setup({ opted: false })
    expect((await s.buy()).status).toBe('SKIPPED')
    expect(s.c.txs.size).toBe(0)
    const i = await s.buy('direct', false)
    expect(i.status).toBe('VERIFIED')
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['Payment'])
  })
})
