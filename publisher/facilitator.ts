// The publisher's own x402 facilitator (#129, D7): verify, submit, de-duplicate by tx hash.
// Simulated rail: the same checks with a local signer and no network, labelled SIMULATED.
import { decode, hashes, verifySignature } from 'xrpl'
import type { Rail } from '../shared/contracts/publisher.js'
import { X402_NETWORK, type PaymentRequirements, type PaymentResponse, type PaymentSignature } from '../shared/contracts/x402.js'
import { ledgerInvoiceId } from '../shared/x402.js'
import { lookupTx, simulatedLedgerIndex, simulatedPayerWallet, validatedLedgerIndex, verifyPayment, type Ledger } from '../shared/xrpl.js'
import type { PublisherJournal, X402Quote, X402Settlement } from './journal.js'

export const MAX_TIMEOUT_SECONDS = 60
type Tx = { TransactionType?: string; Account?: string; Destination?: string; Amount?: unknown; InvoiceID?: string; LastLedgerSequence?: number }
export type Verified = { ok: true; txHash: string; payer: string; quote: X402Quote } | { ok: false; reason: string; txHash?: string }
export type Settled = { ok: true; settlement: X402Settlement; quote: X402Quote } | { ok: false; reason: string; txHash?: string; pending?: boolean }

export const requirementsFor = (quote: X402Quote): PaymentRequirements => ({
  scheme: 'exact', network: X402_NETWORK, amount: quote.amount, asset: 'XRP', payTo: quote.payTo,
  maxTimeoutSeconds: MAX_TIMEOUT_SECONDS, extra: { invoiceId: quote.invoiceId, areFeesSponsored: false },
})
export const paymentResponse = (result: Settled): PaymentResponse => result.ok
  ? { success: true, payer: result.settlement.payer, transaction: result.settlement.txHash, network: X402_NETWORK }
  : { success: false, errorReason: result.reason, transaction: '', network: X402_NETWORK }

export class Facilitator {
  private readonly inflight = new Map<string, Promise<Settled>>()
  private readonly simulatedPayer = simulatedPayerWallet().classicAddress
  constructor(readonly journal: PublisherJournal, readonly rail: Rail, readonly ledger?: Ledger, readonly timing = { pollMs: 1000, timeoutMs: 30_000 }) {}

  /** Read-only: the signed blob pays exactly what an open quote asked for. `expect` pins the article being bought. */
  async verify(signature: PaymentSignature, expect?: { articleId: string; version: string }): Promise<Verified> {
    let tx: Tx, txHash: string
    try { tx = decode(signature.payload.signedTxBlob) as Tx; txHash = hashes.hashSignedTx(signature.payload.signedTxBlob).toUpperCase() } catch { return { ok: false, reason: 'signed blob does not decode' } }
    const quote = tx.InvoiceID ? this.journal.quoteByInvoice(tx.InvoiceID) : undefined
    const reason = tx.TransactionType !== 'Payment' ? 'not a Payment'
      : !quote ? 'InvoiceID matches no quote'
        : expect && (quote.articleId !== expect.articleId || quote.version !== expect.version) ? 'InvoiceID belongs to another article'
          : ledgerInvoiceId(quote.invoiceId) !== String(tx.InvoiceID).toUpperCase() ? 'InvoiceID does not match the quote'
            : signature.accepted.extra.invoiceId !== quote.invoiceId ? 'accepted requirements name another invoice'
              : tx.Destination !== quote.payTo ? 'wrong destination'
                : tx.Amount !== quote.amount ? 'wrong amount'
                  : typeof tx.LastLedgerSequence !== 'number' ? 'LastLedgerSequence missing'
                    : this.rail === 'simulated' && tx.Account !== this.simulatedPayer ? 'the simulated rail accepts only the SIMULATED test payer'
                      : this.rail === 'xrpl-testnet' && tx.Account === this.simulatedPayer ? 'the SIMULATED test payer is refused on the XRPL Testnet'
                        : this.rail === 'simulated' && !safeVerify(signature.payload.signedTxBlob) ? 'bad signature'
                          : undefined
    if (reason) return { ok: false, reason, txHash }
    // A blob that already settled stays valid after its quote or LastLedgerSequence lapsed (resend = same delivery).
    if (!this.journal.settlementByTx(txHash)) {
      const current = this.rail === 'simulated' ? simulatedLedgerIndex() : await validatedLedgerIndex(this.ledger!)
      if (tx.LastLedgerSequence! < current && !(await this.onLedger(txHash))) return { ok: false, reason: 'LastLedgerSequence has passed', txHash }
    }
    return { ok: true, txHash, payer: String(tx.Account), quote: quote! }
  }

  /** Verify, submit, wait for validation, confirm with verifyPayment, then record once per tx hash. */
  settle(signature: PaymentSignature, expect?: { articleId: string; version: string }): Promise<Settled> {
    const blob = signature.payload.signedTxBlob.toUpperCase()
    const running = this.inflight.get(blob)
    if (running) return running
    const pending = this.doSettle(signature, expect).finally(() => this.inflight.delete(blob))
    this.inflight.set(blob, pending)
    return pending
  }

  private async doSettle(signature: PaymentSignature, expect?: { articleId: string; version: string }): Promise<Settled> {
    const verified = await this.verify(signature, expect).catch((): Verified => ({ ok: false, reason: 'ledger unavailable' }))
    if (!verified.ok) return verified
    const { txHash, quote, payer } = verified
    const existing = this.journal.settlementByTx(txHash)
    if (existing) return { ok: true, settlement: existing, quote }
    let ledgerIndex: number | undefined
    if (this.rail === 'xrpl-testnet') {
      const confirmed = await this.submitAndConfirm(signature.payload.signedTxBlob, txHash, quote)
      if (!confirmed.ok) return { ...confirmed, txHash }
      ledgerIndex = confirmed.ledgerIndex
    } else if (Date.parse(quote.expiresAt) <= Date.now()) return { ok: false, reason: 'quote expired', txHash }
    try {
      return { ok: true, quote, settlement: this.journal.settle({ txHash, ledgerInvoiceId: quote.ledgerInvoiceId, payer, ledgerIndex, settledAt: new Date().toISOString() }) }
    } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'settlement failed', txHash } }
  }

  private async onLedger(txHash: string): Promise<boolean> {
    return this.rail === 'xrpl-testnet' && (await lookupTx(this.ledger!, txHash)).state === 'validated'
  }

  private async submitAndConfirm(blob: string, txHash: string, quote: X402Quote): Promise<{ ok: true; ledgerIndex: number } | { ok: false; reason: string; pending?: boolean }> {
    const terms = { rail: 'xrpl-testnet' as const, network: 'xrpl:1' as const, asset: 'XRP' as const, payTo: quote.payTo, amountDrops: quote.amount, invoiceId: quote.ledgerInvoiceId }
    // Already validated (e.g. a resend after a restart) needs no new submission; else only an open quote may be submitted.
    if (!(await this.onLedger(txHash))) {
      if (Date.parse(quote.expiresAt) <= Date.now()) return { ok: false, reason: 'quote expired' }
      // Same blob, same hash: submitting twice is harmless, the ledger applies it once.
      try { await this.ledger!.request({ command: 'submit', tx_blob: blob }) } catch { /* the lookup decides */ }
    }
    const deadline = Date.now() + this.timing.timeoutMs
    for (;;) {
      const verdict = await verifyPayment(this.ledger!, txHash, terms).catch(() => ({ state: 'pending' as const }))
      if (verdict.state === 'ok') return { ok: true, ledgerIndex: verdict.proof.ledgerIndex }
      if (verdict.state === 'invalid') return { ok: false, reason: `XRPL payment not accepted: ${verdict.reason}` }
      if (Date.now() > deadline) return { ok: false, reason: 'XRPL payment not validated yet', pending: true }
      await new Promise(resolve => setTimeout(resolve, this.timing.pollMs))
    }
  }
}

function safeVerify(blob: string): boolean {
  try { return verifySignature(blob) } catch { return false }
}
