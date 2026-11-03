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
export class WriterCredentials {
  private cache = new Map<string, { until: number; value: Promise<WriterVerification> }>()
  constructor(private issuers: CredentialIssuer[], private rpc: Rpc = credentialRpc(), private timeoutMs = 1200, private ttlMs = 15_000) {
    this.issuers = z.array(CredentialIssuerSchema).max(4).parse(issuers)
  }
  async check(subject: string): Promise<WriterVerification> {
    if (!this.issuers.length) return unverified()
    const cached = this.cache.get(subject)
    if (cached && cached.until > Date.now()) return cached.value
    if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!)
    const value = this.lookup(subject).catch((): WriterVerification => ({ status: 'check_failed' }))
    this.cache.set(subject, { until: Date.now() + this.ttlMs, value })
    return value
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
  private async lookup(subject: string): Promise<WriterVerification> {
    z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/).parse(subject)
    const info = await this.request({ command: 'server_info' })
    z.object({ info: z.object({ network_id: z.literal(1) }) }).parse(info)
    const header = z.object({ validated: z.literal(true), ledger_index: uint.positive(), ledger_hash: hash,
      ledger: z.object({ close_time: uint }) }).parse(await this.request({ command: 'ledger', ledger_index: 'validated', transactions: false, expand: false }))
    const checkedAt = new Date().toISOString()
    for (const issuer of this.issuers) {
      const raw = await this.request({ command: 'ledger_entry', ledger_hash: header.ledger_hash,
        credential: { subject, issuer: issuer.issuer, credential_type: issuer.credentialType } })
      if (raw.error === 'entryNotFound') continue
      const entry = z.object({ validated: z.literal(true), ledger_hash: z.literal(header.ledger_hash), index: hash,
        node: z.object({ LedgerEntryType: z.literal('Credential'), Flags: uint, Subject: z.literal(subject), Issuer: z.literal(issuer.issuer),
          CredentialType: z.string().refine(s => s.toUpperCase() === issuer.credentialType), Expiration: uint.optional() }) }).parse(raw)
      const n = entry.node
      if (!(n.Flags & 0x10000) || (n.Expiration !== undefined && n.Expiration <= header.ledger.close_time)) continue
      // Do not cache an accepted credential past its ledger-relative expiry.
      const expiresAt = n.Expiration === undefined ? undefined : new Date((n.Expiration + epoch) * 1000).toISOString()
      if (expiresAt && Date.parse(expiresAt) <= Date.now() + this.ttlMs) continue
      return { status: 'verified', issuerLabel: issuer.label, issuer: issuer.issuer, credentialType: issuer.credentialType,
        credentialId: entry.index, ledgerIndex: header.ledger_index, expiresAt, checkedAt }
    }
    return unverified()
  }
}
let configured: { raw: string; verifier: WriterCredentials } | undefined
export async function writerVerification(subject: string): Promise<WriterVerification> {
  try {
    const raw = loadConfig().WRITER_CREDENTIAL_ISSUERS || '[]'
    if (!configured || configured.raw !== raw) configured = { raw, verifier: new WriterCredentials(z.array(CredentialIssuerSchema).max(4).parse(JSON.parse(raw))) }
    return await configured.verifier.check(subject)
  } catch { return { status: 'check_failed' } }
}
