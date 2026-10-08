import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import type { Submission } from './xrpl.js'
import { leafHash, manifestRoot } from '../shared/manifest.js'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Manifest } from '../shared/contracts/manifest.js'
import { AnswerSchema, BUDGET, ContentEnvelopeSchema, DecisionRoundSchema, GrantSchema, ImpactSchema, PurchaseIntentSchema, ReceiptSchema, ReputationRecordSchema, RunSnapshotSchema, TraceEventSchema, type Answer, type ContentEnvelope, type DecisionRound, type DeliveryProof, type Grant, type Impact, type ModeLabels, type PurchaseIntent, type Receipt, type ReputationRecord, type RunSnapshot, type TraceEvent } from '../shared/contracts/index.js'

const reservedStatuses = new Set(['RESERVED', 'SUBMITTING'])
/** A refund never frees budget inside the run: every post-delivery status still counts as the gross charge. */
const chargedStatuses = new Set(['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
/** Proof checked (D4/D5): delivery is over, whatever the verdict. */
export const PROVEN_STATUSES = new Set(['VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
const CHALLENGE_OUTCOMES = new Set(['REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
type ResourceIdentity = Pick<ContentEnvelope, 'profileId' | 'resourceId' | 'version'>
const sameResource = (a: ResourceIdentity, b: ResourceIdentity) => a.profileId === b.profileId && a.resourceId === b.resourceId && a.version === b.version
function publicMetadata(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(publicMetadata); return }
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['deliverytoken', 'body', 'spans', 'contents'].includes(key.toLowerCase())) throw new Error('Private content or token cannot be stored as public metadata')
    publicMetadata(child)
  }
}


/** All mutations are synchronous SQLite transactions; no transaction crosses an await. */
export class Store {
  private readonly db: DatabaseSync
  constructor(readonly path: string = 'data/app.db', private readonly onEvent?: (event: TraceEvent) => void) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS answers (run_id TEXT NOT NULL REFERENCES runs(id), version INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(run_id,version));
      CREATE TABLE IF NOT EXISTS decisions (run_id TEXT NOT NULL REFERENCES runs(id), round INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(run_id,round));
      CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts (intent_id TEXT PRIMARY KEY REFERENCES intents(id), json TEXT NOT NULL, token TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS grants (intent_id TEXT PRIMARY KEY REFERENCES intents(id), json TEXT NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS run_meta (run_id TEXT PRIMARY KEY REFERENCES runs(id), pinned INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS submissions (intent_id TEXT PRIMARY KEY REFERENCES intents(id), tx_hash TEXT UNIQUE NOT NULL, tx_blob TEXT NOT NULL, last_ledger INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS publisher_reputation (wallet TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS manifests (intent_id TEXT PRIMARY KEY REFERENCES intents(id), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS grant_salts (intent_id TEXT PRIMARY KEY REFERENCES grants(intent_id), json TEXT NOT NULL);
    `)
  }
  private atomic<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = fn(); this.db.exec('COMMIT'); return result }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  private rows<T>(sql: string, ...args: string[]): T[] {
    return this.db.prepare(sql).all(...args).map(row => JSON.parse(row.json as string) as T)
  }
  private rawRun(runId: string): RunSnapshot {
    const row = this.db.prepare('SELECT json FROM runs WHERE id=?').get(runId)
    if (!row) throw new Error('Run not found')
    return RunSnapshotSchema.parse(JSON.parse(row.json as string))
  }
  private saveRun(run: RunSnapshot): void {
    this.db.prepare('UPDATE runs SET json=? WHERE id=?').run(JSON.stringify(RunSnapshotSchema.parse(run)), run.runId)
  }
  private saveIntent(intent: PurchaseIntent): void {
    this.db.prepare('UPDATE intents SET json=? WHERE id=?').run(JSON.stringify(PurchaseIntentSchema.parse(intent)), intent.intentId)
  }
  createRun(question: string, budgetMinor: number, labels?: ModeLabels): RunSnapshot {
    const run = RunSnapshotSchema.parse({ runId: randomUUID(), question, budgetMinor, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: BUDGET.capMinor,
      phase: 'SEARCH', stopped: false, round: 0, candidates: [], contents: [], answers: [], decisions: [], intents: [], receipts: [], grants: [], events: [], checkpoint: {}, reportStatus: 'NONE',
      labels: labels ?? { research: 'fixture', decision: 'fixture', publisher: 'local', settlement: 'SIMULATED SGD · no real funds' } })
    this.db.prepare('INSERT INTO runs VALUES (?,?)').run(run.runId, JSON.stringify(run))
    return this.getRun(run.runId)
  }
  getRun(runId: string): RunSnapshot {
    // A consistent read also makes callbacks observe the committed event and ledger.
    return this.atomic(() => {
      const run = this.rawRun(runId)
      run.intents = this.rows('SELECT json FROM intents WHERE run_id=? ORDER BY rowid', runId)
      run.receipts = this.rows('SELECT r.json FROM receipts r JOIN intents i ON i.id=r.intent_id WHERE i.run_id=?', runId)
      run.grants = this.rows('SELECT g.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?', runId)
      run.answers = this.rows('SELECT json FROM answers WHERE run_id=? ORDER BY version', runId)
      run.decisions = this.rows('SELECT json FROM decisions WHERE run_id=? ORDER BY round', runId)
      run.events = this.rows('SELECT json FROM events WHERE run_id=? ORDER BY id', runId)
      // Quarantine (#131): only a grant whose proof verified is accessible content; a failed one stays for audit only.
      const paid = this.db.prepare('SELECT g.content, i.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(runId)
        .filter(row => (JSON.parse(row.json as string) as PurchaseIntent).status === 'VERIFIED')
        .map(row => ContentEnvelopeSchema.parse(JSON.parse(row.content as string)))
      run.contents = [...run.contents.filter(content => run.candidates.some(c => c.tier === 'FREE' && sameResource(c, content))), ...paid]
      run.spentMinor = run.intents.filter(i => chargedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      run.reservedMinor = run.intents.filter(i => reservedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      run.refundedMinor = run.intents.reduce((sum, i) => sum + (i.refund?.amountMinor ?? 0), 0)
      return RunSnapshotSchema.parse(run)
    })
  }
  listRuns(): RunSnapshot[] { return this.db.prepare('SELECT id FROM runs ORDER BY rowid').all().map(row => this.getRun(row.id as string)) }
  /** Sidebar history, newest first: every pinned run, then the `recent` latest others. Deleting only hides a run: its receipts and ledger rows stay (one charge per intent). */
  listPastRuns(recent = 4): { runId: string; question: string; phase: RunSnapshot['phase']; stopped: boolean; budgetMinor: number; spentMinor: number; at: string; pinned: boolean }[] {
    const meta = new Map(this.db.prepare('SELECT run_id, pinned, hidden FROM run_meta').all().map(row => [row.run_id as string, row]))
    let others = 0
    return this.db.prepare('SELECT id FROM runs ORDER BY rowid DESC').all().flatMap(row => {
      const id = row.id as string, m = meta.get(id)
      if (m?.hidden || (!m?.pinned && others++ >= recent)) return []
      const run = this.getRun(id)
      return [{ runId: id, question: run.question, phase: run.phase, stopped: run.stopped, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, at: run.events[0]?.at ?? '', pinned: !!m?.pinned }]
    })
  }
  setRunMeta(runId: string, change: { pinned?: boolean; hidden?: boolean }): void {
    this.rawRun(runId)
    this.db.prepare('INSERT OR IGNORE INTO run_meta (run_id) VALUES (?)').run(runId)
    if (change.pinned !== undefined) this.db.prepare('UPDATE run_meta SET pinned=? WHERE run_id=?').run(change.pinned ? 1 : 0, runId)
    if (change.hidden !== undefined) this.db.prepare('UPDATE run_meta SET hidden=? WHERE run_id=?').run(change.hidden ? 1 : 0, runId)
  }
  updateRun(runId: string, patch: Partial<RunSnapshot>): RunSnapshot {
    const allowed = new Set(['phase', 'stopped', 'round', 'candidates', 'labels', 'checkpoint', 'error', 'reportStatus'])
    if (Object.keys(patch).some(key => !allowed.has(key))) throw new Error('Protected run fields require ledger APIs')
    publicMetadata(patch.checkpoint)
    this.atomic(() => {
      const run = this.rawRun(runId)
      if (run.stopped && patch.stopped === false) throw new Error('A stopped run cannot resume spending')
      if (patch.candidates) {
        const identities = patch.candidates.map(c => JSON.stringify([c.profileId, c.resourceId, c.version]))
        if (new Set(identities).size !== identities.length) throw new Error('Duplicate candidate identity')
        // Metadata already registered for an identity cannot be relabelled FREE.
        for (const c of patch.candidates) {
          const old = run.candidates.find(o => sameResource(o, c))
          if (old && old.tier !== c.tier) throw new Error('Candidate tier is immutable')
        }
        if (run.candidates.some(old => !patch.candidates!.some(c => sameResource(c, old)))) throw new Error('Cannot remove registered candidate identity')
      }
      // Checkpoints and error strings are trusted orchestration metadata, never delivery payloads.
      this.saveRun({ ...run, ...patch })
    })
    return this.getRun(runId)
  }
  appendEvent(runId: string, input: Omit<TraceEvent, 'id' | 'runId' | 'at'>): TraceEvent {
    publicMetadata(input.data)
    const event = this.atomic(() => {
      this.rawRun(runId)
      const result = this.db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)').run(runId, '{}')
      const event = TraceEventSchema.parse({ ...input, id: Number(result.lastInsertRowid), runId, at: new Date().toISOString() })
      this.db.prepare('UPDATE events SET json=? WHERE id=?').run(JSON.stringify(event), event.id)
      return event
    })
    // Subscriber failures must not roll back committed state or derail a purchase.
    try { this.onEvent?.(event) } catch { /* subscribers reconnect from durable events */ }
    return event
  }
  addAnswer(runId: string, input: Answer, impact?: Impact): void {
    const answer = AnswerSchema.parse(input)
    const run = this.getRun(runId)
    for (const claim of answer.claims) for (const citation of claim.citations) {
      if (!run.contents.some(c => c.resourceId === citation.resourceId && c.version === citation.version && c.spans.some(s => s.id === citation.spanId && c.body.includes(s.text)))) throw new Error('Answer cites inaccessible content')
    }
    this.atomic(() => {
      this.db.prepare('INSERT INTO answers VALUES (?,?,?)').run(runId, answer.version, JSON.stringify(answer))
      if (impact) this.saveRun({ ...this.rawRun(runId), impact: ImpactSchema.parse(impact) })
    })
  }
  addDecision(runId: string, decision: DecisionRound): void {
    this.db.prepare('INSERT INTO decisions VALUES (?,?,?)').run(runId, decision.round, JSON.stringify(DecisionRoundSchema.parse(decision)))
  }
  addContent(runId: string, input: ContentEnvelope): void {
    const content = ContentEnvelopeSchema.parse(input)
    if (content.spans.some(s => !content.body.includes(s.text))) throw new Error('Span is not an exact substring')
    this.atomic(() => {
      const run = this.rawRun(runId)
      if (!run.candidates.some(c => c.tier === 'FREE' && sameResource(c, content))) {
        const granted = this.db.prepare('SELECT g.content, i.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(runId).some(row => JSON.stringify(content) === row.content && (JSON.parse(row.json as string) as PurchaseIntent).status === 'VERIFIED')
        if (!granted) throw new Error('Paid or unknown content requires verified grant')
        return
      }
      const old = run.contents.find(c => sameResource(c, content))
      if (old && JSON.stringify(old) !== JSON.stringify(content)) throw new Error('Content version is immutable')
      if (!old) this.saveRun({ ...run, contents: [...run.contents, content] })
    })
  }
  getIntent(intentId: string): PurchaseIntent | undefined { return this.rows<PurchaseIntent>('SELECT json FROM intents WHERE id=?', intentId)[0] }
  listIntents(status?: PurchaseIntent['status']): PurchaseIntent[] {
    const intents = this.rows<PurchaseIntent>('SELECT json FROM intents ORDER BY rowid')
    return status ? intents.filter(i => i.status === status) : intents
  }
  reserveIntent(input: PurchaseIntent): PurchaseIntent {
    const intent = PurchaseIntentSchema.parse(input)
    return this.atomic(() => {
      const existing = this.getIntent(intent.intentId)
      if (existing) {
        if (['runId', 'profileId', 'resourceId', 'version', 'amountMinor'].some(key => existing[key as keyof PurchaseIntent] !== intent[key as keyof PurchaseIntent])) throw new Error('Intent identity mismatch')
        return existing
      }
      const run = this.rawRun(intent.runId)
      const quote = intent.quote
      if (!quote || quote.intentId !== intent.intentId || quote.runId !== intent.runId || quote.profileId !== intent.profileId || quote.resourceId !== intent.resourceId || quote.version !== intent.version) throw new Error('Quote identity mismatch')
      const intents = this.rows<PurchaseIntent>('SELECT json FROM intents WHERE run_id=?', intent.runId)
      const committed = intents.filter(i => reservedStatuses.has(i.status) || chargedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      let error: string | undefined
      if (quote.amountMinor !== intent.amountMinor) error = 'Quoted price differs from evaluated price'
      else if (run.stopped) error = 'Run stopped'
      else if (run.budgetMinor === 0 || intent.amountMinor > run.perSourceCapMinor || committed + intent.amountMinor > run.budgetMinor) error = 'Budget or per-source cap exceeded'
      else if (Date.parse(quote.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(quote.expiresAt))) error = 'Quote expired'
      else if (intents.some(i => i.profileId === intent.profileId && i.resourceId === intent.resourceId && i.version === intent.version && (reservedStatuses.has(i.status) || chargedStatuses.has(i.status)))) error = 'Resource already purchased or reserved'
      const result: PurchaseIntent = { ...intent, status: error ? 'SKIPPED' : 'RESERVED', error }
      this.db.prepare('INSERT INTO intents VALUES (?,?,?)').run(intent.intentId, intent.runId, JSON.stringify(result))
      return result
    })
  }
  /** CAS prevents independent managers/processes from submitting the same intent. */
  claimSubmitting(intentId: string): boolean {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || intent.status !== 'RESERVED') return false
      if (this.rawRun(intent.runId).stopped || Date.parse(intent.quote!.expiresAt) <= Date.now()) { this.saveIntent({ ...intent, status: 'SKIPPED', error: 'Run stopped or quote expired' }); return false }
      this.saveIntent({ ...intent, status: 'SUBMITTING' }); return true
    })
  }
  updateIntent(intentId: string, patch: Partial<PurchaseIntent>): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent) throw new Error('Intent not found')
      if (Object.keys(patch).some(k => k !== 'status' && k !== 'error')) throw new Error('Intent identity and accounting are immutable')
      const status = patch.status ?? intent.status
      const transitions: Record<string, string[]> = {
        RESERVED: ['SKIPPED', 'FAILED_NOT_SETTLED'], SUBMITTING: [], SETTLED: ['DELIVERY_PENDING', 'DELIVERY_FAILED'],
        DELIVERY_PENDING: ['DELIVERY_FAILED'], DELIVERY_FAILED: ['DELIVERY_PENDING'], VERIFIED: [], SKIPPED: [], FAILED_NOT_SETTLED: [],
      }
      if (status !== intent.status && !transitions[intent.status]?.includes(status)) throw new Error('Unsafe intent transition')
      const next = { ...intent, ...patch }; this.saveIntent(next); return next
    })
  }
  recordSettlement(intentId: string, input: Receipt, deliveryToken: string): void {
    const receipt = ReceiptSchema.parse(input)
    this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || !deliveryToken || receipt.intentId !== intentId || receipt.runId !== intent.runId || receipt.resourceId !== intent.resourceId || receipt.version !== intent.version || receipt.amountMinor !== intent.amountMinor) throw new Error('Settlement identity mismatch')
      const existing = this.rows<Receipt>('SELECT json FROM receipts WHERE intent_id=?', intentId)[0]
      if (existing) { if (existing.receiptId !== receipt.receiptId) throw new Error('Settlement receipt mismatch'); return }
      if (intent.status !== 'SUBMITTING') throw new Error('Settlement requires submitting reservation')
      this.db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(intentId, JSON.stringify(receipt), deliveryToken)
      this.saveIntent({ ...intent, status: 'SETTLED', receiptId: receipt.receiptId, error: undefined })
    })
  }
  /** Write-once: the first signed payment for an intent is the only one that may ever be submitted. */
  recordSubmission(intentId: string, signed: Submission): Submission {
    return this.atomic(() => {
      const existing = this.getSubmission(intentId)
      if (existing) return existing
      const intent = this.getIntent(intentId)
      if (intent?.status !== 'SUBMITTING') throw new Error('Payment submission requires a submitting reservation')
      this.db.prepare('INSERT INTO submissions VALUES (?,?,?,?)').run(intentId, signed.txHash, signed.txBlob, signed.lastLedgerSequence)
      this.saveIntent({ ...intent, txHash: signed.txHash })
      return signed
    })
  }
  getSubmission(intentId: string): Submission | undefined {
    const row = this.db.prepare('SELECT tx_hash, tx_blob, last_ledger FROM submissions WHERE intent_id=?').get(intentId)
    return row ? { txHash: row.tx_hash as string, txBlob: row.tx_blob as string, lastLedgerSequence: Number(row.last_ledger) } : undefined
  }
  /** Releases a reservation only when the ledger proves no payment can ever settle (caller supplies that proof). */
  failSubmission(intentId: string, reason: string): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || intent.status !== 'SUBMITTING' || this.db.prepare('SELECT 1 FROM receipts WHERE intent_id=?').get(intentId)) throw new Error('Only an unsettled submission can fail')
      const next: PurchaseIntent = { ...intent, status: 'FAILED_NOT_SETTLED', error: reason }
      this.saveIntent(next); return next
    })
  }
  getDeliveryToken(intentId: string): string | undefined { return this.db.prepare('SELECT token FROM receipts WHERE intent_id=?').get(intentId)?.token as string | undefined }
  /**
   * Stores the delivered bytes as an UNVERIFIED grant (#131): the intent stays DELIVERY_PENDING and the
   * content is not accessible until server/proofs.ts records the proof. The grant's digest is the root
   * recomputed from the delivered passages; a mismatch with the quote is a proof failure, not an error.
   */
  addGrant(input: Grant, inputContent: ContentEnvelope, proof?: DeliveryProof): void {
    const content = ContentEnvelopeSchema.parse(inputContent)
    if (!proof) throw new Error('Exact response bytes and manifest salts required')
    const root = manifestRoot(content.spans.map((s, i) => leafHash(proof.salts[i] ?? '', i, s.id, s.text)))
    const grant = GrantSchema.parse({ ...input, contentDigest: root })
    const parsed = ContentEnvelopeSchema.parse(JSON.parse(typeof proof.bytes === 'string' ? proof.bytes : Buffer.from(proof.bytes).toString('utf8')))
    if (JSON.stringify(parsed) !== JSON.stringify(content) || proof.salts.length !== content.spans.length || content.spans.some(s => !content.body.includes(s.text)) || new Set(content.spans.map(s => s.id)).size !== content.spans.length) throw new Error('Delivery verification failed')
    this.atomic(() => {
      const intent = this.getIntent(grant.intentId)
      if (!intent || !chargedStatuses.has(intent.status) || intent.runId !== grant.runId || intent.resourceId !== grant.resourceId || intent.version !== grant.version || content.profileId !== intent.profileId || content.resourceId !== intent.resourceId || content.version !== intent.version) throw new Error('Grant does not match settled quote')
      const existing = this.rows<Grant>('SELECT json FROM grants WHERE intent_id=?', grant.intentId)[0]
      if (existing) { if (existing.contentDigest !== root) throw new Error('Grant is immutable'); return }
      this.db.prepare('INSERT INTO grants VALUES (?,?,?)').run(grant.intentId, JSON.stringify(grant), JSON.stringify(content))
      this.db.prepare('INSERT INTO grant_salts VALUES (?,?)').run(grant.intentId, JSON.stringify(proof.salts))
    })
  }
  /** Server-private: the delivered content and salts behind a grant (proof check and challenge only; never in a snapshot). */
  getDelivery(intentId: string): { grant: Grant; content: ContentEnvelope; salts: string[] } | undefined {
    const row = this.db.prepare('SELECT g.json, g.content, s.json AS salts FROM grants g JOIN grant_salts s ON s.intent_id=g.intent_id WHERE g.intent_id=?').get(intentId)
    return row ? { grant: JSON.parse(row.json as string) as Grant, content: ContentEnvelopeSchema.parse(JSON.parse(row.content as string)), salts: JSON.parse(row.salts as string) as string[] } : undefined
  }
  /** Write-once: the verified search manifest the policy evaluated for this intent. */
  recordManifest(intentId: string, manifest: Manifest): void {
    this.db.prepare('INSERT OR IGNORE INTO manifests VALUES (?,?)').run(intentId, JSON.stringify(manifest))
  }
  getManifest(intentId: string): Manifest | undefined {
    const row = this.db.prepare('SELECT json FROM manifests WHERE intent_id=?').get(intentId)
    return row ? JSON.parse(row.json as string) as Manifest : undefined
  }
  /** Only server/proofs.ts calls this: DELIVERY_PENDING → VERIFIED (root bound to the quote) or CLAIM_FAILED (quarantined). */
  recordProof(intentId: string, ok: boolean, failedClaimIds: string[]): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent) throw new Error('Intent not found')
      if (PROVEN_STATUSES.has(intent.status)) return intent
      const grant = this.rows<Grant>('SELECT json FROM grants WHERE intent_id=?', intentId)[0]
      if (intent.status !== 'DELIVERY_PENDING' || !grant) throw new Error('Proof requires a stored delivery')
      const verified = ok && grant.contentDigest === intent.quote?.contentDigest
      const next: PurchaseIntent = verified ? { ...intent, status: 'VERIFIED', error: undefined } : { ...intent, status: 'CLAIM_FAILED', failedClaimIds, error: 'Proof failed; source quarantined' }
      this.saveIntent(next); return next
    })
  }
  /** CLAIM_FAILED → CHALLENGED once the challenge is sent; a resend keeps CHALLENGED. */
  markChallenged(intentId: string): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || !['CLAIM_FAILED', 'CHALLENGED'].includes(intent.status)) throw new Error('Only a failed proof can be challenged')
      const next: PurchaseIntent = { ...intent, status: 'CHALLENGED' }
      this.saveIntent(next); return next
    })
  }
  /** Write-once per intent (gate 3): the first challenge outcome, and at most one refund, are final. */
  recordChallengeOutcome(intentId: string, status: 'REFUNDED' | 'CHALLENGE_REJECTED' | 'CHALLENGE_REFUSED', refund?: { txHash: string; amountMinor: number }): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent) throw new Error('Intent not found')
      if (CHALLENGE_OUTCOMES.has(intent.status)) return intent
      if (intent.status !== 'CHALLENGED') throw new Error('Challenge outcome requires a sent challenge')
      if ((status === 'REFUNDED') !== Boolean(refund) || (refund && refund.amountMinor !== intent.amountMinor)) throw new Error('A refund is exactly the full charge')
      const next: PurchaseIntent = { ...intent, status, ...(refund ? { refund } : {}) }
      this.saveIntent(next); return next
    })
  }
  // Engine-side trust per seller of record (D6, D21), across runs; server/reputation.ts owns the math.
  getReputation(wallet: string): ReputationRecord | undefined { return this.rows<ReputationRecord>('SELECT json FROM publisher_reputation WHERE wallet=?', wallet)[0] }
  listReputation(): ReputationRecord[] { return this.rows<ReputationRecord>('SELECT json FROM publisher_reputation ORDER BY wallet') }
  putReputation(record: ReputationRecord): void {
    const parsed = ReputationRecordSchema.parse(record)
    this.db.prepare('INSERT INTO publisher_reputation VALUES (?,?) ON CONFLICT(wallet) DO UPDATE SET json=excluded.json').run(parsed.wallet, JSON.stringify(parsed))
  }
  resetReputation(): void { this.db.exec('DELETE FROM publisher_reputation') }
  close(): void { this.db.close() }
}
