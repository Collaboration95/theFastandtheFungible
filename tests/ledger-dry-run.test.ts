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
