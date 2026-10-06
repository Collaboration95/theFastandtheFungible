import { z } from 'zod'
import { SearchHitSchema, type SearchHit } from '../shared/contracts/manifest.js'
import { PassageSchema } from '../shared/contracts/writers.js'
import { ContentEnvelopeSchema, ProfileSchema, PublicCandidateSchema, type ContentEnvelope, type Profile, type PublicCandidate } from '../shared/contracts/index.js'
import type { PaymentRequired, PaymentResponse } from '../shared/contracts/x402.js'
import { decodeHeader } from '../shared/x402.js'
export type WireExchange = { method: string; path: string; status: number; body?: unknown }
export type WireObserver = (wire: WireExchange) => void
export class PublisherHttpError extends Error {
  constructor(readonly status: number) { super(`Publisher HTTP ${status}`) }
}
export class PublisherClient {
  /** `secret` is unused since x402 v2 (no Bearer settlement); kept so existing callers compile. */
  constructor(readonly options: { baseUrl?: string; secret?: string; onWire?: WireObserver; timeoutMs?: number } = {}) {}
  private async request(method: string, path: string, body?: unknown, token?: string, observer?: WireObserver): Promise<{ bytes: Buffer; digest: string; status: number }> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers['X-Delivery-Token'] = token
    const response = await fetch(new URL(path, this.options.baseUrl ?? process.env.PUBLISHER_URL ?? 'http://127.0.0.1:8790'), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.options.timeoutMs ?? 5000), redirect: 'error',
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    // Only status/path leave this boundary. No delivery token, response body, or
    // publisher error text (which could contain premium content) enters a trace.
    const wire = { method, path, status: response.status }
    observer?.(wire) // Manager persists first; only then notify external subscribers.
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter settlement */ }
    if (!response.ok) throw new PublisherHttpError(response.status)
    return { bytes, digest: response.headers.get('digest') ?? '', status: response.status }
  }
  async profiles(): Promise<Profile[]> {
    const result = await this.request('GET', '/v1/profiles')
    return ProfileSchema.array().parse(JSON.parse(result.bytes.toString('utf8')))
  }
  async search(profileId: string, question: string): Promise<PublicCandidate[]> {
    const result = await this.request('GET', `/v1/profiles/${encodeURIComponent(profileId)}/search?q=${encodeURIComponent(question)}`)
    return PublicCandidateSchema.array().parse(JSON.parse(result.bytes.toString('utf8')))
  }
  async read(candidate: PublicCandidate, token?: string, observer?: WireObserver): Promise<{ content: ContentEnvelope; digest: string; bytes: string; rawBytes?: Uint8Array }> {
    const path = `/v1/profiles/${encodeURIComponent(candidate.profileId)}/resources/${encodeURIComponent(candidate.resourceId)}/versions/${encodeURIComponent(candidate.version)}/content`
    const result = await this.request('GET', path, undefined, token, observer)
    const bytes = result.bytes.toString('utf8')
    const content = ContentEnvelopeSchema.parse(JSON.parse(bytes))
    if (content.profileId !== candidate.profileId || content.resourceId !== candidate.resourceId || content.version !== candidate.version || content.spans.some(s => !content.body.includes(s.text))) throw new Error('Publisher content identity or spans invalid')
    return { content, digest: result.digest, bytes, rawBytes: result.bytes }
  }
  /** Paid GET path: the hit's root-relative agent URL, else the legacy profile content path. */
  static paidPath(candidate: Pick<PublicCandidate, 'url' | 'profileId' | 'resourceId' | 'version'>): string {
    return candidate.url ?? `/v1/profiles/${encodeURIComponent(candidate.profileId)}/resources/${encodeURIComponent(candidate.resourceId)}/versions/${encodeURIComponent(candidate.version)}/content`
  }
  /**
   * x402 v2 paid GET (#130). Without a signature it expects 402 + PAYMENT-REQUIRED; with one it returns the
   * status, the decoded PAYMENT-RESPONSE and, on 200, the delivered JSON. Only status/path reach the wire log.
   */
  async paidGet(path: string, signature: string | undefined, observer?: WireObserver): Promise<{ status: number; required?: PaymentRequired; response?: PaymentResponse; delivery?: unknown }> {
    const response = await fetch(new URL(path, this.options.baseUrl ?? process.env.PUBLISHER_URL ?? 'http://127.0.0.1:8790'), {
      headers: { Accept: 'application/json', ...(signature ? { 'PAYMENT-SIGNATURE': signature } : {}) }, signal: AbortSignal.timeout(this.options.timeoutMs ?? 60_000), redirect: 'error',
    })
    const text = await response.text()
    const wire = { method: 'GET', path, status: response.status }
    observer?.(wire)
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter settlement */ }
    const header = <H extends 'PAYMENT-REQUIRED' | 'PAYMENT-RESPONSE'>(name: H) => response.headers.has(name) ? decodeHeader(name, response.headers.get(name)) : undefined
    return {
      status: response.status, required: response.status === 402 ? header('PAYMENT-REQUIRED') : undefined, response: header('PAYMENT-RESPONSE'),
      delivery: response.status === 200 ? JSON.parse(text) as unknown : undefined,
    }
  }
  // Federated search (D1, #138): registry, per-publisher search and FREE article reads.
  private async getJson(path: string, timeoutMs?: number): Promise<unknown> {
    const response = await fetch(new URL(path, this.options.baseUrl ?? process.env.PUBLISHER_URL ?? 'http://127.0.0.1:8790'), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs ?? this.options.timeoutMs ?? 5000), redirect: 'error' })
    const wire = { method: 'GET', path, status: response.status }
    try { this.options.onWire?.(wire) } catch { /* telemetry cannot alter retrieval */ }
    if (!response.ok) throw new PublisherHttpError(response.status)
    return response.json()
  }
  async registry(): Promise<RegistryPublisher[]> {
    return RegistrySchema.parse(await this.getJson('/registry')).publishers
  }
  /** Invalid hits (schema or a PAID hit without a manifest) are dropped, never repaired. */
  async searchPublisher(slug: string, q: string, k: number, timeoutMs?: number): Promise<SearchHit[]> {
    const raw = z.array(z.unknown()).parse(await this.getJson(`/w/${encodeURIComponent(slug)}/search?${new URLSearchParams({ q, k: String(k) })}`, timeoutMs))
    return raw.flatMap(item => { const hit = SearchHitSchema.safeParse(item); return hit.success && hit.data.publisherSlug === slug ? [hit.data] : [] })
  }
  /** FREE articles only (gate 1): a PAID url answers 402 and is never read here. */
  async readFree(hit: SearchHit, publisherName: string): Promise<ContentEnvelope> {
    if (hit.tier !== 'FREE') throw new Error('Only FREE articles are read without a grant')
    const article = FreeArticleSchema.parse(await this.getJson(hit.url))
    if (article.articleId !== hit.articleId || article.version !== hit.version || article.publisherSlug !== hit.publisherSlug || article.passages.some(p => !article.body.includes(p.text))) throw new Error('Publisher article identity or passages invalid')
    return ContentEnvelopeSchema.parse({ profileId: hit.publisherSlug, resourceId: hit.articleId, version: hit.version, title: article.title, publisher: publisherName, body: article.body, spans: article.passages.map(p => ({ id: p.id, text: p.text, ...(p.heading ? { label: p.heading } : {}) })) })
  }
}
const RegistryPublisherSchema = z.object({ slug: z.string().min(1), name: z.string().min(1), kind: z.enum(['masthead', 'independent', 'records']), domain: z.string().optional(), wallet: z.string().optional(), synthetic: z.boolean().optional() })
const RegistrySchema = z.object({ publishers: z.array(RegistryPublisherSchema) })
const FreeArticleSchema = z.object({ publisherSlug: z.string(), articleId: z.string(), version: z.string(), title: z.string().min(1), tier: z.literal('FREE'), body: z.string().min(1), passages: z.array(PassageSchema).min(1) })
export type RegistryPublisher = z.infer<typeof RegistryPublisherSchema>
