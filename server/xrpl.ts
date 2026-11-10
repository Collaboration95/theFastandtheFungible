import { signPayment } from '../shared/xrpl.js'
import { amountFor, ledgerAmount } from '../shared/contracts/asset.js'
import { checkIssuedPayment } from '../shared/issued-currency.js'
import { screenPayee } from './payee-screening.js'
import { bounded } from './dependencies.js'
import { loadConfig } from './config.js'
import { Wallet, decode, type Transaction } from 'xrpl'
import type { PaymentRequirement } from '../shared/contracts/index.js'
import { lookupTx, simulatedLedgerIndex, simulatedPayerWallet, testnetLedger, validatedLedgerIndex, type Ledger } from '../shared/xrpl.js'

/** A signed payment, persisted before it is ever submitted so a restart can find it by hash. */
export type Submission = { txHash: string; txBlob: string; lastLedgerSequence: number }
export type PaymentOutcome =
  | { state: 'success'; ledgerIndex: number }
  | { state: 'failed'; result: string }
  | { state: 'expired' }
  | { state: 'pending' }

export class BeforeSignError extends Error {}
export const FEE_CAP_DROPS = 2000

/** Buyer wallet. The seed stays inside this object: never logged, traced or sent to a model. */
// Every role and signer object sharing an address shares its sequence reservation.
const walletQueues = new Map<string, { queue: Promise<unknown>; pending: Submission[] }>()
export class XrplPayer {
  readonly rail = 'xrpl-testnet' as const
  readonly lockWaitMs: number[] = []
  private escrowFeeHolds: () => number = () => 0
  holdEscrowFees(hold: () => number) { this.escrowFeeHolds = hold }
  private balanceLoading?: Promise<void>
  private balanceCache?: { at: number; value: BalanceSnapshot; committed: number }
  readonly address?: string
  constructor(readonly ledger: Ledger, private readonly wallet?: Wallet, private readonly timing = { pollMs: 1000, timeoutMs: 120_000 }) {
    this.address = wallet?.classicAddress
  }
  static fromEnv(): XrplPayer {
    const seed = loadConfig().XRPL_PAYER_SEED
    return new XrplPayer(testnetLedger(), seed ? Wallet.fromSeed(seed) : undefined)
  }
  /** Amount, network and invoice must match the quote exactly; the publisher cannot ask for more. */
  static checkTerms(terms: PaymentRequirement, amountMinor: number, dropsPerMinor: number, quoteHash: string): string | undefined {
    if (terms.amountDrops !== (terms.asset === 'XRP' ? String(amountMinor * dropsPerMinor) : amountFor(amountMinor, terms.asset))) return 'XRPL amount does not match the quoted price'
    if (terms.invoiceId !== quoteHash.toUpperCase()) return 'XRPL InvoiceID does not match the quote'
    return undefined
  }
  /**
   * Serialize signing until the previous sequence is ledger-proven consumed or expired.
   * Delivery never owns the lock. An unresolved sequence refuses new signing after a bounded
   * ledger wait, rather than guessing a sequence or waiting for a slow writer's 60 s HTTP reply.
   */
  pay<T>(terms: PaymentRequirement & { memo?: string }, persist: (signed: Submission) => Submission, send: (submission: Submission) => Promise<T>): Promise<{ submission: Submission; sent: Promise<T> }> {
    return this.queued(() => this.sign(terms), persist, send)
  }
  /** Writer policy has already bound the full refund to a settled charge. Keep the original
   * refund signing checks, while reserving its sequence with every other wallet operation. */
  refund<T>(payment: Parameters<typeof signPayment>[1], persist: (s: Submission) => Submission, send: (s: Submission) => Promise<T>) {
    return this.queued(() => signPayment(this.wallet!,payment,this.ledger),persist,send)
  }
  private queued<T>(sign: () => Promise<Submission>, persist: (s: Submission) => Submission, send: (s: Submission) => Promise<T>) {
    const started = Date.now()
    const key = this.address
    if (!key) return Promise.reject(new BeforeSignError('Testnet signer unavailable'))
    let state = walletQueues.get(key)
    if (!state) { state = { queue: Promise.resolve(), pending: [] }; walletQueues.set(key, state) }
    const shared = state
    const run = shared.queue.then(async () => {
      this.balanceCache = undefined
      for (const previous of shared.pending) {
        const outcome = await this.waitForSequence(previous)
        if (outcome.state === 'pending') throw new BeforeSignError('Previous payer sequence unresolved; retry after reconciliation; nothing was charged')
      }
      shared.pending = []
      this.lockWaitMs.push(Date.now() - started)
      if (this.lockWaitMs.length > 1024) this.lockWaitMs.shift()
      const submission = persist(await sign())
      shared.pending.push(submission)
      const sent = send(submission)
      void sent.catch(() => undefined)
      return { submission, sent }
    })
    shared.queue = run.catch(() => undefined)
    return run
  }
  escrow<T>(tx: Omit<Transaction, 'Account'>, principal: number, persist: (s: Submission) => Submission, send: (s: Submission) => Promise<T>, beforeSign?: () => Promise<void>, reservedTerminalFees: () => number = () => 0) {
    return this.queued(async () => {
      if (!this.wallet || this.address === simulatedPayerWallet().classicAddress) throw new BeforeSignError('Testnet signer unavailable')
      const info = await this.ledger.request({ command: 'server_info' })
      if (info.result.info.network_id !== 1) throw new BeforeSignError('Escrow is Testnet only')
      // Fresh validated balance already reflects locked principal and owner count. Do not deduct it twice.
      this.balanceCache = undefined
      const balance = await this.balance()
      const increment = Math.ceil(Number(info.result.info.validated_ledger.reserve_inc_xrp) * 1_000_000)
      if (!Number.isSafeInteger(increment) || increment < 200000) throw new BeforeSignError('Escrow reserve unavailable')
      const needed = reservedTerminalFees() + principal + FEE_CAP_DROPS + (tx.TransactionType === 'EscrowCreate' ? increment + FEE_CAP_DROPS : 0)
      if (balance.availableDrops < needed) throw new BeforeSignError('Payer balance below escrow reserve; nothing was charged')
      const [account, current, fee] = await Promise.all([
        this.ledger.request({ command: 'account_info', account: this.address, ledger_index: 'current' }),
        this.ledger.request({ command: 'ledger_current' }), this.ledger.request({ command: 'fee' }),
      ])
      const base = Math.max(12, Number(fee.result.drops?.open_ledger_fee ?? 12))
      const cost = Math.ceil(base * (tx.TransactionType === 'EscrowFinish' && typeof tx.Fulfillment === 'string' ? 33 + tx.Fulfillment.length / 2 / 16 : 1))
      if (!Number.isSafeInteger(cost) || cost > FEE_CAP_DROPS) throw new BeforeSignError('Escrow fee exceeds policy ceiling')
      const lastLedgerSequence = Number(current.result.ledger_current_index) + 20
      await beforeSign?.()
      const signed = this.wallet.sign({ ...tx, Account: this.address!, Sequence: Number(account.result.account_data.Sequence), Fee: String(cost), LastLedgerSequence: lastLedgerSequence } as Transaction)
      // Until the next validated refresh, a direct payment must see this new principal/reserve too.
      this.balanceCache!.committed += principal + FEE_CAP_DROPS + (tx.TransactionType === 'EscrowCreate' ? increment : 0)
      return { txHash: signed.hash.toUpperCase(), txBlob: signed.tx_blob, lastLedgerSequence }
    }, persist, send)
  }
  anchor<T>(memo: string, persist: (s: Submission) => Submission, send: (s: Submission) => Promise<T>) {
    return this.escrow({ TransactionType: 'AccountSet', Memos: [{ Memo: { MemoType: Buffer.from('researchagent/anchor-v1').toString('hex').toUpperCase(), MemoData: Buffer.from(memo).toString('hex').toUpperCase() } }] } as Omit<Transaction, 'Account'>, 0, persist, send)
  }
  revokeCredential<T>(subject: string, credentialType: string, persist: (s: Submission) => Submission, send: (s: Submission) => Promise<T>) {
    return this.escrow({ TransactionType: 'CredentialDelete', Subject: subject, CredentialType: credentialType } as Omit<Transaction, 'Account'>, 0, persist, send)
  }
  restorePending(submissions: Submission[]) {
    if (!this.address) return
    let state = walletQueues.get(this.address)
    if (!state) { state = { queue: Promise.resolve(), pending: [] }; walletQueues.set(this.address, state) }
    for (const s of submissions) if (!state.pending.some(p => p.txHash === s.txHash)) state.pending.push(s)
  }
  private async waitForSequence(submission: Submission): Promise<PaymentOutcome> {
    const deadline = Date.now() + Math.min(5000, this.timing.timeoutMs)
    do {
      const result = await bounded(this.status(submission), Math.max(1, deadline - Date.now())).catch((): PaymentOutcome => ({ state: 'pending' }))
      if (result.state !== 'pending') return result
      if (Date.now() >= deadline) break
      await new Promise(resolve => setTimeout(resolve, this.timing.pollMs))
    } while (Date.now() < deadline)
    return { state: 'pending' }
  }
  async balance(): Promise<BalanceSnapshot> {
    if (!this.address) throw new BeforeSignError('XRPL payer is not configured; nothing was charged')
    if (!this.balanceCache || Date.now() - this.balanceCache.at >= 5000) {
      this.balanceLoading ??= (async () => {
        const [account, server] = await Promise.all([
          this.ledger.request({ command: 'account_info', account: this.address, ledger_index: 'validated' }),
          this.ledger.request({ command: 'server_info' }),
        ])
        const validated = server.result.info.validated_ledger
        const balanceDrops = Number(account.result.account_data.Balance)
        const reserveDrops = Math.ceil((Number(validated.reserve_base_xrp) + Number(account.result.account_data.OwnerCount) * Number(validated.reserve_inc_xrp)) * 1_000_000)
        const ledgerAgeSeconds = Number(validated.age)
        if (![balanceDrops, reserveDrops, ledgerAgeSeconds].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Ledger balance or reserve unavailable')
        this.balanceCache = { at: Date.now(), committed: 0, value: { balanceDrops, reserveDrops, availableDrops: balanceDrops - reserveDrops, ledgerAgeSeconds } }
      })().finally(() => { this.balanceLoading = undefined })
      await this.balanceLoading
    }
    const cache = this.balanceCache!
    return { ...cache.value, availableDrops: cache.value.availableDrops - cache.committed,
      ledgerAgeSeconds: cache.value.ledgerAgeSeconds + (Date.now() - cache.at) / 1000 }
  }
  private async sign(terms: PaymentRequirement & { memo?: string }): Promise<Submission> {
    if (!this.wallet) throw new Error('XRPL payer seed is not configured')
    if (this.wallet.classicAddress === simulatedPayerWallet().classicAddress) throw new Error('The SIMULATED test payer is refused on the XRPL Testnet')
    if (terms.asset !== 'XRP') {
      try { await checkIssuedPayment(this.ledger, this.address!, terms.payTo, terms.amountDrops, terms.asset) } catch (e) { throw new BeforeSignError(e instanceof Error ? e.message : 'Issued-currency preflight failed') }
      this.balanceCache = undefined
    }
    const balance = await this.balance()
    if (balance.availableDrops < (terms.asset === 'XRP' ? Number(terms.amountDrops) : 0) + FEE_CAP_DROPS + this.escrowFeeHolds()) throw new BeforeSignError('Payer balance below reserve; nothing was charged')
    const account = this.wallet.classicAddress
    const [info, current, fee] = await Promise.all([
      this.ledger.request({ command: 'account_info', account, ledger_index: 'current' }),
      this.ledger.request({ command: 'ledger_current' }),
      this.ledger.request({ command: 'fee' }),
    ])
    for (const address of [terms.payTo, ...(terms.asset === 'XRP' ? [] : [terms.asset.issuer])]) {
      const refusal = screenPayee(address); if (refusal) throw new BeforeSignError(refusal.refusal)
    }
    const lastLedgerSequence = Number(current.result.ledger_current_index) + 20
    const signed = this.wallet.sign({
      TransactionType: 'Payment', Account: account, Destination: terms.payTo, Amount: ledgerAmount(terms.amountDrops, terms.asset), InvoiceID: terms.invoiceId,
      ...(terms.memo ? { Memos: [{ Memo: { MemoData: Buffer.from(terms.memo).toString('hex').toUpperCase() } }] } : {}),
      // Fee capped so a fee spike never drains the wallet; LastLedgerSequence makes expiry provable.
      Sequence: Number(info.result.account_data.Sequence), Fee: String(Math.min(FEE_CAP_DROPS, Math.max(12, Number(fee.result.drops?.open_ledger_fee ?? 12)))), LastLedgerSequence: lastLedgerSequence,
    })
    this.balanceCache!.committed += (terms.asset === 'XRP' ? Number(terms.amountDrops) : 0) + FEE_CAP_DROPS
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
      const outcome = await bounded(this.status(submission), Math.max(1, deadline - Date.now())).catch((): PaymentOutcome => ({ state: 'pending' }))
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
    const signed = this.wallet.sign({ TransactionType: 'Payment', Account: this.address, Destination: terms.payTo, Amount: ledgerAmount(terms.amountDrops, terms.asset), InvoiceID: terms.invoiceId, Sequence: 1, Fee: '12', LastLedgerSequence: lastLedgerSequence })
    const submission = persist({ txHash: signed.hash.toUpperCase(), txBlob: signed.tx_blob, lastLedgerSequence })
    return { submission, sent: send(submission) }
  }
}
export type Payer = XrplPayer | SimulatedPayer
export type BalanceSnapshot = { balanceDrops: number; reserveDrops: number; availableDrops: number; ledgerAgeSeconds: number }
