import { createHash } from 'node:crypto'

export type HashChainEvent = {
  sequence: number
  type: string
  actor: string
  occurredAt: string
  idempotencyKey: string
  previousHash: string
  payload: Record<string, unknown>
  eventHash: string
}

/** Stable JSON for evidence hashes: object keys are sorted recursively. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(',')}}`
}

export function hashValue(value: unknown) {
  return createHash('sha256').update(canonicalize(value)).digest('hex')
}

export function eventHash(event: Omit<HashChainEvent, 'eventHash'>, aggregateId: string) {
  return hashValue({ aggregate_id: aggregateId, sequence: event.sequence, event_type: event.type, actor: event.actor, occurred_at: event.occurredAt, idempotency_key: event.idempotencyKey, previous_hash: event.previousHash, redacted_payload: event.payload })
}

export function verifyEventChain(events: HashChainEvent[], aggregateId: string) {
  let previousHash = 'GENESIS'
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1 || event.previousHash !== previousHash) return false
    if (event.eventHash !== eventHash(event, aggregateId)) return false
    previousHash = event.eventHash
  }
  return true
}
