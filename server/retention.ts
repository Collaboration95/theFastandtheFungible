// Data retention (#288): delete what is sensitive or bulky (premium bodies, salts, events, answers, the question
// text) from runs that are finished and old enough, and keep what proves the money moved (intents, receipts,
// manifests, signed payments) and the whole audit chain. The audit chain holds no payload, so there is nothing
// in it to prune: it records hashes, ids and figures only, and a prune appends one more entry to it.
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { PurchaseIntentSchema, RunSnapshotSchema } from '../shared/contracts/index.js'
import type { AuditLog } from './audit.js'

export const PRUNED_QUESTION = '[pruned]'
export const DEFAULT_RETENTION_DAYS = 30
/** Intents in these states are finished: nothing can still be delivered, challenged, refunded or reconciled. */
const FINAL = new Set(['VERIFIED', 'SKIPPED', 'FAILED_NOT_SETTLED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
const TERMINAL_RUN = new Set(['DONE', 'STOPPED', 'FAILED'])

export type PruneOptions = { olderThanDays?: number; now?: number; dryRun?: boolean }
export type PruneResult = { cutoff: string; olderThanDays: number; dryRun: boolean; runIds: string[]; deleted: { grants: number; grantSalts: number; events: number; answers: number; decisions: number; runBodies: number; questionSalts: number } }

/** `30d`, `7d` or a bare number of days. */
export function parseWindow(text: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*d?$/.exec(text.trim())
  if (!match || !(Number(match[1]) >= 0)) throw new Error(`Invalid retention window "${text}"; use e.g. 30d`)
  return Number(match[1])
}

export function pruneRunData(db: DatabaseSync, audit: AuditLog, options: PruneOptions = {}): PruneResult {
  const days = options.olderThanDays ?? DEFAULT_RETENTION_DAYS, now = options.now ?? Date.now()
  if (!Number.isFinite(days) || days < 0) throw new Error('Retention window must be a non-negative number of days')
  const cutoff = now - days * 86_400_000
  const result: PruneResult = { cutoff: new Date(cutoff).toISOString(), olderThanDays: days, dryRun: !!options.dryRun, runIds: [], deleted: { grants: 0, grantSalts: 0, events: 0, answers: 0, decisions: 0, runBodies: 0, questionSalts: 0 } }
  const count = (sql: string, ...args: string[]) => Number((db.prepare(sql).get(...args) as { n: number }).n)
  for (const row of db.prepare('SELECT id, json FROM runs ORDER BY rowid').all() as { id: string; json: string }[]) {
    const run = JSON.parse(row.json) as { phase: string; question: string }
    if (!TERMINAL_RUN.has(run.phase)) continue
    const intents = (db.prepare('SELECT json FROM intents WHERE run_id=?').all(row.id) as { json: string }[]).map(i => PurchaseIntentSchema.parse(JSON.parse(i.json)))
    if (intents.some(i => !FINAL.has(i.status))) continue
    const lastEvent = db.prepare('SELECT json FROM events WHERE run_id=? ORDER BY id DESC LIMIT 1').get(row.id) as { json: string } | undefined
    const day = (db.prepare('SELECT day FROM admissions WHERE run_id=?').get(row.id) as { day: string } | undefined)?.day
    const stamps = [lastEvent ? (JSON.parse(lastEvent.json) as { at?: string }).at : undefined, ...intents.flatMap(i => [i.createdAt, i.settledAt])]
      .map(t => Date.parse(t ?? '')).filter(Number.isFinite)
    // Events pruned earlier leave the admission day (end of that UTC day) as the last known activity.
    if (!stamps.length && day) stamps.push(Date.parse(`${day}T23:59:59.999Z`))
    // No timestamp at all means we cannot show it is old: keep it.
    if (!stamps.length || Math.max(...stamps) >= cutoff) continue
    const hasPayload = run.question !== PRUNED_QUESTION || count('SELECT COUNT(*) AS n FROM events WHERE run_id=?', row.id) > 0 || count('SELECT COUNT(*) AS n FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?', row.id) > 0
    if (!hasPayload) continue
    result.runIds.push(row.id)
    const salts = count('SELECT COUNT(*) AS n FROM grant_salts s JOIN grants g ON g.intent_id=s.intent_id JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?', row.id)
    const grants = count('SELECT COUNT(*) AS n FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?', row.id)
    result.deleted.grants += grants; result.deleted.grantSalts += salts
    result.deleted.events += count('SELECT COUNT(*) AS n FROM events WHERE run_id=?', row.id)
    result.deleted.answers += count('SELECT COUNT(*) AS n FROM answers WHERE run_id=?', row.id)
    result.deleted.decisions += count('SELECT COUNT(*) AS n FROM decisions WHERE run_id=?', row.id)
    result.deleted.questionSalts += count('SELECT COUNT(*) AS n FROM audit_salts WHERE run_id=?', row.id)
    result.deleted.runBodies += 1
    if (options.dryRun) continue
    const intentIds = `(SELECT id FROM intents WHERE run_id=?)`
    db.prepare(`DELETE FROM grant_salts WHERE intent_id IN ${intentIds}`).run(row.id)
    db.prepare(`DELETE FROM grants WHERE intent_id IN ${intentIds}`).run(row.id)
    db.prepare('DELETE FROM events WHERE run_id=?').run(row.id)
    db.prepare('DELETE FROM answers WHERE run_id=?').run(row.id)
    db.prepare('DELETE FROM decisions WHERE run_id=?').run(row.id)
    db.prepare('DELETE FROM audit_salts WHERE run_id=?').run(row.id)
    db.prepare('UPDATE mcp_requests SET question=? WHERE run_id=?').run(PRUNED_QUESTION, row.id)
    const scrubbed = RunSnapshotSchema.parse({ ...JSON.parse(row.json), question: PRUNED_QUESTION, contents: [], answers: [], decisions: [], events: [], checkpoint: {}, impact: undefined, error: undefined })
    db.prepare('UPDATE runs SET json=? WHERE id=?').run(JSON.stringify(scrubbed), row.id)
  }
  if (!options.dryRun && result.runIds.length) audit.append({ kind: 'prune', principal: 'operator', data: { olderThanDays: days, cutoff: result.cutoff, runIds: result.runIds, deleted: result.deleted,
    kept: 'intents, receipts, manifests, signed payments and every audit entry' } })
  return result
}

/** Report files (`<runId>.pdf` / `.html`) of pruned runs carry the question and cited sources. Returns the files removed. */
export function removeReports(dir: string, runIds: string[]): string[] {
  const names = (() => { try { return readdirSync(dir) } catch { return [] } })()
  const ids = new Set(runIds)
  return names.filter(name => ids.has(name.replace(/\.[^.]+$/, ''))).map(name => { rmSync(join(dir, name), { force: true }); return name })
}
