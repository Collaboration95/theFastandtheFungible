import { resources } from './helpers/resource-scope.js'
// v1.0.1 regression: a first lookup that is not validated yet is progress, never a failure label.
import { describe, expect, it, vi } from 'vitest'
import { Wallet, decode } from 'xrpl'
import { readFileSync } from 'node:fs'
import { Store } from '../server/store.js'
import { AnswerAnchors } from '../server/anchor.js'
import { XrplPayer } from '../server/xrpl.js'
import { ANCHOR_PENDING_LABEL, anchorProgress } from '../shared/anchor-status.js'
import type { Ledger } from '../shared/xrpl.js'
const receipts = JSON.parse(readFileSync('docs/evidence/lane-b3/UC3.receipts.json', 'utf8')).receipts

/** A Testnet ledger whose anchor transaction validates on the `validateOnLookup`-th lookup (Infinity: never; `tecFail`: validates unsuccessfully). */
function setup(validateOnLookup: number, result = 'tesSUCCESS') {
  const store = resources().own(new Store(':memory:'))
  const run = store.createRun('orchids', 200, { research: 'fixture', decision: 'fixture', publisher: 'local', settlement: 'XRPL TESTNET · no real value' })
  store.addAnswer(run.runId, { version: 1, conclusion: 'Answer', claims: [], openGaps: [], provider: 'fixture', model: 'fixture' })
  store.updateRun(run.runId, { phase: 'DONE' })
  let lookups = 0, submitted: Record<string, unknown> | undefined
  const ledger: Ledger = { async request(req) {
    if (req.command === 'server_info') return { result: { info: { network_id: 1, validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: .2, age: 0 } } } }
    if (req.command === 'account_info') return { result: { account_data: { Sequence: 1, Balance: '100000000', OwnerCount: 0 } } }
    if (req.command === 'ledger') return { result: { ledger_index: 100 } }
    if (req.command === 'ledger_current') return { result: { ledger_current_index: 100 } }
    if (req.command === 'fee') return { result: { drops: { open_ledger_fee: '12' } } }
    if (req.command === 'submit') { submitted = { ...decode(String(req.tx_blob)), hash: store.anchorRows()[0].submission!.txHash }; return { result: {} } }
    if (req.command === 'tx') { lookups++; return { result: lookups >= validateOnLookup && submitted ? { ...submitted, validated: true, ledger_index: 777, meta: { TransactionResult: result } } : { validated: false } } }
    throw Error('unexpected ' + req.command)
  } }
  return { store, run, lookups: () => lookups, anchors: (opts: ConstructorParameters<typeof AnswerAnchors>[2]) => new AnswerAnchors(store, new XrplPayer(ledger, Wallet.generate()), opts) }
}
const labels = (store: Store, runId: string) => store.getRun(runId).events.map(e => e.label)

describe('anchor pending state', () => {
  for (const purchased of [true, false]) it(`pending then anchored on retry, purchase=${purchased}: no failure label at any point`, async () => {
    const t = setup(3)
    if (purchased) { const get = t.store.getRun.bind(t.store); vi.spyOn(t.store, 'getRun').mockImplementation(id => ({ ...get(id), receipts })) }
    await t.anchors({ lookupAttempts: 5, lookupIntervalMs: 1 }).ensure(t.run.runId)
    const done = t.store.getRun(t.run.runId)
    expect(done.ledgerAnchor?.ledgerIndex).toBe(777)
    expect(t.lookups()).toBe(3)
    const seen = labels(t.store, t.run.runId)
    expect(seen.filter(l => l === ANCHOR_PENDING_LABEL)).toHaveLength(1)
    expect(seen.some(l => l?.startsWith('Anchor unavailable'))).toBe(false)
    expect(seen.at(-1)).toMatch(purchased ? /^Anchored on XRPL · anchor fee/ : /^Anchored on XRPL · no purchase · anchor fee/)
    expect(anchorProgress(done.events)?.kind).not.toBe('failed') // The screen treats pending as non-terminal.
  })

  it('a lookup that never validates ends in a clear terminal label after bounded retries', async () => {
    const t = setup(Infinity)
    await t.anchors({ lookupAttempts: 3, lookupIntervalMs: 1 }).ensure(t.run.runId)
    const done = t.store.getRun(t.run.runId)
    expect(done.ledgerAnchor).toBeUndefined()
    expect(t.lookups()).toBe(3)
    expect(labels(t.store, t.run.runId).slice(-2)).toEqual([ANCHOR_PENDING_LABEL, 'Anchor unavailable (validation not confirmed in time)'])
    expect(anchorProgress(done.events)).toEqual({ kind: 'failed', label: 'Anchor unavailable (validation not confirmed in time)' })
  })

  it('a validated but unsuccessful transaction is a terminal failure, not an anchor', async () => {
    const t = setup(1, 'tecNO_PERMISSION')
    await t.anchors({ lookupAttempts: 3, lookupIntervalMs: 1 }).ensure(t.run.runId)
    const done = t.store.getRun(t.run.runId)
    expect(done.ledgerAnchor).toBeUndefined()
    expect(done.events.at(-1)?.label).toBe('Anchor unavailable (failed)')
    expect(anchorProgress(done.events)?.kind).toBe('failed')
  })

  it('shutdown stops the retry wait without a failure label', async () => {
    const t = setup(Infinity)
    const anchors = t.anchors({ lookupAttempts: 50, lookupIntervalMs: 60_000 })
    const job = anchors.ensure(t.run.runId)
    await new Promise(resolve => setTimeout(resolve, 50))
    await anchors.drain(); await job
    expect(labels(t.store, t.run.runId).some(l => l?.startsWith('Anchor unavailable'))).toBe(false)
  })
})
