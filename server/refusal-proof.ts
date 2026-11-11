// Proof of refusal: builds a sanitized, immutable snapshot of a finished no-purchase run and stores it beside the
// other app state (the same SQLite file, so hosted retention and backups cover it). Every public byte comes from a
// whitelist: the question the visitor chose to publish, public candidate facts, the on-ledger anchor and the run's own
// receipts bundle (hash-chained audit rows, free-tier sources). No premium bytes, no other run's rows, no model text.
import { createHash, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { verifyAnswer } from '../sdk/verify.js'
import { ReceiptBundleSchema, type ReceiptBundle } from '../shared/contracts/receipts.js'
import type { RunSnapshot } from '../shared/contracts/index.js'
import { canonical } from './audit.js'
import { receiptBundle } from './receipt-bundle.js'
import type { Store } from './store.js'
import {
  HOSTED_PROOFS_PER_SESSION, HOSTED_PROOFS_TOTAL, HOSTED_PROOF_RETAIN_UNTIL, PROOF_ID, PROOF_MAX_BYTES, PROOF_VERSION,
  ProofSnapshotSchema, clip, describeRefusal, refusalEligibility, type ProofBlockCode, type ProofSnapshot,
} from '../shared/refusal-proof.js'

/** A refusal that is the visitor's to fix or wait out (HTTP 409) or a cap (HTTP 429). `code` is safe to show. */
export class ProofError extends Error {
  constructor(readonly status: 404 | 409 | 429, readonly code: ProofBlockCode | 'proof_limit' | 'not_found', message: string) { super(message) }
}

export type StoredProof = { id: string; runId: string; createdAt: string; snapshot: ProofSnapshot }
type Row = { id: string; run_id: string; principal: string; created: number; expires: number; sha256: string; size: number; json: string }
const sha = (text: string) => createHash('sha256').update(text).digest('hex')

/**
 * The run's own export, minus everything the proof does not need. Throws if the export contradicts "nothing was
 * bought" or carries another run's data: the invariants of this feature, checked again at the last moment.
 */
export function sanitizeBundle(bundle: ReceiptBundle, run: Pick<RunSnapshot, 'runId' | 'candidates'>): ReceiptBundle {
  const bought = bundle.fraudProofs?.length || bundle.grants.length || bundle.receipts.length || bundle.payments.length || bundle.proofs.some(proof => proof.keyReveal || proof.intentId) || bundle.intents.some(intent => intent.status !== 'SKIPPED')
  if (bought) throw new ProofError(409, 'purchased', 'This run paid a writer, so it is not a refusal.')
  const paid = new Set(run.candidates.filter(candidate => candidate.tier === 'PAID').map(candidate => `${candidate.profileId}/${candidate.resourceId}@${candidate.version}`))
  // Gate 1: paid bodies only ever exist after a grant. A refusal has none, so any paid body here is a defect, not a choice.
  if (bundle.sources.some(source => paid.has(`${source.profileId}/${source.resourceId}@${source.version}`))) throw new ProofError(409, 'purchased', 'This run holds paid text, so it can’t be shared as a refusal.')
  if (bundle.audit.entries.some(entry => !('commitment' in entry) && entry.runId !== run.runId)) throw new ProofError(409, 'verification_failed', 'The audit log carries another run’s rows.')
  // The question’s facets are derived from the question; the proof carries the question itself, so the copy is dropped.
  return ReceiptBundleSchema.parse({ ...bundle, requirements: [] })
}

export class RefusalProofs {
  constructor(private store: Store) {
    store.hostedState(db => db.exec(`CREATE TABLE IF NOT EXISTS refusal_proofs (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE, principal TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL,
        sha256 TEXT NOT NULL, size INTEGER NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS refusal_proofs_principal ON refusal_proofs(principal, created);
      CREATE TRIGGER IF NOT EXISTS refusal_proofs_immutable BEFORE UPDATE ON refusal_proofs BEGIN SELECT RAISE(ABORT, 'a refusal proof is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS refusal_proofs_retained BEFORE DELETE ON refusal_proofs
        WHEN OLD.expires > CAST(strftime('%s', 'now') AS INTEGER) * 1000 BEGIN SELECT RAISE(ABORT, 'a refusal proof is kept until its retention date'); END;`))
  }
  private parse(row: Row | undefined): StoredProof | undefined {
    // Fail closed: a row whose bytes no longer match the digest taken at creation is not served.
    if (!row || sha(row.json) !== row.sha256) return undefined
    const parsed = ProofSnapshotSchema.safeParse(JSON.parse(row.json))
    return parsed.success ? { id: row.id, runId: row.run_id, createdAt: parsed.data.createdAt, snapshot: parsed.data } : undefined
  }
  get(id: string, now = Date.now()): StoredProof | undefined {
    if (!PROOF_ID.test(id)) return undefined
    return this.parse(this.store.hostedState(db => db.prepare('SELECT * FROM refusal_proofs WHERE id=? AND expires>?').get(id, now) as Row | undefined))
  }
  forRun(runId: string, now = Date.now()): StoredProof | undefined {
    return this.parse(this.store.hostedState(db => db.prepare('SELECT * FROM refusal_proofs WHERE run_id=? AND expires>?').get(runId, now) as Row | undefined))
  }
  /** Retention sweep: rows past their end date only. The trigger refuses anything earlier. */
  expire(now = Date.now()) { this.store.hostedState(db => db.prepare('DELETE FROM refusal_proofs WHERE expires<=?').run(now)) }
  count(db: DatabaseSync, where = '1=1', ...params: (string | number)[]) { return Number(db.prepare(`SELECT count(*) AS n FROM refusal_proofs WHERE ${where}`).get(...params)!.n) }

  /**
   * Everything a proof needs before it is written, and every reason it may not be written. Used by `create` and, without
   * writing, by `preflight`, so what the page offers is what the server will then do. An unexpected failure is reported as
   * a stated reason (and logged for the operator), never as a bare error: a visitor who was offered the button must not
   * be told "try again" for a run that can never be shared.
   */
  private async prepare(run: RunSnapshot, options: { hosted: boolean; principal: string; now: number }): Promise<{ snapshot: ProofSnapshot; json: string; size: number }> {
    const { now } = options
    try {
      const bundle = sanitizeBundle(receiptBundle(this.store, run.runId), run)
      const anchor = bundle.ledgerAnchor
      if (!anchor || anchor.txHash !== run.ledgerAnchor?.txHash) throw new ProofError(409, 'anchor_missing', 'No ledger anchor is recorded for this run, so it can’t be shared.')
      // Offline checks only (hash chain, anchor binding, "refused, never signed"); the ledger read happens in the visitor's own browser.
      const checked = await verifyAnswer(bundle)
      if (!checked.ok) {
        console.warn(`[proof] ${run.runId.slice(0, 8)} failed the offline checks: ${checked.checks.filter(check => check.status === 'FAIL').map(check => check.check).join(', ')}`)
        throw new ProofError(409, 'verification_failed', 'This run’s receipts did not pass the offline checks, so it can’t be shared.')
      }
      const id = randomBytes(16).toString('hex')
      const fixture = [run.labels.research, run.labels.decision].some(label => /^fixture\b/i.test(label))
      const { summary, found } = describeRefusal(run)
      const snapshot = ProofSnapshotSchema.parse({
        version: PROOF_VERSION, id, createdAt: new Date(now).toISOString(), question: run.question, askedAt: run.events[0]?.at ?? new Date(now).toISOString(),
        environment: { surface: options.hosted ? 'hosted' : 'local', network: 'XRPL Testnet', models: fixture ? 'fixture' : 'live', label: `${options.hosted ? 'Shared ' : ''}XRPL Testnet demo · ${fixture ? 'fixture' : 'live'} models · no real value` },
        outcome: { summary: clip(summary, 240) }, found, bought: { count: 0, spentMinor: 0, currency: 'SGD' }, anchor,
        verification: { ok: true, passed: checked.checks.filter(check => check.status === 'PASS').length, skipped: checked.checks.filter(check => check.status === 'SKIP').length, total: checked.checks.length, at: new Date(now).toISOString() },
        bundle,
      })
      const json = canonical(snapshot)
      const size = Buffer.byteLength(json)
      if (size > PROOF_MAX_BYTES) {
        console.warn(`[proof] ${run.runId.slice(0, 8)} is ${size} bytes, over the ${PROOF_MAX_BYTES} limit`)
        throw new ProofError(409, 'too_large', 'This run’s receipts are too large to share.')
      }
      return { snapshot, json, size }
    } catch (error) {
      if (error instanceof ProofError) throw error
      console.warn(`[proof] ${run.runId.slice(0, 8)} could not be packaged: ${error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : 'unknown error'}`)
      throw new ProofError(409, 'verification_failed', 'This run’s receipts could not be packaged into a verifiable proof, so it can’t be shared.')
    }
  }

  /** The reason a run that passed the cheap rules still cannot be shared, or undefined when `create` would succeed. Writes nothing. */
  async preflight(runId: string, now = Date.now()): Promise<ProofError | undefined> {
    if (this.forRun(runId, now)) return undefined
    let run: RunSnapshot
    try { run = this.store.getRun(runId) } catch { return new ProofError(404, 'not_found', 'Run not found.') }
    const eligibility = refusalEligibility(run, now)
    if (!eligibility.ok) return new ProofError(409, eligibility.code, eligibility.message)
    try { await this.prepare(run, { hosted: false, principal: '', now }) } catch (error) { if (error instanceof ProofError) return error; throw error }
    return undefined
  }

  /**
   * One proof per run, ever: a second request returns the first snapshot untouched (the permalink never changes).
   * The caller has already proven the run belongs to the requester (hosted: the gateway's run ownership check).
   */
  async create(runId: string, options: { hosted: boolean; principal: string; now?: number }): Promise<{ proof: StoredProof; created: boolean }> {
    const now = options.now ?? Date.now()
    const old = this.forRun(runId, now)
    if (old) return { proof: old, created: false }
    let run: RunSnapshot
    try { run = this.store.getRun(runId) } catch { throw new ProofError(404, 'not_found', 'Run not found.') }
    const eligibility = refusalEligibility(run, now)
    if (!eligibility.ok) throw new ProofError(409, eligibility.code, eligibility.message)
    if (options.hosted) {
      const since = now - 86_400_000
      const limited = this.store.hostedState(db => this.count(db, 'principal=? AND created>?', options.principal, since) >= HOSTED_PROOFS_PER_SESSION || this.count(db) >= HOSTED_PROOFS_TOTAL)
      if (limited) throw new ProofError(429, 'proof_limit', 'This session has shared as many proofs as the demo allows.')
    }
    const { snapshot, json, size } = await this.prepare(run, { ...options, now })
    const { id } = snapshot
    const expires = options.hosted ? Math.max(Date.parse(HOSTED_PROOF_RETAIN_UNTIL), now + 2 * 86_400_000) : now + 3650 * 86_400_000
    this.store.hostedState(db => db.prepare('INSERT OR IGNORE INTO refusal_proofs (id, run_id, principal, created, expires, sha256, size, json) VALUES (?,?,?,?,?,?,?,?)').run(id, runId, options.principal, now, expires, sha(json), size, json))
    const stored = this.forRun(runId, now)
    if (!stored) throw new ProofError(409, 'verification_failed', 'The proof could not be stored.')
    return { proof: stored, created: stored.id === id }
  }
}
