import { IntentStatusSchema, type PurchaseIntent, type RunSnapshot, type TraceEvent } from '../shared/contracts/index.js'

/* Stage pacing. A fixture run finishes in under 100 ms, so the screen replays the
   persisted trace with a minimum time per step. The server stays fast; the view waits
   for people. Replay only hides what hasn't "happened" yet: it never adds data. */

export type Pace = 'stage' | 'slow' | 'real'
export const SPEED: Record<Pace, number> = { stage: 1, slow: 0.5, real: Infinity }

const TERMINAL = ['DONE', 'FAILED', 'STOPPED']
export const isTerminal = (run?: RunSnapshot) => !!run && (run.stopped || TERMINAL.includes(run.phase))
export const runEvents = (run: RunSnapshot) => run.events.filter(event => event.runId === run.runId).sort((a, b) => a.id - b.id)

// Time on screen after each event, in ms at 1×.
const DWELL: Record<string, number> = { SEARCH: 1900, READ_FREE: 1900, ANSWER: 3400, DECIDE: 4600, BUY: 1300, PURCHASE: 900, XRPL: 900, GRANT: 2300, READ_PAID: 500, FAILED: 1500 }
export function dwell(event: TraceEvent): number {
  if (event.type === 'WIRE') return Number(event.data?.status) === 402 ? 1700 : 900
  return DWELL[event.type] ?? 0
}

const PHASES = new Set<string>(['SEARCH', 'READ_FREE', 'ANSWER', 'DECIDE', 'BUY', 'READ_PAID', 'DONE', 'FAILED', 'STOPPED'])
const PAID: PurchaseIntent['status'][] = ['SETTLED', 'DELIVERY_PENDING', 'VERIFIED', 'DELIVERY_FAILED']
export const isPaid = (intent: PurchaseIntent) => PAID.includes(intent.status)

/** The run as it looked once every event up to `cursor` had happened. */
export function staged(run: RunSnapshot, cursor: number): RunSnapshot {
  const all = runEvents(run)
  if (!Number.isFinite(cursor) || all.every(event => event.id <= cursor)) return run
  const events = all.filter(event => event.id <= cursor)
  const count = (type: string) => events.filter(event => event.type === type).length
  const status = new Map<string, PurchaseIntent['status']>()
  let phase: RunSnapshot['phase'] = 'SEARCH'
  let buy = -1
  for (const event of events) {
    if (PHASES.has(event.type)) phase = event.type as RunSnapshot['phase']
    const intent = run.intents[buy]
    if (event.type === 'BUY') { buy++; const next = run.intents[buy]; if (next) status.set(next.intentId, 'DECIDED') }
    else if (event.type === 'PURCHASE' && intent) {
      // Refusal events carry the status only in their label.
      const parsed = IntentStatusSchema.safeParse(event.data?.status ?? event.label.split(' ')[0])
      if (parsed.success) status.set(intent.intentId, parsed.data)
    }
    else if (event.type === 'WIRE' && intent) {
      const path = String(event.data?.path ?? ''), code = Number(event.data?.status)
      if (path.includes('/quotes')) status.set(intent.intentId, 'QUOTED')
      else if (path.includes('/settlements') && code === 200) status.set(intent.intentId, 'SETTLED')
      else if (path.endsWith('/content') && code === 200 && status.get(intent.intentId) === 'SETTLED') status.set(intent.intentId, 'DELIVERY_PENDING')
    } else if (event.type === 'GRANT') {
      const real = run.intents.find(item => item.intentId === event.data?.intentId)
      if (real) status.set(real.intentId, 'VERIFIED')
    } else if (event.type === 'FAILED' && intent && ['SETTLED', 'DELIVERY_PENDING'].includes(status.get(intent.intentId) ?? '')) status.set(intent.intentId, 'DELIVERY_FAILED')
  }
  const intents = run.intents.filter(item => status.has(item.intentId)).map(item => ({ ...item, status: status.get(item.intentId)! }))
  const paid = intents.filter(isPaid)
  const verified = new Set(intents.filter(item => item.status === 'VERIFIED').map(item => item.intentId))
  const answers = [...run.answers].sort((a, b) => a.version - b.version).slice(0, count('ANSWER'))
  return {
    ...run, phase, stopped: false, error: undefined, reportStatus: 'NONE', events,
    candidates: count('SEARCH') ? run.candidates : [],
    contents: count('READ_FREE') ? run.contents : [],
    answers, impact: answers.length > 1 ? run.impact : undefined,
    decisions: run.decisions.slice(0, count('DECIDE')), round: Math.min(run.round, count('DECIDE')),
    intents,
    spentMinor: paid.reduce((sum, item) => sum + item.amountMinor, 0),
    reservedMinor: intents.filter(item => item.status === 'RESERVED' || item.status === 'SUBMITTING').reduce((sum, item) => sum + item.amountMinor, 0),
    receipts: run.receipts.filter(receipt => paid.some(item => item.intentId === receipt.intentId)),
    grants: run.grants.filter(grant => verified.has(grant.intentId)),
  }
}
