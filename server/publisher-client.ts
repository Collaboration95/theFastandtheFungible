import { localWriterRegistrations } from './local-writer-discovery.js'
import { writerVerification } from './writer-credentials.js'
import { WriterVerificationSchema } from '../shared/writer-verification.js'
import { deriveAddress } from 'ripple-keypairs'
import { validateProviderUrl } from './agents/compatible.js'
import { verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'
import type { SourceIdentity } from '../shared/source-identity.js'
import { boundedBody } from './body-limit.js'
import { EscrowQuoteSchema } from '../shared/contracts/escrow.js'
import { loadConfig } from './config.js'
import { z } from 'zod'
import { SearchHitSchema, type SearchHit } from '../shared/contracts/manifest.js'
import { PassageSchema } from '../shared/contracts/writers.js'
import { ManifestSchema } from '../shared/contracts/manifest.js'
import { ContentEnvelopeSchema, type ContentEnvelope, type PublicCandidate } from '../shared/contracts/index.js'
import type { PaymentRequired, PaymentResponse } from '../shared/contracts/x402.js'
import { decodeHeader } from '../shared/x402.js'
import { ChallengeResultSchema, type Challenge, type ChallengeResult } from '../shared/contracts/publisher.js'
export type WireExchange = { method: string; path: string; status: number; body?: unknown }
export type WireObserver = (wire: WireExchange) => void
export class PublisherHttpError extends Error {
  constructor(readonly status: number) { super(`Publisher HTTP ${status}`) }
}
export class PublisherClient {
  private readonly sellerKeys = new Map<string, Promise<string>>()
  private readonly sellerWallets = new Map<string,string>()
  /** `secret` is unused since x402 v2 (no Bearer settlement); kept so existing callers compile. */
  constructor(readonly options: { baseUrl?: string; secret?: string; onWire?: WireObserver; timeoutMs?: number; baseUrls?: string[]; federated?: boolean; deadline?: number; signal?: AbortSignal } = {}) {}
  withSignal(signal?: AbortSignal): PublisherClient { return Object.assign(Object.create(this) as PublisherClient, {options:{...this.options,signal}}) }
  get origin(): string { return approvedPublisherOrigin(this.options.baseUrl ?? loadConfig().PUBLISHER_URL ?? 'http://127.0.0.1:8790') }
  origins(): PublisherClient[] {
    const raw = this.options.baseUrls ?? (!this.options.baseUrl && loadConfig().PUBLISHER_URLS ? loadConfig().PUBLISHER_URLS!.split(',').map(s => s.trim()) : [this.origin])
    if (!raw.length || raw.length > 3) throw new Error('At most three publisher origins')
    const urls = raw.map(approvedPublisherOrigin)
    if (loadConfig().SETTLEMENT_RAIL === 'xrpl-testnet') for (const entry of localWriterRegistrations()) {
      if (urls.length < 3 && !urls.includes(entry.origin)) urls.push(entry.origin)
    }
    if (new Set(urls).size !== urls.length) throw new Error('Duplicate publisher origin')
    return urls.map(baseUrl => Object.assign(Object.create(this) as PublisherClient, { sellerKeys: new Map<string,Promise<string>>(), sellerWallets: new Map<string,string>(), options: { ...this.options, baseUrls: undefined, baseUrl, federated: Boolean(urls.length > 1 || this.options.baseUrls || loadConfig().PUBLISHER_URLS || this.options.federated), deadline: Date.now() + 15000 } }))
  }
  forSource(source?: SourceIdentity, recovery = false): PublisherClient {
    if (!source) { if (this.options.baseUrls || this.options.federated || loadConfig().PUBLISHER_URLS) throw new Error('Historical origin unresolved'); return this }
    const origin = approvedPublisherOrigin(source.origin)
    if (!recovery && !this.origins().some(c => c.origin === origin)) throw new Error('Origin is not admitted for new purchases')
    return new PublisherClient({ ...this.options, baseUrls: undefined, baseUrl: origin })
  }
  private async fetchPath(path: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /%2f|%5c/i.test(path)) throw new Error('Publisher path must be root relative')
    const url = new URL(path, this.origin)
    if (url.origin !== this.origin) throw new Error('Cross-origin publisher path')
    const remaining = this.options.deadline ? this.options.deadline - Date.now() : undefined
    if (remaining !== undefined && remaining <= 0) throw new Error('Origin deadline exceeded')
    const signal = AbortSignal.any([...(init.signal ? [init.signal] : []), ...(this.options.signal ? [this.options.signal] : []), ...(remaining ? [AbortSignal.timeout(remaining)] : [])])
    return limitedFetch(url.href, { ...init, signal }, timeoutMs)
  }

  private async request(method: string, path: string, body?: unknown, token?: string, observer?: WireObserver): Promise<{ bytes: Buffer; digest: string; status: number }> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers['X-Delivery-Token'] = token
    const response = await this.fetchPath(path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.options.timeoutMs ?? 5000), redirect: 'error',
    })
    const bytes = await boundedBody(response, 256 * 1024)
    // Only status/path leave this boundary. No delivery token, response body, or
    // publisher error text (which could contain premium content) enters a trace.
    const wire = { method, path, status: response.status }
    observer?.(wire) // Manager persists first; only then notify external subscribers.
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter settlement */ }
    if (!response.ok) throw new PublisherHttpError(response.status)
    return { bytes, digest: response.headers.get('digest') ?? '', status: response.status }
  }
  /** Paid GET path: the hit's root-relative agent URL, else the publisher's agent article route. */
  static paidPath(candidate: Pick<PublicCandidate, 'url' | 'profileId' | 'resourceId'>): string {
    return candidate.url ?? `/w/${encodeURIComponent(candidate.profileId)}/articles/${encodeURIComponent(candidate.resourceId)}`
  }
  /**
   * x402 v2 paid GET (#130). Without a signature it expects 402 + PAYMENT-REQUIRED; with one it returns the
   * status, the decoded PAYMENT-RESPONSE and, on 200, the delivered JSON. Only status/path reach the wire log.
   */
  async paidGet(path: string, signature: string | undefined, observer?: WireObserver): Promise<{ status: number; required?: PaymentRequired; response?: PaymentResponse; delivery?: unknown }> {
    const response = await this.fetchPath(path, {
      headers: { Accept: 'application/json', ...(signature ? { 'PAYMENT-SIGNATURE': signature } : {}) }, signal: AbortSignal.timeout(this.options.timeoutMs ?? 60_000), redirect: 'error',
    })
    const text = (await boundedBody(response, 2 * 1024 * 1024)).toString('utf8')
    const wire = { method: 'GET', path, status: response.status }
    observer?.(wire)
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter settlement */ }
    const header = <H extends 'PAYMENT-REQUIRED' | 'PAYMENT-RESPONSE'>(name: H) => response.headers.has(name) ? decodeHeader(name, response.headers.get(name)) : undefined
    return {
      status: response.status, required: response.status === 402 ? header('PAYMENT-REQUIRED') : undefined, response: header('PAYMENT-RESPONSE'),
      delivery: response.status === 200 ? JSON.parse(text) as unknown : undefined,
    }
  }
  async escrowQuote(path: string, request: { mode?: 'key-reveal'; payer: string; intentId: string; condition: string; cancelAfter: number }) {
    const result = await this.request('POST', `${path}/escrow-quote`, request)
    return EscrowQuoteSchema.parse(JSON.parse(result.bytes.toString('utf8')))
  }
  /** POST /w/:slug/challenge (#132). Any non-200, timeout or malformed answer throws: the caller records REFUSED. */
  async challenge(slug: string, challenge: Challenge, timeoutMs: number, observer?: WireObserver): Promise<ChallengeResult> {
    const path = `/w/${encodeURIComponent(slug)}/challenge`
    const response = await this.fetchPath(path, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(challenge), signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
    })
    const wire = { method: 'POST', path, status: response.status }
    observer?.(wire)
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter a challenge */ }
    if (!response.ok) throw new PublisherHttpError(response.status)
    return ChallengeResultSchema.parse(JSON.parse((await boundedBody(response, 256 * 1024)).toString('utf8')))
  }
  // Federated search (D1, #138): registry, per-publisher search and FREE article reads.
  private async getJson(path: string, timeoutMs?: number): Promise<unknown> {
    const response = await this.fetchPath(path, { headers: { Accept: 'application/json' }, ...(path === '/registry' ? {signal:AbortSignal.timeout(2000)} : {}), redirect: 'error' }, timeoutMs ?? this.options.timeoutMs ?? 5000)
    const wire = { method: 'GET', path, status: response.status }
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter retrieval */ }
    if (!response.ok) throw new PublisherHttpError(response.status)
    return JSON.parse((await boundedBody(response, path.includes('/articles/') ? 2 * 1024 * 1024 : 256 * 1024)).toString('utf8'))
  }
  async registry(): Promise<RegistryPublisher[]> {
    const publishers = RegistrySchema.parse(await this.getJson('/registry')).publishers.slice(0, 50)
    for (const p of publishers) if (p.wallet) this.sellerWallets.set(p.slug, p.wallet)
    // Registry metadata alone is not proof of possession of the seller key.
    return publishers.map(p => ({ ...p, verification: { status: 'unverified' as const } }))
  }
  /** Catalogue identity is independent of purchases. Never promote a bare registry wallet or a historical run. */
  async writerCatalogue(): Promise<RegistryPublisher[]> {
    return Promise.all((await this.registry()).map(async publisher => {
      if (publisher.authorship !== 'team-authored') return publisher
      try {
        const card = z.object({ pubKey: z.string(), identityManifest: ManifestSchema }).parse(
          await this.getJson(`/w/${encodeURIComponent(publisher.slug)}/.well-known/agent-publisher.json`))
        const m = card.identityManifest
        if (!publisher.wallet || m.publisherSlug !== publisher.slug || m.wallet !== publisher.wallet || m.pubKey !== card.pubKey || !verifyManifestSignature(m)) throw Error('Unbound writer identity')
        return { ...publisher, verification: await writerVerification(publisher.wallet) }
      } catch { return { ...publisher, verification: { status: 'check_failed' as const } } }
    }))
  }
  private sellerKey(slug: string): Promise<string> {
    if (!this.sellerKeys.has(slug)) this.sellerKeys.set(slug, this.getJson(`/w/${encodeURIComponent(slug)}/.well-known/agent-publisher.json`).then(raw => {
      const card = z.object({pubKey:z.string().regex(/^[0-9A-F]{66}$/i)}).parse(raw)
      if (deriveAddress(card.pubKey) !== this.sellerWallets.get(slug)) throw new Error('Discovery key differs from registered wallet')
      return card.pubKey
    }))
    return this.sellerKeys.get(slug)!
  }
  /** Invalid hits (schema or a PAID hit without a manifest) are dropped, never repaired. */
  async searchPublisher(slug: string, q: string, k: number, timeoutMs?: number): Promise<SearchHit[]> {
    const raw = z.array(z.unknown()).parse(await this.getJson(`/w/${encodeURIComponent(slug)}/search?${new URLSearchParams({ q, k: String(k) })}`, timeoutMs))
    const freeKey = this.options.federated && raw.some(i => !!i && typeof i === 'object' && 'tier' in i && i.tier === 'FREE') ? await this.sellerKey(slug) : undefined
    const hits = raw.slice(0, Math.min(k, 50)).flatMap(item => { const hit = SearchHitSchema.safeParse(item); if (!hit.success || hit.data.publisherSlug !== slug || hit.data.source) return []; return [{ ...hit.data, ...(this.options.federated ? { source: { schemaVersion: 1 as const, origin: this.origin, sellerKey: hit.data.manifest?.pubKey ?? freeKey ?? 'unverified', profileId: slug, resourceId: hit.data.articleId, version: hit.data.version } } : {}) }] })
    return Promise.all(hits.map(async hit => {
      const wallet = this.sellerWallets.get(slug)
      let verification = { status: 'unverified' } as import('../shared/writer-verification.js').WriterVerification
      if (!(loadConfig().WRITER_CREDENTIAL_ISSUERS || loadConfig().WRITER_CREDENTIAL_DOMAIN) || !hit.manifest) return { ...hit, verification }
      try {
        const key = hit.manifest?.pubKey ?? await this.sellerKey(slug)
        if (wallet && deriveAddress(key) === wallet && (!hit.manifest || verifyManifestSignature(hit.manifest) && hit.manifest.wallet === wallet)) verification = await writerVerification(wallet)
      } catch { verification = { status: 'check_failed' } }
      return { ...hit, verification }
    }))

  }
  /** FREE articles only (gate 1): a PAID url answers 402 and is never read here. */
  async readFree(hit: SearchHit, publisherName: string): Promise<ContentEnvelope> {
    if (hit.tier !== 'FREE') throw new Error('Only FREE articles are read without a grant')
    const article = FreeArticleSchema.parse(await this.getJson(hit.url))
    if (article.articleId !== hit.articleId || article.version !== hit.version || article.publisherSlug !== hit.publisherSlug || article.passages.some(p => !article.body.includes(p.text))) throw new Error('Publisher article identity or passages invalid')
    const proof = article.verification
    // Local unsigned legacy FREE articles remain explicit legacy input. Any supplied
    // envelope must pass in full, even when federation is off.
    if (proof && (proof.manifest.priceMinor !== 0 || new Set(article.passages.map(p => p.id)).size !== article.passages.length || !verifyManifestSignature(proof.manifest) || proof.manifest.wallet !== this.sellerWallets.get(hit.publisherSlug)
      || proof.manifest.articleId !== hit.articleId || proof.manifest.version !== hit.version || proof.manifest.publisherSlug !== hit.publisherSlug
      || proof.salts.length !== article.passages.length || !verifyDelivery(article.body, article.passages, proof.salts, proof.manifest).ok)) throw new Error('Free source delivery proof invalid')
    if (hit.source) {
      if (!article.verification || !verifyManifestSignature(article.verification.manifest) || article.verification.manifest.wallet !== this.sellerWallets.get(hit.publisherSlug) || article.verification.manifest.articleId !== hit.articleId || article.verification.manifest.version !== hit.version || article.verification.manifest.publisherSlug !== hit.publisherSlug) throw new Error('Free source requires signed identity')
      hit.source = { ...hit.source, sellerKey: article.verification.manifest.pubKey }
    }
    const signed = article.verification?.manifest
    if ((loadConfig().WRITER_CREDENTIAL_ISSUERS || loadConfig().WRITER_CREDENTIAL_DOMAIN) && signed && verifyManifestSignature(signed) && signed.wallet === this.sellerWallets.get(hit.publisherSlug) && signed.publisherSlug === hit.publisherSlug && signed.articleId === hit.articleId && signed.version === hit.version) hit.verification = await writerVerification(signed.wallet)
    return ContentEnvelopeSchema.parse({ source: hit.source, profileId: hit.publisherSlug, resourceId: hit.articleId, version: hit.version, title: article.title, publisher: publisherName, body: article.body, verification: article.verification, spans: article.passages.map(p => ({ id: p.id, text: p.text, ...(p.heading ? { label: p.heading } : {}) })) })
  }
}
const RegistryPublisherSchema = z.object({ slug: z.string().min(1), name: z.string().min(1), kind: z.enum(['masthead', 'independent', 'records']), domain: z.string().optional(), wallet: z.string().optional(), synthetic: z.boolean().optional(), authorship: z.literal('team-authored').optional(), verification: WriterVerificationSchema.optional() })
const RegistrySchema = z.object({ publishers: z.array(RegistryPublisherSchema) })
const FreeArticleSchema = z.object({ publisherSlug: z.string(), articleId: z.string(), version: z.string(), title: z.string().min(1), tier: z.literal('FREE'), verification: z.object({ manifest: ManifestSchema, salts: z.array(z.string()) }).optional(), body: z.string().min(1), passages: z.array(PassageSchema).min(1) })
export type RegistryPublisher = z.infer<typeof RegistryPublisherSchema>

/** Finals topology: numeric loopback only. Public remote federation is deferred. */
export function approvedPublisherOrigin(raw: string): string {
  const u = validateProviderUrl(raw)
  if (!['127.0.0.1', '[::1]'].includes(u.hostname) || u.pathname !== '/' || /[?#]/.test(raw)) throw new Error('Publisher requires pinned numeric loopback origin')
  return u.origin
}
let activeRequests = 0
const waiters: (() => void)[] = []
async function acquireSlot(signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted()
  if (activeRequests < 4) { activeRequests++; return }
  await new Promise<void>((resolve,reject) => {
    const wake = () => { signal?.removeEventListener('abort',abort); resolve() }
    const abort = () => { const index=waiters.indexOf(wake); if(index >= 0) waiters.splice(index,1); reject(signal?.reason) }
    waiters.push(wake)
    signal?.addEventListener('abort',abort,{once:true})
  })
}
async function limitedFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  await acquireSlot(init.signal)
  try {
    init.signal?.throwIfAborted()
    // Queue wait consumes the origin's 15 s budget; the search/embedding budget starts in its slot.
    const signal=timeoutMs ? AbortSignal.any([...(init.signal ? [init.signal] : []),AbortSignal.timeout(timeoutMs)]) : init.signal
    const response = await fetch(url, { ...init, signal, redirect: 'error' })
    // Hold the slot through body consumption, not just response headers.
    const bytes = await boundedBody(response, new URL(url).pathname.includes('/articles/') ? 2 * 1024 * 1024 : 256 * 1024)
    return new Response(new Uint8Array(bytes), { status: response.status, headers: response.headers })
  } finally { const next=waiters.shift(); if(next) next(); else activeRequests-- }
}
