import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const evidence = JSON.parse(readFileSync(new URL('../docs/evidence/dry-run-nov12/result.json', import.meta.url), 'utf8'))
describe('committed unsigned ledger evidence', () => {
  it('pins both issuer refusals, matched control and integer fee to ledger indexes', () => {
    expect(evidence.unsigned).toBe(true)
    expect(evidence.submitted).toBe(false)
    expect(evidence.results.map((r: { network: string }) => r.network)).toEqual(['Testnet', 'Mainnet'])
    for (const r of evidence.results) {
      expect(r.flags).toBe(2174353408)
      expect(r.rlusd.engine_result).toBe('tecNO_PERMISSION')
      expect(r.rlusd.ledger_index).toBeGreaterThan(0)
      expect(r.reads.every((v: { request: { command: string } }) => ['server_info', 'ledger', 'feature', 'account_info', 'simulate'].includes(v.request.command))).toBe(true)
    }
    const testnet = evidence.results[0]
    expect(testnet.control.engine_result).toBe('tesSUCCESS')
    expect(testnet.control.ledger_index).toBeGreaterThan(0)
    expect(testnet.finish.tx_json.Fee).toBe('350')
    expect(testnet.finish.ledger_index).toBeGreaterThan(0)
    const creates = testnet.reads.filter((v: { request: { tx_json?: { TransactionType: string } } }) => v.request.tx_json?.TransactionType === 'EscrowCreate')
    const { Amount: _rlusd, ...rlusd } = creates[0].request.tx_json
    const { Amount: _control, ...control } = creates[1].request.tx_json
    expect(rlusd).toEqual(control)
  })
})

import { afterEach, vi } from 'vitest'
import { Wallet, decode } from 'xrpl'
import { XrplPayer } from '../server/xrpl.js'
import { chain } from './fixtures/key-reveal-ledger.js'
import { createPublisherApp } from '../publisher/routes.js'
import { PublisherClient } from '../server/publisher-client.js'
import { PurchaseManager } from '../server/purchases.js'
import { Store } from '../server/store.js'
import { alphaLeakCorpus } from './fixtures/corpus-mini/index.js'
import { candidateFrom, honestArticle } from './fixtures/pay-path.js'
import { escrowInvoice } from '../shared/escrow.js'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers() })

function probeLedger(verdict: string | Error | 'timeout') {
  const c = chain(), original = c.ledger.request.bind(c.ledger)
  const request = vi.spyOn(c.ledger, 'request').mockImplementation(async r => {
    if (r.command !== 'simulate') return original(r)
    if (verdict instanceof Error) throw verdict
    if (verdict === 'timeout') return new Promise(() => {})
    return { result: { engine_result: verdict, ledger_index: c.state.index } }
  })
  const wallet = Wallet.generate(), sign = vi.spyOn(wallet, 'sign')
  const payer = new XrplPayer(c.ledger, wallet)
  const persist = vi.fn(s => s), send = vi.fn(async () => undefined)
  const run = () => payer.escrow({ TransactionType: 'AccountSet' }, 0, persist, send)
  return { ...c, request, payer, sign, persist, send, run }
}

describe('dry run can only veto an already-authorized signature', () => {
  for (const code of ['tecNO_PERMISSION', 'tecNO_TARGET', 'temMALFORMED', 'tefPAST_SEQ']) it(`${code}: no signature, persisted blob or submission`, async () => {
    const s = probeLedger(code)
    await expect(s.run()).rejects.toThrow(`Ledger dry run refused (${code}); nothing was charged`)
    expect(s.sign).not.toHaveBeenCalled(); expect(s.persist).not.toHaveBeenCalled(); expect(s.send).not.toHaveBeenCalled()
  })
  for (const code of ['tesSUCCESS', 'terPRE_SEQ', new Error('unknown method'), new Error('RPC error')]) it(`${String(code)} keeps the original policy signing path`, async () => {
    const s = probeLedger(code), events: unknown[] = []
    s.payer.observeDryRuns((_tx, report) => events.push(report))
    const result = await s.run(); await result.sent
    expect(s.sign).toHaveBeenCalledOnce(); expect(s.persist).toHaveBeenCalledOnce(); expect(s.send).toHaveBeenCalledOnce()
    expect(result.submission.dryRun?.state).toBe(code === 'tesSUCCESS' ? 'accepted' : 'unavailable')
    expect(events).toHaveLength(1)
    const simulated = s.request.mock.calls.find(([r]) => r.command === 'simulate')![0].tx_json
    expect(simulated).not.toHaveProperty('TxnSignature')
    expect(simulated).toEqual(s.sign.mock.calls[0][0])
    expect(decode(result.submission.txBlob)).toMatchObject({ Fee: '12', LastLedgerSequence: 120 })
  })
  it('treats an over-budget reply as unavailable even if the timeout callback was delayed', async () => {
    const s = probeLedger('tesSUCCESS')
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(2001)
    const result = await s.run()
    expect(result.submission.dryRun?.state).toBe('unavailable')
    expect(s.sign).toHaveBeenCalledOnce()
  })
  it('bounds an unanswered RPC to two seconds and records unavailability', async () => {
    vi.useFakeTimers()
    const s = probeLedger('timeout'), promise = s.run()
    await vi.advanceTimersByTimeAsync(2001)
    const result = await promise
    expect(result.submission.dryRun?.state).toBe('unavailable')
    expect(s.sign).toHaveBeenCalledOnce()
  })
})

async function purchaseSetup(mode: 'success' | 'create-refused' | 'near-deadline' = 'success') {
  vi.stubEnv('ESCROW_MODE', 'key-reveal')
  const c = chain(), original = c.ledger.request.bind(c.ledger)
  vi.spyOn(c.ledger, 'request').mockImplementation(async r => {
    if (r.command === 'ledger_entry' && mode === 'near-deadline') {
      const object = c.objects.values().next().value
      if (object) c.state.now = Number(object.CancelAfter) - 30
    }
    if (r.command === 'simulate') {
      const type = (r.tx_json as { TransactionType: string }).TransactionType
      if (type === 'EscrowCreate' && mode === 'create-refused') return { result: { engine_result: 'tecNO_PERMISSION' } }
    }
    return original(r)
  })
  const env = { ESCROW_MODE: 'key-reveal', XRPL_PUBLISHER_LOAD_FACTOR_SEED: Wallet.generate().seed!, XRPL_PUBLISHER_ALPHALEAK_SEED: Wallet.generate().seed! }
  const app = createPublisherApp({ journal: ':memory:', rail: 'xrpl-testnet', ledger: c.ledger, writers: alphaLeakCorpus, env, escrowWriters: ['load-factor', 'alphaleak'] })
  await app.locals.ready
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r))
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => { app.locals.journal.close(); resolve() }) }))
  const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
  const store = new Store(':memory:'); cleanup.push(() => store.close())
  const payer = new XrplPayer(c.ledger, Wallet.generate(), { pollMs: 1, timeoutMs: 10 })
  const candidate = await candidateFrom(client.origin, honestArticle), run = store.createRun('SYNTHETIC dry-run guard', 200)
  const intent = await new PurchaseManager(store, client, payer).purchase({ runId: run.runId, candidate, intentId: 'guard-one', escrow: true })
  return { c, store, payer, intent, run, journal: app.locals.journal }
}

describe('writer guard and purchase evidence', () => {
  it('create refusal ends uncharged, with no outbox, grant or submission', async () => {
    const s = await purchaseSetup('create-refused')
    expect(s.store.getRun(s.run.runId)).toMatchObject({ spentMinor: 0, reservedMinor: 0, contents: [], grants: [] })
    expect(s.store.escrowOutbox(s.intent.intentId)).toEqual([])
    expect(s.c.txs.size).toBe(0)
    expect(s.store.getRun(s.run.runId).events.some(e => e.type === 'LEDGER_DRY_RUN' && e.data?.code === 'tecNO_PERMISSION')).toBe(true)
  })
  for (const mode of ['near-deadline'] as const) it(`${mode} keeps K out of a finish blob and submission`, async () => {
    const s = await purchaseSetup(mode)
    expect(s.store.getRun(s.run.runId).grants).toEqual([])
    expect([...s.c.txs.values()].map(t => t.tx_json.TransactionType)).toEqual(['EscrowCreate'])
    const e = s.store.getEscrow(s.intent.intentId)!
    const privateState = s.journal.keyReveal(escrowInvoice(e.quote.terms))!
    expect(privateState.finish).toBeUndefined()
    expect(JSON.stringify([s.store.getRun(s.run.runId), s.store.auditEntries()])).not.toContain(privateState.secret)
    expect(s.store.getRun(s.run.runId).spentMinor).toBe(0)
  })
  it('happy path signs a +5 finish, retains fees and records create/anchor simulations and writer pre-check', async () => {
    const s = await purchaseSetup()
    expect(s.intent.status).toBe('VERIFIED')
    const txs = [...s.c.txs.values()]
    expect(txs[0].tx_json.Fee).toBe('12')
    expect(txs[1].tx_json).toMatchObject({ TransactionType: 'EscrowFinish', Fee: '423', LastLedgerSequence: 106 })
    const anchor = await s.payer.anchor(`${'a'.repeat(64)}:${(await import('node:crypto')).createHash('sha256').update(s.run.runId).digest('hex')}`, x => x, async () => undefined)
    await anchor.sent
    const events = s.store.getRun(s.run.runId).events.filter(e => e.type === 'LEDGER_DRY_RUN')
    expect(events.map(e => e.data?.operation)).toEqual(['EscrowCreate', 'anchor'])
    expect(events.every(e => e.label.includes('tesSUCCESS') && e.label.includes('not submitted'))).toBe(true)
    const preCheck = s.store.getRun(s.run.runId).events.find(e => e.type === 'LEDGER_PRE_CHECK')!
    expect(preCheck.label).toBe('Ledger pre-check · escrow found, condition matches · read-only, key not sent')
    expect(preCheck.data).toMatchObject({ operation: 'EscrowFinish', reportedBy: 'writer' })
    expect(s.store.auditVerify().ok).toBe(true)
  })
})
