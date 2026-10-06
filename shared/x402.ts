// x402 v2 header codec and invoice binding. Node only: never import from src/.
import type { z } from 'zod'
import { PaymentRequiredSchema, PaymentResponseSchema, PaymentSignatureSchema } from './contracts/x402.js'
import { canonicalJson, sha256 } from './manifest.js'

export const MAX_HEADER_BYTES = 8 * 1024
export const X402_HEADERS = { 'PAYMENT-REQUIRED': PaymentRequiredSchema, 'PAYMENT-SIGNATURE': PaymentSignatureSchema, 'PAYMENT-RESPONSE': PaymentResponseSchema } as const
export type X402Header = keyof typeof X402_HEADERS
type HeaderValue<H extends X402Header> = z.infer<(typeof X402_HEADERS)[H]>

/** `articleId` is the run's `resourceId`. Canonical JSON, so key order never matters. */
export const invoiceIdFor = (input: { quoteId: string; articleId: string; version: string; manifestRoot: string; amount: string; payTo: string }) =>
  canonicalJson({ quoteId: input.quoteId, articleId: input.articleId, version: input.version, manifestRoot: input.manifestRoot, amount: input.amount, payTo: input.payTo })
/** The on-ledger XRPL `InvoiceID`: sha256(invoiceId), 64 uppercase hex chars. */
export const ledgerInvoiceId = (invoiceId: string) => sha256(invoiceId).toUpperCase()

export function encodeHeader<H extends X402Header>(header: H, value: HeaderValue<H>): string {
  const encoded = Buffer.from(JSON.stringify(X402_HEADERS[header].parse(value)), 'utf8').toString('base64')
  if (encoded.length > MAX_HEADER_BYTES) throw new Error(`${header} header exceeds ${MAX_HEADER_BYTES} bytes`)
  return encoded
}

/** Throws on oversize, non-base64, non-JSON or schema-invalid input. */
export function decodeHeader<H extends X402Header>(header: H, raw: string | null | undefined): HeaderValue<H> {
  if (typeof raw !== 'string' || raw.length === 0) throw new Error(`${header} header missing`)
  if (raw.length > MAX_HEADER_BYTES) throw new Error(`${header} header exceeds ${MAX_HEADER_BYTES} bytes`)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) throw new Error(`${header} header is not base64`)
  let json: unknown
  try { json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) } catch { throw new Error(`${header} header is not JSON`) }
  return X402_HEADERS[header].parse(json) as HeaderValue<H>
}
