import { DatabaseSync } from 'node:sqlite'
import type { X402Quote } from '../../publisher/journal.js'

export type Hire = { key: string; agentId?: string; question: string; budgetMinor: number; quote: X402Quote; signature?: string; runId?: string; writerAddresses?: Record<string, string>; result?: unknown; inboundExpired?: boolean }
/** Durable request binding; a quote can acquire exactly one signed blob before any submission. */
export class HireJournal {
  private db: DatabaseSync
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS hires (key TEXT PRIMARY KEY, json TEXT NOT NULL)')
  }
  close() { this.db.close() }
  get(key: string): Hire | undefined {
    const row = this.db.prepare('SELECT json FROM hires WHERE key=?').get(key)
    return row ? JSON.parse(String(row.json)) : undefined
  }
  /** Only durable admitted work can owe research or payouts; unpaid quotes are not work. */
  due(): Hire[] {
    return this.db.prepare("SELECT json FROM hires WHERE json_extract(json,'$.runId') IS NOT NULL AND json_extract(json,'$.signature') IS NOT NULL AND json_extract(json,'$.result') IS NULL AND NOT coalesce(json_extract(json,'$.inboundExpired'),0) ORDER BY rowid").all().map(row => JSON.parse(String(row.json)))
  }
  save(hire: Hire): Hire {
    this.db.prepare('INSERT OR IGNORE INTO hires VALUES (?,?)').run(hire.key, JSON.stringify(hire))
    return this.get(hire.key)!
  }
  patch(key: string, patch: Partial<Hire>) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const old = this.get(key)!
      if (old.signature && patch.signature && old.signature !== patch.signature) throw new Error('Invoice already bound to a payment; resend the original signature')
      const next = { ...old, ...patch, writerAddresses: old.writerAddresses ?? patch.writerAddresses }
      this.db.prepare('UPDATE hires SET json=? WHERE key=?').run(JSON.stringify(next), key)
      this.db.exec('COMMIT')
      return next
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
}
