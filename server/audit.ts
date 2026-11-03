// Tamper-evident operator ledger (#288). Every authorisation or refusal of money movement is one row in
// `audit_log`, hash-chained to the row before it and written inside the same SQLite transaction as the state
// change it describes (Store.atomic), so a spend cannot exist without its audit row and the reverse.
// Never put premium bytes, seeds, tokens, signed blobs or the question text in an entry: assertSafe() rejects them.
import { createHash, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { DROPS_PER_MINOR, PurchaseIntentSchema, ReceiptSchema, XRPL_EXPLORER, XRPL_LABEL, type PurchaseIntent, type Receipt } from '../shared/contracts/index.js'
import { lookupTx, verifyPayment, type Ledger } from '../shared/xrpl.js'
import { ledgerInvoiceId } from '../shared/x402.js'

export const GENESIS_HASH = '0'.repeat(64)
export const AUDIT_KINDS = ['baseline', 'policy', 'admission', 'decision', 'reserve', 'sign', 'settle', 'deliver', 'proof', 'challenge', 'refund', 'refusal', 'pause', 'prune', 'inbound', 'payout-reserve', 'payout-sign', 'payout-settle'] as const
export type AuditKind = typeof AUDIT_KINDS[number] | (string & {})
export type AuditEntry = { seq: number; at: string; prevHash: string; hash: string; runId: string | null; intentId: string | null; surface: string; principal: string; kind: string; data: Record<string, unknown> }
export type AuditInput = { kind: AuditKind; data: Record<string, unknown>; runId?: string; intentId?: string; surface?: string; principal?: string; at?: string }

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
/** Key-sorted JSON: the stored text is what is hashed, so verification never depends on key order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
const entryHash = (seq: number, at: string, prev: string, runId: string | null, intentId: string | null, surface: string, principal: string, kind: string, data: string) =>
  sha256(JSON.stringify([seq, at, prev, runId, intentId, surface, principal, kind, data]))

const FORBIDDEN_KEYS = new Set(['body', 'spans', 'contents', 'content', 'passages', 'bytes', 'token', 'deliverytoken', 'seed', 'secret', 'privatekey', 'apikey', 'authorization', 'txblob', 'signedtxblob', 'blob', 'question', 'salt', 'salts'])
const SEED_LIKE = /(?:^|[^A-Za-z0-9])(?:sEd[1-9A-HJ-NP-Za-km-z]{20,}|s[1-9A-HJ-NP-Za-km-z]{25,33})(?:$|[^A-Za-z0-9])|Bearer\s+\S+/
/** Fail closed: an entry that could carry a secret, premium bytes or the question is never written (the state change rolls back). */
export function assertSafe(value: unknown, path = 'data'): void {
  if (Array.isArray(value)) { value.forEach((v, i) => assertSafe(v, `${path}[${i}]`)); return }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error(`Audit entries cannot carry "${key}" (${path})`)
      assertSafe(child, `${path}.${key}`)
    }
    return
  }
  if (typeof value === 'string' && (value.length > 600 || SEED_LIKE.test(value))) throw new Error(`Audit entry value at ${path} looks like a secret or a payload`)
}

type Row = Record<string, unknown>
const hasTable = (db: DatabaseSync, name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
const toEntry = (row: Row): AuditEntry => ({ seq: Number(row.seq), at: String(row.at), prevHash: String(row.prev_hash), hash: String(row.hash), runId: (row.run_id as string | null) ?? null,
  intentId: (row.intent_id as string | null) ?? null, surface: String(row.surface), principal: String(row.principal), kind: String(row.kind), data: JSON.parse(String(row.data)) as Record<string, unknown> })

export class AuditLog {
  /** Append-only is also enforced by SQLite itself; a tamperer must drop the triggers first, and verify still catches the edit. */
  static ensureSchema(db: DatabaseSync): void {
    db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL UNIQUE,
        run_id TEXT, intent_id TEXT, surface TEXT NOT NULL, principal TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_log_run ON audit_log(run_id);
      CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
      CREATE TABLE IF NOT EXISTS audit_salts (run_id TEXT PRIMARY KEY, salt TEXT NOT NULL);`)
  }
  constructor(private readonly db: DatabaseSync) {}
  /** The caller owns the transaction (BEGIN IMMEDIATE serialises writers, so seq and prev_hash cannot race). */
  append(input: AuditInput): AuditEntry {
    assertSafe(input.data)
    const last = this.db.prepare('SELECT seq, hash FROM audit_log ORDER BY seq DESC LIMIT 1').get() as { seq: number; hash: string } | undefined
    const seq = (last?.seq ?? 0) + 1, prev = last?.hash ?? GENESIS_HASH
    const admitted = input.runId ? this.db.prepare('SELECT surface, principal FROM admissions WHERE run_id=?').get(input.runId) as { surface: string; principal: string } | undefined : undefined
    const surface = input.surface ?? admitted?.surface ?? (input.runId ? 'unattributed' : 'system')
    const principal = input.principal ?? admitted?.principal ?? (input.runId ? 'unattributed' : 'system')
    const at = input.at ?? new Date().toISOString(), data = canonical(input.data)
    const hash = entryHash(seq, at, prev, input.runId ?? null, input.intentId ?? null, surface, principal, input.kind, data)
    this.db.prepare('INSERT INTO audit_log (seq, at, prev_hash, hash, run_id, intent_id, surface, principal, kind, data) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(seq, at, prev, hash, input.runId ?? null, input.intentId ?? null, surface, principal, input.kind, data)
    return { seq, at, prevHash: prev, hash, runId: input.runId ?? null, intentId: input.intentId ?? null, surface, principal, kind: input.kind, data: JSON.parse(data) }
  }
  /** A per-run salted hash of the question: provable while the salt exists, unlinkable after data:prune deletes it. */
  questionCommitment(runId: string, question: string): string {
    const salt = randomBytes(16).toString('hex')
    this.db.prepare('INSERT OR IGNORE INTO audit_salts VALUES (?,?)').run(runId, salt)
    const stored = this.db.prepare('SELECT salt FROM audit_salts WHERE run_id=?').get(runId) as { salt: string }
    return sha256(`${stored.salt}\0${question}`)
  }
  /** First start: pin what existed before the log did, so an upgraded database verifies without inventing history. */
  boot(policy: Record<string, unknown> | undefined): void {
    if (!this.db.prepare('SELECT 1 FROM audit_log LIMIT 1').get()) {
      const ids = (this.db.prepare('SELECT id FROM intents ORDER BY rowid').all() as { id: string }[]).map(row => row.id)
      if (hasTable(this.db, 'policy_payments')) ids.push(...(this.db.prepare('SELECT id FROM policy_payments ORDER BY id').all() as { id: string }[]).map(row => row.id))
      if (hasTable(this.db, 'x402_settlements')) ids.push(...(this.db.prepare('SELECT tx_hash FROM x402_settlements ORDER BY tx_hash').all() as { tx_hash: string }[]).map(row => row.tx_hash))
      this.append({ kind: 'baseline', data: { note: 'Intents that existed before the audit log; their history is not covered.', preexistingIntentIds: ids } })
    }
    if (!policy) return
    const last = this.db.prepare("SELECT data FROM audit_log WHERE kind='policy' ORDER BY seq DESC LIMIT 1").get() as { data: string } | undefined
    if (last?.data !== canonical(policy)) this.append({ kind: 'policy', data: policy, principal: 'boot' })
  }
}

export type ChainResult = { ok: boolean; entries: number; head: { seq: number; hash: string } | null; failures: { seq?: number; reason: string }[]; coverage: { receipts: number; signed: number; refunds: number; payouts: number; inbound: number } }

/** Recompute the chain and cross-check it against the money tables. Read-only. `expectHead` pins the tip to defeat tail truncation. */
export function verifyChain(db: DatabaseSync, options: { expectHead?: string } = {}): ChainResult {
  const failures: ChainResult['failures'] = []
  const result: ChainResult = { ok: false, entries: 0, head: null, failures, coverage: { receipts: 0, signed: 0, refunds: 0, payouts: 0, inbound: 0 } }
  if (!hasTable(db, 'audit_log')) { failures.push({ reason: 'audit_log table is missing (a database from before #288: open it once with this version, e.g. `npm run data:prune -- --dry-run`, to pin its baseline)' }); return result }
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY seq').all() as Row[]
  const entries: AuditEntry[] = []
  let prev = GENESIS_HASH
  for (const [index, row] of rows.entries()) {
    const seq = Number(row.seq)
    const fail = (reason: string) => { failures.push({ seq, reason }) }
    if (seq !== index + 1) { fail(`sequence is not contiguous: expected ${index + 1}, found ${seq} (row deleted or reordered)`); break }
    if (row.prev_hash !== prev) { fail('prev_hash does not match the previous entry (row deleted, inserted or reordered)'); break }
    let ok = true
    try { JSON.parse(String(row.data)) } catch { ok = false }
    if (!ok || entryHash(seq, String(row.at), prev, (row.run_id as string | null) ?? null, (row.intent_id as string | null) ?? null, String(row.surface), String(row.principal), String(row.kind), String(row.data)) !== row.hash) { fail('hash does not match the entry contents (row edited)'); break }
    prev = String(row.hash)
    entries.push(toEntry(row))
  }
  result.entries = entries.length
  if (entries.length) result.head = { seq: entries.at(-1)!.seq, hash: entries.at(-1)!.hash }
  if (!failures.length) {
    const counter = db.prepare("SELECT seq FROM sqlite_sequence WHERE name='audit_log'").get() as { seq: number } | undefined
    if (entries.length && Number(counter?.seq ?? 0) !== entries.at(-1)!.seq) failures.push({ seq: entries.at(-1)!.seq, reason: `entries after seq ${entries.at(-1)!.seq} were removed (the counter reached ${counter?.seq})` })
    if (options.expectHead) {
      const want = options.expectHead.trim().toLowerCase().replace(/^#?\d+[:@]/, '')
      if (result.head?.hash !== want) failures.push({ reason: `chain head ${result.head?.hash ?? 'none'} is not the expected ${want} (tail truncated or rewritten)` })
    }
    checkCoverage(db, entries, result)
  }
  result.ok = failures.length === 0
  return result
}

/** The log must account for the money tables: every receipt, signed payment and refund has its entry, with matching figures. */
function checkCoverage(db: DatabaseSync, entries: AuditEntry[], result: ChainResult): void {
  const baseline = new Set(entries.filter(e => e.kind === 'baseline').flatMap(e => (e.data.preexistingIntentIds as string[] | undefined) ?? []))
  const by = (kind: string) => new Map(entries.filter(e => e.kind === kind && e.intentId).map(e => [e.intentId!, e]))
  const settles = by('settle'), signs = by('sign'), refunds = by('refund')
  const flag = (reason: string, seq?: number) => result.failures.push({ ...(seq ? { seq } : {}), reason })
  for (const row of db.prepare('SELECT r.json AS receipt, i.json AS intent FROM receipts r JOIN intents i ON i.id=r.intent_id ORDER BY r.rowid').all() as Row[]) {
    const receipt = ReceiptSchema.parse(JSON.parse(String(row.receipt))), intent = PurchaseIntentSchema.parse(JSON.parse(String(row.intent)))
    if (baseline.has(receipt.intentId)) continue
    result.coverage.receipts++
    const entry = settles.get(receipt.intentId)
    if (!entry) { flag(`receipt for intent ${receipt.intentId} has no settle entry`); continue }
    const txHash = receipt.xrpl?.txHash ?? intent.txHash
    if (entry.data.txHash !== txHash || entry.data.amountMinor !== receipt.amountMinor || entry.data.payTo !== (intent.quote?.payment?.payTo ?? null)) flag(`receipt for intent ${receipt.intentId} differs from its settle entry (tx, amount or payee)`, entry.seq)
  }
  for (const row of db.prepare('SELECT intent_id, tx_hash FROM submissions').all() as Row[]) {
    const id = String(row.intent_id)
    if (baseline.has(id)) continue
    result.coverage.signed++
    const entry = signs.get(id)
    if (!entry) flag(`signed payment for intent ${id} has no sign entry`)
    else if (entry.data.txHash !== row.tx_hash) flag(`signed payment for intent ${id} differs from its sign entry`, entry.seq)
  }
  // Hire-the-agent (#274): outbound royalty and change payments, and every inbound payment that was settled.
  if (hasTable(db, 'policy_payments')) {
    const payoutSigns = by('payout-sign'), payoutSettles = by('payout-settle')
    for (const row of db.prepare('SELECT json FROM policy_payments ORDER BY id').all() as Row[]) {
      const payment = JSON.parse(String(row.json)) as { id: string; payTo: string; amountDrops: string; submission?: { txHash: string }; confirmedAt?: string }
      if (baseline.has(payment.id) || !payment.submission) continue
      result.coverage.payouts++
      const sign = payoutSigns.get(payment.id), settle = payoutSettles.get(payment.id)
      if (!sign) flag(`payout ${payment.id} was signed but has no payout-sign entry`)
      else if (sign.data.txHash !== payment.submission.txHash || sign.data.payTo !== payment.payTo || sign.data.amountDrops !== payment.amountDrops) flag(`payout ${payment.id} differs from its payout-sign entry (tx, payee or amount)`, sign.seq)
      if (payment.confirmedAt && !settle) flag(`payout ${payment.id} is confirmed but has no payout-settle entry`)
    }
  }
  if (hasTable(db, 'x402_settlements')) {
    const inbound = new Set(entries.filter(e => e.kind === 'inbound').map(e => String(e.data.txHash)))
    for (const row of db.prepare('SELECT tx_hash FROM x402_settlements ORDER BY tx_hash').all() as Row[]) {
      const tx = String(row.tx_hash)
      if (baseline.has(tx)) continue
      result.coverage.inbound++
      if (!inbound.has(tx)) flag(`inbound payment ${tx} was settled but has no inbound entry (replaying the same request writes it)`)
    }
  }
  for (const row of db.prepare('SELECT json FROM intents').all() as Row[]) {
    const intent = PurchaseIntentSchema.parse(JSON.parse(String(row.json)))
    if (!intent.refund || baseline.has(intent.intentId)) continue
    result.coverage.refunds++
    const entry = refunds.get(intent.intentId)
    if (!entry) flag(`refund for intent ${intent.intentId} has no refund entry`)
    else if (entry.data.txHash !== intent.refund.txHash || entry.data.amountMinor !== intent.refund.amountMinor) flag(`refund for intent ${intent.intentId} differs from its refund entry`, entry.seq)
  }
}

export type DateRange = { from?: string; to?: string }
/** `to` as a bare date is inclusive of that whole day. */
export function parseRange(range: DateRange): { from?: number; to?: number } {
  const parse = (value: string | undefined, end: boolean) => {
    if (!value) return undefined
    const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : value)
    if (!Number.isFinite(time)) throw new Error(`Invalid date "${value}"; use YYYY-MM-DD or an ISO timestamp`)
    return time
  }
  return { from: parse(range.from, false), to: parse(range.to, true) }
}
const inRange = (iso: string, range: { from?: number; to?: number }) => { const t = Date.parse(iso); return (range.from === undefined || t >= range.from) && (range.to === undefined || t <= range.to) }

export function auditEntries(db: DatabaseSync, range: DateRange = {}): AuditEntry[] {
  if (!hasTable(db, 'audit_log')) return []
  const bounds = parseRange(range)
  return (db.prepare('SELECT * FROM audit_log ORDER BY seq').all() as Row[]).map(toEntry).filter(e => inRange(e.at, bounds))
}

/** `purchase` = the operator paid a writer for an article; `inbound`, `royalty` and `change` are the hire-the-agent flow (#274). */
export type ReceiptRow = {
  kind: 'purchase' | 'inbound' | 'royalty' | 'change'; label: string; network: string; runId: string; intentId: string; surface: string; principal: string; policyVersion: string; writer: string; resourceId: string; version: string
  payee: string; payer: string; amountMinor: number | ''; currency: string; amountDrops: string; txHash: string; invoiceId: string; ledgerIndex: number | ''; explorerUrl: string
  status: string; refundTxHash: string; refundAmountMinor: number | ''; refundExplorerUrl: string; reservedAt: string; settledAt: string
}
export const RECEIPT_COLUMNS: (keyof ReceiptRow)[] = ['kind', 'label', 'network', 'runId', 'intentId', 'surface', 'principal', 'policyVersion', 'writer', 'resourceId', 'version', 'payee', 'payer', 'amountMinor', 'currency', 'amountDrops', 'txHash', 'invoiceId', 'ledgerIndex', 'explorerUrl', 'status', 'refundTxHash', 'refundAmountMinor', 'refundExplorerUrl', 'reservedAt', 'settledAt']
const explorer = (tx: string) => `${XRPL_EXPLORER}/${tx}`

/**
 * One row per charge (a receipt exists), straight from the money tables, plus one row per hire-the-agent inbound
 * payment (from its audit entry) and per signed royalty or change payout. Every row says which rail it was on.
 */
export function receiptRows(db: DatabaseSync, range: DateRange = {}): ReceiptRow[] {
  const bounds = parseRange(range)
  const admissions = new Map((db.prepare('SELECT run_id, surface, principal, policy_version FROM admissions').all() as Row[]).map(r => [String(r.run_id), r]))
  const purchases = (db.prepare('SELECT r.json AS receipt, i.json AS intent FROM receipts r JOIN intents i ON i.id=r.intent_id ORDER BY r.rowid').all() as Row[]).flatMap(row => {
    const receipt: Receipt = ReceiptSchema.parse(JSON.parse(String(row.receipt))), intent: PurchaseIntent = PurchaseIntentSchema.parse(JSON.parse(String(row.intent)))
    if (!inRange(receipt.settledAt, bounds)) return []
    const admission = admissions.get(receipt.runId), terms = intent.quote?.payment
    const testnet = receipt.label === XRPL_LABEL
    const txHash = receipt.xrpl?.txHash ?? intent.txHash ?? ''
    return [{
      kind: 'purchase', label: receipt.label, network: testnet ? 'XRPL Testnet (xrpl:1), no real value' : 'SIMULATED rail, no real funds', runId: receipt.runId, intentId: receipt.intentId,
      surface: String(admission?.surface ?? 'unattributed'), principal: String(admission?.principal ?? 'unattributed'), policyVersion: String(admission?.policy_version ?? ''),
      writer: intent.profileId, resourceId: receipt.resourceId, version: receipt.version, payee: receipt.xrpl?.payTo ?? terms?.payTo ?? '', payer: receipt.xrpl?.payer ?? '',
      amountMinor: receipt.amountMinor, currency: receipt.currency, amountDrops: receipt.xrpl?.amountDrops ?? terms?.amountDrops ?? String(receipt.amountMinor * DROPS_PER_MINOR),
      txHash, invoiceId: terms?.invoiceId ?? '', ledgerIndex: receipt.xrpl?.ledgerIndex ?? '', explorerUrl: testnet && txHash ? explorer(txHash) : '', status: intent.status,
      refundTxHash: intent.refund?.txHash ?? '', refundAmountMinor: intent.refund?.amountMinor ?? '', refundExplorerUrl: intent.refund && testnet ? explorer(intent.refund.txHash) : '',
      reservedAt: intent.createdAt ?? '', settledAt: receipt.settledAt,
    } satisfies ReceiptRow]
  })
  const hire = (kind: ReceiptRow['kind'], runId: string, intentId: string, f: Partial<ReceiptRow>): ReceiptRow[] => {
    const admission = admissions.get(runId)
    const row: ReceiptRow = { kind, label: XRPL_LABEL, network: 'XRPL Testnet (xrpl:1), no real value', runId, intentId, surface: String(admission?.surface ?? 'unattributed'), principal: String(admission?.principal ?? 'unattributed'),
      policyVersion: String(admission?.policy_version ?? ''), writer: '', resourceId: '', version: '', payee: '', payer: '', amountMinor: '', currency: 'SGD', amountDrops: '0', txHash: '', invoiceId: '', ledgerIndex: '', explorerUrl: '',
      status: '', refundTxHash: '', refundAmountMinor: '', refundExplorerUrl: '', reservedAt: '', settledAt: '', ...f }
    return inRange(row.settledAt, bounds) ? [row] : []
  }
  const inbound = auditEntries(db).filter(e => e.kind === 'inbound' && e.runId).flatMap(e => hire('inbound', e.runId!, String(e.data.txHash), {
    payee: String(e.data.payTo), payer: String(e.data.payer), amountDrops: String(e.data.amountDrops), amountMinor: Number(e.data.amountDrops) / DROPS_PER_MINOR, txHash: String(e.data.txHash),
    invoiceId: String(e.data.invoiceId), ledgerIndex: typeof e.data.ledgerIndex === 'number' ? e.data.ledgerIndex : '', explorerUrl: explorer(String(e.data.txHash)), status: 'SETTLED', settledAt: String(e.data.settledAt ?? e.at) }))
  const payouts = !hasTable(db, 'policy_payments') ? [] : (db.prepare('SELECT run_id, json FROM policy_payments ORDER BY run_id, id').all() as Row[]).flatMap(row => {
    const p = JSON.parse(String(row.json)) as { id: string; kind: 'royalty' | 'change'; payTo: string; amountDrops: string; submission?: { txHash: string }; confirmedAt?: string; ledgerIndex?: number }
    if (!p.submission) return []
    return hire(p.kind, String(row.run_id), p.id, { writer: p.kind === 'royalty' ? p.id.split(':royalty:')[1] ?? '' : '', payee: p.payTo, amountDrops: p.amountDrops, amountMinor: '',
      txHash: p.submission.txHash, invoiceId: ledgerInvoiceId(p.id), ledgerIndex: p.ledgerIndex ?? '', explorerUrl: explorer(p.submission.txHash), status: p.confirmedAt ? 'CONFIRMED' : 'SIGNED_UNCONFIRMED', settledAt: p.confirmedAt ?? '' })
  })
  return [...purchases, ...inbound, ...payouts]
}

/** RFC 4180 quoting, plus a leading apostrophe on cells a spreadsheet would execute (writer-controlled text is untrusted). */
const cell = (value: unknown) => {
  let text = value === undefined || value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
export const toCsv = (rows: ReceiptRow[]) => [RECEIPT_COLUMNS.join(','), ...rows.map(row => RECEIPT_COLUMNS.map(column => cell(row[column])).join(','))].join('\r\n') + '\r\n'
export const toJsonl = (rows: object[]) => rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')

export type TestnetCheck = { intentId: string; txHash: string; kind: 'payment' | 'refund'; status: 'ok' | 'mismatch' | 'pending' | 'error' | 'skipped'; detail: string }
/** Read-only lookups against a public Testnet node: destination, delivered amount and InvoiceID of each payment, and each refund. Spends nothing. */
export async function verifyOnTestnet(rows: ReceiptRow[], ledger: Ledger): Promise<TestnetCheck[]> {
  const check = async (row: ReceiptRow): Promise<TestnetCheck[]> => {
    if (row.label !== XRPL_LABEL) return [{ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'skipped', detail: 'SIMULATED rail: there is no ledger transaction to check' }]
    const out: TestnetCheck[] = []
    try {
      const paid = await verifyPayment(ledger, row.txHash, { rail: 'xrpl-testnet', network: 'xrpl:1', asset: 'XRP', payTo: row.payee, amountDrops: row.amountDrops, invoiceId: row.invoiceId })
      if (paid.state === 'pending') out.push({ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'pending', detail: 'not found as a validated transaction on this node' })
      else if (paid.state === 'invalid') out.push({ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'mismatch', detail: paid.reason })
      else if (row.payer && paid.proof.payer !== row.payer) out.push({ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'mismatch', detail: 'sender differs from the receipt payer' })
      else if (row.ledgerIndex !== '' && paid.proof.ledgerIndex !== row.ledgerIndex) out.push({ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'mismatch', detail: `validated in ledger ${paid.proof.ledgerIndex}, receipt says ${row.ledgerIndex}` })
      else out.push({ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'ok', detail: `ledger ${paid.proof.ledgerIndex} · ${row.amountDrops} drops → ${row.payee}` })
    } catch (error) { out.push({ intentId: row.intentId, txHash: row.txHash, kind: 'payment', status: 'error', detail: `lookup failed: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}` }) }
    if (row.refundTxHash) {
      const refund = { intentId: row.intentId, txHash: row.refundTxHash, kind: 'refund' as const }
      try {
        const found = await lookupTx(ledger, row.refundTxHash)
        if (found.state !== 'validated') out.push({ ...refund, status: 'pending', detail: 'refund not found as a validated transaction on this node' })
        else {
          const { tx, meta } = found
          const wrong = tx.TransactionType !== 'Payment' ? 'not a Payment' : meta.TransactionResult !== 'tesSUCCESS' ? `ledger result ${String(meta.TransactionResult)}`
            : tx.Account !== row.payee ? 'refund was not sent by the payee' : tx.Destination !== row.payer ? 'refund was not sent to the payer'
              : meta.delivered_amount !== String(Number(row.refundAmountMinor) * DROPS_PER_MINOR) ? 'refund amount differs from the recorded refund'
                : String(tx.InvoiceID ?? '').toUpperCase() !== row.txHash.toUpperCase() ? 'refund InvoiceID is not the original payment hash' : undefined
          out.push(wrong ? { ...refund, status: 'mismatch', detail: wrong } : { ...refund, status: 'ok', detail: `ledger ${found.ledgerIndex} · ${row.refundAmountMinor} minor back to ${row.payer}` })
        }
      } catch (error) { out.push({ ...refund, status: 'error', detail: `lookup failed: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}` }) }
    }
    return out
  }
  const results: TestnetCheck[][] = []
  for (let i = 0; i < rows.length; i += 4) results.push(...await Promise.all(rows.slice(i, i + 4).map(check)))
  return results.flat()
}
