// Trust matrix (D6, FINAL-PUSH §7): Beta Reputation honesty × Brier calibration,
// keyed by the seller of record, the publisher wallet (D21). Trust only lowers
// value; it never touches the budget or the per-source cap (gate 2).
import type { ReputationRecord, ReputationSummary, RunSnapshot } from '../shared/contracts/index.js'
import type { DecisionProvider } from './agents/decision.js'
import type { Store } from './store.js'
import { recordStep } from './telemetry.js'

/** Every knob in one place; tune in rehearsal. */
export const REPUTATION = {
  /** Beta prior: a newcomer starts at H = α0 / (α0 + β0) = 0.8. */
  alpha0: 4, beta0: 1,
  /** Forgetting factor applied to r and s on each observation. */
  lambda: 0.95,
  /** Evidence weight per proof outcome. */
  weights: { pass: 1, failedRefunded: 5, failedRejected: 5, failedRefused: 10 },
  /** Quarantined (SKIP_LOW_TRUST, never bought or cited) below this honesty. */
  quarantineBelowH: 0.5,
  /** Any refusal or challenge timeout delists the publisher. */
  delistOnRefusal: true,
}
/** A proof outcome: PASS, or a failed proof by how the challenge ended (D5). */
export type ProofOutcome = 'PASS' | 'REFUNDED' | 'REJECTED' | 'REFUSED'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
function scored(record: Omit<ReputationRecord, 'H' | 'C' | 'T' | 'status'>, config = REPUTATION): ReputationRecord {
  const H = (record.r + config.alpha0) / (record.r + record.s + config.alpha0 + config.beta0)
  const C = record.n ? clamp01(1 - record.brierSum / record.n) : 1
  const status = config.delistOnRefusal && record.refusals > 0 ? 'delisted' : H < config.quarantineBelowH ? 'quarantined' : 'active'
  return { ...record, H: clamp01(H), C, T: clamp01(H) * C, status }
}
export const newRecord = (publisherSlug: string, wallet: string, now = new Date().toISOString(), config = REPUTATION): ReputationRecord =>
  scored({ publisherSlug, wallet, r: 0, s: 0, passes: 0, fails: 0, refunds: 0, refusals: 0, brierSum: 0, n: 0, updatedAt: now }, config)

/** r ← λr + pass; s ← λs + w·fail. */
export function applyProof(record: ReputationRecord, outcome: ProofOutcome, now = new Date().toISOString(), config = REPUTATION): ReputationRecord {
  const w = config.weights
  const pass = outcome === 'PASS' ? w.pass : 0
  const fail = outcome === 'REFUNDED' ? w.failedRefunded : outcome === 'REJECTED' ? w.failedRejected : outcome === 'REFUSED' ? w.failedRefused : 0
  return scored({
    ...record, r: config.lambda * record.r + pass, s: config.lambda * record.s + fail,
    passes: record.passes + (outcome === 'PASS' ? 1 : 0), fails: record.fails + (outcome === 'PASS' ? 0 : 1),
    refunds: record.refunds + (outcome === 'REFUNDED' ? 1 : 0), refusals: record.refusals + (outcome === 'REFUSED' ? 1 : 0), updatedAt: now,
  }, config)
}
/** C = 1 − mean((claimed − observed)²); the claimed relevance is whatever the manifest promised. */
export function applyCalibration(record: ReputationRecord, claimed: number, observed: number, now = new Date().toISOString(), config = REPUTATION): ReputationRecord {
  return scored({ ...record, brierSum: record.brierSum + (clamp01(claimed) - clamp01(observed)) ** 2, n: record.n + 1, updatedAt: now }, config)
}
export const summary = (record: ReputationRecord): ReputationSummary => ({ H: record.H, C: record.C, T: record.T, status: record.status })
export const NEWCOMER: ReputationSummary = summary(newRecord('newcomer', 'newcomer', '1970-01-01T00:00:00.000Z'))

/** Persistent reputation (survives runs; `make reset` and POST /api/reputation/reset wipe it). Emits REPUTATION events. */
export class Reputation {
  constructor(private readonly store: Store, private readonly config = REPUTATION) {}
  get(publisherSlug: string, wallet: string): ReputationRecord { return this.store.getReputation(wallet) ?? newRecord(publisherSlug, wallet, undefined, this.config) }
  list(): ReputationRecord[] { return this.store.listReputation() }
  reset(): void { this.store.resetReputation() }
  /** Summaries by wallet, the decision step's input; decide() treats a wallet with no entry as a newcomer (H = 0.8). */
  summaries(): Record<string, ReputationSummary> { return Object.fromEntries(this.list().map(r => [r.wallet, summary(r)])) }
  private update(publisherSlug: string, wallet: string, change: (r: ReputationRecord) => ReputationRecord, runId: string | undefined, label: string) {
    const before = this.get(publisherSlug, wallet)
    const after = change(before)
    this.store.putReputation(after)
    recordStep('reputation-update', { publisherSlug, wallet, change: label }, { before: summary(before), after: summary(after) })
    if (runId) this.store.appendEvent(runId, { type: 'REPUTATION', label: `${publisherSlug}: ${label} · H ${before.H.toFixed(2)}→${after.H.toFixed(2)} · C ${before.C.toFixed(2)}→${after.C.toFixed(2)} · ${after.status}`, data: { publisherSlug, wallet, before: summary(before), after: summary(after) } })
    return after
  }
  recordProof(input: { publisherSlug: string; wallet: string; outcome: ProofOutcome; runId?: string }): ReputationRecord {
    return this.update(input.publisherSlug, input.wallet, r => applyProof(r, input.outcome, undefined, this.config), input.runId, `proof ${input.outcome.toLowerCase()}`)
  }
  recordCalibration(input: { publisherSlug: string; wallet: string; claimed: number; observed: number; runId?: string }): ReputationRecord {
    return this.update(input.publisherSlug, input.wallet, r => applyCalibration(r, input.claimed, input.observed, undefined, this.config), input.runId, `relevance claimed ${input.claimed.toFixed(2)}, observed ${input.observed.toFixed(2)}`)
  }
  /**
   * Calibration after a purchase (#141). Only a VERIFIED intent with a grant for this run,
   * resource and version reaches the model (gate 1); a quarantined delivery is never scored.
   * A model failure skips the update with a label and never blocks the run.
   */
  async calibrate(input: { run: RunSnapshot; intentId: string; question: string; gap: string; provider: DecisionProvider }): Promise<{ status: 'RECORDED'; record: ReputationRecord } | { status: 'SKIPPED'; reason: string }> {
    const { run } = input
    const intent = run.intents.find(i => i.intentId === input.intentId && i.runId === run.runId)
    if (!intent || intent.status !== 'VERIFIED') return { status: 'SKIPPED', reason: 'No verified delivery.' }
    const grant = run.grants.find(g => g.intentId === intent.intentId && g.runId === run.runId && g.resourceId === intent.resourceId && g.version === intent.version)
    const content = run.contents.find(c => c.resourceId === intent.resourceId && c.version === intent.version)
    const candidate = run.candidates.find(c => c.resourceId === intent.resourceId && c.version === intent.version && c.tier === 'PAID')
    if (!grant || !content) return { status: 'SKIPPED', reason: 'No grant for this delivery.' }
    const claimed = candidate?.manifest?.relevance ?? candidate?.relevance
    if (!candidate?.wallet || claimed === undefined) return { status: 'SKIPPED', reason: 'No wallet or claimed relevance.' }
    const publisherSlug = candidate.publisherSlug ?? candidate.profileId
    const { provider } = input
    let observed: number
    try {
      if (!provider.judgePaidRelevance) throw new Error('Provider cannot re-score')
      observed = (await provider.judgePaidRelevance({ question: input.question, gap: input.gap, content: structuredClone(content) })).observed
      if (!(observed >= 0 && observed <= 1)) throw new Error('Invalid observed relevance')
    } catch {
      const reason = `Calibration skipped for ${publisherSlug}: ${provider.name === 'cloudflare' ? 'Clef' : 'decision model'} unavailable.`
      this.store.appendEvent(run.runId, { type: 'REPUTATION', label: reason, data: { publisherSlug, wallet: candidate.wallet, skipped: true } })
      return { status: 'SKIPPED', reason }
    }
    return { status: 'RECORDED', record: this.recordCalibration({ publisherSlug, wallet: candidate.wallet, claimed, observed, runId: run.runId }) }
  }
}
