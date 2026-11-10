import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Store } from '../store.js'
import type { Config } from '../config.js'
import { HostedError, requireAdmissions, requireSpending } from './control.js'
// USD stored as integer microdollars. Gross authority is never replenished by refunds.
export const LIMITS = { questionMinor: 200, sessionQuestions: 5, sessionMinor: 1000, ipQuestions: 60, ipMinor: 12000, dailyQuestions: 300, dailyMinor: 60000, lifetimeQuestions: 2100, lifetimeMinor: 420000, questionModel: 50000, dailyModel: 15000000, lifetimeModel: 105000000, bodyBytes: 16384, questionChars: 2000, waiting: 2, queueMs: 90000 } as const
export const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const canonical = (x: unknown): unknown => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : x
export const digest = (x: unknown) => hash(JSON.stringify(canonical(x)))
export type Hold = { id: string; principal: string; run_id: string | null; scope_digest: string | null; submit_digest: string | null; scope_result: string | null; minor: number; model_used: number; model_envelope: number; created: number; state: string }
export class HostedLimits {
  constructor(readonly store: Store, readonly config: Config, readonly now: () => number = Date.now) {
    store.hostedState(db => db.exec(`CREATE TABLE IF NOT EXISTS hosted_sessions (principal TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS hosted_holds (id TEXT PRIMARY KEY, principal TEXT NOT NULL, request_key TEXT NOT NULL, question TEXT NOT NULL, ip TEXT NOT NULL, day TEXT NOT NULL, created INTEGER NOT NULL, minor INTEGER NOT NULL, gross_open INTEGER NOT NULL DEFAULT 1, model_used INTEGER NOT NULL DEFAULT 0, model_envelope INTEGER NOT NULL DEFAULT 50000, run_id TEXT, scope_digest TEXT, submit_digest TEXT, scope_result TEXT, state TEXT NOT NULL DEFAULT 'draft', UNIQUE(principal,request_key));
      CREATE TABLE IF NOT EXISTS hosted_attempts (id INTEGER PRIMARY KEY, hold_id TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, reserved INTEGER NOT NULL, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS hosted_reputation (principal TEXT NOT NULL, wallet TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(principal,wallet));
      CREATE INDEX IF NOT EXISTS hosted_holds_principal ON hosted_holds(principal,day);
      CREATE INDEX IF NOT EXISTS hosted_holds_ip ON hosted_holds(ip,day);`))
  }
  get questionMinor() { return Number(this.config.HOSTED_QUESTION_CAP_MINOR ?? LIMITS.questionMinor) }
  session(cookie?: string) {
    const now = this.now()
    return this.store.hostedState(db => {
      db.prepare('DELETE FROM hosted_sessions WHERE expires<=?').run(now)
      if (cookie && /^[a-f0-9]{64}$/.test(cookie)) {
        const old = db.prepare('SELECT * FROM hosted_sessions WHERE principal=? AND expires>?').get(hash(cookie), now)
        if (old) return { principal: String(old.principal), csrf: String(old.csrf), expires: Number(old.expires) }
      }
      if (Number(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get()!.n) >= 5000) throw new HostedError(429, 'session_limit')
      const token = randomBytes(32).toString('hex'), principal = hash(token), csrf = randomBytes(32).toString('hex'), expires = now + 86400000
      db.prepare('INSERT INTO hosted_sessions VALUES (?,?,?)').run(principal, csrf, expires)
      return { principal, csrf, expires, token }
    })
  }
  ipKey(ip: string, at = this.now()) { const day = new Date(at).toISOString().slice(0, 10); return createHmac('sha256', createHmac('sha256', this.config.HOSTED_IP_HMAC_KEY!).update(day).digest()).update(ip).digest('hex') }
  private row(db: DatabaseSync, principal: string, key: string) { return db.prepare('SELECT * FROM hosted_holds WHERE principal=? AND request_key=?').get(principal, key) as Hold | undefined }
  existing(principal: string, key: string, stage: 'scope' | 'submit', request: unknown) {
    return this.store.hostedState(db => {
      const old = this.row(db,principal,key), previous = old?.[stage === 'scope' ? 'scope_digest' : 'submit_digest']
      if (previous && previous !== digest(request)) throw new HostedError(409,'idempotency_conflict')
      return old
    })
  }
  expireDrafts() {
    this.store.hostedState(db => db.prepare("UPDATE hosted_holds SET state='expired',minor=0,gross_open=0,model_envelope=model_used WHERE run_id IS NULL AND (state='interrupted' OR (state='draft' AND created<=?))").run(this.now()-LIMITS.queueMs))
  }
  reserve(principal: string, key: string, question: string, ip: string, minor: number, stage: 'scope' | 'submit', request: unknown) {
    this.expireDrafts()
    return this.store.hostedState(db => {
      const old = this.row(db, principal, key), field = stage === 'scope' ? 'scope_digest' : 'submit_digest', d = digest(request)
      if (old) {
        const original = db.prepare('SELECT question FROM hosted_holds WHERE id=?').get(old.id)!
        if (original.question !== hash(question) || (old[field] && old[field] !== d) || (stage === 'submit' && !old.submit_digest && minor > old.minor)) throw new HostedError(409, 'idempotency_conflict')
        if (!old[field]) { requireAdmissions(this.config, this.now()); db.prepare(`UPDATE hosted_holds SET ${field}=? WHERE id=?`).run(d, old.id) }
        return this.row(db, principal, key)!
      }
      requireAdmissions(this.config, this.now())
      if (!Number.isSafeInteger(minor) || minor < 0 || minor > this.questionMinor) throw new HostedError(400, 'invalid_budget')
      const now = this.now(), day = new Date(now).toISOString().slice(0, 10), ipKey = this.ipKey(ip)
      const tally = (where: string, ...params: (string | number)[]) => db.prepare(`SELECT count(*) AS n, coalesce(sum(minor),0) AS minor FROM hosted_holds WHERE ${where}`).get(...params)!
      const check = (v: ReturnType<typeof tally>, questions: number, cap: number) => { if (Number(v.n) >= questions || Number(v.minor) + minor > cap) throw new HostedError(429, 'allowance_exhausted') }
      check(tally('principal=? AND day=?', principal, day), LIMITS.sessionQuestions, LIMITS.sessionMinor)
      check(tally("ip IN (?,?) AND (day=? OR gross_open=1)", ipKey, this.ipKey(ip,now-86400000), day), LIMITS.ipQuestions, LIMITS.ipMinor)
      check(tally("day=? OR gross_open=1", day), LIMITS.dailyQuestions, LIMITS.dailyMinor)
      check(tally('1=1'), LIMITS.lifetimeQuestions, LIMITS.lifetimeMinor)
      if (Number(tally('ip=? AND created>?', ipKey, now - 60000).n) >= 3) throw new HostedError(429, 'start_rate')
      if (Number(tally("principal=? AND (state IN ('active','queued') OR (state='draft' AND created>?))", principal, now - LIMITS.queueMs).n)) throw new HostedError(429, 'session_busy')
      // Every admission holds the full $0.05 envelope across midnight and restart.
      const pending = Number(db.prepare('SELECT coalesce(sum(model_envelope-model_used),0) AS n FROM hosted_holds').get()!.n)
      const used = Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts WHERE created>=?').get(Date.parse(day))!.n)
      if (used + pending + LIMITS.questionModel > LIMITS.dailyModel) throw new HostedError(429, 'model_daily_cap')
      if (Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts').get()!.n) + pending + LIMITS.questionModel > LIMITS.lifetimeModel) throw new HostedError(429, 'model_lifetime_cap')
      const id = randomBytes(16).toString('hex')
      db.prepare(`INSERT INTO hosted_holds (id,principal,request_key,question,ip,day,created,minor,${field}) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, principal, key, hash(question), ipKey, day, now, minor, d)
      // Daily HMAC identifiers expire. Outstanding holds remain counted globally and per session.
      db.prepare("UPDATE hosted_holds SET ip='' WHERE created<?").run(now-86400000)
      db.prepare('UPDATE hosted_holds SET scope_result=NULL WHERE created<?').run(now - 86400000)
      return this.row(db, principal, key)!
    })
  }
  attempt(id: string, provider: string, model: string, input: number, output: number, micro: number) {
    requireSpending(this.config)
    return this.store.hostedState(db => {
      const hold = db.prepare('SELECT * FROM hosted_holds WHERE id=?').get(id) as Hold | undefined
      if (!hold || !Number.isSafeInteger(micro) || micro < 1 || hold.model_used + micro > Math.min(hold.model_envelope,LIMITS.questionModel)) throw new HostedError(429, 'question_model_cap')
      const tokens = db.prepare('SELECT coalesce(sum(input_tokens),0) AS i, coalesce(sum(output_tokens),0) AS o FROM hosted_attempts WHERE hold_id=? AND provider=?').get(id, provider)!
      if (Number(tokens.i) + input > (provider === 'research' ? 60000 : 50000) || (provider === 'research' && Number(tokens.o) + output > 6000)) throw new HostedError(429, 'question_token_cap')
      const today = Date.parse(new Date(this.now()).toISOString().slice(0,10))
      const used = Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts WHERE created>=?').get(today)!.n)
      // All outstanding envelopes count against today's authority, including yesterday's holds.
      const pending = Number(db.prepare('SELECT coalesce(sum(model_envelope-model_used),0) AS n FROM hosted_holds').get()!.n)
      if (used + pending > LIMITS.dailyModel) throw new HostedError(429, 'model_daily_cap')
      db.prepare('UPDATE hosted_holds SET model_used=model_used+? WHERE id=?').run(micro, id)
      return Number(db.prepare('INSERT INTO hosted_attempts (hold_id,provider,model,reserved,input_tokens,output_tokens,created) VALUES (?,?,?,?,?,?,?)').run(id, provider, model, micro, input, output, this.now()).lastInsertRowid)
    })
  }
  reserveRetry(id: string) {
    requireAdmissions(this.config,this.now())
    this.store.hostedState(db => {
      const h = db.prepare('SELECT * FROM hosted_holds WHERE id=?').get(id) as Hold
      if (db.prepare("SELECT 1 FROM hosted_holds WHERE principal=? AND state IN ('active','queued')").get(h.principal)) throw new HostedError(429,'session_busy')
      const pending = Number(db.prepare('SELECT coalesce(sum(model_envelope-model_used),0) AS n FROM hosted_holds').get()!.n)
      const today = Date.parse(new Date(this.now()).toISOString().slice(0,10))
      const used = Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts WHERE created>=?').get(today)!.n)
      const total = Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts').get()!.n)
      const extra = LIMITS.questionModel-h.model_envelope
      if (used+pending+extra>LIMITS.dailyModel || total+pending+extra>LIMITS.lifetimeModel) throw new HostedError(429,'model_daily_cap')
      db.prepare("UPDATE hosted_holds SET model_envelope=?,state='queued' WHERE id=?").run(LIMITS.questionModel,id)
    })
  }
  completeAttempt(attempt: number, input: number, output: number, micro: number) {
    if (![input,output,micro].every(v => Number.isSafeInteger(v) && v >= 0)) return
    this.store.hostedState(db => {
      const old = db.prepare('SELECT * FROM hosted_attempts WHERE id=?').get(attempt)!
      if (input > Number(old.input_tokens) || output > Number(old.output_tokens) || micro > Number(old.reserved)) return
      const released = Number(old.reserved)-micro
      db.prepare('UPDATE hosted_attempts SET reserved=?,input_tokens=?,output_tokens=? WHERE id=?').run(micro,input,output,attempt)
      db.prepare('UPDATE hosted_holds SET model_used=model_used-?,model_envelope=CASE WHEN model_envelope=model_used THEN model_envelope-? ELSE model_envelope END WHERE id=?').run(released,released,String(old.hold_id))
    })
  }
  /** Called only after awaited work has stopped. Unknown money keeps its whole gross hold. */
  settle(id: string) {
    const hold = this.store.hostedState(db => db.prepare('SELECT * FROM hosted_holds WHERE id=?').get(id) as Hold | undefined)
    if (!hold) return
    const run = hold.run_id ? this.store.getRun(hold.run_id) : undefined
    const proven = run && ['DONE','FAILED','STOPPED'].includes(run.phase) && run.intents.every(i => ['SKIPPED','FAILED_NOT_SETTLED','VERIFIED','REFUNDED','CHALLENGE_REJECTED','CHALLENGE_REFUSED'].includes(i.status))
    this.store.hostedState(db => {
      db.prepare('UPDATE hosted_holds SET model_envelope=model_used WHERE id=?').run(id)
      if (proven) db.prepare("UPDATE hosted_holds SET minor=?,gross_open=0,state='done' WHERE id=?").run(run.spentMinor,id)
    })
  }
  available() {
    return this.store.hostedState(db => {
      const day = new Date(this.now()).toISOString().slice(0,10)
      const today = db.prepare("SELECT count(*) AS n, coalesce(sum(minor),0) AS minor FROM hosted_holds WHERE day=? OR gross_open=1").get(day)!
      const all = db.prepare('SELECT count(*) AS n,coalesce(sum(minor),0) AS minor FROM hosted_holds').get()!
      const pending = Number(db.prepare('SELECT coalesce(sum(model_envelope-model_used),0) AS n FROM hosted_holds').get()!.n)
      const used = Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts WHERE created>=?').get(Date.parse(day))!.n)
      const total = Number(db.prepare('SELECT coalesce(sum(reserved),0) AS n FROM hosted_attempts').get()!.n)
      return Number(today.n) < LIMITS.dailyQuestions && Number(today.minor)+this.questionMinor <= LIMITS.dailyMinor && Number(all.n) < LIMITS.lifetimeQuestions && Number(all.minor)+this.questionMinor <= LIMITS.lifetimeMinor && used+pending+LIMITS.questionModel <= LIMITS.dailyModel && total+pending+LIMITS.questionModel <= LIMITS.lifetimeModel
    })
  }
  update(id: string, change: { state?: string; run_id?: string; scope_result?: string }) { this.store.hostedState(db => { for (const [key,value] of Object.entries(change)) db.prepare(`UPDATE hosted_holds SET ${key}=? WHERE id=?`).run(value!,id) }) }
  forRun(runId: string) { return this.store.hostedState(db => db.prepare('SELECT * FROM hosted_holds WHERE run_id=?').get(runId) as Hold | undefined) }
  remaining(principal: string) { return this.store.hostedState(db => { const v = db.prepare('SELECT count(*) AS n,coalesce(sum(minor),0) AS minor FROM hosted_holds WHERE principal=? AND day=?').get(principal,new Date(this.now()).toISOString().slice(0,10))!; return { questions: Math.max(0,LIMITS.sessionQuestions-Number(v.n)), minor: Math.max(0,LIMITS.sessionMinor-Number(v.minor)) } }) }
}
