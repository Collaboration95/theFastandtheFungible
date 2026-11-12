import { screenPayee } from './payee-screening.js'
import { batchInners, innerHash, keyTerms } from '../shared/holdback.js'
import { runAudience } from './hosted/audience.js'
import { type SettlementPhase, type PhaseObservation, PhaseObservationSchema } from '../shared/contracts/settlement-timing.js'
import { probeMetadata } from './agents/precision.js'
import { hostedExecution } from './hosted/execution.js'
import { pastRunSummaries } from './history-query.js'
import { ExactCache } from './exact-cache.js'
import { sourceKey, sameSource, sourceBinding } from '../shared/source-identity.js'
import { AgentKeys, AgentDenied } from './agent-keys.js'
import { decode } from 'xrpl'
import type { EscrowRecord, EscrowOperation, EscrowOutbox } from './escrow-state.js'
import { chmodSync, existsSync } from 'node:fs'
import { DROPS_PER_MINOR, SIMULATED_LABEL, XRPL_LABEL, XRPL_EXPLORER } from '../shared/contracts/index.js'
import type { ChainPayment } from './hire/policy.js'
import { spendPolicy, POLICY_VERSION, PAUSED, type Surface } from './spend-policy.js'
import { budgetPolicy, clampBudget } from '../mcp/policy.js'
import { AuditLog, auditEntries, receiptRows, verifyChain, type AuditInput, type DateRange } from './audit.js'
import { pruneRunData, type PruneOptions } from './retention.js'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import type { Submission } from './xrpl.js'
import { leafHash, manifestRoot } from '../shared/manifest.js'
import { dirname } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import type { Manifest } from '../shared/contracts/manifest.js'
import { AnswerSchema, BUDGET, ContentEnvelopeSchema, DecisionRoundSchema, GrantSchema, ImpactSchema, PurchaseIntentSchema, ReceiptSchema, ReputationRecordSchema, RunSnapshotSchema, TraceEventSchema, type Answer, type ContentEnvelope, type DecisionRound, type DeliveryProof, type Grant, type Impact, type ModeLabels, type PurchaseIntent, type Receipt, type ReputationRecord, type RunSnapshot, type TraceEvent } from '../shared/contracts/index.js'

const reservedStatuses = new Set(['RESERVED', 'SUBMITTING'])
/** A refund never frees budget inside the run: every post-delivery status still counts as the gross charge. */
const chargedStatuses = new Set(['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
/** Proof checked (D4/D5): delivery is over, whatever the verdict. */
export const PROVEN_STATUSES = new Set(['VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
const CHALLENGE_OUTCOMES = new Set(['REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
type ResourceIdentity = Pick<ContentEnvelope, 'profileId' | 'resourceId' | 'version' | 'source'>
const sameResource = (a: ResourceIdentity, b: ResourceIdentity) => a.profileId === b.profileId && sameSource(a, b)
function publicMetadata(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(publicMetadata); return }
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['deliverytoken', 'body', 'spans', 'contents'].includes(key.toLowerCase())) throw new Error('Private content or token cannot be stored as public metadata')
    publicMetadata(child)
  }
}


export type PolicyPayment = ChainPayment & { submission?: Submission; confirmedAt?: string; ledgerIndex?: number; cancelledAt?: string; cancellationReason?: string; retiredSubmissions?: Submission[] }

/** All mutations are synchronous SQLite transactions; no transaction crosses an await. */
export class Store {
  canRateAnswer(runId: string): boolean {
    return !!this.prepare(`SELECT 1 FROM runs r WHERE r.id=? AND json_extract(r.json,'$.phase') IN ('DONE','STOPPED','FAILED')
      AND EXISTS(SELECT 1 FROM answers WHERE run_id=r.id AND json_array_length(json_extract(json,'$.claims'))>0)
      AND EXISTS(SELECT 1 FROM intents i JOIN receipts p ON p.intent_id=i.id WHERE i.run_id=r.id
        AND json_extract(p.json,'$.amountMinor')>0 AND coalesce(json_extract(i.json,'$.escrow.state'),'')!='CANCELLED')`).get(runId)
  }
  answerRating(runId: string): boolean | null {
    const row=this.prepare('SELECT yes FROM answer_ratings WHERE run_id=?').get(runId)
    return row ? Boolean(row.yes) : null
  }
  rateAnswer(runId: string, yes: boolean): boolean {
    return this.atomic(()=>{
      if(!this.canRateAnswer(runId)) throw new Error('Paid answer not available')
      this.prepare('INSERT OR IGNORE INTO answer_ratings VALUES (?,?,?)').run(runId,yes?1:0,new Date().toISOString())
      return this.answerRating(runId)!
    })
  }
  recordMcpCall(id: string) {
    this.db.exec('CREATE TABLE IF NOT EXISTS mcp_calls (agent_id TEXT PRIMARY KEY, at TEXT NOT NULL)')
    this.db.prepare('INSERT OR REPLACE INTO mcp_calls VALUES (?,?)').run(id, new Date().toISOString())
  }
  lastMcpCall(id: string) {
    this.db.exec('CREATE TABLE IF NOT EXISTS mcp_calls (agent_id TEXT PRIMARY KEY, at TEXT NOT NULL)')
    return this.db.prepare('SELECT at FROM mcp_calls WHERE agent_id=?').get(id)?.at ?? null
  }
  private readonly validatedRuns = new ExactCache<string>(32)
  private readonly statements = new Map<string, StatementSync>()
  private prepare(sql: string): StatementSync {
    let statement = this.statements.get(sql)
    if (!statement) {
      statement = this.db.prepare(sql)
      // SQL shapes are fixed; bound future dynamic callers as well.
      if (this.statements.size >= 128) this.statements.delete(this.statements.keys().next().value!)
      this.statements.set(sql, statement)
    }
    return statement
  }
  private readonly db: DatabaseSync
  /** Hash-chained operator ledger (#288). Entries are written inside the same transactions as the state they describe. */
  readonly audit: AuditLog
  readonly agentKeys: AgentKeys
  constructor(readonly path: string = 'data/app.db', private readonly onEvent?: (event: TraceEvent) => void) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS hire_reserves (run_id TEXT PRIMARY KEY, minor INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS policy_payments (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, json TEXT NOT NULL);`)
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS admissions (key TEXT NOT NULL, surface TEXT NOT NULL, principal TEXT NOT NULL, run_id TEXT UNIQUE NOT NULL, requested INTEGER NOT NULL, admitted INTEGER NOT NULL, day TEXT NOT NULL, policy_version TEXT NOT NULL, PRIMARY KEY(surface, principal, key));
      CREATE TABLE IF NOT EXISTS wallet_control (id INTEGER PRIMARY KEY CHECK(id=1), paused INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS mcp_requests (key TEXT PRIMARY KEY, question TEXT NOT NULL, run_id TEXT UNIQUE NOT NULL, budget INTEGER NOT NULL, day TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS answer_anchors (head TEXT PRIMARY KEY, run_id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS answer_ratings (run_id TEXT PRIMARY KEY REFERENCES runs(id), yes INTEGER NOT NULL CHECK(yes IN (0,1)), at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS run_audience (run_id TEXT PRIMARY KEY, audience TEXT NOT NULL CHECK(audience IN ('internal','external')));
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_run_id ON events(run_id,id);
      CREATE TABLE IF NOT EXISTS answers (run_id TEXT NOT NULL REFERENCES runs(id), version INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(run_id,version));
      CREATE TABLE IF NOT EXISTS decisions (run_id TEXT NOT NULL REFERENCES runs(id), round INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(run_id,round));
      CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS intents_run_id ON intents(run_id);
      CREATE TABLE IF NOT EXISTS receipts (intent_id TEXT PRIMARY KEY REFERENCES intents(id), json TEXT NOT NULL, token TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS grants (intent_id TEXT PRIMARY KEY REFERENCES intents(id), json TEXT NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS run_meta (run_id TEXT PRIMARY KEY REFERENCES runs(id), pinned INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS escrows (intent_id TEXT PRIMARY KEY REFERENCES intents(id), invoice TEXT UNIQUE NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS escrow_attempts (tx_hash TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS escrow_outbox (intent_id TEXT NOT NULL REFERENCES escrows(intent_id), operation TEXT NOT NULL, tx_hash TEXT UNIQUE NOT NULL, json TEXT NOT NULL, PRIMARY KEY(intent_id,operation));
      CREATE TABLE IF NOT EXISTS submissions (intent_id TEXT PRIMARY KEY REFERENCES intents(id), tx_hash TEXT UNIQUE NOT NULL, tx_blob TEXT NOT NULL, last_ledger INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS newcomer_probes (wallet TEXT PRIMARY KEY, intent_id TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS consequences (intent_id TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(intent_id,kind));
      CREATE TABLE IF NOT EXISTS recovery_checks (kind TEXT NOT NULL, intent_id TEXT NOT NULL, next_at INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(kind,intent_id));
      CREATE TABLE IF NOT EXISTS publisher_reputation (wallet TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS credential_revocations (intent_id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS manifests (intent_id TEXT PRIMARY KEY REFERENCES intents(id), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS grant_salts (intent_id TEXT PRIMARY KEY REFERENCES grants(intent_id), json TEXT NOT NULL);
    `)
    // Carry legacy checkpoint deduplication forward once; new writes persist both atomically.
    this.db.exec(`INSERT OR IGNORE INTO consequences
      SELECT i.id,'proof','legacy' FROM intents i JOIN runs r ON r.id=i.run_id
      JOIN json_each(r.json,'$.checkpoint.trustRecorded') marker ON marker.value=i.id;
      INSERT OR IGNORE INTO consequences
      SELECT i.id,'challenge',json_extract(i.json,'$.status') FROM intents i JOIN runs r ON r.id=i.run_id
      JOIN json_each(r.json,'$.checkpoint.trustRecorded') marker ON marker.value=i.id
      WHERE json_extract(i.json,'$.status') IN ('REFUNDED','CHALLENGE_REFUSED','CHALLENGE_REJECTED');`)
    // Source-row indexes, not counters: SQLite maintains these atomically even across crashes.
    // Completed history without money never enters request-path accounting or recovery.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS usage_active_runs ON runs(id) WHERE json_extract(json,'$.phase') NOT IN ('DONE','STOPPED','FAILED');
      CREATE INDEX IF NOT EXISTS usage_failed_runs ON runs(json_extract(json,'$.phase'));
      CREATE INDEX IF NOT EXISTS usage_intent_status ON intents(json_extract(json,'$.status'),run_id);
      CREATE INDEX IF NOT EXISTS usage_cancelled_intents ON intents(substr(json_extract(json,'$.createdAt'),1,10),run_id) WHERE json_extract(json,'$.escrow.state')='CANCELLED';
      CREATE INDEX IF NOT EXISTS usage_policy_run ON policy_payments(run_id,id);
      CREATE INDEX IF NOT EXISTS usage_policy_day ON policy_payments(substr(json_extract(json,'$.confirmedAt'),1,10),run_id);
      CREATE INDEX IF NOT EXISTS usage_policy_pending ON policy_payments(run_id) WHERE NOT coalesce(json_extract(json,'$.confirmedAt'),'') AND NOT coalesce(json_extract(json,'$.cancelledAt'),'');
      CREATE INDEX IF NOT EXISTS usage_open_hire ON hire_reserves(run_id) WHERE closed=0;
    `)
    if (path !== ':memory:') for (const file of [path, `${path}-wal`, `${path}-shm`]) if (existsSync(file)) chmodSync(file, 0o600)
    const escrowColumns = new Set(this.prepare('PRAGMA table_info(escrows)').all().map(r => r.name))
    if (!escrowColumns.has('owner')) this.db.exec('ALTER TABLE escrows ADD COLUMN owner TEXT')
    if (!escrowColumns.has('create_sequence')) this.db.exec('ALTER TABLE escrows ADD COLUMN create_sequence INTEGER')
    this.db.exec(`UPDATE escrows SET owner=json_extract(json, '$.publicStatus.owner'), create_sequence=json_extract(json, '$.publicStatus.createSequence') WHERE owner IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS escrow_object_identity ON escrows(owner, create_sequence);`)
    this.db.exec(`INSERT OR IGNORE INTO admissions SELECT key, 'mcp', 'operator', run_id, budget, budget, day, 'mcp-v0' FROM mcp_requests`)
    this.agentKeys = new AgentKeys(this.db)
    AuditLog.ensureSchema(this.db)
    this.db.exec('CREATE INDEX IF NOT EXISTS audit_feed_intent ON audit_log(intent_id,kind,seq)')
    this.db.exec('CREATE INDEX IF NOT EXISTS usage_admission_principal ON admissions(principal,run_id); CREATE INDEX IF NOT EXISTS usage_audit_kind_run ON audit_log(kind,run_id)')
    this.audit = new AuditLog(this.db)
    this.atomic(() => this.audit.boot(this.policySnapshot()))
  }
  /** The caps and policy version in force at boot; a change between boots is itself an audit entry. Invalid config is reported at use, not here. */
  private policySnapshot(): Record<string, unknown> | undefined {
    try {
      const policy = spendPolicy()
      return { policyVersion: POLICY_VERSION, walletDailyMinor: policy.walletDailyMinor, perPromptMaxMinor: policy.maxMinor, mcp: budgetPolicy(), envPaused: policy.paused }
    } catch { return undefined }
  }
  private transactionDepth = 0
  /** Hosted state shares the journal transaction authority; no async callbacks. */
  hostedState<T>(fn: (db: DatabaseSync) => T): T { return this.atomic(() => fn(this.db)) }
  spendingGuard?: () => boolean
  private atomic<T>(fn: () => T): T {
    const depth = this.transactionDepth++, savepoint = `nested_${depth}`
    this.db.exec(depth ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE')
    try { const result = fn(); this.db.exec(depth ? `RELEASE ${savepoint}` : 'COMMIT'); return result }
    catch (error) { this.db.exec(depth ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK'); throw error }
    finally { this.transactionDepth-- }
  }
  withTransaction<T>(apply: () => T): T { return this.atomic(apply) }
  consequence(intentId: string, kind: string): string | undefined {
    return this.prepare('SELECT value FROM consequences WHERE intent_id=? AND kind=?').get(intentId,kind)?.value as string | undefined
  }
  applyConsequence<T>(intentId: string, kind: string, value: string, apply: () => T): T | undefined {
    return this.atomic(() => {
      if (this.consequence(intentId,kind)) return undefined
      const result = apply()
      this.prepare('INSERT INTO consequences VALUES (?,?,?)').run(intentId,kind,value)
      return result
    })
  }
  recoveryChecked(kind: string, intentId: string) {
    this.prepare(`INSERT INTO recovery_checks VALUES (?,?,?,1) ON CONFLICT(kind,intent_id) DO UPDATE SET
      next_at=? + min(60000,1000 * (1 << min(attempts,6))), attempts=attempts+1`).run(kind,intentId,Date.now()+1000,Date.now())
  }
  pendingChallenges(limit = 16): PurchaseIntent[] {
    return this.rows<PurchaseIntent>(`SELECT i.json FROM intents i LEFT JOIN recovery_checks c ON c.kind='challenge' AND c.intent_id=i.id
      WHERE json_extract(i.json,'$.status') IN ('CLAIM_FAILED','CHALLENGED') AND coalesce(c.next_at,0)<=?
      ORDER BY coalesce(c.next_at,0),i.rowid LIMIT ?`,String(Date.now()),String(limit))
  }
  private rows<T>(sql: string, ...args: string[]): T[] {
    return this.prepare(sql).all(...args).map(row => JSON.parse(row.json as string) as T)
  }
  private rawRun(runId: string): RunSnapshot {
    const row = this.prepare('SELECT json FROM runs WHERE id=?').get(runId)
    if (!row) throw new Error('Run not found')
    const bytes = row.json as string
    const cached = this.validatedRuns.get(bytes)
    if (cached !== undefined) return JSON.parse(cached) as RunSnapshot
    const run = RunSnapshotSchema.parse(JSON.parse(bytes))
    this.validatedRuns.set(bytes, JSON.stringify(run))
    return run
  }
  private saveRun(run: RunSnapshot): void {
    this.prepare('UPDATE runs SET json=? WHERE id=?').run(JSON.stringify(RunSnapshotSchema.parse(run)), run.runId)
  }
  private saveIntent(intent: PurchaseIntent): void {
    this.prepare('UPDATE intents SET json=? WHERE id=?').run(JSON.stringify(PurchaseIntentSchema.parse(intent)), intent.intentId)
  }
  private insertRun(question: string, budgetMinor: number, labels?: ModeLabels): RunSnapshot {
    const run = RunSnapshotSchema.parse({ runId: randomUUID(), question, budgetMinor, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: BUDGET.capMinor,
      phase: 'SEARCH', stopped: false, round: 0, candidates: [], contents: [], answers: [], decisions: [], intents: [], receipts: [], grants: [], events: [], checkpoint: {}, reportStatus: 'NONE',
      labels: labels ?? { research: 'fixture', decision: 'fixture', publisher: 'local', settlement: 'SIMULATED SGD · no real funds' } })
    this.prepare('INSERT INTO runs VALUES (?,?)').run(run.runId, JSON.stringify(run))
    const audience = runAudience.getStore() ?? 'internal'
    if (audience !== 'unclassified') this.prepare('INSERT INTO run_audience VALUES (?,?)').run(run.runId, audience)
    return run
  }
  createRun(question: string, budgetMinor: number, labels?: ModeLabels): RunSnapshot {
    return this.getRun(this.insertRun(question, budgetMinor, labels).runId)
  }
  /** Gross charges by receipt day; unfinished budgets and uncertain submissions carry across midnight. */
  private usage(day: string, surface?: Surface, excludeRun?: string, principal?: string) {
    let spentMinor = 0, reservedMinor = 0
    // UNION deduplicates candidate IDs; primary-key order preserves the oracle's JS addition order
    // (policy drops may be fractional minor units). Only hydrate contributing source rows.
    const candidates = this.prepare(`WITH relevant(id) AS (
      SELECT id FROM runs INDEXED BY usage_active_runs WHERE json_extract(json,'$.phase') NOT IN ('DONE','STOPPED','FAILED')
      UNION SELECT run_id FROM hire_reserves WHERE closed=0
      UNION SELECT run_id FROM intents WHERE json_extract(json,'$.status') IN ('RESERVED','SUBMITTING')
      UNION SELECT i.run_id FROM intents i LEFT JOIN receipts r ON r.intent_id=i.id
        WHERE json_extract(i.json,'$.status') IN ('SETTLED','DELIVERY_PENDING','DELIVERY_FAILED','VERIFIED','CLAIM_FAILED','CHALLENGED','REFUNDED','CHALLENGE_REJECTED','CHALLENGE_REFUSED')
        AND (r.intent_id IS NULL OR substr(json_extract(r.json,'$.settledAt'),1,10)=?)
      UNION SELECT run_id FROM intents WHERE json_extract(json,'$.escrow.state')='CANCELLED' AND substr(json_extract(json,'$.createdAt'),1,10)=?
      UNION SELECT run_id FROM policy_payments WHERE substr(json_extract(json,'$.confirmedAt'),1,10)=?
      UNION SELECT run_id FROM policy_payments WHERE NOT coalesce(json_extract(json,'$.confirmedAt'),'') AND NOT coalesce(json_extract(json,'$.cancelledAt'),'')
    ) SELECT r.id, json_extract(r.json,'$.phase') AS phase, json_extract(r.json,'$.budgetMinor') AS budgetMinor,
      (SELECT json_group_array(json(i.json) ORDER BY i.rowid) FROM intents i WHERE i.run_id=r.id) AS intents,
      (SELECT json_group_array(json(t.json)) FROM receipts t JOIN intents i ON i.id=t.intent_id WHERE i.run_id=r.id) AS receipts,
      (SELECT json_group_array(json(p.json) ORDER BY p.id) FROM policy_payments p WHERE p.run_id=r.id) AS payments,
      h.minor AS holdMinor, h.closed AS holdClosed
      FROM relevant v JOIN runs r ON r.id=v.id LEFT JOIN admissions a ON a.run_id=r.id LEFT JOIN hire_reserves h ON h.run_id=r.id
      WHERE (? IS NULL OR a.surface=?) AND (? IS NULL OR a.principal=?) ORDER BY r.id`)
      .all(day, day, day, surface ?? null, surface ?? null, principal ?? null, principal ?? null)
    for (const row of candidates) {
      const id = row.id as string
      const run = { phase: String(row.phase), budgetMinor: Number(row.budgetMinor) }
      const intents = JSON.parse(String(row.intents)) as PurchaseIntent[]
      const receipts = JSON.parse(String(row.receipts)) as Receipt[]
      const charged = intents.filter(i => chargedStatuses.has(i.status))
      const policy = JSON.parse(String(row.payments)) as PolicyPayment[]
      const policySpent = policy.filter(p => p.confirmedAt).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
      const policyReserved = policy.filter(p => !p.confirmedAt && !p.cancelledAt).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
      spentMinor += policy.filter(p => p.confirmedAt?.slice(0, 10) === day).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
      const hold = row.holdMinor === null ? undefined : { minor: Number(row.holdMinor), closed: Number(row.holdClosed) }
      spentMinor += intents.filter(i => i.escrow?.state === 'CANCELLED' && i.createdAt?.slice(0, 10) === day).reduce((sum, i) => sum + i.amountMinor, 0)
      const gross = charged.reduce((sum, i) => sum + i.amountMinor, 0) + policySpent
      spentMinor += charged.reduce((sum, i) => {
        const receipt = receipts.find(r => r.intentId === i.intentId)
        return sum + (!receipt || receipt.settledAt.slice(0, 10) === day ? i.amountMinor : 0)
      }, 0)
      if (id !== excludeRun && (hold && !hold.closed || !['DONE', 'STOPPED', 'FAILED'].includes(run.phase) || intents.some(i => reservedStatuses.has(i.status)))) {
        reservedMinor += Math.max(policyReserved, run.budgetMinor + Number(hold?.minor ?? 0) - gross)
      } else if (id !== excludeRun) reservedMinor += policyReserved
    }
    return { spentMinor, reservedMinor }
  }
  addAgent(input: { name: string; maxMinor: number; dailyMinor: number }) {
    return this.atomic(() => {
      const created = this.agentKeys.add(input)
      const { token: _token, ...key } = created
      this.audit.append({ kind: 'agent-create', surface: 'agent', principal: key.id, data: key })
      return created
    })
  }
  /** Same durable pause path as the wallet, scoped to a principal. Revocation is permanent. */
  setAgentPaused(id: string, paused: boolean, revoke = false, reason?: string) {
    return this.atomic(() => {
      const key = this.agentKeys.control(id, paused, revoke)
      this.audit.append({ kind: 'pause', surface: 'agent', principal: id, data: { paused: key.paused, revoked: key.revoked, ...(reason ? { reason } : {}), policyVersion: POLICY_VERSION } })
      return key
    })
  }
  runPrincipal(runId: string) { return this.prepare('SELECT surface, principal FROM admissions WHERE run_id=?').get(runId) as { surface: Surface; principal: string } | undefined }
  private runAgent(runId: string) {
    const identity = this.runPrincipal(runId)
    return identity?.surface === 'agent' ? this.agentKeys.get(identity.principal) : undefined
  }
  private principalPaused(runId: string) {
    const identity = this.runPrincipal(runId), key = this.runAgent(runId)
    return identity?.surface === 'agent' && (!key || key.paused || key.revoked)
  }
  agentStatus(id: string, day = new Date().toISOString().slice(0, 10)) {
    return this.atomic(() => {
      const key = this.agentKeys.get(id)
      if (!key) throw new AgentDenied('Agent key not found')
      const from = new Date(`${day}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 6)
      const receipts = receiptRows(this.db, { from: from.toISOString().slice(0, 10), to: day, principal: id }).filter(r => r.principal === id && r.kind !== 'inbound')
      return { ...key, maxMinor: Math.min(key.maxMinor, spendPolicy().maxMinor), dailyMinor: Math.min(key.dailyMinor, spendPolicy().walletDailyMinor),
        ...this.usage(day, undefined, undefined, id), spent7DaysMinor: receipts.reduce((s, r) => s + (typeof r.amountMinor === 'number' ? r.amountMinor : Number(r.amountDrops) / DROPS_PER_MINOR), 0),
        rails: [...new Set(receipts.map(r => r.label))] }
    })
  }
  isPaused() {
    return Boolean(this.spendingGuard?.()) || spendPolicy().paused || Boolean(this.prepare('SELECT paused FROM wallet_control WHERE id=1').get()?.paused)
  }
  setPaused(paused: boolean, actor: { surface?: string; principal?: string; reason?: string } = {}) {
    this.atomic(() => {
      const previous = this.isPaused()
      this.prepare('INSERT INTO wallet_control VALUES (1,?) ON CONFLICT(id) DO UPDATE SET paused=excluded.paused').run(Number(paused))
      this.audit.append({ kind: 'pause', surface: actor.surface ?? 'operator', principal: actor.principal ?? 'operator',
        data: { paused, ...(actor.reason ? { reason: actor.reason } : {}), previousEffectivePaused: previous, effectivePaused: this.isPaused(), envPaused: spendPolicy().paused, policyVersion: POLICY_VERSION } })
    })
  }
  walletStatus(day = new Date().toISOString().slice(0, 10)) {
    return this.atomic(() => {
      const paused = this.isPaused()
      return { ...this.usage(day), dailyMinor: spendPolicy().walletDailyMinor,
        paused, label: paused ? PAUSED : 'Spending enabled', policyVersion: POLICY_VERSION }
    })
  }
  mcpStatus(day = new Date().toISOString().slice(0, 10)) { return this.atomic(() => this.usage(day, 'mcp')) }
  isHireRun(runId: string) { return !!this.prepare('SELECT run_id FROM hire_reserves WHERE run_id=?').get(runId) }
  /** Read-only identity lookup for capacity admission; preserves the original durable key. */
  admissionRun(surface: Surface, principal: string, key: string) {
    const row = this.prepare('SELECT run_id FROM admissions WHERE surface=? AND principal=? AND key=?').get(surface, principal, key) as { run_id: string } | undefined
    return row ? this.getRun(row.run_id) : undefined
  }
  isMcpRun(runId: string) { return !!this.prepare("SELECT key FROM admissions WHERE run_id=? AND surface IN ('mcp','agent')").get(runId) }
  /** Key insertion, wallet/surface reservation and run creation commit before async work. */
  admit(input: { surface: Surface; principal: string; question: string; requestedMinor: number;
    idempotencyKey: string; maxMinor: number; dailyMinor?: number; labels?: ModeLabels; reserveMinor?: number }, day = new Date().toISOString().slice(0, 10)) {
    const admitted = this.atomic(() => {
      const agent = input.surface === 'agent' ? this.agentKeys.get(input.principal) : undefined
      if (input.surface === 'agent' && (!agent || agent.revoked || agent.paused)) throw new AgentDenied('Agent paused or revoked')
      const old = this.prepare('SELECT run_id FROM admissions WHERE surface=? AND principal=? AND key=?').get(input.surface, input.principal, input.idempotencyKey)
      if (old) {
        const run = this.rawRun(old.run_id as string)
        if (run.question !== input.question) throw new Error('Idempotency key belongs to a different question')
        return { run, reused: true }
      }
      if (![input.requestedMinor, input.maxMinor, input.dailyMinor ?? 0, input.reserveMinor ?? 0].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid spending limits')
      const wallet = this.usage(day), surface = this.usage(day, agent ? undefined : input.surface, undefined, agent?.id)
      const remaining = Math.max(0, spendPolicy().walletDailyMinor - wallet.spentMinor - wallet.reservedMinor)
      const dailyMinor = agent?.dailyMinor ?? input.dailyMinor
      const surfaceRemaining = dailyMinor === undefined ? remaining : Math.max(0, dailyMinor - surface.spentMinor - surface.reservedMinor)
      const budget = this.isPaused() ? 0 : clampBudget(input.requestedMinor, Math.max(0, Math.min(input.maxMinor, agent ? agent.maxMinor - (input.reserveMinor ?? 0) : input.maxMinor)), Math.max(0, Math.min(remaining, surfaceRemaining) - (input.reserveMinor ?? 0)))
      const run = this.insertRun(input.question, budget, input.labels)
      if (input.reserveMinor && (this.isPaused() || Math.min(remaining, surfaceRemaining, agent?.maxMinor ?? Infinity) < input.reserveMinor)) throw new Error('Wallet cannot reserve hire fee')
      if (input.reserveMinor) this.prepare('INSERT INTO hire_reserves (run_id, minor) VALUES (?,?)').run(run.runId, input.reserveMinor)
      if (budget < input.requestedMinor) run.checkpoint.budgetReason = this.isPaused() ? 'paused' : input.maxMinor === 0 || agent?.maxMinor === 0 ? 'cap_zero' : Math.max(0, Math.min(input.maxMinor, agent?.maxMinor ?? Infinity) - (input.reserveMinor ?? 0)) <= Math.max(0, Math.min(remaining, surfaceRemaining) - (input.reserveMinor ?? 0)) ? 'per_call_cap' : 'budget_exhausted'
      run.policyVersion = POLICY_VERSION
      this.saveRun(run)
      this.prepare('INSERT INTO admissions VALUES (?,?,?,?,?,?,?,?)').run(input.idempotencyKey, input.surface, input.principal, run.runId, input.requestedMinor, budget, day, POLICY_VERSION)
      this.audit.append({ runId: run.runId, kind: 'admission', surface: input.surface, principal: input.principal, data: {
        requestedMinor: input.requestedMinor, admittedMinor: budget, maxMinor: input.maxMinor, surfaceDailyMinor: dailyMinor ?? null, agentMaxMinor: agent?.maxMinor ?? null, walletDailyMinor: spendPolicy().walletDailyMinor,
        walletRemainingMinor: remaining, surfaceRemainingMinor: surfaceRemaining, hireReserveMinor: input.reserveMinor ?? 0, paused: this.isPaused(), policyVersion: POLICY_VERSION, day,
        questionCommitment: this.audit.questionCommitment(run.runId, input.question), labels: input.labels ?? null } })
      if (budget === 0) this.audit.append({ runId: run.runId, kind: 'refusal', surface: input.surface, principal: input.principal, data: { stage: 'admission', policyVersion: POLICY_VERSION,
        reason: this.isPaused() ? PAUSED : 'No budget left under the wallet or surface caps; nothing can be spent' } })
      return { run, reused: false }
    })
    return { ...admitted, run: this.getRun(admitted.run.runId) }
  }
  createMcpRun(question: string, requestedMinor: number, key: string, policy: { maxMinor: number; dailyMinor: number }, labels?: ModeLabels, day = new Date().toISOString().slice(0, 10)) {
    return this.admit({ surface: 'mcp', principal: 'operator', question, requestedMinor, idempotencyKey: key,
      maxMinor: policy.maxMinor, dailyMinor: policy.dailyMinor, labels }, day)
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
      const paid = this.prepare('SELECT g.content, g.json AS grant_json, i.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(runId)
        .filter(row => (JSON.parse(row.json as string) as PurchaseIntent).status === 'VERIFIED' && (!(JSON.parse(row.json as string) as PurchaseIntent).escrow || (JSON.parse(row.json as string) as PurchaseIntent).escrow?.state === 'RELEASED'))
        .map(row => {
          const grant = GrantSchema.parse(JSON.parse(row.grant_json as string))
          const content = ContentEnvelopeSchema.parse(JSON.parse(row.content as string))
          // This is the shared release boundary for research, snapshots and exports. The join and
          // filter above require a stored, verified grant and a released escrow before any bytes leave.
          // Both the grant and its first passage reads commit in this transaction, before returning.
          const recorded = this.prepare("SELECT kind, data FROM audit_log WHERE run_id=? AND intent_id=? AND kind IN ('grant','read_paid')").all(runId, grant.intentId)
          if (!recorded.some(e => e.kind === 'grant')) this.audit.append({ runId, intentId: grant.intentId, kind: 'grant', data: { contentDigest: grant.contentDigest } })
          const read = new Set(recorded.filter(e => e.kind === 'read_paid').map(e => (JSON.parse(e.data as string) as { passageId: string }).passageId))
          for (const passage of content.spans) if (!read.has(passage.id)) this.audit.append({ runId, intentId: grant.intentId, kind: 'read_paid', data: {
            passageId: passage.id, passageSha256: createHash('sha256').update(passage.text, 'utf8').digest('hex'),
          } })
          return content
        })
      run.contents = [...run.contents.filter(content => run.candidates.some(c => c.tier === 'FREE' && sameResource(c, content))), ...paid]
      run.spentMinor = run.intents.filter(i => chargedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      run.reservedMinor = run.intents.filter(i => reservedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      run.refundedMinor = run.intents.reduce((sum, i) => sum + (i.refund?.amountMinor ?? 0) + (i.escrow?.holdback?.state === 'refunded' ? i.escrow.holdback.amountMinor : 0), 0)
      return RunSnapshotSchema.parse(run)
    })
  }
  /** Operational selectors never hydrate retained bodies or event arrays. */
  runnableRunIds(includeHire = false): string[] {
    return this.prepare(`SELECT id FROM runs r INDEXED BY usage_active_runs WHERE json_extract(r.json,'$.phase') NOT IN ('DONE','STOPPED','FAILED')
      ${includeHire ? '' : 'AND NOT EXISTS (SELECT 1 FROM hire_reserves h WHERE h.run_id=r.id)'} ORDER BY r.rowid`).all().map(r => String(r.id))
  }
  recoverableRunIds(): string[] {
    return this.prepare(`SELECT id FROM runs r WHERE json_extract(r.json,'$.phase')='FAILED'
      AND NOT json_extract(r.json,'$.stopped') AND NOT EXISTS (SELECT 1 FROM hire_reserves h WHERE h.run_id=r.id)
      AND json_extract(r.json,'$.checkpoint.intentId') IS NOT NULL AND json_extract(r.json,'$.checkpoint.intentId') != ''
      AND (json_extract(r.json,'$.checkpoint.answeredIntentId') IS NOT json_extract(r.json,'$.checkpoint.intentId')
        OR json_extract(r.json,'$.checkpoint.recoveryIntentId')=json_extract(r.json,'$.checkpoint.intentId'))
      AND EXISTS (SELECT 1 FROM intents i WHERE i.run_id=r.id AND i.id=json_extract(r.json,'$.checkpoint.intentId') AND json_extract(i.json,'$.status')='VERIFIED')
      ORDER BY r.rowid`).all().map(r => String(r.id))
  }
  operationalUsage() {
    const rows = this.prepare(`SELECT run_id, json_extract(json,'$.type') AS type, json_extract(json,'$.data') AS data FROM events
      WHERE json_extract(json,'$.type') IN ('MODEL_USAGE','MODEL_FALLBACK','DECISION_UNAVAILABLE')`).all()
    const usage = new Map<string, Record<string, unknown>[]>()
    let llm = 0, decisionUnavailable = 0
    for (const row of rows) {
      if (row.type === 'MODEL_FALLBACK') llm++
      else if (row.type === 'DECISION_UNAVAILABLE') decisionUnavailable++
      else { const id = String(row.run_id); const values = usage.get(id) ?? []; values.push(row.data ? JSON.parse(String(row.data)) : {}); usage.set(id, values) }
    }
    return { fallbacks: { llm, decisionUnavailable, decision: Number(this.prepare(`SELECT count(*) AS n FROM decisions WHERE json_extract(json,'$.fallbackReason') IS NOT NULL AND json_extract(json,'$.fallbackReason') != ''`).get()!.n) },
      modelUsageByRun: this.prepare('SELECT id FROM runs ORDER BY rowid').all().map(row => {
        const values = usage.get(String(row.id)) ?? []
        return { runId: String(row.id), reportedCalls: values.length,
          inputTokens: values.length ? values.reduce((n,u) => n + Number(u.inputTokens ?? 0),0) : null,
          outputTokens: values.length ? values.reduce((n,u) => n + Number(u.outputTokens ?? 0),0) : null,
          estimatedUsd: values.length && values.every(u => typeof u.estimatedUsd === 'number') ? values.reduce((n,u) => n + Number(u.estimatedUsd),0) : null }
      }) }
  }
  pendingRefunds(limit = 16): PurchaseIntent[] {
    return this.rows<PurchaseIntent>(`SELECT i.json FROM intents i LEFT JOIN recovery_checks c ON c.kind='refund' AND c.intent_id=i.id WHERE json_extract(i.json,'$.refundCandidate') IS NOT NULL
      AND json_extract(i.json,'$.status') IN ('CHALLENGED','CHALLENGE_REFUSED') AND coalesce(c.next_at,0)<=? ORDER BY coalesce(c.next_at,0),i.rowid LIMIT ?`, String(Date.now()), String(limit))
  }
  recordRefundCandidate(intentId: string, txHash: string): void {
    this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || !['CHALLENGED','CHALLENGE_REFUSED'].includes(intent.status)) return
      this.saveIntent({ ...intent, refundCandidate: { txHash, observedAt: new Date().toISOString() } })
    })
  }
  listRuns(): RunSnapshot[] { return this.prepare('SELECT id FROM runs ORDER BY rowid').all().map(row => this.getRun(row.id as string)) }
  /** Sidebar history, newest first: every pinned run, then the `recent` latest others. Deleting only hides a run: its receipts and ledger rows stay (one charge per intent). */
  listPastRuns(recent = 4, principal?: string): { runId: string; question: string; phase: RunSnapshot['phase']; stopped: boolean; budgetMinor: number; spentMinor: number; at: string; pinned: boolean }[] {
    return pastRunSummaries(this.db, { recent, principal })
  }

  setRunMeta(runId: string, change: { pinned?: boolean; hidden?: boolean }): void {
    this.rawRun(runId)
    this.prepare('INSERT OR IGNORE INTO run_meta (run_id) VALUES (?)').run(runId)
    if (change.pinned !== undefined) this.prepare('UPDATE run_meta SET pinned=? WHERE run_id=?').run(change.pinned ? 1 : 0, runId)
    if (change.hidden !== undefined) this.prepare('UPDATE run_meta SET hidden=? WHERE run_id=?').run(change.hidden ? 1 : 0, runId)
  }
  updateRun(runId: string, patch: Partial<RunSnapshot>): RunSnapshot {
    this.updateRunState(runId, patch)
    return this.getRun(runId)
  }
  /** Persist metadata without hydrating an unused full event/content projection. */
  updateRunState(runId: string, patch: Partial<RunSnapshot>): void {
    const allowed = new Set(['ledgerAnchor', 'phase', 'stopped', 'round', 'candidates', 'labels', 'checkpoint', 'error', 'reportStatus'])
    if (Object.keys(patch).some(key => !allowed.has(key))) throw new Error('Protected run fields require ledger APIs')
    publicMetadata(patch.checkpoint)
    this.atomic(() => {
      const run = this.rawRun(runId)
      if (run.stopped && patch.stopped === false) throw new Error('A stopped run cannot resume spending')
      if (patch.candidates) {
        if (patch.candidates.some(c => c.source) && patch.candidates.some(c => !c.source)) throw new Error('Cannot mix unresolved legacy sources with federated identities; start a new run')
        const identities = patch.candidates.map(c => sourceKey(c))
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
      if (run.phase !== patch.phase && patch.phase && (run.phase === 'FAILED' && patch.phase === 'READ_PAID' || run.checkpoint.recoveryIntentId && patch.phase === 'DONE')) this.audit.append({ runId, intentId: run.checkpoint.intentId, kind: 'recovery', data: { from: run.phase, to: patch.phase, answerVersion: run.checkpoint.answerVersion ?? 0, noNewSpending: true } })
    })
  }
  /** Write once per phase, atomically with the hash-chained audit evidence. */
  recordTiming(intentId: string, phase: SettlementPhase, detail: Partial<PhaseObservation> = {}, startedAt?: string) {
    if (process.env.SETTLEMENT_TIMING !== '1') return
    this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || intent.timing?.phases[phase]) return
      const start = intent.timing?.startedAt ?? startedAt ?? new Date().toISOString()
      const at = detail.at ?? new Date().toISOString()
      const observation = PhaseObservationSchema.parse({ at, elapsedMs: Math.max(0, Date.parse(at) - Date.parse(start)), source: 'buyer', ...detail })
      const timing = { startedAt: start, phases: { ...intent.timing?.phases, [phase]: observation } }
      this.saveIntent({ ...intent, timing })
      const receipt = this.rows<Receipt>('SELECT json FROM receipts WHERE intent_id=?', intentId)[0]
      if (receipt) this.prepare('UPDATE receipts SET json=? WHERE intent_id=?').run(JSON.stringify({ ...receipt, timing }), intentId)
      this.audit.append({ runId: intent.runId, intentId, kind: 'settlement-timing', data: { phase, startedAt: start, ...observation } })
    })
    const intent = this.getIntent(intentId)!
    if (!this.getRun(intent.runId).events.some(e => e.type === 'SETTLEMENT_TIMING' && e.data?.intentId === intentId && e.data?.phase === phase))
      this.appendEvent(intent.runId, { type: 'SETTLEMENT_TIMING', label: 'Payment timing observed', data: { intentId, phase, ...intent.timing?.phases[phase] } })
  }
  appendEvent(runId: string, input: Omit<TraceEvent, 'id' | 'runId' | 'at'>): TraceEvent {
    publicMetadata(input.data)
    const event = this.atomic(() => {
      this.rawRun(runId)
      const result = this.prepare('INSERT INTO events (run_id,json) VALUES (?,?)').run(runId, '{}')
      const event = TraceEventSchema.parse({ ...input, id: Number(result.lastInsertRowid), runId, at: new Date().toISOString() })
      this.prepare('UPDATE events SET json=? WHERE id=?').run(JSON.stringify(event), event.id)
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
      if (!run.contents.some(c => sameSource(c, citation) && c.spans.some(s => s.id === citation.spanId && c.body.includes(s.text)))) throw new Error('Answer cites inaccessible content')
    }
    this.atomic(() => {
      this.prepare('INSERT INTO answers VALUES (?,?,?)').run(runId, answer.version, JSON.stringify(answer))
      if (impact) this.saveRun({ ...this.rawRun(runId), impact: ImpactSchema.parse(impact) })
    })
  }
  addDecision(runId: string, decision: DecisionRound): void {
    const parsed = DecisionRoundSchema.parse(decision)
    this.atomic(() => {
      this.prepare('INSERT INTO decisions VALUES (?,?,?)').run(runId, parsed.round, JSON.stringify(parsed))
      const verdicts: Record<string, number> = {}
      for (const row of parsed.rows) verdicts[row.verdict] = (verdicts[row.verdict] ?? 0) + 1
      this.audit.append({ runId, kind: 'decision', data: { round: parsed.round, provider: parsed.provider, model: parsed.model, promptVersion: parsed.promptVersion ?? null, threshold: parsed.threshold,
        calibration: parsed.calibration ? { id: parsed.calibration.id, version: parsed.calibration.version } : null, candidatesJudged: parsed.rows.length, verdicts,
        selectedSourceKey: parsed.selectedSourceKey ?? null, selectedResourceId: parsed.selectedResourceId ?? null, fallbackReason: parsed.fallbackReason?.slice(0, 200) ?? null } })
    })
  }
  addContent(runId: string, input: ContentEnvelope): void {
    const content = ContentEnvelopeSchema.parse(input)
    if (content.spans.some(s => !content.body.includes(s.text))) throw new Error('Span is not an exact substring')
    this.atomic(() => {
      const run = this.rawRun(runId)
      if (!run.candidates.some(c => c.tier === 'FREE' && sameResource(c, content))) {
        const granted = this.prepare('SELECT g.content, i.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(runId).some(row => JSON.stringify(content) === row.content && (JSON.parse(row.json as string) as PurchaseIntent).status === 'VERIFIED')
        if (!granted) throw new Error('Paid or unknown content requires verified grant')
        return
      }
      const old = run.contents.find(c => sameResource(c, content))
      if (old && JSON.stringify(old) !== JSON.stringify(content)) throw new Error('Content version is immutable')
      if (!old) this.saveRun({ ...run, contents: [...run.contents, content] })
    })
  }
  getIntent(intentId: string): PurchaseIntent | undefined { return this.rows<PurchaseIntent>('SELECT json FROM intents WHERE id=?', intentId)[0] }
  reconciliationIntents(includeSubmitting = false): PurchaseIntent[] {
    return this.rows<PurchaseIntent>(`SELECT json FROM intents WHERE json_extract(json,'$.status') IN
      ('SETTLED','DELIVERY_PENDING','DELIVERY_FAILED'${includeSubmitting ? ",'SUBMITTING'" : ''}) ORDER BY rowid`)
  }
  listIntents(status?: PurchaseIntent['status']): PurchaseIntent[] {
    return status ? this.rows<PurchaseIntent>("SELECT json FROM intents WHERE json_extract(json,'$.status')=? ORDER BY rowid", status) : this.rows<PurchaseIntent>('SELECT json FROM intents ORDER BY rowid')
  }
  skipEscrow(input: PurchaseIntent, reason: string, scheme = 'escrow-v1'): PurchaseIntent {
    return this.atomic(() => {
      const old = this.getIntent(input.intentId)
      if (old) return old
      const next = PurchaseIntentSchema.parse({ ...input, status: 'SKIPPED', error: reason, createdAt: new Date().toISOString() })
      this.prepare('INSERT INTO intents VALUES (?,?,?)').run(next.intentId, next.runId, JSON.stringify(next))
      this.audit.append({ runId: next.runId, intentId: next.intentId, kind: 'refusal', data: { scheme, reason, amountMinor: next.amountMinor, ...(next.source ? { source: next.source, resourceId: next.resourceId, version: next.version, profileId: next.profileId } : {}) } })
      return next
    })
  }
  /** A reservation counts as a prior sale here, closing the concurrent-run window. */
  probeAvailable(wallet: string): boolean {
    const history = this.getReputation(wallet)
    if (history && (history.passes > 0 || history.fails > 0)) return false
    return !this.prepare('SELECT wallet FROM newcomer_probes WHERE wallet=?').get(wallet)
      && !this.prepare(`SELECT id FROM intents WHERE json_extract(json,'$.quote.payment.payTo')=?
        AND json_extract(json,'$.status') NOT IN ('SKIPPED','FAILED_NOT_SETTLED') LIMIT 1`).get(wallet)
  }
  reserveIntent(input: PurchaseIntent): PurchaseIntent {
    const intent = PurchaseIntentSchema.parse(input)
    if (!sourceBinding(intent)) throw new Error('Source identity mismatch')
    return this.atomic(() => {
      const existing = this.getIntent(intent.intentId)
      if (existing) {
        if (!sameSource(existing, intent) || ['runId', 'profileId', 'resourceId', 'version', 'amountMinor'].some(key => existing[key as keyof PurchaseIntent] !== intent[key as keyof PurchaseIntent])) throw new Error('Intent identity mismatch')
        return existing
      }
      const run = this.rawRun(intent.runId)
      const decision = this.rows<DecisionRound>('SELECT json FROM decisions WHERE run_id=? ORDER BY round', intent.runId).at(-1)
      const pick = decision?.rows.find(row => row.probe && row.verdict === 'BUY' && sameSource(row.candidate, intent) && decision.selectedResourceId === intent.resourceId)
      const candidate = pick && run.candidates.find(c => sameSource(c, intent))
      const probe = !!pick
      const quote = intent.quote
      if (!quote || !sameSource(quote, intent) || quote.intentId !== intent.intentId || quote.runId !== intent.runId || quote.profileId !== intent.profileId || quote.resourceId !== intent.resourceId || quote.version !== intent.version) throw new Error('Quote identity mismatch')
      const intents = this.rows<PurchaseIntent>('SELECT json FROM intents WHERE run_id=?', intent.runId)
      const committed = intents.filter(i => reservedStatuses.has(i.status) || chargedStatuses.has(i.status) || i.escrow?.state === 'CANCELLED').reduce((sum, i) => sum + i.amountMinor, 0)
      let error: string | undefined
      if (probe && (!candidate || !probeMetadata(run.question, candidate, run.candidates[0]) || candidate.price.amountMinor !== intent.amountMinor || intent.amountMinor > 30 || !candidate.wallet || !this.probeAvailable(candidate.wallet) || candidate.wallet !== quote.payment?.payTo)) error = 'New-writer probe unavailable'
      else if (quote.amountMinor !== intent.amountMinor) error = 'Quoted price differs from evaluated price'
      else if (this.isPaused() || this.principalPaused(run.runId)) error = PAUSED
      else if (!this.walletAllows(run, intent.amountMinor)) error = 'Wallet daily cap exceeded'
      else if (run.stopped) error = 'Run stopped'
      else if (run.budgetMinor === 0 || intent.amountMinor > run.perSourceCapMinor || committed + intent.amountMinor > run.budgetMinor) error = 'Budget or per-source cap exceeded'
      else if (Date.parse(quote.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(quote.expiresAt))) error = 'Quote expired'
      else if (intents.some(i => i.profileId === intent.profileId && sameSource(i, intent) && (reservedStatuses.has(i.status) || chargedStatuses.has(i.status) || i.escrow?.state === 'CANCELLED'))) error = 'Resource already purchased or reserved'
      if (probe && !error) this.prepare('INSERT INTO newcomer_probes VALUES (?,?)').run(candidate!.wallet!, intent.intentId)
      const result: PurchaseIntent = { ...intent, ...(probe && !error ? { purchaseKind: 'probe purchase · new writer' as const } : {}), status: error ? 'SKIPPED' : 'RESERVED', createdAt: new Date().toISOString(), error }
      this.prepare('INSERT INTO intents VALUES (?,?,?)').run(intent.intentId, intent.runId, JSON.stringify(result))
      const terms = { source: intent.source ?? null, resourceId: intent.resourceId, version: intent.version, profileId: intent.profileId, amountMinor: intent.amountMinor, payTo: quote.payment?.payTo ?? null, rail: quote.payment?.rail ?? null,
        runBudgetMinor: run.budgetMinor, perSourceCapMinor: run.perSourceCapMinor, committedMinor: committed, walletDailyMinor: spendPolicy().walletDailyMinor, policyVersion: run.policyVersion ?? POLICY_VERSION }
      this.audit.append(error ? { runId: intent.runId, intentId: intent.intentId, kind: 'refusal', data: { stage: 'reserve', reason: error, ...terms } }
        : { runId: intent.runId, intentId: intent.intentId, kind: 'reserve', data: { quoteHash: quote.quoteHash, ...terms } })
      return result
    })
  }
  private walletAllows(run: RunSnapshot, amount: number) {
    const usage = this.usage(new Date().toISOString().slice(0, 10), undefined, run.runId)
    const own = this.rows<PurchaseIntent>('SELECT json FROM intents WHERE run_id=?', run.runId)
      .filter(i => reservedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
    const policyReserved = this.policyPayments(run.runId).filter(p => !p.confirmedAt && !p.cancelledAt).reduce((sum, p) => sum + Number(p.amountDrops) / DROPS_PER_MINOR, 0)
    const key = this.runAgent(run.runId)
    const agentUsage = key && this.usage(new Date().toISOString().slice(0, 10), undefined, run.runId, key.id)
    return usage.spentMinor + usage.reservedMinor + own + policyReserved + amount <= spendPolicy().walletDailyMinor
      && (!agentUsage || agentUsage.spentMinor + agentUsage.reservedMinor + own + policyReserved + amount <= key!.dailyMinor)
  }
  /** CAS prevents independent managers/processes from submitting the same intent. */
  private readonly credentialAdmissions = new Map<string,{wallet:string;domain:string;until:number}>()
  acceptCredentialForIntent(intentId:string,wallet:string) {
    if(this.credentialAdmissions.size>=256)this.credentialAdmissions.delete(this.credentialAdmissions.keys().next().value!)
    this.credentialAdmissions.set(intentId,{wallet,domain:process.env.WRITER_CREDENTIAL_DOMAIN ?? '',until:Date.now()+10000})
  }
  private consumeCredentialAdmission(intent:PurchaseIntent) {
    const admission=this.credentialAdmissions.get(intent.intentId);this.credentialAdmissions.delete(intent.intentId)
    if(process.env.REGULATED_MODE!=='on')return
    const reason=screenPayee(intent.quote?.payment?.payTo ?? '')?.refusal ?? (!admission||admission.wallet!==intent.quote?.payment?.payTo||admission.domain!==process.env.WRITER_CREDENTIAL_DOMAIN||admission.until<=Date.now()?'Writer needs a fresh accepted credential; nothing was charged':undefined)
    if(reason){this.audit.append({runId:intent.runId,intentId:intent.intentId,kind:'refusal',data:{stage:'pre-broadcast',reason}});throw Error(reason)}
  }
  claimSubmitting(intentId: string): boolean {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || intent.status !== 'RESERVED') return false
      const admission=this.credentialAdmissions.get(intentId)
      const screen=process.env.REGULATED_MODE==='on' ? screenPayee(intent.quote?.payment?.payTo ?? '') : undefined
      const credentialRefusal=process.env.REGULATED_MODE==='on' && (!admission || admission.wallet!==intent.quote?.payment?.payTo || admission.domain!==process.env.WRITER_CREDENTIAL_DOMAIN || admission.until<=Date.now()) ? 'Writer needs a fresh accepted credential; nothing was charged' : undefined
      if(screen || credentialRefusal) {
        const reason=screen?.refusal ?? credentialRefusal!
        this.saveIntent({...intent,status:'SKIPPED',error:reason})
        this.audit.append({runId:intent.runId,intentId,kind:'refusal',data:{stage:'submit',reason,amountMinor:intent.amountMinor}})
        return false
      }
      if (this.isPaused() || this.principalPaused(intent.runId) || !this.walletAllows(this.rawRun(intent.runId), 0) || this.rawRun(intent.runId).stopped || Date.parse(intent.quote!.expiresAt) <= Date.now()) {
        const reason = this.isPaused() ? PAUSED : 'Run stopped, wallet capped or quote expired'
        this.saveIntent({ ...intent, status: 'SKIPPED', error: reason })
        this.audit.append({ runId: intent.runId, intentId, kind: 'refusal', data: { stage: 'submit', reason, amountMinor: intent.amountMinor, payTo: intent.quote?.payment?.payTo ?? null, policyVersion: POLICY_VERSION } })
        return false
      }
      this.saveIntent({ ...intent, status: 'SUBMITTING', submittingAt: new Date().toISOString() }); return true
    })
  }
  /** `auditContext` adds non-secret fields (e.g. the denylist reason) to the refusal entry written when the intent is refused. */
  updateIntent(intentId: string, patch: Partial<PurchaseIntent>, auditContext: Record<string, unknown> = {}): PurchaseIntent {
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
      const next = { ...intent, ...patch }; this.saveIntent(next)
      if (status !== intent.status && (status === 'SKIPPED' || status === 'FAILED_NOT_SETTLED')) this.audit.append({ runId: intent.runId, intentId, kind: 'refusal', data: {
        stage: 'purchase', reason: next.error ?? status, status, amountMinor: intent.amountMinor, payTo: intent.quote?.payment?.payTo ?? null, policyVersion: POLICY_VERSION, ...auditContext } })
      return next
    })
  }
  recordSettlement(intentId: string, input: Receipt, deliveryToken: string): void {
    const receipt = ReceiptSchema.parse(input)
    this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || !sameSource(intent, receipt) || !deliveryToken || receipt.intentId !== intentId || receipt.runId !== intent.runId || receipt.resourceId !== intent.resourceId || receipt.version !== intent.version || receipt.amountMinor !== intent.amountMinor) throw new Error('Settlement identity mismatch')
      const existing = this.rows<Receipt>('SELECT json FROM receipts WHERE intent_id=?', intentId)[0]
      if (existing) { if (existing.receiptId !== receipt.receiptId) throw new Error('Settlement receipt mismatch'); return }
      if (intent.status !== 'SUBMITTING') throw new Error('Settlement requires submitting reservation')
      this.prepare('INSERT INTO receipts VALUES (?,?,?)').run(intentId, JSON.stringify(receipt), deliveryToken)
      this.saveIntent({ ...intent, status: 'SETTLED', settledAt: receipt.settledAt, receiptId: receipt.receiptId, error: undefined })
      this.audit.append({ runId: intent.runId, intentId, kind: 'settle', data: { receiptId: receipt.receiptId, txHash: receipt.xrpl?.txHash ?? intent.txHash ?? null, ledgerIndex: receipt.xrpl?.ledgerIndex ?? null,
        asset: receipt.xrpl?.asset ?? intent.quote?.payment?.asset ?? 'XRP', deliveredAmount: receipt.xrpl?.deliveredAmount ?? null, amountMinor: receipt.amountMinor, amountDrops: receipt.xrpl?.amountDrops ?? intent.quote?.payment?.amountDrops ?? null, payTo: intent.quote?.payment?.payTo ?? null, payer: receipt.xrpl?.payer ?? null,
        label: receipt.label, resourceId: receipt.resourceId, version: receipt.version, profileId: intent.profileId, settledAt: receipt.settledAt, policyVersion: this.rawRun(intent.runId).policyVersion ?? POLICY_VERSION } })
    })
  }
  /** Private holdback journal; secrets and signed blobs never enter snapshots or audit data. */
  holdbackPrivate<T>(intentId: string, value?: T): T | undefined {
    this.db.exec('CREATE TABLE IF NOT EXISTS holdback_private (intent_id TEXT PRIMARY KEY, json TEXT NOT NULL)')
    if (value !== undefined) this.prepare('INSERT INTO holdback_private VALUES (?,?) ON CONFLICT(intent_id) DO UPDATE SET json=excluded.json').run(intentId, JSON.stringify(value))
    const row = this.prepare('SELECT json FROM holdback_private WHERE intent_id=?').get(intentId)
    return row ? JSON.parse(String(row.json)) : undefined
  }
  reserveHoldbackSequences(intentId: string, owner: string, sequences: number[]) {
    const intent = this.getIntent(intentId)!
    if (intent.status !== 'SUBMITTING' || this.isPaused() || this.principalPaused(intent.runId) || this.rawRun(intent.runId).stopped || !this.walletAllows(this.rawRun(intent.runId),0) || Date.parse(intent.quote!.expiresAt) <= Date.now()) throw Error('Batch signing authority expired')
    this.db.exec('CREATE TABLE IF NOT EXISTS holdback_sequences (owner TEXT NOT NULL, sequence INTEGER NOT NULL, intent_id TEXT NOT NULL, PRIMARY KEY(owner,sequence))')
    for (const sequence of sequences) this.prepare('INSERT INTO holdback_sequences VALUES (?,?,?)').run(owner, sequence, intentId)
  }
  releaseHoldbackSequences(intentId: string, unused = false) {
    this.db.exec('CREATE TABLE IF NOT EXISTS holdback_sequences (owner TEXT NOT NULL, sequence INTEGER NOT NULL, intent_id TEXT NOT NULL, PRIMARY KEY(owner,sequence))')
    this.prepare('DELETE FROM holdback_sequences WHERE intent_id=?').run(intentId)
    if (unused) this.prepare('UPDATE escrows SET owner=NULL, create_sequence=NULL WHERE intent_id=?').run(intentId)
  }
  updateHoldback(intentId: string, holdback: NonNullable<EscrowRecord['publicStatus']['holdback']>) {
    this.atomic(() => {
      const e = this.getEscrow(intentId)!, intent = this.getIntent(intentId)!
      e.publicStatus.holdback = holdback
      this.prepare('UPDATE escrows SET json=? WHERE intent_id=?').run(JSON.stringify(e),intentId)
      this.saveIntent({ ...intent, escrow: e.publicStatus })
      const receipt = this.rows<import('../shared/contracts/index.js').Receipt>('SELECT json FROM receipts WHERE intent_id=?',intentId)[0]
      if (receipt) this.prepare('UPDATE receipts SET json=? WHERE intent_id=?').run(JSON.stringify({ ...receipt, escrow: e.publicStatus }),intentId)
    })
  }
  getEscrow(intentId: string): EscrowRecord | undefined { return this.rows<EscrowRecord>('SELECT json FROM escrows WHERE intent_id=?', intentId)[0] }
  persistReveal(intentId: string, reveal: NonNullable<EscrowRecord['reveal']>) {
    const e = this.getEscrow(intentId)!
    if (e.reveal && (e.reveal.key !== reveal.key || e.reveal.finishHash !== reveal.finishHash || e.reveal.ledgerIndex !== reveal.ledgerIndex)) throw new Error('Reveal is immutable')
    this.prepare('UPDATE escrows SET json=? WHERE intent_id=?').run(JSON.stringify({ ...e, reveal }), intentId)
  }
  /** Persisted CredentialDelete submission, so a crash re-sends the same signed blob instead of signing twice. */
  credentialRevocation(intentId: string, submission?: import('./xrpl.js').Submission): import('./xrpl.js').Submission | undefined {
    if (submission) this.prepare('INSERT OR IGNORE INTO credential_revocations VALUES (?,?)').run(intentId, JSON.stringify(submission))
    const row = this.prepare('SELECT json FROM credential_revocations WHERE intent_id=?').get(intentId)
    return row ? JSON.parse(String(row.json)) : undefined
  }
  /** Explicit post-reveal fraud evidence; never part of ordinary snapshots or exports. */
  keyRevealEvidence(intentId: string) {
    const e = this.getEscrow(intentId)
    if (!e?.reveal || !['RELEASED'].includes(e.publicStatus.state)) throw new Error('Validated reveal required')
    return { quote: e.quote, manifest: this.getManifest(intentId), ...e.reveal, createHash: e.publicStatus.createHash }
  }
  escrowOutbox(intentId?: string): EscrowOutbox[] {
    return intentId ? this.rows('SELECT json FROM escrow_outbox WHERE intent_id=? ORDER BY rowid', intentId) : this.rows('SELECT json FROM escrow_outbox ORDER BY rowid')
  }
  prepareEscrow(record: EscrowRecord): EscrowRecord {
    return this.atomic(() => {
      const old = this.getEscrow(record.intentId)
      if (old) return old
      const intent = this.getIntent(record.intentId)
      if (intent?.status !== 'SUBMITTING' || this.getSubmission(record.intentId)) throw new Error('Escrow requires an exclusive reservation')
      this.prepare('INSERT INTO escrows (intent_id, invoice, json) VALUES (?,?,?)').run(record.intentId, record.quote.terms.quoteId, JSON.stringify(record))
      this.saveIntent({ ...intent, escrow: record.publicStatus })
      return record
    })
  }
  /** Caller must have ledger proof of failure/expiry; principal identity is never replaced. */
  retireEscrowTerminal(intentId: string, operation: 'finish' | 'cancel') {
    this.atomic(() => {
      const row = this.escrowOutbox(intentId).find(t => t.operation === operation)
      if (!row) return
      this.prepare('INSERT OR IGNORE INTO escrow_attempts VALUES (?,?)').run(row.txHash, JSON.stringify(row))
      this.prepare('DELETE FROM escrow_outbox WHERE intent_id=? AND operation=?').run(intentId, operation)
    })
  }
  recordEscrowSubmission(intentId: string, operation: EscrowOperation, signed: Submission): Submission {
    const pending=this.getIntent(intentId)
    if(operation==='create'&&pending?.status==='SUBMITTING'&&!this.escrowOutbox(intentId).some(t=>t.operation==='create'))this.consumeCredentialAdmission(pending)
    return this.atomic(() => {
      const old = this.escrowOutbox(intentId).find(r => r.operation === operation)
      if (old) return old
      const intent = this.getIntent(intentId)!, e = this.getEscrow(intentId)!
      if (!e || intent.status !== 'SUBMITTING') throw new Error('Escrow reservation unavailable')
      if (operation === 'create' && !this.holdbackPrivate<{unsigned?:unknown}>(intentId)?.unsigned && (this.isPaused() || this.principalPaused(intent.runId) || this.rawRun(intent.runId).stopped || !this.walletAllows(this.rawRun(intent.runId), 0) || Date.parse(intent.quote!.expiresAt) <= Date.now())) throw new Error('Signing authority expired')
      if (operation === 'finish' && (e.publicStatus.state !== 'VERIFIED_FOR_RELEASE' || !e.publicStatus.proofOk || this.rawRun(intent.runId).stopped || this.isPaused() || this.principalPaused(intent.runId))) throw new Error('Finish requires a verified proof and active run')
      if (operation === 'cancel' && !['LOCKED', 'VERIFIED_FOR_RELEASE', 'CANCEL_DUE'].includes(e.publicStatus.state)) throw new Error('Cancel requires a locked escrow')
      const row = { ...signed, operation, intentId }
      this.prepare('INSERT INTO escrow_outbox VALUES (?,?,?,?)').run(intentId, operation, signed.txHash, JSON.stringify(row))
      if (operation === 'create') {
        const decoded = decode(signed.txBlob)
        const tx = decoded.TransactionType === 'Batch' ? batchInners(decoded)[0] : decoded
        if (tx.TransactionType !== 'EscrowCreate' || tx.Account !== e.publicStatus.owner) throw new Error('Create identity mismatch')
        this.prepare('UPDATE escrows SET owner=?, create_sequence=? WHERE intent_id=?').run(tx.Account, Number(tx.Sequence), intentId)
        e.publicStatus.createSequence = Number(tx.Sequence)
      }
      e.publicStatus = { ...e.publicStatus, [operation + 'Hash']: operation === 'create' && e.quote.terms.holdback ? innerHash(batchInners(decode(signed.txBlob))[0]) : signed.txHash }
      this.prepare('UPDATE escrows SET json=? WHERE intent_id=?').run(JSON.stringify(e), intentId)
      this.saveIntent({ ...intent, escrow: e.publicStatus })
      this.audit.append({ runId: intent.runId, intentId, kind: 'escrow-sign', data: { operation, txHash: signed.txHash, owner: e.publicStatus.owner, createSequence: e.publicStatus.createSequence, lastLedgerSequence: signed.lastLedgerSequence, amountDrops: keyTerms(e.quote.terms).amount, payTo: e.quote.terms.payTo, invoiceHash: intent.quote!.quoteHash, proofOk: e.publicStatus.proofOk ?? false } })
      return signed
    })
  }
  escrowTransition(intentId: string, patch: Partial<EscrowRecord['publicStatus']>, ledgerIndex?: number): EscrowRecord {
    return this.atomic(() => {
      const e = this.getEscrow(intentId)!, intent = this.getIntent(intentId)!
      if (['RELEASED', 'CANCELLED'].includes(e.publicStatus.state)) return e
      const next = { ...e, publicStatus: { ...e.publicStatus, ...patch } }
      this.prepare('UPDATE escrows SET json=? WHERE intent_id=?').run(JSON.stringify(next), intentId)
      this.saveIntent({ ...intent, escrow: next.publicStatus })
      if (patch.state === 'LOCKED' && e.publicStatus.state !== 'LOCKED') this.audit.append({ runId: intent.runId, intentId, kind: 'ESCROW_CREATE', data: { txHash: next.publicStatus.createHash, owner: next.publicStatus.owner, createSequence: next.publicStatus.createSequence, ledgerIndex, result: 'tesSUCCESS', ...(e.quote.terms.holdback ? {terms:e.quote.terms} : {}), invoiceHash: intent.quote!.quoteHash, amountDrops: keyTerms(e.quote.terms).amount, payTo: e.quote.terms.payTo, cancelAfter: e.quote.terms.cancelAfter } })
      if (patch.proofOk !== undefined && patch.proofOk !== e.publicStatus.proofOk) this.audit.append({ runId: intent.runId, intentId, kind: 'proof', data: { verified: patch.proofOk, status: next.publicStatus.state, scheme: 'escrow-v1', accessible: false } })
      return next
    })
  }
  completeEscrow(intentId: string, terminal: 'finish' | 'cancel', ledgerIndex: number, observedHash?: string, failedClaimIds?: string[]): void {
    this.atomic(() => {
      const e = this.getEscrow(intentId)!, intent = this.getIntent(intentId)!
      if (['RELEASED', 'CANCELLED'].includes(e.publicStatus.state)) return
      const tx = observedHash ? { txHash: observedHash } : this.escrowOutbox(intentId).find(r => r.operation === terminal)
      if (!tx || terminal === 'finish' && !e.publicStatus.proofOk && !e.reveal) throw new Error('Terminal escrow proof missing')
      e.publicStatus = { ...e.publicStatus, state: terminal === 'finish' ? 'RELEASED' : 'CANCELLED', [terminal + 'Hash']: tx.txHash }
      const settledAt = new Date().toISOString(), terms = e.quote.terms
      const receipt = ReceiptSchema.parse({ timing: intent.timing, source: intent.source, receiptId: `escrow-${tx.txHash}`, intentId, runId: intent.runId, resourceId: intent.resourceId, version: intent.version,
        amountMinor: terminal === 'finish' ? intent.amountMinor : 0, currency: 'SGD', settledAt, label: 'XRPL TESTNET · no real value', escrow: e.publicStatus,
        xrpl: { asset: terms.asset, txHash: tx.txHash, ledgerIndex, payer: terms.payer, payTo: terminal === 'finish' ? terms.payTo : terms.payer, amountDrops: terminal === 'finish' ? terms.amount : '0', explorerUrl: `https://testnet.xrpl.org/transactions/${tx.txHash}` } })
      this.prepare('INSERT INTO receipts VALUES (?,?,?)').run(intentId, JSON.stringify(receipt), tx.txHash)
      this.prepare('UPDATE escrows SET json=? WHERE intent_id=?').run(JSON.stringify(e), intentId)
      this.saveIntent({ ...intent, escrow: e.publicStatus, status: terminal === 'finish' ? e.publicStatus.proofOk ? 'VERIFIED' : 'CLAIM_FAILED' : 'FAILED_NOT_SETTLED', settledAt, receiptId: receipt.receiptId, txHash: tx.txHash, ...(failedClaimIds ? { failedClaimIds } : {}), error: terminal === 'cancel' ? 'Escrow cancelled; principal returned, fees remain paid' : undefined })
      this.audit.append({ runId: intent.runId, intentId, kind: terminal === 'finish' ? 'ESCROW_FINISH' : 'ESCROW_CANCEL', data: { txHash: tx.txHash, ledgerIndex, owner: terms.payer, createSequence: e.publicStatus.createSequence, createHash: e.publicStatus.createHash, result: 'tesSUCCESS', proofOk: e.publicStatus.proofOk ?? false, amountDrops: keyTerms(terms).amount, payTo: terms.payTo } })
      this.audit.append({ runId: intent.runId, intentId, kind: 'settle', data: { receiptId: receipt.receiptId, txHash: tx.txHash, ledgerIndex, asset: receipt.xrpl?.asset ?? intent.quote?.payment?.asset ?? 'XRP', deliveredAmount: receipt.xrpl?.deliveredAmount ?? null, amountMinor: receipt.amountMinor, amountDrops: receipt.xrpl!.amountDrops, payTo: terms.payTo, payer: terms.payer, label: receipt.label, scheme: 'escrow-v1', state: e.publicStatus.state } })
    })
  }
  /** Write-once: the first signed payment for an intent is the only one that may ever be submitted. */
  recordSubmission(intentId: string, signed: Submission): Submission {
    const pending=this.getIntent(intentId)
    if(!this.getSubmission(intentId)&&pending?.status==='SUBMITTING')this.consumeCredentialAdmission(pending)
    return this.atomic(() => {
      const existing = this.getSubmission(intentId)
      if (existing) return existing
      const intent = this.getIntent(intentId)
      if (this.getEscrow(intentId)) throw new Error('Intent uses escrow')
      if (intent?.status !== 'SUBMITTING') throw new Error('Payment submission requires a submitting reservation')
      if (this.isPaused() || this.principalPaused(intent.runId) || !this.walletAllows(this.rawRun(intent.runId), 0) || this.rawRun(intent.runId).stopped || Date.parse(intent.quote!.expiresAt) <= Date.now()) throw new Error('Signing authority expired')
      this.prepare('INSERT INTO submissions VALUES (?,?,?,?)').run(intentId, signed.txHash, signed.txBlob, signed.lastLedgerSequence)
      this.saveIntent({ ...intent, txHash: signed.txHash })
      this.audit.append({ runId: intent.runId, intentId, kind: 'sign', data: { txHash: signed.txHash, lastLedgerSequence: signed.lastLedgerSequence, amountMinor: intent.amountMinor,
        payTo: intent.quote?.payment?.payTo ?? null, rail: intent.quote?.payment?.rail ?? null, walletDailyMinor: spendPolicy().walletDailyMinor, paused: false, policyVersion: this.rawRun(intent.runId).policyVersion ?? POLICY_VERSION } })
      return signed
    })
  }
  getSubmission(intentId: string): Submission | undefined {
    const row = this.prepare('SELECT tx_hash, tx_blob, last_ledger FROM submissions WHERE intent_id=?').get(intentId)
    return row ? { txHash: row.tx_hash as string, txBlob: row.tx_blob as string, lastLedgerSequence: Number(row.last_ledger) } : undefined
  }
  /** Releases a reservation only when the ledger proves no payment can ever settle (caller supplies that proof). */
  failSubmission(intentId: string, reason: string): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || intent.status !== 'SUBMITTING' || this.prepare('SELECT 1 FROM receipts WHERE intent_id=?').get(intentId)) throw new Error('Only an unsettled submission can fail')
      const next: PurchaseIntent = { ...intent, status: 'FAILED_NOT_SETTLED', error: reason }
      this.saveIntent(next)
      this.audit.append({ runId: intent.runId, intentId, kind: 'refusal', data: { stage: 'submission', reason, amountMinor: intent.amountMinor, payTo: intent.quote?.payment?.payTo ?? null, txHash: intent.txHash ?? null, policyVersion: POLICY_VERSION } })
      return next
    })
  }
  policyPayments(runId: string): PolicyPayment[] {
    return this.rows<PolicyPayment>('SELECT json FROM policy_payments WHERE run_id=? ORDER BY id', runId)
  }
  reservePolicyPayments(runId: string, payments: PolicyPayment[]) {
    const run = this.getRun(runId)
    this.atomic(() => {
      if (this.policyPayments(runId).length) return
      const hold = this.prepare('SELECT minor FROM hire_reserves WHERE run_id=?').get(runId)
      const total = payments.reduce((sum, p) => sum + Number(p.amountDrops), 0)
      if (!hold || !['DONE', 'FAILED', 'STOPPED'].includes(run.phase) || run.reservedMinor
        || payments.some(p => !/^[1-9]\d*$/.test(p.amountDrops) || !Number.isSafeInteger(Number(p.amountDrops)))
        || total + run.spentMinor * DROPS_PER_MINOR > (run.budgetMinor + Number(hold.minor)) * DROPS_PER_MINOR) throw new Error('Invalid policy payment reservation')
      for (const payment of payments) this.prepare('INSERT INTO policy_payments VALUES (?,?,?)').run(payment.id, runId, JSON.stringify(payment))
      this.audit.append({ runId, kind: 'payout-reserve', data: { policyVersion: 'hire-v1', totalDrops: String(total), payments: payments.map(p => ({ id: p.id, kind: p.kind, payTo: p.payTo, amountDrops: p.amountDrops })) } })
    })
  }
  cancelRefusedRoyalty(runId: string, id: string, caller: string, reason: Record<string, unknown>) {
    this.atomic(() => {
      const payment = this.policyPayments(runId).find(p => p.id === id)!
      if (payment.cancelledAt) return
      if (payment.submission || payment.kind !== 'royalty') throw new Error('Signed payout requires reconciliation')
      const cancelledAt = new Date().toISOString()
      this.prepare('UPDATE policy_payments SET json=? WHERE id=?').run(JSON.stringify({ ...payment, cancelledAt, ...((reason.screen === 'credential-domain' || reason.screen === 'ofac-sdn-xrp') ? {cancellationReason:String(reason.reason)} : {}) }), id)
      const refund: PolicyPayment = { id: `${id}:refund`, kind: 'change', payTo: caller, amountDrops: payment.amountDrops }
      this.prepare('INSERT INTO policy_payments VALUES (?,?,?)').run(refund.id, runId, JSON.stringify(refund))
      this.audit.append({ runId, intentId: id, kind: 'refusal', data: { stage: 'payout', paymentKind: payment.kind, payTo: payment.payTo, amountDrops: payment.amountDrops, ...reason } })
      this.audit.append({ runId, intentId: id, kind: 'payout-cancel', data: { cancelledAt, paymentKind: payment.kind, amountDrops: payment.amountDrops, refundId: refund.id, refundPayTo: caller } })
      this.audit.append({ runId, kind: 'payout-reserve', data: { policyVersion: 'hire-v1', totalDrops: refund.amountDrops, payments: [refund], reason: reason.screen==='operator-denylist' ? 'denylist refund' : 'refused royalty refund' } })
    })
  }
  assertPolicyPaymentAllowed(runId: string) {
    if (this.isPaused() || this.principalPaused(runId) || !this.walletAllows(this.rawRun(runId), 0)) throw new Error('Policy payment paused or capped')
  }
  recordPolicySubmission(runId: string, id: string, submission: Submission) {
    return this.atomic(() => {
      const payment = this.policyPayments(runId).find(p => p.id === id)!
      if (payment.cancelledAt) throw new Error('Policy payment cancelled')
      if (payment.submission) return payment.submission
      if (this.isPaused() || this.principalPaused(runId) || !this.walletAllows(this.rawRun(runId), 0)) throw new Error('Policy payment paused or capped')
      this.prepare('UPDATE policy_payments SET json=? WHERE id=?').run(JSON.stringify({ ...payment, submission }), id)
      this.audit.append({ runId, intentId: id, kind: 'payout-sign', data: { paymentKind: payment.kind, txHash: submission.txHash, lastLedgerSequence: submission.lastLedgerSequence, payTo: payment.payTo, amountDrops: payment.amountDrops, paused: false, walletDailyMinor: spendPolicy().walletDailyMinor } })
      return submission
    })
  }
  /** Called only after ledger-proven expiry/failure; retain the old hash for audit. */
  retirePolicySubmission(runId: string, id: string, txHash: string, reason: 'expired' | 'failed') {
    this.atomic(() => {
      const payment = this.policyPayments(runId).find(p => p.id === id)!
      if (payment.confirmedAt || payment.submission?.txHash !== txHash) throw new Error('Policy attempt changed')
      const { submission, ...rest } = payment
      this.prepare('UPDATE policy_payments SET json=? WHERE id=?').run(JSON.stringify({ ...rest, retiredSubmissions: [...(payment.retiredSubmissions ?? []), submission] }), id)
      this.audit.append({ runId, intentId: id, kind: 'refusal', data: { stage: 'payout-attempt', txHash, reason, paymentKind: payment.kind } })
    })
  }
  confirmPolicyPayment(runId: string, id: string, ledgerIndex?: number) {
    this.atomic(() => {
      const payment = this.policyPayments(runId).find(p => p.id === id)!
      if (!payment.submission) throw new Error('No signed policy payment')
      if (payment.confirmedAt) return
      const confirmedAt = new Date().toISOString()
      this.prepare('UPDATE policy_payments SET json=? WHERE id=?').run(JSON.stringify({ ...payment, confirmedAt, ...(ledgerIndex === undefined ? {} : { ledgerIndex }) }), id)
      this.audit.append({ runId, intentId: id, kind: 'payout-settle', data: { paymentKind: payment.kind, txHash: payment.submission.txHash, ledgerIndex: ledgerIndex ?? null, payTo: payment.payTo, amountDrops: payment.amountDrops, confirmedAt } })
    })
  }
  closeHireReserve(runId: string) {
    if (this.policyPayments(runId).some(p => !p.confirmedAt && !p.cancelledAt)) throw new Error('Hire payments pending')
    this.prepare('UPDATE hire_reserves SET closed=1 WHERE run_id=?').run(runId)
  }
  getDeliveryToken(intentId: string): string | undefined { return this.prepare('SELECT token FROM receipts WHERE intent_id=?').get(intentId)?.token as string | undefined }
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
      if (!intent || !sameSource(intent, grant) || !sameSource(intent, content) || !(chargedStatuses.has(intent.status) || intent.status === 'SUBMITTING' && intent.escrow?.state === 'LOCKED') || intent.runId !== grant.runId || intent.resourceId !== grant.resourceId || intent.version !== grant.version || content.profileId !== intent.profileId || content.resourceId !== intent.resourceId || content.version !== intent.version) throw new Error('Grant does not match settled quote')
      const existing = this.rows<Grant>('SELECT json FROM grants WHERE intent_id=?', grant.intentId)[0]
      if (existing) { if (existing.contentDigest !== root) throw new Error('Grant is immutable'); return }
      this.prepare('INSERT INTO grants VALUES (?,?,?)').run(grant.intentId, JSON.stringify(grant), JSON.stringify(content))
      this.prepare('INSERT INTO grant_salts VALUES (?,?)').run(grant.intentId, JSON.stringify(proof.salts))
      this.audit.append({ runId: grant.runId, intentId: grant.intentId, kind: 'deliver', data: { resourceId: grant.resourceId, version: grant.version, contentDigest: root, passageCount: content.spans.length, accessible: false } })
    })
  }
  /** Server-private: the delivered content and salts behind a grant (proof check and challenge only; never in a snapshot). */
  getDelivery(intentId: string): { grant: Grant; content: ContentEnvelope; salts: string[] } | undefined {
    const row = this.prepare('SELECT g.json, g.content, s.json AS salts FROM grants g JOIN grant_salts s ON s.intent_id=g.intent_id WHERE g.intent_id=?').get(intentId)
    return row ? { grant: JSON.parse(row.json as string) as Grant, content: ContentEnvelopeSchema.parse(JSON.parse(row.content as string)), salts: JSON.parse(row.salts as string) as string[] } : undefined
  }
  /** Write-once: the verified search manifest the policy evaluated for this intent. */
  recordManifest(intentId: string, manifest: Manifest): void {
    this.prepare('INSERT OR IGNORE INTO manifests VALUES (?,?)').run(intentId, JSON.stringify(manifest))
  }
  getManifest(intentId: string): Manifest | undefined {
    const row = this.prepare('SELECT json FROM manifests WHERE intent_id=?').get(intentId)
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
      this.saveIntent(next)
      this.audit.append({ runId: intent.runId, intentId, kind: 'proof', data: { verified, status: next.status, resourceId: intent.resourceId, version: intent.version, contentDigest: grant.contentDigest, failedClaimIds: failedClaimIds.slice(0, 20) } })
      return next
    })
  }
  /** CLAIM_FAILED → CHALLENGED once the challenge is sent; a resend keeps CHALLENGED. */
  markChallenged(intentId: string): PurchaseIntent {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || !['CLAIM_FAILED', 'CHALLENGED'].includes(intent.status)) throw new Error('Only a failed proof can be challenged')
      const next: PurchaseIntent = { ...intent, status: 'CHALLENGED' }
      this.saveIntent(next)
      if (intent.status === 'CLAIM_FAILED') this.audit.append({ runId: intent.runId, intentId, kind: 'challenge', data: { outcome: 'sent', resourceId: intent.resourceId, version: intent.version, failedClaimIds: (intent.failedClaimIds ?? []).slice(0, 20) } })
      return next
    })
  }
  /** Write-once per intent (gate 3): the first challenge outcome, and at most one refund, are final. */
  recordChallengeOutcome(intentId: string, status: 'REFUNDED' | 'CHALLENGE_REJECTED' | 'CHALLENGE_REFUSED', refund?: { txHash: string; amountMinor: number }): PurchaseIntent {
    let refundEvent: TraceEvent | undefined
    const result = this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent) throw new Error('Intent not found')
      const late = intent.status === 'CHALLENGE_REFUSED' && status === 'REFUNDED' && intent.refundCandidate?.txHash === refund?.txHash
      if (CHALLENGE_OUTCOMES.has(intent.status) && !late) return intent
      if (intent.status !== 'CHALLENGED' && !late) throw new Error('Challenge outcome requires a sent challenge')
      if ((status === 'REFUNDED') !== Boolean(refund) || (refund && refund.amountMinor !== intent.amountMinor)) throw new Error('A refund is exactly the full charge')
      const next: PurchaseIntent = { ...intent, status, ...(refund ? { refund } : {}) }
      this.saveIntent(next)
      this.audit.append(refund ? { runId: intent.runId, intentId, kind: 'refund', data: { txHash: refund.txHash, amountMinor: refund.amountMinor, originalTxHash: intent.txHash ?? null, payTo: intent.quote?.payment?.payTo ?? null, resourceId: intent.resourceId, version: intent.version } }
        : { runId: intent.runId, intentId, kind: 'challenge', data: { outcome: status, resourceId: intent.resourceId, version: intent.version } })
      if (refund) {
        const testnet = intent.quote?.payment?.rail === 'xrpl-testnet'
        const label = testnet ? XRPL_LABEL : SIMULATED_LABEL
        const inserted = this.prepare('INSERT INTO events (run_id,json) VALUES (?,?)').run(intent.runId, '{}')
        refundEvent = TraceEventSchema.parse({ id: Number(inserted.lastInsertRowid), runId: intent.runId, at: new Date().toISOString(), type: 'REFUND',
          label: `${intent.escrow?.mode === 'key-reveal' ? 'Refund · writer-signed · fixture writer cooperates (a real writer could refuse) · ' : ''}Refunded S$${(refund.amountMinor / 100).toFixed(2)} · InvoiceID = original tx · ${label}`,
          data: { intentId, txHash: refund.txHash, amountMinor: refund.amountMinor, originalTxHash: intent.txHash, label, ...(testnet ? { explorerUrl: `${XRPL_EXPLORER}/${refund.txHash}` } : {}) } })
        this.prepare('UPDATE events SET json=? WHERE id=?').run(JSON.stringify(refundEvent), refundEvent.id)
      }
      return next
    })
    if (refundEvent) { try { this.onEvent?.(refundEvent) } catch { /* committed; observers resync */ } }
    return result
  }
  // Engine-side trust per seller of record (D6, D21), across runs; server/reputation.ts owns the math.
  getReputation(wallet: string): ReputationRecord | undefined {
    if (process.env.HOSTED === '1') return this.rows<ReputationRecord>('SELECT json FROM hosted_reputation WHERE principal=? AND wallet=?', hostedExecution.getStore()?.principal ?? '', wallet)[0]
    return this.rows<ReputationRecord>('SELECT json FROM publisher_reputation WHERE wallet=?', wallet)[0] }
  listReputation(): ReputationRecord[] {
    if (process.env.HOSTED === '1') return this.rows<ReputationRecord>('SELECT json FROM hosted_reputation WHERE principal=? ORDER BY wallet', hostedExecution.getStore()?.principal ?? '')
    return this.rows<ReputationRecord>('SELECT json FROM publisher_reputation ORDER BY wallet') }
  putReputation(record: ReputationRecord): void {
    const parsed = ReputationRecordSchema.parse(record)
    if (process.env.HOSTED === '1') {
      const principal = hostedExecution.getStore()?.principal
      if (!principal) throw new Error('Hosted reputation principal missing')
      this.prepare('INSERT INTO hosted_reputation VALUES (?,?,?) ON CONFLICT(principal,wallet) DO UPDATE SET json=excluded.json').run(principal, parsed.wallet, JSON.stringify(parsed))
      return
    }
    this.prepare('INSERT INTO publisher_reputation VALUES (?,?) ON CONFLICT(wallet) DO UPDATE SET json=excluded.json').run(parsed.wallet, JSON.stringify(parsed))
  }
  resetReputation(): void { this.db.exec('DELETE FROM publisher_reputation') }
  /** Probe an actual write transaction without changing operator state. */
  checkWritable(): void {
    this.atomic(() => { this.prepare('INSERT OR IGNORE INTO wallet_control VALUES (1,0)').run(); this.prepare('UPDATE wallet_control SET paused=paused WHERE id=1').run() })
  }
  spendBySurface() {
    const day = new Date().toISOString().slice(0, 10)
    return Object.fromEntries((['web', 'mcp', 'x402', 'agent'] as const).map(surface => [surface, this.usage(day, surface)]))
  }
  claimDeliveryRetry(intentId: string, now = Date.now()): PurchaseIntent | undefined {
    return this.atomic(() => {
      const intent = this.getIntent(intentId)
      if (!intent || intent.status !== 'DELIVERY_FAILED' || (intent.deliveryAttempts ?? 0) >= 3 || Date.parse(intent.nextDeliveryAt ?? '') > now) return undefined
      const attempt = (intent.deliveryAttempts ?? 0) + 1
      const next = { ...intent, deliveryAttempts: attempt, nextDeliveryAt: new Date(now + 15000 * 2 ** (attempt - 1)).toISOString() }
      this.saveIntent(next)
      return next
    })
  }
  /** For other modules (e.g. hire-the-agent inbound and royalty payments): appends inside its own transaction. */
  recordAudit(input: AuditInput, once?: Record<string, string>) {
    return this.atomic(() => {
      // `once` makes a replayed request idempotent: an entry of this kind with the same data field values is not written twice.
      if (once && Object.entries(once).every(([field, value]) => this.prepare(`SELECT 1 FROM audit_log WHERE kind=? AND json_extract(data, ?)=? LIMIT 1`).get(input.kind, `$.${field}`, value))) return undefined
      return this.audit.append(input)
    })
  }
  auditVerify(options: { expectHead?: string } = {}) { return verifyChain(this.db, options) }
  anchorRows(): import('./anchor.js').AnchorRecord[] { return this.rows('SELECT json FROM answer_anchors ORDER BY rowid') }
  saveAnchor(row: import('./anchor.js').AnchorRecord) { this.prepare('INSERT INTO answer_anchors VALUES (?,?,?) ON CONFLICT(head) DO UPDATE SET json=excluded.json').run(row.head, row.runId, JSON.stringify(row)) }
  auditEntries(range: DateRange = {}) { return auditEntries(this.db, range) }
  receiptRows(range: DateRange = {}) { return receiptRows(this.db, range) }
  /** Deletes premium content, events and run bodies past the window; keeps receipts, intents and every audit row (#288). */
  prune(options: PruneOptions) { return this.atomic(() => pruneRunData(this.db, this.audit, options)) }
  /** Reclaim the freed pages so pruned bytes are not left in the file. Cannot run inside a transaction. */
  compact(): void { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE)') }
  close(): void { this.statements.clear(); this.db.close() }
}
