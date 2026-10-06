import { Wallet, decode } from 'xrpl'
import type { PaymentRequirement } from '../shared/contracts/index.js'
import { lookupTx, simulatedLedgerIndex, simulatedPayerWallet, testnetLedger, validatedLedgerIndex, type Ledger } from '../shared/xrpl.js'

/** A signed payment, persisted before it is ever submitted so a restart can find it by hash. */
export type Submission = { txHash: string; txBlob: string; lastLedgerSequence: number }
export type PaymentOutcome =
  | { state: 'success'; ledgerIndex: number }
  | { state: 'failed'; result: string }
  | { state: 'expired' }
  | { state: 'pending' }

/** Buyer wallet. The seed stays inside this object: never logged, traced or sent to a model. */
export class XrplPayer {
  readonly rail = 'xrpl-testnet' as const
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
   * Sign → persist → send under one lock, so two payments never share an account Sequence. `send`
   * hands the blob to the publisher's facilitator, which submits it (x402 v2, D7).
   * ponytail: one global lock per payer; per-account queues if several payers ever exist.
   */
  pay<T>(terms: PaymentRequirement, persist: (signed: Submission) => Submission, send: (submission: Submission) => Promise<T>): Promise<{ submission: Submission; sent: Promise<T> }> {
    const run = this.queue.then(async () => {
      const submission = persist(await this.sign(terms))
      const sent = send(submission)
      // Hold the lock until the facilitator answered, so the next Sequence is read after this one applied.
      await sent.catch(() => undefined)
      return { submission, sent }
    })
    this.queue = run.catch(() => undefined)
    return run
  }
  private async sign(terms: PaymentRequirement): Promise<Submission> {
    if (!this.wallet) throw new Error('XRPL payer seed is not configured')
    if (this.wallet.classicAddress === simulatedPayerWallet().classicAddress) throw new Error('The SIMULATED test payer is refused on the XRPL Testnet')
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

/**
 * SIMULATED rail (#130): signs a real XRPL Payment blob with a deterministic, public test-only key and no
 * network. The publisher's simulated facilitator runs the same checks; the Testnet rail refuses this key.
 */
export class SimulatedPayer {
  readonly rail = 'simulated' as const
  private readonly wallet = simulatedPayerWallet()
  readonly address = this.wallet.classicAddress
  async pay<T>(terms: PaymentRequirement, persist: (signed: Submission) => Submission, send: (submission: Submission) => Promise<T>): Promise<{ submission: Submission; sent: Promise<T> }> {
    const lastLedgerSequence = simulatedLedgerIndex() + 20
    const signed = this.wallet.sign({ TransactionType: 'Payment', Account: this.address, Destination: terms.payTo, Amount: terms.amountDrops, InvoiceID: terms.invoiceId, Sequence: 1, Fee: '12', LastLedgerSequence: lastLedgerSequence })
    const submission = persist({ txHash: signed.hash.toUpperCase(), txBlob: signed.tx_blob, lastLedgerSequence })
    return { submission, sent: send(submission) }
  }
}
export type Payer = XrplPayer | SimulatedPayer
