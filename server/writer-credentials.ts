import { z } from 'zod'
import { testnetUrl } from '../shared/xrpl.js'
import { boundedBody } from './body-limit.js'
import { loadConfig } from './config.js'
import { CredentialIssuerSchema, unverified, type CredentialIssuer, type WriterVerification } from '../shared/writer-verification.js'

type Rpc = (request: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>
const uint = z.number().int().nonnegative().max(0xffffffff)
const hash = z.string().regex(/^[A-F0-9]{64}$/)
const epoch = 946684800
// Global admission: bounded queue; timed-out transports keep their slot until settled.
let active = 0
const waiting: (() => void)[] = []
async function acquire(signal: AbortSignal) {
  signal.throwIfAborted()
  if (active < 2) { active++; return }
  if (waiting.length >= 64) throw Error('Credential queue full')
  await new Promise<void>((resolve, reject) => {
    const wake = () => { signal.removeEventListener('abort', abort); resolve() }
    const abort = () => { const i = waiting.indexOf(wake); if (i >= 0) waiting.splice(i, 1); reject(Error('Credential queue timeout')) }
    waiting.push(wake); signal.addEventListener('abort', abort, { once: true })
  })
}
function release() { const next = waiting.shift(); if (next) next(); else active-- }
export function credentialRpc(): Rpc {
  return async (request, signal) => {
    const url = new URL(testnetUrl(loadConfig().XRPL_RPC_URL))
    url.protocol = 'https:'
    if (url.port === '51233') url.port = '51234'
    const { command, ...params } = request
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: command, params: [params] }) })
    if (!response.ok) throw Error('Credential RPC unavailable')
    return JSON.parse((await boundedBody(response, 16 * 1024)).toString('utf8'))
  }
}
type Observation = { value?: WriterVerification; until: number; retryAt: number; inFlight?: Promise<WriterVerification>; timer?: ReturnType<typeof setTimeout> }
const coldWaitMs = 300, staleMs = 600_000, retryMs = 60_000
export class WriterCredentials {
  private context?: { pending: boolean; until: number; value: Promise<{ header: { ledger_hash: string; ledger_index: number; ledger: { close_time: number } }; issuers: CredentialIssuer[] }> }
  private cache = new Map<string, Observation>()
  private warming = Promise.resolve()
  private disposed = false
  constructor(private issuers: CredentialIssuer[], private rpc: Rpc = credentialRpc(), private timeoutMs = 1200, private ttlMs = 300_000, private domainId?: string) {
    this.issuers = z.array(CredentialIssuerSchema).max(4).parse(issuers)
  }
  async check(subject: string): Promise<WriterVerification> {
    if (!this.issuers.length && !this.domainId) return unverified()
    let cached = this.cache.get(subject)
    if (!cached) {
      if (this.cache.size >= 256) {
        const oldest = this.cache.keys().next().value!
        clearTimeout(this.cache.get(oldest)?.timer)
        this.cache.delete(oldest)
      }
      cached = { until: 0, retryAt: 0 }
      this.cache.set(subject, cached)
    }
    if (Date.now() >= cached.retryAt && (!cached.value || Date.now() >= cached.until - this.refreshLeadMs)) this.refresh(subject, cached)
    if (cached.value) {
      // A refresh failure cannot extend either the snapshot age or credential expiry.
      if (Date.now() >= cached.until + staleMs || (cached.value.status === 'verified' && cached.value.expiresAt && Date.parse(cached.value.expiresAt) <= Date.now())) return { status: 'check_failed' }
      return cached.value
    }
    if (!cached.inFlight) return { status: 'check_failed' }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([cached.inFlight, new Promise<WriterVerification>(resolve => { timer = setTimeout(() => resolve({ status: 'check_pending' }), coldWaitMs) })])
    } finally { clearTimeout(timer) }
  }
  private get refreshLeadMs() { return Math.min(60_000, this.ttlMs / 5) }
  private refresh(subject: string, cached: Observation) {
    if (cached.inFlight) return
    clearTimeout(cached.timer)
    cached.inFlight = this.lookup(subject).then(({ value, until }) => {
      cached.value = value; cached.until = until
      cached.retryAt = until - this.refreshLeadMs
      return value
    }).catch((): WriterVerification => {
      cached.retryAt = Date.now() + retryMs
      return { status: 'check_failed' }
    }).finally(() => {
      cached.inFlight = undefined
      if (this.cache.get(subject) !== cached) return
      cached.timer = setTimeout(() => this.refresh(subject, cached), Math.max(1, cached.retryAt - Date.now()))
      cached.timer.unref?.()
    })
  }
  /** Only warms advisory observations; registry wallets still require signed binding at use. */
  prewarm(subjects: string[] = []) {
    if (this.disposed || (!this.issuers.length && !this.domainId)) return
    void this.getContext().value.catch(() => {})
    // Pace startup warming so it cannot fill its own bounded RPC queue.
    for (const subject of new Set(subjects.slice(0, 256))) {
      this.warming = this.warming.then(async () => {
        if (this.disposed) return
        await this.check(subject)
        await this.cache.get(subject)?.inFlight
      }).catch(() => {})
    }
  }
  dispose() {
    this.disposed = true
    for (const cached of this.cache.values()) clearTimeout(cached.timer)
    this.cache.clear()
  }
  private async request(request: Record<string, unknown>) {
    const controller = new AbortController()
    const queueTimer = setTimeout(() => controller.abort(), this.timeoutMs)
    try { await acquire(controller.signal) } finally { clearTimeout(queueTimer) }
    if (controller.signal.aborted) { release(); throw Error('Credential queue timeout') }
    let timer: ReturnType<typeof setTimeout> | undefined
    const transport = Promise.resolve().then(() => this.rpc(request, controller.signal)).finally(release)
    try {
      const response = await Promise.race([transport, new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Credential RPC timeout')) }, this.timeoutMs) })])
      if (Buffer.byteLength(JSON.stringify(response)) > 16 * 1024) throw Error('Oversized credential response')
      return z.object({ result: z.record(z.string(), z.unknown()) }).parse(response).result
    } finally { clearTimeout(timer) }
  }
  private async loadContext() {
    const info = await this.request({ command: 'server_info' })
    z.object({ info: z.object({ network_id: z.literal(1) }) }).parse(info)
    const header = z.object({ validated: z.literal(true), ledger_index: uint.positive(), ledger_hash: hash,
      ledger: z.object({ close_time: uint }) }).parse(await this.request({ command: 'ledger', ledger_index: 'validated', transactions: false, expand: false }))
    if (!this.domainId) return { header, issuers: this.issuers }
    // Domain and credentials are observed at one validated ledger, never a moving tip.
    const id = hash.safeParse(this.domainId.toUpperCase())
    if (!id.success) return { header, issuers: [] }
    const raw = await this.request({ command: 'ledger_entry', index: id.data, ledger_hash: header.ledger_hash })
    const domain = z.object({ validated: z.literal(true), ledger_hash: z.literal(header.ledger_hash), index: z.literal(id.data),
      node: z.object({ LedgerEntryType: z.literal('PermissionedDomain'), AcceptedCredentials: z.array(z.object({ Credential: z.object({
        Issuer: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/), CredentialType: z.string().regex(/^(?:[A-Fa-f0-9]{2}){1,64}$/),
      }).strict() }).strict()).min(1).max(4) }) }).safeParse(raw)
    if (!domain.success) return { header, issuers: [] }
    const issuers = domain.data.node.AcceptedCredentials.map(({ Credential: c }) => CredentialIssuerSchema.parse({
      issuer: c.Issuer, credentialType: c.CredentialType, label: 'ResearchAgent operator',
    }))
    if (new Set(issuers.map(i => `${i.issuer}:${i.credentialType}`)).size !== issuers.length) return { header, issuers: [] }
    return { header, issuers }
  }
  private getContext() {
    if (!this.context || (!this.context.pending && this.context.until - this.refreshLeadMs <= Date.now())) {
      const context = { pending: true, until: Date.now() + this.ttlMs, value: this.loadContext() }
      this.context = context
      void context.value.catch(() => { if (this.context === context) this.context = undefined }).finally(() => { context.pending = false })
    }
    return this.context
  }
  private async lookup(subject: string): Promise<{ value: WriterVerification; until: number }> {
    z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/).parse(subject)
    const context = this.getContext()
    const { header, issuers } = await context.value
    const checkedAt = new Date().toISOString()
    for (const issuer of issuers) {
      const raw = await this.request({ command: 'ledger_entry', ledger_hash: header.ledger_hash,
        credential: { subject, issuer: issuer.issuer, credential_type: issuer.credentialType } })
      if (raw.error === 'entryNotFound') continue
      const entry = z.object({ validated: z.literal(true), ledger_hash: z.literal(header.ledger_hash), index: hash,
        node: z.object({ LedgerEntryType: z.literal('Credential'), Flags: uint, Subject: z.literal(subject), Issuer: z.literal(issuer.issuer),
          CredentialType: z.string().refine(s => s.toUpperCase() === issuer.credentialType), Expiration: uint.optional(), PreviousTxnID: hash.optional() }) }).safeParse(raw)
      if (!entry.success) continue
      const data = entry.data
      const n = data.node
      if (!(n.Flags & 0x10000) || (n.Expiration !== undefined && n.Expiration <= header.ledger.close_time)) continue
      // Do not cache an accepted credential past its ledger-relative expiry.
      const expiresAt = n.Expiration === undefined ? undefined : new Date((n.Expiration + epoch) * 1000).toISOString()
      if (expiresAt && Date.parse(expiresAt) <= Date.now() + this.ttlMs) continue
      return { until: context.until, value: { status: 'verified', issuerLabel: issuer.label, issuer: issuer.issuer, credentialType: issuer.credentialType,
        credentialId: data.index, credentialTxHash: n.PreviousTxnID, domainId: this.domainId?.toUpperCase(), ledgerIndex: header.ledger_index, expiresAt, checkedAt } }
    }
    return { until: context.until, value: unverified() }
  }
}
let configured: { raw: string; verifier: WriterCredentials } | undefined
function configuredVerifier() {
  const config = loadConfig()
  const issuers = config.WRITER_CREDENTIAL_ISSUERS || '[]'
  // Presentation-only configuration: never used by spending policy.
  const domain = config.WRITER_CREDENTIAL_DOMAIN || undefined
  const raw = JSON.stringify([issuers, domain, config.XRPL_RPC_URL])
  if (!configured || configured.raw !== raw) {
    configured?.verifier.dispose()
    configured = { raw, verifier: new WriterCredentials(domain ? [] : z.array(CredentialIssuerSchema).max(4).parse(JSON.parse(issuers)), credentialRpc(), 1200, 300_000, domain) }
  }
  return configured.verifier
}
export async function writerVerification(subject: string): Promise<WriterVerification> {
  try { return await configuredVerifier().check(subject) } catch { return { status: 'check_failed' } }
}
/** Best effort startup task: never awaited by startup or readiness. */
export async function prewarmWriterVerification() {
  try {
    const config = loadConfig()
    if (!config.WRITER_CREDENTIAL_ISSUERS && !config.WRITER_CREDENTIAL_DOMAIN) return
    const verifier = configuredVerifier()
    verifier.prewarm()
    const { PublisherClient } = await import('./publisher-client.js')
    await Promise.allSettled(new PublisherClient().origins().map(async client => {
      const registry = await client.registry()
      verifier.prewarm(registry.flatMap(writer => writer.wallet ? [writer.wallet] : []))
    }))
  } catch { /* Identity display cannot block startup or readiness. */ }
}
