import { Wallet, decode } from 'xrpl'
import type { PaymentRequirement } from '../shared/contracts/index.js'
import { lookupTx, testnetLedger, validatedLedgerIndex, type Ledger } from '../shared/xrpl.js'

/** A signed payment, persisted before it is ever submitted so a restart can find it by hash. */
export type Submission = { txHash: string; txBlob: string; lastLedgerSequence: number }
export type PaymentOutcome =
  | { state: 'success'; ledgerIndex: number }
  | { state: 'failed'; result: string }
  | { state: 'expired' }
  | { state: 'pending' }

/** Buyer wallet. The seed stays inside this object: never logged, traced or sent to a model. */
export class XrplPayer {
  private queue: Promise<unknown> = Promise.resolve()
  readonly address?: string
  constructor(readonly ledger: Ledger, private readonly wallet?: Wallet, private readonly timing = { pollMs: 1000, timeoutMs: 120_000 }) {
    this.address = wallet?.classicAddress
  }
  static fromEnv(): XrplPayer {
    const seed = process.env.XRPL_PAYER_SEED
    return new XrplPayer(testnetLedger(), seed ? Wallet.fromSeed(seed) : undefined)
  }
  /** Amount, network and invoice must match the quote exactly; the publisher cannot ask for more. */
  static checkTerms(terms: PaymentRequirement, amountMinor: number, dropsPerMinor: number, quoteHash: string): string | undefined {
    if (terms.amountDrops !== String(amountMinor * dropsPerMinor)) return 'XRPL amount does not match the quoted price'
    if (terms.invoiceId !== quoteHash.toUpperCase()) return 'XRPL InvoiceID does not match the quote'
    return undefined
  }
  /**
   * Sign → persist → submit under one lock, so two payments never share an account Sequence.
   * ponytail: one global lock per payer; per-account queues if several payers ever exist.
   */
  pay(terms: PaymentRequirement, persist: (signed: Submission) => Submission): Promise<{ submission: Submission; engineResult: string }> {
    const run = this.queue.then(async () => {
      const submission = persist(await this.sign(terms))
      return { submission, engineResult: await this.submit(submission.txBlob) }
    })
    this.queue = run.catch(() => undefined)
    return run
  }
  private async sign(terms: PaymentRequirement): Promise<Submission> {
    if (!this.wallet) throw new Error('XRPL payer seed is not configured')
    const account = this.wallet.classicAddress
    const [info, current, fee] = await Promise.all([
      this.ledger.request({ command: 'account_info', account, ledger_index: 'current' }),
      this.ledger.request({ command: 'ledger_current' }),
      this.ledger.request({ command: 'fee' }),
    ])
    const lastLedgerSequence = Number(current.result.ledger_current_index) + 20
    const signed = this.wallet.sign({
      TransactionType: 'Payment', Account: account, Destination: terms.payTo, Amount: terms.amountDrops, InvoiceID: terms.invoiceId,
      // Fee capped so a fee spike never drains the wallet; LastLedgerSequence makes expiry provable.
      Sequence: Number(info.result.account_data.Sequence), Fee: String(Math.min(2000, Math.max(12, Number(fee.result.drops?.open_ledger_fee ?? 12)))), LastLedgerSequence: lastLedgerSequence,
    })
    return { txHash: signed.hash.toUpperCase(), txBlob: signed.tx_blob, lastLedgerSequence }
  }
  /** Re-submitting the same signed blob is harmless: the ledger applies one transaction per Sequence. */
  async submit(txBlob: string): Promise<string> {
    try { return String((await this.ledger.request({ command: 'submit', tx_blob: txBlob })).result.engine_result) }
    catch { return 'submit-unconfirmed' } // The hash lookup decides the outcome.
  }
  async status(submission: Submission): Promise<PaymentOutcome> {
    const validatedBefore = await validatedLedgerIndex(this.ledger)
    const found = await lookupTx(this.ledger, submission.txHash)
    if (found.state === 'validated') {
      const result = String(found.meta.TransactionResult)
      return result === 'tesSUCCESS' ? { state: 'success', ledgerIndex: found.ledgerIndex } : { state: 'failed', result }
    }
    // Proof of absence that does not trust the node's tx history: past LastLedgerSequence the payment
    // can never apply, and if the account Sequence in that validated ledger has not moved past ours,
    // it never did. Otherwise keep the reservation and look again.
    if (found.state === 'missing' && validatedBefore > submission.lastLedgerSequence) {
      const signed = decode(submission.txBlob) as { Account: string; Sequence: number }
      const { result } = await this.ledger.request({ command: 'account_info', account: signed.Account, ledger_index: validatedBefore })
      if (Number(result.account_data.Sequence) <= Number(signed.Sequence)) return { state: 'expired' }
    }
    return { state: 'pending' }
  }
  async waitFor(submission: Submission): Promise<PaymentOutcome> {
    const deadline = Date.now() + this.timing.timeoutMs
    for (;;) {
      const outcome = await this.status(submission).catch((): PaymentOutcome => ({ state: 'pending' }))
      if (outcome.state !== 'pending' || Date.now() > deadline) return outcome
      await new Promise(resolve => setTimeout(resolve, this.timing.pollMs))
    }
  }
}
