// "Check the key yourself": sha256(key) = lock, from the public XRPL Testnet ledger, in the visitor's browser.
// Everything here comes from two public transactions: the EscrowCreate holds the lock (Condition =
// A0258020 ‖ sha256(key) ‖ 810120) and the EscrowFinish the writer signed publishes the key (Fulfillment =
// A0228020 ‖ key). The hash is computed with WebCrypto. Nothing from our server is trusted, nothing is signed or
// submitted, and there is no server route behind this: the browser asks the same read-only public nodes as the
// "Verify on XRPL" button. The verifier chunk is only imported when the button is pressed.

export type ReadOnlyLedger = {
  request(request: { command: 'tx'; transaction: string; binary: false }): Promise<{ result: Record<string, unknown> }>
  close?(): void
  endpoint?(): string
}
/** Opens a read-only lookup against one public node (a test hands in a recorded ledger instead). */
export type LedgerFor = (endpoint: string) => ReadOnlyLedger | Promise<ReadOnlyLedger>

export type KeyCheck =
  | { status: 'match'; lock: string; key: string; ledger?: number; node?: string }
  /** `key`: the published key hashes to something else · `lock`: the finish names another lock · `escrow`: the two
   *  transactions are not the same escrow · `failed`: a transaction did not succeed on the ledger. */
  | { status: 'mismatch'; why: 'key' | 'lock' | 'escrow' | 'failed'; lock?: string; key?: string; ledger?: number; node?: string }
  /** Not an error: the node has not got (or has not finalised) a transaction yet. */
  | { status: 'pending'; why: 'not-found' | 'not-validated' }
  | { status: 'unreachable' }
  | { status: 'unreadable' }

const HASH = /^[A-Fa-f0-9]{64}$/
const CONDITION = /^A0258020([0-9A-F]{64})810120$/i
const FULFILLMENT = /^A0228020([0-9A-F]{64})$/i
const upper = (value: string) => value.toUpperCase()

/** First and last 8 hex characters; the full value sits behind the explorer link. */
export { shortTx as shortHex } from '../../shared/presentation'

async function sha256Hex(hex: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('WebCrypto unavailable')
  const bytes = Uint8Array.from(hex.match(/../g)!.map(pair => parseInt(pair, 16)))
  return [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

type Seen = { tx: Record<string, unknown>; validated: boolean; ledger?: number; success?: boolean; node?: string }
/** `tx` answers either flat (API v1) or with `tx_json` (v2); both are read the same way. */
function parse(result: Record<string, unknown>, node?: string): Seen {
  const tx = (result.tx_json && typeof result.tx_json === 'object' ? result.tx_json : result) as Record<string, unknown>
  const meta = result.meta && typeof result.meta === 'object' ? result.meta as Record<string, unknown> : undefined
  const index = Number(result.ledger_index ?? result.inLedger)
  return { tx, validated: result.validated === true, ledger: Number.isInteger(index) && index > 0 ? index : undefined, success: typeof meta?.TransactionResult === 'string' ? meta.TransactionResult === 'tesSUCCESS' : undefined, node }
}

/**
 * The check itself, on two already-fetched transactions. A tampered key, a different lock or a different escrow
 * is a mismatch and never a ✓.
 */
export async function compareKey(createResult: Record<string, unknown>, finishResult: Record<string, unknown>): Promise<KeyCheck> {
  return decide(parse(createResult), parse(finishResult))
}
async function decide(create: Seen, finish: Seen): Promise<KeyCheck> {
  const at = { ledger: finish.ledger, node: finish.node }
  if (!create.validated || !finish.validated) return { status: 'pending', why: 'not-validated' }
  if (create.tx.TransactionType !== 'EscrowCreate' || finish.tx.TransactionType !== 'EscrowFinish') return { status: 'mismatch', why: 'escrow', ...at }
  if (create.success === undefined || finish.success === undefined || !create.ledger || !finish.ledger) return { status: 'unreadable' }
  if (!create.success || !finish.success) return { status: 'mismatch', why: 'failed', ...at }
  // The finish names the escrow it releases by its owner and the sequence of the create.
  if (typeof create.tx.Account !== 'string' || !create.tx.Account || typeof finish.tx.Owner !== 'string' ||
      !Number.isSafeInteger(create.tx.Sequence) || !Number.isSafeInteger(finish.tx.OfferSequence) ||
      typeof finish.tx.Condition !== 'string') return { status: 'unreadable' }
  if (finish.tx.Owner !== create.tx.Account || finish.tx.OfferSequence !== create.tx.Sequence) return { status: 'mismatch', why: 'escrow', ...at }
  const lock = typeof create.tx.Condition === 'string' ? CONDITION.exec(create.tx.Condition)?.[1] : undefined
  const key = typeof finish.tx.Fulfillment === 'string' ? FULFILLMENT.exec(finish.tx.Fulfillment)?.[1] : undefined
  if (!lock || !key) return { status: 'unreadable' }
  if (typeof finish.tx.Condition === 'string' && upper(finish.tx.Condition) !== upper(create.tx.Condition as string)) return { status: 'mismatch', why: 'lock', lock: upper(lock), key: upper(key), ...at }
  let digest: string
  try { digest = await sha256Hex(key) } catch { return { status: 'unreadable' } }
  return digest === upper(lock) ? { status: 'match', lock: upper(lock), key: upper(key), ...at } : { status: 'mismatch', why: 'key', lock: upper(lock), key: upper(key), ...at }
}

const notFound = (error: unknown) => (error as { data?: { error?: string } } | undefined)?.data?.error === 'txnNotFound'

/** The browser verifier's own public Testnet nodes, one read-only lookup at a time. Loaded only when needed. */
async function publicLedger(): Promise<{ endpoints: readonly string[]; ledgerFor: LedgerFor }> {
  const { LEDGER_ENDPOINTS, browserLedger } = await import('./browser')
  return { endpoints: LEDGER_ENDPOINTS, ledgerFor: endpoint => browserLedger([endpoint]) }
}

/**
 * Fetches the EscrowCreate and the EscrowFinish by hash from the public Testnet nodes and compares them. A node that
 * has not got a transaction yet is a pending state (never a failure): the next public node is asked, and a missing
 * transaction on every node reads "not found yet". With no reachable node nothing is claimed.
 */
export async function verifyKeyOnLedger(hashes: { create: string; finish: string }, options: { endpoints?: readonly string[]; ledgerFor?: LedgerFor } = {}): Promise<KeyCheck> {
  if (!HASH.test(hashes.create) || !HASH.test(hashes.finish)) return { status: 'unreadable' }
  let endpoints = options.endpoints, ledgerFor = options.ledgerFor
  if (!endpoints || !ledgerFor) {
    try { const pub = await publicLedger(); endpoints ??= pub.endpoints; ledgerFor ??= pub.ledgerFor } catch { return { status: 'unreachable' } }
  }
  const found: { create?: Seen; finish?: Seen } = {}
  let reachable = false
  for (const endpoint of endpoints) {
    let ledger: ReadOnlyLedger
    try { ledger = await ledgerFor(endpoint) } catch { continue }
    try {
      const wanted = (['create', 'finish'] as const).filter(name => !found[name])
      const settled = await Promise.allSettled(wanted.map(name => ledger.request({ command: 'tx', transaction: hashes[name], binary: false })))
      settled.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') { reachable = true; found[wanted[index]] = parse(outcome.value.result, ledger.endpoint?.() || endpoint) }
        else if (notFound(outcome.reason)) reachable = true
      })
    } finally { ledger.close?.() }
    if (found.create && found.finish) break
  }
  if (found.create && found.finish) return decide(found.create, found.finish)
  return reachable ? { status: 'pending', why: 'not-found' } : { status: 'unreachable' }
}
