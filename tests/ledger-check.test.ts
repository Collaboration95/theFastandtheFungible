import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import bank from '../eval/questions/bank.v1.json'
import xrplBank from '../eval/questions/judge-xrpl.v3.json'
import fixture from './fixtures/ledger-check/rpc.json'
import { feeSettings, issuerFact, ledgerKind, ledgerReadTime, readLedgerFact, readPayer, SHARED_PAYER } from '../src/ledger-check'
import { PUBLIC_LEDGER_ENDPOINTS, publicRead } from '../src/ledger-rpc'
import { LEDGER_ENDPOINTS } from '../src/verify/browser'
const rpc = (value: unknown) => vi.fn(async () => value as Record<string, unknown>)
describe('ledger check subjects', () => {
  it('is hidden for 20 research-bank questions', () => {
    const questions = bank.questions.slice(0, 20)
    expect(questions).toHaveLength(20)
    for (const q of questions) expect(ledgerKind(q.question), q.id).toBeUndefined()
  })
  it('shows only relevant facts across 20 XRPL judge-bank questions', () => {
    const expected: Record<string, string> = { V01: 'fee', V10: 'fee' }
    expect(xrplBank.questions).toHaveLength(20)
    for (const q of xrplBank.questions) expect(ledgerKind(q.question), q.id).toBe(expected[q.id])
  })
  it.each([
    ['Can RLUSD be escrowed on XRPL?', 'rlusd-escrow'], ['Does the RLUSD issuer permit escrow?', 'rlusd-escrow'],
    ['What are XRP account reserves?', 'reserve'], ['How much XRPL owner reserve is held?', 'reserve'],
    ['What fee does EscrowFinish charge?', 'fee'], ['What are XRPL transaction fees?', 'fee'],
    ['What is the RLUSD currency code?', undefined], ['What are mutual fund fees?', undefined], ['How do escrows work?', undefined],
    ['What are bank reserves?', undefined], ['How many drops are in one XRP?', undefined], ['How much does EscrowFinish cost?', 'fee'], ['What are XRPL transaction costs?', 'fee'], ['Which XRPL transactions are allowed?', undefined],
  ])('%s → %s', (question, kind) => expect(ledgerKind(question)).toBe(kind))
})
describe('validated facts', () => {
  it('reads the recorded RLUSD issuer flag with provenance', async () => {
    expect(issuerFact(fixture.issuer, fixture.readAt)).toMatchObject({ network: 'XRPL Testnet', ledger: 22245632, readAt: fixture.readAt, text: expect.stringContaining('OFF · issuer blocks token escrow') })
    const read = rpc(fixture.issuer); await readLedgerFact('rlusd-escrow', read)
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ command: 'account_info', ledger_index: 'validated' }))
  })
  it('never treats missing, wrong-account, or unvalidated flags as off', () => {
    for (const r of [{ ...fixture.issuer, validated: false }, { ...fixture.issuer, account_data: { ...fixture.issuer.account_data, Flags: undefined } }, { ...fixture.issuer, account_data: { ...fixture.issuer.account_data, Account: SHARED_PAYER } }]) expect(() => issuerFact(r, fixture.readAt)).toThrow()
  })
  it('reads reserve and fee settings; distinguishes paid fees from rippled minimum', async () => {
    expect(feeSettings(fixture.fees)).toEqual({ ledger: 22245632, baseFee: '10', baseReserve: '1000000', ownerReserve: '200000' })
    expect((await readLedgerFact('fee', rpc(fixture.fees))).text).toContain('12 drops to lock (buyer) and 423 to reveal (writer)')
    expect((await readLedgerFact('fee', rpc(fixture.fees))).text).toContain('minimum is 350 drops')
    expect((await readLedgerFact('reserve', rpc(fixture.fees))).text).toContain('1.00 XRP · owner reserve 0.20 XRP')
    expect(() => feeSettings({ ...fixture.fees, validated: false })).toThrow()
    expect(() => feeSettings({ ...fixture.fees, node: {} })).toThrow()
  })
  it('pins payer objects to the account ledger hash and refuses partial pages', async () => {
    const read = vi.fn().mockResolvedValueOnce(fixture.payer).mockResolvedValueOnce(fixture.escrows)
    expect(await readPayer(read)).toMatchObject({ openEscrows: 0, ownerCount: 0, ledger: 22245632, text: 'Shared Testnet payer rbcLo4… · open escrows 0 · owner count 0 · read at ledger 22245632' })
    expect(read.mock.calls[1][0]).toMatchObject({ command: 'account_objects', ledger_hash: fixture.payer.ledger_hash })
    for (const patch of [{ marker: 'more' }, { validated: false }, { ledger_index: 1 }, { ledger_hash: '0'.repeat(64) }, { account_objects: [{}] }]) {
      await expect(readPayer(vi.fn().mockResolvedValueOnce(fixture.payer).mockResolvedValueOnce({ ...fixture.escrows, ...patch }))).rejects.toThrow()
    }
  })
  it('uses SGT regardless of the local timezone', () => expect(ledgerReadTime('2026-11-11T07:06:00Z')).toBe('11 Nov 2026, 15:06 SGT'))
  it('keeps the verifier endpoints and desktop policy unchanged; hosted has no restrictive app CSP', async () => {
    expect(PUBLIC_LEDGER_ENDPOINTS).toEqual(LEDGER_ENDPOINTS)
    const desktop = readFileSync('desktop/policy.mjs', 'utf8')
    PUBLIC_LEDGER_ENDPOINTS.forEach(endpoint => expect(desktop).toContain(endpoint))
    await expect(publicRead({ command: 'submit' })).rejects.toThrow('Read-only')
    await expect(publicRead({ command: 'tx' }, ['wss://mainnet.example'])).rejects.toThrow('Public Testnet')
  })
})
