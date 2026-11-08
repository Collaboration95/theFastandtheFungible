/** Anchor progress labels shared by the server outbox and the answer screen. Pending is not a failure. */
export const ANCHOR_PENDING_LABEL = 'Anchoring… awaiting validation'
/** Real terminal failures only. A pending lookup must never match, or the UI stops polling a good anchor. */
export const ANCHOR_FAILURE_LABELS = [
  'Anchor unavailable (failed)',
  'Anchor unavailable (expired)',
  'Anchor unavailable (submission or validation failed)',
  'Anchor unavailable (validation not confirmed in time)',
] as const
type Labelled = { label?: string }
/** The newest anchor progress event: a terminal failure, a pending lookup, or none. */
export function anchorProgress(events: readonly Labelled[]): { kind: 'failed' | 'pending'; label: string } | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const label = events[i]!.label
    if (label === ANCHOR_PENDING_LABEL) return { kind: 'pending', label }
    if (label && (ANCHOR_FAILURE_LABELS as readonly string[]).includes(label)) return { kind: 'failed', label }
  }
  return undefined
}
