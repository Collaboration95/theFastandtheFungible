import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { AnswerSchema, ContentEnvelopeSchema, DecisionRoundSchema, GrantSchema, ImpactSchema, PurchaseIntentSchema, ReceiptSchema, RunSnapshotSchema, TraceEventSchema, type Answer, type ContentEnvelope, type DecisionRound, type DeliveryProof, type Grant, type Impact, type ModeLabels, type PurchaseIntent, type Receipt, type RunSnapshot, type TraceEvent } from '../shared/contracts/index.js'

const reservedStatuses = new Set(['RESERVED', 'SUBMITTING'])
const chargedStatuses = new Set(['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED'])
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
    const run = RunSnapshotSchema.parse({ runId: randomUUID(), question, budgetMinor, spentMinor: 0, reservedMinor: 0, perSourceCapMinor: 100,
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
      const paid = this.db.prepare('SELECT g.content FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(runId)
        .map(row => ContentEnvelopeSchema.parse(JSON.parse(row.content as string)))
      run.contents = [...run.contents.filter(content => run.candidates.some(c => c.tier === 'FREE' && sameResource(c, content))), ...paid]
      run.spentMinor = run.intents.filter(i => chargedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      run.reservedMinor = run.intents.filter(i => reservedStatuses.has(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
      return RunSnapshotSchema.parse(run)
    })
  }
  listRuns(): RunSnapshot[] { return this.db.prepare('SELECT id FROM runs ORDER BY rowid').all().map(row => this.getRun(row.id as string)) }
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
        const granted = this.db.prepare('SELECT g.content FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(runId).some(row => JSON.stringify(content) === row.content)
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
  getDeliveryToken(intentId: string): string | undefined { return this.db.prepare('SELECT token FROM receipts WHERE intent_id=?').get(intentId)?.token as string | undefined }
  addGrant(input: Grant, inputContent: ContentEnvelope, proof?: DeliveryProof): void {
    const grant = GrantSchema.parse(input)
    const content = ContentEnvelopeSchema.parse(inputContent)
    if (!proof) throw new Error('Exact response bytes and digest header required')
    const hash = createHash('sha256').update(proof.bytes).digest('hex')
    const parsed = ContentEnvelopeSchema.parse(JSON.parse(typeof proof.bytes === 'string' ? proof.bytes : Buffer.from(proof.bytes).toString('utf8')))
    if (JSON.stringify(parsed) !== JSON.stringify(content) || proof.digest !== `sha-256=${hash}` || grant.contentDigest !== hash || content.spans.some(s => !content.body.includes(s.text)) || new Set(content.spans.map(s => s.id)).size !== content.spans.length) throw new Error('Delivery verification failed')
    this.atomic(() => {
      const intent = this.getIntent(grant.intentId)
      if (!intent || !chargedStatuses.has(intent.status) || intent.runId !== grant.runId || intent.resourceId !== grant.resourceId || intent.version !== grant.version || content.profileId !== intent.profileId || content.resourceId !== intent.resourceId || content.version !== intent.version || intent.quote?.contentDigest !== hash) throw new Error('Grant does not match settled quote')
      const existing = this.rows<Grant>('SELECT json FROM grants WHERE intent_id=?', grant.intentId)[0]
      if (existing) { if (existing.contentDigest !== hash) throw new Error('Grant is immutable'); return }
      this.db.prepare('INSERT INTO grants VALUES (?,?,?)').run(grant.intentId, JSON.stringify(grant), JSON.stringify(content))
      this.saveIntent({ ...intent, status: 'VERIFIED', error: undefined })
    })
  }
  close(): void { this.db.close() }
}
