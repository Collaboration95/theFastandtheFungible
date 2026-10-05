// XRPL Testnet access shared by the publisher (verifies payments) and the api (pays).
// Runtime code: import by path, never from shared/contracts/index (the browser bundle).
import { Client } from 'xrpl'
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
