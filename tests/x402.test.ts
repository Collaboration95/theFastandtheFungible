import { describe, expect, it } from 'vitest'
import type { PaymentRequired, PaymentResponse, PaymentSignature } from '../shared/contracts/index.js'
import { MAX_HEADER_BYTES, decodeHeader, encodeHeader, invoiceIdFor, ledgerInvoiceId } from '../shared/x402.js'

const payTo = 'r4Dg79JKSPuVdhULa8TKVnX6VsMPzruZMV'
const invoice = { quoteId: 'q-1', articleId: 'lf-kestrel-tsmc-deal', version: 'v1', manifestRoot: 'ab'.repeat(32), amount: '60000', payTo }
const accepted = { scheme: 'exact', network: 'xrpl:1', amount: '60000', asset: 'XRP', payTo, maxTimeoutSeconds: 60, extra: { invoiceId: invoiceIdFor(invoice), areFeesSponsored: false } } as const
const required: PaymentRequired = { x402Version: 2, resource: { url: '/w/load-factor/articles/lf-kestrel-tsmc-deal', mimeType: 'application/json' }, accepts: [accepted] }
const signature: PaymentSignature = { x402Version: 2, accepted, payload: { signedTxBlob: '1200002280000000' } }
const response: PaymentResponse = { success: true, transaction: 'C'.repeat(64), network: 'xrpl:1', payer: payTo }

describe('x402 v2 header codec (#114)', () => {
  it('round-trips each header', () => {
    expect(decodeHeader('PAYMENT-REQUIRED', encodeHeader('PAYMENT-REQUIRED', required))).toEqual(required)
    expect(decodeHeader('PAYMENT-SIGNATURE', encodeHeader('PAYMENT-SIGNATURE', signature))).toEqual(signature)
    expect(decodeHeader('PAYMENT-RESPONSE', encodeHeader('PAYMENT-RESPONSE', response))).toEqual(response)
    expect(decodeHeader('PAYMENT-RESPONSE', encodeHeader('PAYMENT-RESPONSE', { success: false, errorReason: 'invalid_payload', transaction: '', network: 'xrpl:1' })).success).toBe(false)
  })

  it('rejects malformed, oversize and schema-invalid headers', () => {
    const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')
    expect(() => decodeHeader('PAYMENT-REQUIRED', undefined)).toThrow(/missing/)
    expect(() => decodeHeader('PAYMENT-REQUIRED', 'not base64!')).toThrow(/base64/)
    expect(() => decodeHeader('PAYMENT-REQUIRED', Buffer.from('{oops').toString('base64'))).toThrow(/JSON/)
    expect(() => decodeHeader('PAYMENT-REQUIRED', 'A'.repeat(MAX_HEADER_BYTES + 4))).toThrow(/exceeds/)
    expect(() => decodeHeader('PAYMENT-REQUIRED', b64({ ...required, x402Version: 1 }))).toThrow()
    expect(() => decodeHeader('PAYMENT-REQUIRED', b64({ ...required, accepts: [{ ...accepted, network: 'xrpl:0' }] }))).toThrow()
    expect(() => decodeHeader('PAYMENT-REQUIRED', b64({ ...required, accepts: [{ ...accepted, extra: { ...accepted.extra, areFeesSponsored: true } }] }))).toThrow()
    expect(() => decodeHeader('PAYMENT-SIGNATURE', b64({ ...signature, payload: { signedTxBlob: 'zz' } }))).toThrow()
    expect(() => encodeHeader('PAYMENT-REQUIRED', { ...required, error: 'x'.repeat(MAX_HEADER_BYTES) })).toThrow(/exceeds/)
  })

  it('invoiceIdFor is stable across key order and binds every field', () => {
    const reordered = { payTo, amount: '60000', manifestRoot: invoice.manifestRoot, version: 'v1', articleId: invoice.articleId, quoteId: 'q-1' }
    expect(invoiceIdFor(reordered)).toBe(invoiceIdFor(invoice))
    expect(invoiceIdFor({ ...invoice, manifestRoot: 'cd'.repeat(32) })).not.toBe(invoiceIdFor(invoice))
    expect(ledgerInvoiceId(invoiceIdFor(invoice))).toMatch(/^[0-9A-F]{64}$/)
    expect(ledgerInvoiceId(invoiceIdFor(reordered))).toBe(ledgerInvoiceId(invoiceIdFor(invoice)))
  })
})
