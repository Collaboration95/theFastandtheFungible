import { describe, expect, it, vi } from 'vitest'
import { checkIssuedPayment } from '../shared/issued-currency.js'
import { XrplPayer } from '../server/xrpl.js'
import { Wallet } from 'xrpl'
import type { Ledger } from '../shared/xrpl.js'
import type { PaymentRequirement } from '../shared/contracts/index.js'

const issuer = Wallet.generate().classicAddress
const payer = Wallet.generate().classicAddress
const payee = Wallet.generate().classicAddress
const asset = { currency: '524C555344000000000000000000000000000000', issuer, label: 'RLUSD (Testnet)' } as const

describe('issued payment refusal before signing (synthetic ledger)', () => {
  it.each([
    ['global freeze', { flags: 0x00400000 }, 'Issuer frozen'],
    ['transfer fee', { rate: 1000000001 }, 'transfer fee'],
    ['missing source line', { sourceMissing: true }, 'trust line missing'],
    ['missing destination line', { destinationMissing: true }, 'trust line missing'],
    ...['freeze', 'freeze_peer', 'deep_freeze', 'deep_freeze_peer'].map(flag => [flag, { lineFlag: flag }, 'frozen or unauthorized']),
    ['authorization required', { flags: 0x00040000 }, 'unauthorized'],
    ['invalid amount', { amount: 'bad' }, 'Insufficient RLUSD'],
    ['zero amount', { amount: '0' }, 'Insufficient RLUSD'],
    ['invalid balance', { balance: 'bad' }, 'Insufficient RLUSD'],
    ['low balance', { balance: '0.5' }, 'Insufficient RLUSD'],
    ['invalid held', { held: 'bad' }, 'trust limit'],
    ['invalid limit', { limit: 'bad' }, 'trust limit'],
    ['full destination', { held: '100' }, 'trust limit'],
    ['invalid reserve', { reserve: 'bad' }, 'XRP reserve'],
    ['insufficient fee reserve', { xrp: '1000001' }, 'XRP reserve'],
  ] as [string, Record<string, string | number | boolean>, string][])('%s refuses without a ledger write', async (_name, fault, message) => {
    const request = vi.fn(async (r: Record<string, unknown>) => {
      if (r.command === 'server_info') return { result: { info: { validated_ledger: { reserve_base_xrp: fault.reserve ?? 1, reserve_inc_xrp: 0.2 } } } }
      if (r.command === 'account_info') return { result: { account_data: { Flags: fault.flags ?? 0, TransferRate: fault.rate ?? 1000000000, Balance: fault.xrp ?? '100000000', OwnerCount: 0 } } }
      if (r.command === 'account_lines') return { result: { lines: (r.account === payer ? fault.sourceMissing : fault.destinationMissing) ? [] : [{ currency: asset.currency, account: issuer, balance: r.account === payer ? fault.balance ?? '10' : fault.held ?? '0', limit: fault.limit ?? '100', ...(fault.lineFlag ? { [String(fault.lineFlag)]: true } : {}) }] } }
      throw new Error('Unexpected ledger write')
    })
    await expect(checkIssuedPayment({ request } as Ledger, payer, payee, String(fault.amount ?? '1'), asset)).rejects.toThrow(message)
    expect(request.mock.calls.every(([r]) => ['server_info', 'account_info', 'account_lines'].includes(String(r.command)))).toBe(true)
  })
  it('refuses escrow signing without a configured wallet', async () => {
    const request = vi.fn()
    const persist = vi.fn(), send = vi.fn()
    await expect(new XrplPayer({ request }).escrow({ TransactionType: 'EscrowCancel', Owner: payee, OfferSequence: 1 }, 0, persist, send)).rejects.toThrow('signer unavailable')
    expect(request).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
  it('refuses a mismatched amount and invoice independently', () => {
    const terms = { asset: 'XRP', amountDrops: '1000', invoiceId: 'AB' } as PaymentRequirement
    expect(XrplPayer.checkTerms({ ...terms, amountDrops: '2000' }, 1, 1000, 'AB')).toContain('amount')
    expect(XrplPayer.checkTerms({ ...terms, invoiceId: 'CD' }, 1, 1000, 'AB')).toContain('InvoiceID')
  })
})
