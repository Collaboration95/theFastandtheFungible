import { describe, expect, it, vi } from 'vitest'
import fixture from './fixtures/ledger-check/rpc.json'
import { ledgerReceipt, ledgerReceiptLine } from '../shared/ledger-receipt'
import { readLedgerReceipt } from '../src/ledger-check'
describe('recorded public Testnet purchases', () => {
  it('reports the hosted B6FDBD22 / 4CCB4E56 pair exactly', () => {
    const receipt = ledgerReceipt(fixture.hostedCreate, fixture.hostedFinish, fixture.hostedFees)
    expect(receipt).toEqual({ buyer: 'rbcLo4UJCbQMYzrYTLfdUcdSbJvYyc5Q1', writer: 'r9hkhUEsqcUBAhzp5dfVbPeX37UE6dEQ8c', amount: '40,000 drops', buyerFee: '12', writerFee: '423', createLedger: 22228565, finishLedger: 22228567, ledgersLater: 2, heldSeconds: 2, ownerReserveDrops: '200000' })
    expect(ledgerReceiptLine(receipt)).toBe('Buyer locked 40,000 drops (fee 12, paid by the buyer) · writer revealed the key 2 ledgers later (fee 423, paid by the writer) · 0.20 XRP owner reserve held 2 s, then released.')
  })
  it('reports the E36AF9F1 / 384CA34F TEST-SGD pair without calling it XRP', () => {
    expect(ledgerReceipt(fixture.tokenCreate, fixture.tokenFinish, fixture.tokenFees)).toEqual({ buyer: 'rshm7hcbFpKiYMKWzhCxmGUi8pd4Bf8Ppn', writer: 'rJDwaPFKQv45eQRxbRPpkCUZGvHMEtwPcg', amount: 'TEST-SGD 0.90 (stand-in for RLUSD, no real value)', buyerFee: '12', writerFee: '423', createLedger: 22128287, finishLedger: 22128289, ledgersLater: 2, heldSeconds: 2, ownerReserveDrops: '200000' })
  })
  it('also accepts flat v1 transaction responses', () => {
    const flat = (r: typeof fixture.hostedCreate | typeof fixture.hostedFinish) => ({ ...r.tx_json, validated: r.validated, ledger_index: r.ledger_index, meta: r.meta })
    expect(ledgerReceipt(flat(fixture.hostedCreate), flat(fixture.hostedFinish), fixture.hostedFees).heldSeconds).toBe(2)
  })
  it('refuses pending, failed, mismatched, incomplete and time-reversed evidence', () => {
    for (const patch of [{ validated: false }, { meta: {} }, { ledger_index: 0 }, { tx_json: { ...fixture.hostedFinish.tx_json, Owner: 'someone else' } }, { tx_json: { ...fixture.hostedFinish.tx_json, Account: 'third party' } }, { tx_json: { ...fixture.hostedFinish.tx_json, OfferSequence: 1 } }, { tx_json: { ...fixture.hostedFinish.tx_json, date: 0 } }, { tx_json: { ...fixture.hostedFinish.tx_json, Fee: undefined } }]) expect(() => ledgerReceipt(fixture.hostedCreate, { ...fixture.hostedFinish, ...patch }, fixture.hostedFees)).toThrow()
    expect(() => ledgerReceipt(fixture.hostedCreate, fixture.tokenFinish, fixture.hostedFees)).toThrow()
    expect(() => ledgerReceipt(fixture.hostedCreate, fixture.hostedFinish, fixture.fees)).toThrow('Historical')
  })
  it('does not claim a reserve release without matching deletion and owner-count deltas', () => {
    const f = structuredClone(fixture.hostedFinish)
    f.meta.AffectedNodes = f.meta.AffectedNodes.filter(n => !('DeletedNode' in n))
    expect(() => ledgerReceipt(fixture.hostedCreate, f, fixture.hostedFees)).toThrow('Reserve')
  })
  it('reads real fees instead of replacing a changed fee with 423', () => {
    const f = structuredClone(fixture.hostedFinish); f.tx_json.Fee = '424'
    expect(ledgerReceiptLine(ledgerReceipt(fixture.hostedCreate, f, fixture.hostedFees))).toContain('fee 424, paid by the writer')
  })
  it('binds RPC results to the requested hashes and reads historical reserve settings', async () => {
    const rpc = vi.fn().mockResolvedValueOnce(fixture.hostedCreate).mockResolvedValueOnce(fixture.hostedFinish).mockResolvedValueOnce(fixture.hostedFees)
    const r = await readLedgerReceipt(fixture.hostedCreate.hash, fixture.hostedFinish.hash, rpc)
    expect(r.fields.heldSeconds).toBe(2)
    expect(rpc.mock.calls[2][0]).toMatchObject({ command: 'ledger_entry', ledger_index: 22228565 })
    await expect(readLedgerReceipt('A'.repeat(64), fixture.hostedFinish.hash, vi.fn().mockResolvedValueOnce(fixture.hostedCreate).mockResolvedValueOnce(fixture.hostedFinish))).rejects.toThrow('Different transaction')
  })
})
