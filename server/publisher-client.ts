import { ContentEnvelopeSchema, ProfileSchema, PublicCandidateSchema, QuoteSchema, SettlementSchema, type ContentEnvelope, type Profile, type PublicCandidate, type Quote, type QuoteRequest, type Settlement } from '../shared/contracts/index.js'
export type WireExchange = { method: string; path: string; status: number; body?: unknown }
export type WireObserver = (wire: WireExchange) => void
export class PublisherHttpError extends Error {
  constructor(readonly status: number) { super(`Publisher HTTP ${status}`) }
}
export class PublisherClient {
  constructor(readonly options: { baseUrl?: string; secret?: string; onWire?: WireObserver; timeoutMs?: number } = {}) {}
  private async request(method: string, path: string, body?: unknown, token?: string, authenticated = false, observer?: WireObserver): Promise<{ bytes: Buffer; digest: string; status: number }> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers['X-Delivery-Token'] = token
    if (authenticated) headers.Authorization = `Bearer ${this.options.secret ?? process.env.PUBLISHER_SECRET ?? ''}`
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
    const result = await this.request('GET', path, undefined, token, false, observer)
    const bytes = result.bytes.toString('utf8')
    const content = ContentEnvelopeSchema.parse(JSON.parse(bytes))
    if (content.profileId !== candidate.profileId || content.resourceId !== candidate.resourceId || content.version !== candidate.version || content.spans.some(s => !content.body.includes(s.text))) throw new Error('Publisher content identity or spans invalid')
    return { content, digest: result.digest, bytes, rawBytes: result.bytes }
  }
  async quote(request: QuoteRequest, observer?: WireObserver): Promise<Quote> {
    const result = await this.request('POST', '/v1/quotes', request, undefined, false, observer)
    const quote = QuoteSchema.parse(JSON.parse(result.bytes.toString('utf8')))
    if (Object.entries(request).some(([key, value]) => quote[key as keyof Quote] !== value)) throw new Error('Publisher quote identity mismatch')
    return quote
  }
  async settle(quote: Quote, observer?: WireObserver, txHash?: string): Promise<Settlement> {
    const result = await this.request('POST', '/v1/settlements', { quoteId: quote.quoteId, quoteHash: quote.quoteHash, intentId: quote.intentId, ...(txHash ? { txHash } : {}) }, undefined, true, observer)
    // POST may omit status; the wire protocol's success is a settled receipt/token.
    const value = JSON.parse(result.bytes.toString('utf8'))
    return SettlementSchema.parse({ status: 'SETTLED', ...value })
  }
  async settlement(intentId: string, observer?: WireObserver): Promise<Settlement> {
    const result = await this.request('GET', `/v1/settlements/${encodeURIComponent(intentId)}`, undefined, undefined, true, observer)
    return SettlementSchema.parse(JSON.parse(result.bytes.toString('utf8')))
  }
}
