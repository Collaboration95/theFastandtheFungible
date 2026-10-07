// XRPL Testnet access shared by the publisher (verifies payments) and the api (pays).
// Runtime code: import by path, never from shared/contracts/index (the browser bundle).
import { createHash } from 'node:crypto'
import { Client, Wallet, type ECDSA } from 'xrpl'
import type { LedgerProof, PaymentRequirement } from './contracts/publisher.js'

/** The subset of xrpl.Client the rail uses; tests inject a fake ledger. */
export type Ledger = { request(request: Record<string, unknown>): Promise<{ result: any }> } // eslint-disable-line @typescript-eslint/no-explicit-any

export const TESTNET_WSS = 'wss://s.altnet.rippletest.net:51233'
/** Phase 1 (#98): every simulated publisher is paid at this one funded Testnet address. */
export const TESTNET_RECEIVER = 'r4Dg79JKSPuVdhULa8TKVnX6VsMPzruZMV'

/** The rail must never reach Mainnet: only rippletest.net hosts are accepted. */
export function testnetUrl(url = process.env.XRPL_RPC_URL || TESTNET_WSS): string {
  if (!/^wss:\/\/[a-z0-9.-]+\.rippletest\.net(?::\d+)?\/?$/.test(url)) throw new Error('XRPL rail is restricted to the Testnet (*.rippletest.net)')
  return url
}

/** One lazily connected client per process, reconnected after a drop. */
export function testnetLedger(url = testnetUrl()): Ledger & { close(): Promise<void> } {
  let client: Client | undefined
  return {
    async request(request) {
      if (!client?.isConnected()) { client = new Client(url); await client.connect() }
      return client.request(request as never) as never
    },
    async close() { await client?.disconnect() },
  }
}

export type TxLookup =
  | { state: 'missing' | 'pending' }
  | { state: 'validated'; tx: Record<string, unknown>; meta: Record<string, unknown>; ledgerIndex: number }

/** 'missing' is only "this node did not find it"; callers needing proof of absence check the account Sequence. */
export async function lookupTx(ledger: Ledger, txHash: string): Promise<TxLookup> {
  let response: { result: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  try { response = await ledger.request({ command: 'tx', transaction: txHash }) }
  catch (error) {
    if ((error as { data?: { error?: string } }).data?.error === 'txnNotFound') return { state: 'missing' }
    throw error
  }
  const result = response.result
  if (!result?.validated) return { state: 'pending' }
  return { state: 'validated', tx: result.tx_json ?? result, meta: result.meta ?? {}, ledgerIndex: Number(result.ledger_index) }
}

export async function validatedLedgerIndex(ledger: Ledger): Promise<number> {
  return Number((await ledger.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger_index)
}

/**
 * Publisher-side proof: a validated, successful XRP Payment to payTo that delivered exactly
 * amountDrops and carries the quote hash as InvoiceID. Anything else never earns a receipt.
 */
export async function verifyPayment(ledger: Ledger, txHash: string, terms: PaymentRequirement):
  Promise<{ state: 'pending' } | { state: 'invalid'; reason: string } | { state: 'ok'; proof: LedgerProof }> {
  const found = await lookupTx(ledger, txHash)
  if (found.state !== 'validated') return { state: 'pending' }
  const { tx, meta } = found
  const reason = tx.TransactionType !== 'Payment' ? 'not a Payment'
    : meta.TransactionResult !== 'tesSUCCESS' ? `ledger result ${String(meta.TransactionResult)}`
      : tx.Destination !== terms.payTo ? 'wrong destination'
        : meta.delivered_amount !== terms.amountDrops ? 'wrong delivered amount'
          : String(tx.InvoiceID ?? '').toUpperCase() !== terms.invoiceId ? 'InvoiceID does not match the quote'
            : undefined
  if (reason) return { state: 'invalid', reason }
  return { state: 'ok', proof: { txHash, ledgerIndex: found.ledgerIndex, payer: String(tx.Account), payTo: terms.payTo, amountDrops: terms.amountDrops } }
}

/** Public, test-only seed salt: the SIMULATED payer is accepted only on the simulated rail, never on the Testnet. */
const SIMULATED_PAYER_SALT = 'researchagent-simulated-payer-v1'
export const SIMULATED_PAYER_LABEL = 'SIMULATED payer key · test only'
export const simulatedPayerWallet = () => Wallet.fromEntropy(createHash('sha256').update(SIMULATED_PAYER_SALT).digest().subarray(0, 16), { algorithm: 'ed25519' as ECDSA }) // type-only: Node 22's ESM loader can't see xrpl's CJS re-export of the enum
/** The simulated rail's ledger clock (one "ledger" per 4 s), so LastLedgerSequence expiry works the same offline. */
export const simulatedLedgerIndex = (now = Date.now()) => Math.floor(now / 4000)

/**
 * Signs an XRP Payment from `wallet` (the publisher's refund, D5). With a ledger: live Sequence and a
 * capped fee, LastLedgerSequence = current + 20. Without one (SIMULATED rail): no network, the simulated
 * ledger clock. The caller persists the blob write-once before submitting it.
 */
export async function signPayment(wallet: Wallet, payment: { Destination: string; Amount: string; InvoiceID: string }, ledger?: Ledger): Promise<{ txHash: string; txBlob: string; lastLedgerSequence: number }> {
  let fields = { Sequence: 1, Fee: '12', LastLedgerSequence: simulatedLedgerIndex() + 20 }
  if (ledger) {
    const [info, current, fee] = await Promise.all([
      ledger.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'current' }),
      ledger.request({ command: 'ledger_current' }),
      ledger.request({ command: 'fee' }),
    ])
    fields = { Sequence: Number(info.result.account_data.Sequence), Fee: String(Math.min(2000, Math.max(12, Number(fee.result.drops?.open_ledger_fee ?? 12)))), LastLedgerSequence: Number(current.result.ledger_current_index) + 20 }
  }
  const signed = wallet.sign({ TransactionType: 'Payment', Account: wallet.classicAddress, ...payment, ...fields })
  return { txHash: signed.hash.toUpperCase(), txBlob: signed.tx_blob, lastLedgerSequence: fields.LastLedgerSequence }
}
