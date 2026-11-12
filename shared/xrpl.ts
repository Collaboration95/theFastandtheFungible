// XRPL Testnet access shared by the publisher (verifies payments) and the api (pays).
// Runtime code: import by path, never from shared/contracts/index (the browser bundle).
import { matchesAmount } from './contracts/asset.js'
import { createHash } from 'node:crypto'
import { Client, Wallet, decode, type ECDSA } from 'xrpl'
import type { LedgerProof, PaymentRequirement } from './contracts/publisher.js'

/** The subset of xrpl.Client the rail uses; tests inject a fake ledger. */
export type Ledger = {
  streamActive?: () => boolean
  activity?: (listener: () => void, hash?: string) => () => void
  cachedTx?: (hash: string) => Extract<TxLookup, { state: 'validated' }> | undefined
  request(request: Record<string, unknown>): Promise<{ result: any }> } // eslint-disable-line @typescript-eslint/no-explicit-any

export const TESTNET_WSS = 'wss://s.altnet.rippletest.net:51233'

/** The rail must never reach Mainnet: only rippletest.net hosts are accepted. */
export function testnetUrl(url = process.env.XRPL_RPC_URL || TESTNET_WSS): string {
  if (!/^wss:\/\/[a-z0-9.-]+\.rippletest\.net(?::\d+)?\/?$/.test(url)) throw new Error('XRPL rail is restricted to the Testnet (*.rippletest.net)')
  return url
}

/** One lazily connected client per process, reconnected after a drop. */
export function testnetLedger(url = testnetUrl()): Ledger & { close(): Promise<void>; diagnostics?(): { subscriptions: number; subscriptionFailures: number; cacheHits: number } } {
  let client: Client | undefined
  const listeners = new Map<() => void, string | undefined>()
  const transactions = new Map<string, Extract<TxLookup, { state: 'validated' }>>()
  const wake = (hash?: string) => { for (const [listener, target] of listeners) if (!hash || !target || target === hash) listener() }
  const streams = process.env.XRPL_STREAM_WAITS === '1'
  let closed = false, subscribed = false
  const diagnostics = { subscriptions: 0, subscriptionFailures: 0, cacheHits: 0 }
  let connecting: Promise<void> | undefined
  return {
    diagnostics: () => ({ ...diagnostics }),
    ...(streams ? {
      streamActive: () => subscribed && !!client?.isConnected(),
      activity(listener: () => void, hash?: string) { listeners.set(listener, hash?.toUpperCase()); return () => { listeners.delete(listener) } },
      cachedTx(hash: string) { const found = transactions.get(hash.toUpperCase()); if (found) diagnostics.cacheHits++; return found },
    } : {}),
    async request(request) {
      // Enforce at the network boundary, before even connecting. Also inspect
      // binary simulate requests so tx_blob cannot bypass the JSON field guard.
      if (request.command === 'simulate') {
        const containsFulfillment = (value: unknown): boolean => !!value && typeof value === 'object' &&
          Object.entries(value).some(([key, child]) => key === 'Fulfillment' || containsFulfillment(key === 'tx_blob' && typeof child === 'string' ? decode(child) : child))
        if (containsFulfillment(request)) throw new Error('Refusing simulate request containing Fulfillment; key must stay private until signed submit')
      }
      if (closed) throw new Error('Ledger connection closed')
      if (!client?.isConnected() || connecting) {
        // Signing asks for account, fee and ledger concurrently. Share the connection
        // attempt, or each request can orphan a WebSocket that close() cannot reach.
        if (!connecting) {
          client = new Client(url)
          if (streams) {
            client.on('transaction', event => {
              const observed = streamTransaction(event)
              if (!observed) return
              if (!transactions.has(observed.hash)) transactions.set(observed.hash, observed.found)
              if (transactions.size > 512) transactions.delete(transactions.keys().next().value!)
              wake(observed.hash)
            })
            client.on('ledgerClosed', () => wake())
            client.on('disconnected', () => { subscribed = false; wake() })
          }
          const socket = client
          connecting = socket.connect().then(async () => {
            if (streams) {
              // A refused subscription keeps the socket usable through the polling fallback.
              try { await socket.request({ command: 'subscribe', streams: ['ledger', 'transactions'] }); subscribed = true; diagnostics.subscriptions++ } catch { diagnostics.subscriptionFailures++ }
            }
          }).finally(() => { connecting = undefined })
        }
        await connecting
      }
      return client!.request(request as never) as never
    },
    async close() { closed = true; wake(); listeners.clear(); transactions.clear(); await connecting?.catch(() => undefined); await client?.disconnect() },
  }
}

export type TxLookup =
  | { state: 'missing' | 'pending' }
  | { state: 'validated'; tx: Record<string, unknown>; meta: Record<string, unknown>; ledgerIndex: number }

/** 'missing' is only "this node did not find it"; callers needing proof of absence check the account Sequence. */
export async function lookupTx(ledger: Ledger, txHash: string): Promise<TxLookup> {
  const cached = ledger.cachedTx?.(txHash)
  if (cached) return cached
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
      : (Number(tx.Flags ?? 0) & 0x20000) !== 0 ? 'partial payments are refused'
      : tx.SendMax !== undefined || tx.Paths !== undefined || tx.DeliverMin !== undefined ? 'cross-currency payments are refused'
      : terms.asset !== 'XRP' && !matchesAmount(tx.Amount ?? tx.DeliverMax, terms.amountDrops, terms.asset) ? 'wrong transaction amount'
      : tx.Destination !== terms.payTo ? 'wrong destination'
        : !matchesAmount(meta.delivered_amount, terms.amountDrops, terms.asset) ? 'wrong delivered amount'
          : String(tx.InvoiceID ?? '').toUpperCase() !== terms.invoiceId ? 'InvoiceID does not match the quote'
            : undefined
  if (reason) return { state: 'invalid', reason }
  return { state: 'ok', proof: { txHash, ledgerIndex: found.ledgerIndex, payer: String(tx.Account), payTo: terms.payTo, amountDrops: terms.amountDrops, asset: terms.asset, deliveredAmount: meta.delivered_amount } }
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
export async function signPayment(wallet: Wallet, payment: { Destination: string; Amount: string | { currency: string; issuer: string; value: string }; InvoiceID: string; SourceTag?: number; DestinationTag?: number }, ledger?: Ledger): Promise<{ txHash: string; txBlob: string; lastLedgerSequence: number }> {
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

/** Normalize rippled API v1/v2 events. Proposed, incomplete or unrelated messages are never proof. */
export function streamTransaction(input: unknown): { hash: string; found: Extract<TxLookup, { state: 'validated' }> } | undefined {
  if (!input || typeof input !== 'object') return
  const event = input as Record<string, unknown>
  const tx = event.tx_json ?? event.transaction
  const meta = event.meta ?? event.metadata
  if (event.validated !== true || !Number.isSafeInteger(event.ledger_index) || Number(event.ledger_index) <= 0 ||
      !tx || typeof tx !== 'object' || !meta || typeof meta !== 'object' || Array.isArray(meta)) return
  const transaction = tx as Record<string, unknown>, metadata = meta as Record<string, unknown>
  const hash = event.hash ?? transaction.hash
  if (typeof hash !== 'string' || !/^[A-F0-9]{64}$/i.test(hash) || typeof metadata.TransactionResult !== 'string') return
  return { hash: hash.toUpperCase(), found: { state: 'validated', tx: transaction, meta: metadata, ledgerIndex: Number(event.ledger_index) } }
}

/** Install before the first read, so an event racing that read cannot be lost. Always dispose. */
export function ledgerWake(ledger: Ledger, fallbackMs: number, hash?: string) {
  let pending = false, waiting: (() => void) | undefined
  const remove = ledger.activity?.(() => { pending = true; waiting?.() }, hash)
  return {
    async wait(remainingMs = fallbackMs) {
      if (pending) { pending = false; return }
      await new Promise<void>(resolve => {
        const timer = setTimeout(done, Math.min(remainingMs, ledger.streamActive?.() ? Math.max(15000, fallbackMs) : fallbackMs))
        function done() { clearTimeout(timer); waiting = undefined; pending = false; resolve() }
        waiting = done
      })
    },
    close() { remove?.(); waiting?.() },
  }
}

/** Read-only wait. Missing streams/disconnects fall back to bounded polling; never submits. */
export async function waitForTx(ledger: Ledger, hash: string, { pollMs = 1000, timeoutMs = 30000 } = {}): Promise<TxLookup> {
  const deadline = Date.now() + timeoutMs, wake = ledgerWake(ledger, Math.min(pollMs, timeoutMs), hash)
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const found = await Promise.race([lookupTx(ledger, hash).catch((): TxLookup => ({ state: 'pending' })), new Promise<TxLookup>(resolve => { timer = setTimeout(() => resolve({ state: 'pending' }), Math.max(1, deadline - Date.now())) })]).finally(() => clearTimeout(timer))
      if (found.state === 'validated' || Date.now() >= deadline) return found
      await wake.wait(Math.max(1, deadline - Date.now()))
    }
  } finally { wake.close() }
}

const autofillReads = new WeakMap<Ledger, Map<string, { at: number; value: ReturnType<Ledger['request']> }>>()
/** Fee/current-index hints can be shared briefly; signed fees remain capped and LLS bounded. */
export function autofillHint(ledger: Ledger, command: 'fee' | 'ledger_current'): ReturnType<Ledger['request']> {
  if (process.env.XRPL_STREAM_WAITS !== '1') return ledger.request({ command })
  let reads = autofillReads.get(ledger)
  if (!reads) { reads = new Map(); autofillReads.set(ledger, reads) }
  const cached = reads.get(command)
  if (cached && Date.now() - cached.at < 750) return cached.value
  const value = ledger.request({ command }).catch(error => { reads!.delete(command); throw error })
  reads.set(command, { at: Date.now(), value })
  return value
}
