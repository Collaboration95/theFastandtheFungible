import { describe, expect, it, vi } from 'vitest'
import { checkIssuedPayment } from '../shared/issued-currency.js'
import { XrplPayer } from '../server/xrpl.js'
import { Wallet } from 'xrpl'
import type { Ledger } from '../shared/xrpl.js'
import type { PaymentRequirement } from '../shared/contracts/index.js'

const issuer = Wallet.generate().classicAddress
const payer = Wallet.generate().classicAddress
const payee = Wallet.generate().classicAddress
const asset = { currency: '524C555344000000000000000000000000000000', issuer, label: 'test USD (substitute for RLUSD)' } as const

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

// A receipt consumer must refuse citations without delivery/grant provenance.
import { presentRun } from '../sdk/present.js'
import { Store } from '../server/store.js'
import type { RunSnapshot } from '../shared/contracts/run.js'
it.each(['missing passage', 'missing candidate', 'paid without grant'])('refuses %s in the SDK presentation', fault => {
  const store = new Store(':memory:')
  try {
    const run = store.getRun(store.createRun('fixture', 100).runId)
    const citation = { resourceId: 'paid', version: 'v1', spanId: 's1' }
    run.answers = [{ claims: [{ id: 'claim', citations: [citation] }] }] as RunSnapshot['answers']
    if (fault !== 'missing passage') run.contents = [{ resourceId: 'paid', version: 'v1', profileId: 'writer', publisher: 'Fixture', spans: [{ id: 's1', text: 'fixture evidence' }] }] as RunSnapshot['contents']
    if (fault === 'paid without grant') run.candidates = [{ resourceId: 'paid', version: 'v1', profileId: 'writer', tier: 'PAID' }] as RunSnapshot['candidates']
    expect(() => presentRun(run, 'http://localhost')).toThrow(/Citation has no/)
  } finally { store.close() }
})
it('keeps a refused purchase visible without inventing a receipt or explorer link', () => {
  const store = new Store(':memory:')
  try {
    const run = store.getRun(store.createRun('fixture', 100).runId)
    run.intents = [{ intentId: 'denied', profileId: 'writer', resourceId: 'paid', amountMinor: 10, status: 'FAILED_NOT_SETTLED' }] as RunSnapshot['intents']
    expect(presentRun(run, 'http://localhost').purchases[0]).toMatchObject({ writer: 'writer', txHash: null, explorerUrl: null, settlementAmount: null, verified: false })
  } finally { store.close() }
})

import { payAndFetch, type PaymentAttempt } from '../sdk/x402.js'
import { encodeHeader } from '../shared/x402.js'
it.each(['resource', 'amount', 'timeout', 'extension', 'asset'])('refuses x402 %s outside operator authority before ledger access', async fault => {
  const request = vi.fn(), persist = vi.fn()
  const challenge = {
    x402Version: 2 as const,
    resource: { url: fault === 'resource' ? '/other' : '/paid' },
    accepts: [{ scheme: 'exact' as const, network: 'xrpl:1' as const, asset: fault === 'asset' ? asset : 'XRP' as const,
      amount: fault === 'amount' ? '2000' : '1000', payTo: payee,
      maxTimeoutSeconds: fault === 'timeout' ? 301 : 60,
      extra: { invoiceId: 'fixture', ...(fault === 'extension' ? { crossCurrency: true } : {}) } }],
  }
  const transport = vi.fn(async () => new Response(null, { status: 402, headers: { 'PAYMENT-REQUIRED': encodeHeader('PAYMENT-REQUIRED', challenge) } }))
  await expect(payAndFetch('http://localhost/paid', { wallet: Wallet.generate(), maxDrops: '1000', ledger: { request },
    fetch: transport, journal: { load: () => undefined, save: persist } })).rejects.toThrow(/authority|Unsupported|unavailable/)
  expect(request).not.toHaveBeenCalled()
  expect(persist).not.toHaveBeenCalled()
})
it('refuses a durable payment exceeding the retry budget without resubmitting', async () => {
  const request = vi.fn(), transport = vi.fn(), persist = vi.fn()
  const stored = { amountDrops: '2000', asset: 'XRP' } as PaymentAttempt
  await expect(payAndFetch('http://localhost/paid', { wallet: Wallet.generate(), maxDrops: '1000', ledger: { request }, fetch: transport,
    journal: { load: () => stored, save: persist } })).rejects.toThrow('Stored payment exceeds authority')
  expect(request).not.toHaveBeenCalled()
  expect(transport).not.toHaveBeenCalled()
  expect(persist).not.toHaveBeenCalled()
})

import { PublisherClient, PublisherHttpError } from '../server/publisher-client.js'
import type { Challenge } from '../shared/contracts/publisher.js'
it.each(['registry', 'challenge', 'escrow'])('preserves %s refusal and redacts publisher bodies when telemetry throws', async method => {
  const wires: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async () => new Response('premium-error-body', { status: 403 })))
  const client = new PublisherClient({ baseUrl: 'http://127.0.0.1:1234', onWire: wire => { wires.push(wire); throw new Error('observer failed') } })
  try {
    const result = method === 'registry' ? client.registry() : method === 'challenge' ? client.challenge('writer', {} as Challenge, 100) : client.escrowQuote('/paid', { payer, intentId: 'fixture', condition: 'fixture', cancelAfter: 1 })
    await expect(result).rejects.toEqual(new PublisherHttpError(403))
    expect(wires).toHaveLength(1)
    expect(JSON.stringify(wires)).not.toContain('premium-error-body')
    expect(JSON.stringify(wires)).not.toContain('observer failed')
  } finally { vi.unstubAllGlobals() }
})
