import type { Answer, ContentEnvelope, Impact, PublicCandidate } from '../../shared/contracts/index.js'
import type { PublisherClient } from '../publisher-client.js'
export async function retrieve(_client: PublisherClient, _question: string): Promise<{ candidates: PublicCandidate[]; contents: ContentEnvelope[] }> { throw new Error('TODO(W1-RESEARCH)') }
export async function writeAnswer(_input: { question: string; contents: ContentEnvelope[]; candidates: PublicCandidate[]; version: number; previous?: Answer; onToken?: (delta: string) => void }): Promise<{ answer: Answer; impact?: Impact }> { throw new Error('TODO(W1-RESEARCH)') }
