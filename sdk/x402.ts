/** Generic Node x402 v2 exact/XRP buyer. No ResearchAgent-specific routes or manifests. */
import { Wallet, decode } from 'xrpl'
import { decodeHeader, encodeHeader, ledgerInvoiceId } from '../shared/x402.js'
import { signPayment, testnetLedger, verifyPayment, simulatedPayerWallet, type Ledger } from '../shared/xrpl.js'
import type { Submission } from '../server/xrpl.js'

export type PaymentAttempt = { signature: string; submission: Submission; payTo: string; amountDrops: string; invoiceId: string }
export type PaymentJournal = { load(key: string): PaymentAttempt | undefined; save(key: string, value: PaymentAttempt): PaymentAttempt }
const attempts = new Map<string, PaymentAttempt>()
const memoryJournal: PaymentJournal = { load: key => attempts.get(key), save: (key, value) => {
  const old = attempts.get(key); if (old) return old; attempts.set(key, value); return value
} }
const queues = new Map<string, Promise<unknown>>()
export type PayOptions = { wallet: Wallet; maxDrops: string; method?: string; body?: string;
  headers?: HeadersInit; idempotencyKey?: string; journal?: PaymentJournal; ledger?: Ledger; fetch?: typeof fetch }

/** Persist the returned attempt to retry delivery safely after a process restart. Fees are capped at 2,000 drops. */
export async function payAndFetch(url: string, options: PayOptions) {
  if (options.wallet.classicAddress === simulatedPayerWallet().classicAddress) throw new Error('SIMULATED signer refused on Testnet')
  if (!/^[1-9]\d*$/.test(options.maxDrops)) throw new Error('maxDrops must be positive integer drops')
  const resource = new URL(url)
  if (resource.protocol !== 'https:' && !(resource.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(resource.hostname))) throw new Error('x402 requires HTTPS or loopback HTTP')
  const key = JSON.stringify([options.wallet.classicAddress, url, options.method ?? 'GET', options.body ?? '', options.idempotencyKey ?? ''])
  const journal = options.journal ?? memoryJournal
  const transport = options.fetch ?? fetch
  const headers = new Headers(options.headers)
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
  const request = () => transport(url, { method: options.method ?? 'GET', body: options.body, headers, redirect: 'error', signal: AbortSignal.timeout(240_000) })
  const owned = options.ledger ? undefined : testnetLedger()
  const ledger = options.ledger ?? owned!
  const previous = queues.get(options.wallet.classicAddress) ?? Promise.resolve()
  const task = previous.catch(() => undefined).then(async () => {
    let attempt = journal.load(key)
    if (!attempt) {
      const first = await request()
      if (first.status !== 402) { await first.body?.cancel(); throw new Error('Expected x402 payment challenge') }
      const required = decodeHeader('PAYMENT-REQUIRED', first.headers.get('PAYMENT-REQUIRED'))
      await first.body?.cancel()
      const terms = required.accepts[0] // codec rejects Mainnet, non-XRP and non-exact schemes
      if (new URL(required.resource.url, url).href !== resource.href || BigInt(terms.amount) > BigInt(options.maxDrops) || terms.maxTimeoutSeconds > 300) throw new Error('x402 terms exceed resource or spending authority')
      const invoiceId = ledgerInvoiceId(terms.extra.invoiceId)
      const submission = await signPayment(options.wallet, { Destination: terms.payTo, Amount: terms.amount, InvoiceID: invoiceId }, ledger)
      attempt = journal.save(key, { submission, payTo: terms.payTo, amountDrops: terms.amount, invoiceId,
        signature: encodeHeader('PAYMENT-SIGNATURE', { x402Version: 2, accepted: terms, payload: { signedTxBlob: submission.txBlob } }) })
    }
    if (BigInt(attempt.amountDrops) > BigInt(options.maxDrops)) throw new Error('Stored payment exceeds authority')
    headers.set('PAYMENT-SIGNATURE', attempt.signature)
    const response = await request() // ambiguous failure keeps the same durable blob, never signs again
    const receipt = decodeHeader('PAYMENT-RESPONSE', response.headers.get('PAYMENT-RESPONSE'))
    if (!receipt.success || receipt.transaction !== attempt.submission.txHash || receipt.payer !== options.wallet.classicAddress) throw new Error('x402 settlement receipt mismatch; reuse this intent')
    const proof = await verifyPayment(ledger, receipt.transaction, { rail: 'xrpl-testnet', network: 'xrpl:1', asset: 'XRP', ...attempt })
    if (proof.state !== 'ok') throw new Error('x402 settlement is not ledger-proven; reuse this intent')
    return { response, receipt, payment: { txHash: attempt.submission.txHash, payTo: attempt.payTo, amountDrops: attempt.amountDrops, feeDrops: String(decode(attempt.submission.txBlob).Fee) } }
  })
  queues.set(options.wallet.classicAddress, task)
  try { return await task } finally { if (queues.get(options.wallet.classicAddress) === task) queues.delete(options.wallet.classicAddress); await owned?.close() }
}
