import type { Asset } from '../shared/contracts/asset.js'
import type { EscrowQuote } from '../shared/contracts/escrow.js'
import { escrowInvoice } from '../shared/escrow.js'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export class PublisherError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
export function digestBytes(bytes: string): string {
  return createHash('sha256').update(bytes, 'utf8').digest('hex')
}
/** What the publisher asked for in one 402 (#128). `invoiceId` is invoiceIdFor(...); the tx InvoiceID is its sha256. */
export type X402Quote = { invoiceId: string; ledgerInvoiceId: string; quoteId: string; publisherSlug: string; articleId: string; version: string; amount: string; payTo: string; expiresAt: string; asset?: Asset }
export type X402Refund = { originalTxHash: string; intentId: string; txHash: string; txBlob: string }
export type X402Settlement = { txHash: string; ledgerInvoiceId: string; payer: string; ledgerIndex?: number; settledAt: string }

/** Synchronous IMMEDIATE transactions serialize intent creation across connections/processes. */
export class PublisherJournal {
  private readonly db: DatabaseSync
  constructor(readonly path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS x402_bindings (invoice TEXT PRIMARY KEY, hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS key_reveals (invoice TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS escrow_quotes (invoice TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS escrow_grants (tx_hash TEXT PRIMARY KEY, invoice TEXT UNIQUE NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS x402_quotes (ledger_invoice_id TEXT PRIMARY KEY, quote_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS x402_settlements (
        tx_hash TEXT PRIMARY KEY, ledger_invoice_id TEXT UNIQUE NOT NULL REFERENCES x402_quotes(ledger_invoice_id), settlement_json TEXT NOT NULL
      );`)
    // Per-passage manifest salts (#125), generated once per article version and released only with the paid body (#129).
    // One refund per paid tx and per buyer intent (D5, gate 3): the signed blob is stored before it is ever submitted.
    this.db.exec('CREATE TABLE IF NOT EXISTS refunds (original_tx_hash TEXT PRIMARY KEY REFERENCES x402_settlements(tx_hash), intent_id TEXT UNIQUE NOT NULL, tx_hash TEXT UNIQUE NOT NULL, tx_blob TEXT NOT NULL)')
    this.db.exec('CREATE TABLE IF NOT EXISTS salts (article_key TEXT NOT NULL, idx INTEGER NOT NULL, salt TEXT NOT NULL, PRIMARY KEY (article_key, idx))')
  }
  /** The salts for passages 0..count-1 of `articleKey` (articleId@version), created on first use and stable after. */
  salts(articleKey: string, count: number): string[] {
    return this.transaction(() => {
      const insert = this.db.prepare('INSERT OR IGNORE INTO salts (article_key, idx, salt) VALUES (?, ?, ?)')
      for (let i = 0; i < count; i++) insert.run(articleKey, i, randomBytes(16).toString('hex'))
      const rows = this.db.prepare('SELECT salt FROM salts WHERE article_key = ? AND idx < ? ORDER BY idx').all(articleKey, count) as { salt: string }[]
      return rows.map(row => row.salt)
    })
  }
  saveEscrowQuote(q: EscrowQuote) { this.db.prepare('INSERT INTO escrow_quotes VALUES (?,?)').run(escrowInvoice(q.terms), JSON.stringify(q)) }
  escrowQuote(invoice: string): EscrowQuote | undefined {
    const row = this.db.prepare('SELECT json FROM escrow_quotes WHERE invoice=?').get(invoice)
    return row && JSON.parse(String(row.json))
  }
  escrowGrant(hash: string): Record<string, unknown> | undefined {
    const row = this.db.prepare('SELECT json FROM escrow_grants WHERE tx_hash=?').get(hash)
    return row && JSON.parse(String(row.json))
  }
  saveEscrowGrant(hash: string, invoice: string, grant: unknown) {
    this.db.prepare('INSERT OR IGNORE INTO escrow_grants VALUES (?,?,?)').run(hash, invoice, JSON.stringify(grant))
    if (!this.escrowGrant(hash)) throw new PublisherError(409, 'Escrow invoice already locked')
  }
  keyReveal(invoice: string): { secret: string; finish?: import('../server/xrpl.js').Submission } | undefined {
    const row = this.db.prepare('SELECT json FROM key_reveals WHERE invoice=?').get(invoice)
    return row && JSON.parse(String(row.json))
  }
  saveKeyReveal(invoice: string, value: { secret: string; finish?: import('../server/xrpl.js').Submission }) {
    this.db.prepare('INSERT INTO key_reveals VALUES (?,?) ON CONFLICT(invoice) DO UPDATE SET json=excluded.json').run(invoice, JSON.stringify(value))
  }
  close(): void { this.db.close() }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  /** An open x402 quote (#128), keyed by the on-ledger InvoiceID = sha256(invoiceId). */
  saveQuote(quote: X402Quote): void {
    this.db.prepare('INSERT INTO x402_quotes (ledger_invoice_id, quote_json) VALUES (?, ?)').run(quote.ledgerInvoiceId, JSON.stringify(quote))
  }
  quoteByInvoice(ledgerInvoiceId: string): X402Quote | undefined {
    const row = this.db.prepare('SELECT quote_json FROM x402_quotes WHERE ledger_invoice_id = ?').get(ledgerInvoiceId.toUpperCase()) as { quote_json: string } | undefined
    return row ? JSON.parse(row.quote_json) as X402Quote : undefined
  }
  bindPayment(invoice: string, hash: string) {
    return this.transaction(() => {
      this.db.prepare('INSERT OR IGNORE INTO x402_bindings VALUES (?,?)').run(invoice, hash)
      if (this.db.prepare('SELECT hash FROM x402_bindings WHERE invoice=?').get(invoice)?.hash !== hash) throw new PublisherError(409, 'Invoice already bound to another payment')
    })
  }
  settlementByTx(txHash: string): X402Settlement | undefined {
    const row = this.db.prepare('SELECT settlement_json FROM x402_settlements WHERE tx_hash = ?').get(txHash) as { settlement_json: string } | undefined
    return row ? JSON.parse(row.settlement_json) as X402Settlement : undefined
  }
  refundByTx(originalTxHash: string): X402Refund | undefined {
    const row = this.db.prepare('SELECT original_tx_hash, intent_id, tx_hash, tx_blob FROM refunds WHERE original_tx_hash = ?').get(originalTxHash) as Record<string, string> | undefined
    return row && { originalTxHash: row.original_tx_hash, intentId: row.intent_id, txHash: row.tx_hash, txBlob: row.tx_blob }
  }
  /** Write-once: the first stored refund for a payment wins; a later one is never stored or submitted. */
  saveRefund(refund: X402Refund): X402Refund {
    return this.transaction(() => {
      this.db.prepare('INSERT OR IGNORE INTO refunds (original_tx_hash, intent_id, tx_hash, tx_blob) VALUES (?, ?, ?, ?)').run(refund.originalTxHash, refund.intentId, refund.txHash, refund.txBlob)
      const stored = this.refundByTx(refund.originalTxHash)
      if (!stored) throw new PublisherError(409, 'This intent already has a refund for another payment')
      return stored
    })
  }
  /** One settlement per tx hash and per invoice (both UNIQUE): resending a blob returns the first settlement. */
  settle(settlement: X402Settlement): X402Settlement {
    return this.transaction(() => {
      const existing = this.settlementByTx(settlement.txHash)
      if (existing) return existing
      if (this.db.prepare('SELECT 1 FROM x402_settlements WHERE ledger_invoice_id = ?').get(settlement.ledgerInvoiceId)) throw new PublisherError(409, 'This quote is already settled by another payment')
      this.db.prepare('INSERT INTO x402_settlements (tx_hash, ledger_invoice_id, settlement_json) VALUES (?, ?, ?)').run(settlement.txHash, settlement.ledgerInvoiceId, JSON.stringify(settlement))
      return settlement
    })
  }
}
