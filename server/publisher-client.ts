import type { ContentEnvelope, Profile, PublicCandidate, Quote, QuoteRequest, Settlement } from '../shared/contracts/index.js'
export type WireExchange = { method: string; path: string; status: number; body?: unknown }
export class PublisherClient {
  constructor(readonly options: { baseUrl?: string; secret?: string; onWire?: (wire: WireExchange) => void } = {}) {}
  async profiles(): Promise<Profile[]> { throw new Error('TODO(W1-LEDGER)') }
  async search(_profileId: string, _question: string): Promise<PublicCandidate[]> { throw new Error('TODO(W1-LEDGER)') }
  async read(_candidate: PublicCandidate, _token?: string): Promise<{ content: ContentEnvelope; digest: string; bytes: string }> { throw new Error('TODO(W1-LEDGER)') }
  async quote(_request: QuoteRequest): Promise<Quote> { throw new Error('TODO(W1-LEDGER)') }
  async settle(_quote: Quote): Promise<Settlement> { throw new Error('TODO(W1-LEDGER)') }
  async settlement(_intentId: string): Promise<Settlement> { throw new Error('TODO(W1-LEDGER)') }
}
