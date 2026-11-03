import { DatabaseSync } from 'node:sqlite'
import type { PaymentAttempt, PaymentJournal } from './x402.js'
/** Private local state: contains signed payment blobs, never seeds. Reuse across process restarts. */
export function openPaymentJournal(path: string): PaymentJournal & { close(): void } {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS x402_attempts (key TEXT PRIMARY KEY, json TEXT NOT NULL)')
  const load = (key: string): PaymentAttempt | undefined => {
    const row = db.prepare('SELECT json FROM x402_attempts WHERE key=?').get(key)
    return row ? JSON.parse(String(row.json)) as PaymentAttempt : undefined
  }
  return { load, save(key, value) {
    db.prepare('INSERT OR IGNORE INTO x402_attempts VALUES (?,?)').run(key, JSON.stringify(value))
    return load(key)!
  }, close: () => db.close() }
}
