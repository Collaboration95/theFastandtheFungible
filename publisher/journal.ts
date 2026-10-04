import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { QuoteSchema, SettlementSchema, type Quote, type QuoteRequest, type Settlement } from '../shared/contracts/publisher.js'

export class PublisherError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
export function digestBytes(bytes: string): string {
  return createHash('sha256').update(bytes, 'utf8').digest('hex')
}
type QuoteRow = { quote_json: string; bytes: string }

/** Synchronous IMMEDIATE transactions serialize intent creation across connections/processes. */
export class PublisherJournal {
  private readonly db: DatabaseSync
  constructor(readonly path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS quotes (
        intent_id TEXT PRIMARY KEY, quote_id TEXT UNIQUE NOT NULL,
        quote_json TEXT NOT NULL, bytes TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settlements (
        intent_id TEXT PRIMARY KEY REFERENCES quotes(intent_id),
        token TEXT UNIQUE NOT NULL, settlement_json TEXT NOT NULL
      );`)
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
  private row(intentId: string): QuoteRow | undefined {
    return this.db.prepare('SELECT quote_json, bytes FROM quotes WHERE intent_id = ?').get(intentId) as QuoteRow | undefined
  }
  /** A retry must recover its snapshot even if the corpus has changed or disappeared. */
  existingQuote(request: QuoteRequest): Quote | undefined {
    const row = this.row(request.intentId)
    if (!row) return undefined
    const quote = QuoteSchema.parse(JSON.parse(row.quote_json))
    if (['profileId', 'resourceId', 'version', 'runId', 'intentId'].some(key =>
      quote[key as keyof QuoteRequest] !== request[key as keyof QuoteRequest])) {
      throw new PublisherError(409, 'Intent is bound to a different purchase')
    }
    return quote
  }
  quote(request: QuoteRequest, amountMinor: number, bytes: string): Quote {
    return this.transaction(() => {
      const existing = this.existingQuote(request)
      if (existing) return existing
      const fields = {
        ...request, quoteId: randomUUID(), amountMinor, currency: 'SGD' as const,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), contentDigest: digestBytes(bytes),
      }
      const quote = QuoteSchema.parse({ ...fields, quoteHash: digestBytes(JSON.stringify(fields)) })
      this.db.prepare('INSERT INTO quotes VALUES (?, ?, ?, ?)').run(request.intentId, quote.quoteId, JSON.stringify(quote), bytes)
      return quote
    })
  }
  settle(request: { quoteId: string; quoteHash: string; intentId: string }): Settlement {
    return this.transaction(() => {
      const row = this.row(request.intentId)
      if (!row) throw new PublisherError(404, 'Quote not found')
      const quote = QuoteSchema.parse(JSON.parse(row.quote_json))
      if (quote.quoteId !== request.quoteId || quote.quoteHash !== request.quoteHash) {
        throw new PublisherError(409, 'Quote does not match intent')
      }
      const existing = this.settlement(request.intentId)
      if (existing.status === 'SETTLED') return existing
      if (Date.parse(quote.expiresAt) <= Date.now()) throw new PublisherError(410, 'Quote expired')
      const settlement = SettlementSchema.parse({ status: 'SETTLED', receiptId: randomUUID(), deliveryToken: randomBytes(32).toString('base64url') })
      this.db.prepare('INSERT INTO settlements VALUES (?, ?, ?)').run(request.intentId, settlement.deliveryToken!, JSON.stringify(settlement))
      return settlement
    })
  }
  settlement(intentId: string): Settlement {
    const row = this.db.prepare('SELECT settlement_json FROM settlements WHERE intent_id = ?').get(intentId) as { settlement_json: string } | undefined
    return row ? SettlementSchema.parse(JSON.parse(row.settlement_json)) : { status: 'NOT_FOUND' }
  }
  delivery(token: string, profileId: string, resourceId: string, version: string): { bytes: string; quote: Quote } | undefined {
    const row = this.db.prepare(`SELECT q.quote_json, q.bytes FROM quotes q
      JOIN settlements s ON s.intent_id = q.intent_id WHERE s.token = ?`).get(token) as QuoteRow | undefined
    if (!row) return undefined
    const quote = QuoteSchema.parse(JSON.parse(row.quote_json))
    if (quote.profileId !== profileId || quote.resourceId !== resourceId || quote.version !== version) return undefined
    return { bytes: row.bytes, quote }
  }
}
