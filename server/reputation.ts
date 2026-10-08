// Trust matrix (D6, FINAL-PUSH §7): Beta Reputation honesty × Brier calibration,
// keyed by the seller of record, the publisher wallet (D21). Trust only lowers
// value; it never touches the budget or the per-source cap (gate 2).
import { PlanSchema, SEARCH_LABELS } from '../shared/contracts/index.js'
import type { ContentEnvelope, PublicCandidate, ReputationRecord, ReputationSummary, RunSnapshot } from '../shared/contracts/index.js'
import { cosine, cosineRelevance, normaliseQuery, SEARCH_TUNING } from '../publisher/search.js'
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

/**
 * The trust check's "observed" relevance (#205, option A): the same measure as the signed promise, taken on the
 * delivered article. `queries` are the search queries the promise answered; `text` is the delivered article.
 */
export type RelevanceObserver = (input: { queries: string[]; text: string }) => Promise<number>
/**
 * The delivered article as the search index embeds an article (publisher/search.ts embeddingText): public title,
 * abstract and tags plus the head of the DELIVERED body. An honest writer's article re-measures to its promise.
 */
export const deliveredText = (candidate: Pick<PublicCandidate, 'title' | 'preview' | 'facets'>, content: Pick<ContentEnvelope, 'body'>) =>
  `${candidate.title}\n${candidate.preview}\n${candidate.facets.join(', ')}\n${content.body.slice(0, SEARCH_TUNING.embedBodyChars)}`
/**
 * Cosine observer over the search embedder: one embedding call for the queries and the delivered text, then the
 * search's own cosineRange mapping; the best query wins, as fusion keeps a hit's highest promise. Called only after a
 * verified grant (gate 1).
 */
export function cosineObserver(embed: (texts: string[], signal: AbortSignal) => Promise<number[][]>, timeoutMs = 5000): RelevanceObserver {
  return async ({ queries, text }) => {
    const vectors = await embed([...queries.map(normaliseQuery), text], AbortSignal.timeout(timeoutMs))
    if (vectors.length !== queries.length + 1) throw new Error('Unexpected embedding count')
    const body = vectors.at(-1)!
    return Math.max(...vectors.slice(0, -1).map(query => cosineRelevance(cosine(query, body))))
  }
}
/** The queries a run's search promises answered: the plan's sub-queries, else the question (as research.ts searches). */
export function searchQueries(run: Pick<RunSnapshot, 'question' | 'checkpoint'>): string[] {
  const plan = PlanSchema.safeParse(run.checkpoint.plan)
  return plan.success && plan.data.subqueries.length ? plan.data.subqueries : [run.question.slice(0, 300)]
}
export type ReputationOptions = { config?: typeof REPUTATION; observe?: RelevanceObserver }

/** Persistent reputation (survives runs; `make reset` and POST /api/reputation/reset wipe it). Emits REPUTATION events. */
export class Reputation {
  private readonly config: typeof REPUTATION
  private readonly observe?: RelevanceObserver
  constructor(private readonly store: Store, options: ReputationOptions = {}) {
    this.config = options.config ?? REPUTATION
    this.observe = options.observe
  }
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
  /**
   * A proof outcome (D5). A failed proof also records the broken promise for calibration (#205): observed = 0, with no
   * re-scoring of a body that arrived without a verified grant. The loop calls this once per intent.
   */
  recordProof(input: { publisherSlug: string; wallet: string; outcome: ProofOutcome; runId?: string; claimed?: number }): ReputationRecord {
    const record = this.update(input.publisherSlug, input.wallet, r => applyProof(r, input.outcome, undefined, this.config), input.runId, `proof ${input.outcome.toLowerCase()}`)
    if (input.outcome === 'PASS' || input.claimed === undefined) return record
    return this.recordCalibration({ publisherSlug: input.publisherSlug, wallet: input.wallet, claimed: input.claimed, observed: 0, runId: input.runId, note: 'proof failed' })
  }
  recordCalibration(input: { publisherSlug: string; wallet: string; claimed: number; observed: number; runId?: string; note?: string }): ReputationRecord {
    return this.update(input.publisherSlug, input.wallet, r => applyCalibration(r, input.claimed, input.observed, undefined, this.config), input.runId, `relevance claimed ${input.claimed.toFixed(2)}, observed ${input.observed.toFixed(2)}${input.note ? ` (${input.note})` : ''}`)
  }
  /**
   * Calibration after a verified purchase (#141, #205 option A). claimed = the signed manifest relevance; observed = the
   * same cosine measure on the delivered article. Only a VERIFIED intent with a grant for this run, resource and version
   * is measured (gate 1); a quarantined delivery never is (its failed proof records observed = 0 in recordProof).
   * Once per intent (#206): the run checkpoint lists intents already calibrated. A failure skips with a label and never
   * blocks the run. A keyword-only search promised on the BM25 scale, so it is not re-measured on the cosine scale.
   */
  async calibrate(input: { run: RunSnapshot; intentId: string }): Promise<{ status: 'RECORDED'; record: ReputationRecord } | { status: 'SKIPPED'; reason: string }> {
    const { run } = input
    const intent = run.intents.find(i => i.intentId === input.intentId && i.runId === run.runId)
    if (!intent || intent.status !== 'VERIFIED') return { status: 'SKIPPED', reason: 'No verified delivery.' }
    const grant = run.grants.find(g => g.intentId === intent.intentId && g.runId === run.runId && g.resourceId === intent.resourceId && g.version === intent.version)
    const content = run.contents.find(c => c.resourceId === intent.resourceId && c.version === intent.version)
    const candidate = run.candidates.find(c => c.resourceId === intent.resourceId && c.version === intent.version && c.tier === 'PAID')
    if (!grant || !content) return { status: 'SKIPPED', reason: 'No grant for this delivery.' }
    const claimed = candidate?.manifest?.relevance ?? candidate?.relevance
    if (!candidate?.wallet || claimed === undefined) return { status: 'SKIPPED', reason: 'No wallet or claimed relevance.' }
    const calibrated = (runId: string) => { const list = this.store.getRun(runId).checkpoint.calibrated; return Array.isArray(list) ? list as string[] : [] }
    if (calibrated(run.runId).includes(intent.intentId)) return { status: 'SKIPPED', reason: 'Already calibrated.' }
    const publisherSlug = candidate.publisherSlug ?? candidate.profileId
    const skip = (why: string) => {
      const reason = `Calibration skipped for ${publisherSlug}: ${why}.`
      this.store.appendEvent(run.runId, { type: 'REPUTATION', label: reason, data: { publisherSlug, wallet: candidate.wallet, skipped: true } })
      return { status: 'SKIPPED' as const, reason }
    }
    if (run.labels.search === SEARCH_LABELS[1]) return skip('search ran keyword only, so relevance cannot be re-measured')
    if (!this.observe) return skip('no live embedding to re-measure relevance')
    let observed: number
    try {
      observed = await this.observe({ queries: searchQueries(run), text: deliveredText(candidate, content) })
      if (!(observed >= 0 && observed <= 1)) throw new Error('Invalid observed relevance')
    } catch { return skip('relevance re-measure unavailable') }
    // No await between this check and the record: a second caller for the same intent sees it and skips.
    if (calibrated(run.runId).includes(intent.intentId)) return { status: 'SKIPPED', reason: 'Already calibrated.' }
    const record = this.recordCalibration({ publisherSlug, wallet: candidate.wallet, claimed, observed, runId: run.runId })
    const latest = this.store.getRun(run.runId)
    this.store.updateRun(run.runId, { checkpoint: { ...latest.checkpoint, calibrated: [...calibrated(run.runId), intent.intentId] } })
    return { status: 'RECORDED', record }
  }
}
