import { activeTraceUrl, scoreTrace, traceRun } from '../telemetry.js'
import type { Store } from '../store.js'
import type { PublisherClient } from '../publisher-client.js'
import type { PurchaseManager } from '../purchases.js'
import { AnswerSchema, PublicCandidateSchema, providerLabels } from '../../shared/contracts/index.js'
import type { ContentEnvelope, RunSnapshot, TraceEvent } from '../../shared/contracts/index.js'
import { decide, publicSources } from './decision.js'
import type { DecisionProvider } from './decision.js'
import { retrieve, writeAnswer } from './research.js'

export type RunLoopOptions = { provider?: DecisionProvider; retrieve?: typeof retrieve; writeAnswer?: typeof writeAnswer; threshold?: number }
export class RunLoop {
  private readonly active = new Map<string, Promise<void>>()
  constructor(readonly store: Store, readonly client: PublisherClient, readonly purchases: PurchaseManager, readonly onEvent?: (event: TraceEvent) => void, readonly options: RunLoopOptions = {}) {}

  private trace(runId: string, phase: RunSnapshot['phase'], label: string, checkpoint: Record<string, unknown> = {}) {
    const run = this.store.getRun(runId)
    this.store.updateRun(runId, { phase, checkpoint: { ...run.checkpoint, ...checkpoint, phase, round: run.round } })
    const event = this.store.appendEvent(runId, { type: phase, label })
    // A disconnected SSE consumer must not interrupt a persisted run.
    try { this.onEvent?.(event) } catch { /* The event is already durable. */ }
  }
  private progress(runId: string) {
    if (this.stopped(runId)) return
    const event = this.store.appendEvent(runId, { type: 'ANSWER_PROGRESS', label: 'Writing and validating cited evidence.' })
    try { this.onEvent?.(event) } catch { /* The event is already durable. */ }
  }
  private stopped(runId: string) { return this.store.getRun(runId).stopped }
  stop(runId: string): void {
    this.store.updateRun(runId, { stopped: true })
    this.trace(runId, 'STOPPED', 'Stopped; no new purchases will start.')
  }
  private exclusive(runId: string, work: () => Promise<void>): Promise<void> {
    const existing = this.active.get(runId)
    if (existing) return existing
    const promise = Promise.resolve().then(work).catch(() => {
      const run = this.store.getRun(runId)
      const pending = run.intents.find(intent => ['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'SUBMITTING'].includes(intent.status) || intent.status === 'VERIFIED' && run.checkpoint.intentId === intent.intentId && run.checkpoint.answeredIntentId !== intent.intentId)
      this.store.updateRun(runId, { error: pending ? 'Delivery incomplete. Retry delivery to verify and re-answer.' : 'Run failed. The last good answer is preserved; start a new ask.', checkpoint: { ...run.checkpoint, nextAction: pending ? 'retry-delivery' : 'ask', ...(pending ? { intentId: pending.intentId } : {}) } })
      this.trace(runId, run.stopped ? 'STOPPED' : 'FAILED', 'Run interrupted; last good answer preserved.')
    }).finally(() => { this.active.delete(runId) })
    this.active.set(runId, promise)
    return promise
  }
  private accessible(run: RunSnapshot): ContentEnvelope[] {
    return run.contents.map(content => {
      const free = run.candidates.some(candidate => candidate.tier === 'FREE' && candidate.resourceId === content.resourceId && candidate.version === content.version && candidate.profileId === content.profileId)
      const granted = run.grants.some(grant => grant.runId === run.runId && grant.resourceId === content.resourceId && grant.version === content.version && run.intents.some(intent => intent.intentId === grant.intentId && intent.runId === run.runId && intent.status === 'VERIFIED' && intent.resourceId === content.resourceId && intent.version === content.version))
      if (!free && !granted) throw new Error('Content lacks an accessible grant')
      return structuredClone(content)
    })
  }
  private async answer(runId: string) {
    const run = this.store.getRun(runId)
    const previous = run.answers.at(-1)
    this.trace(runId, 'ANSWER', previous ? 'Re-answering with verified evidence.' : 'Writing the free answer.')
    let lastProgressAt = -Infinity
    const onToken = (_unvalidatedDelta: string) => {
      const now = Date.now()
      if (now - lastProgressAt < 1000) return
      lastProgressAt = now
      this.progress(runId)
    }
    const result = await (this.options.writeAnswer ?? writeAnswer)({ question: run.question, contents: this.accessible(run), candidates: run.candidates.map(candidate => PublicCandidateSchema.parse(candidate)), version: (previous?.version ?? 0) + 1, onToken, ...(previous ? { previous: structuredClone(previous) } : {}) })
    const answer = AnswerSchema.parse(result.answer)
    if (answer.version !== (previous?.version ?? 0) + 1) throw new Error('Answer version mismatch')
    this.store.addAnswer(runId, structuredClone(answer), result.impact ? structuredClone(result.impact) : undefined)
    const started = this.started.get(runId)
    if (!previous && started) scoreTrace('time-to-first-answer-s', (Date.now() - started) / 1000, 'ask → validated cited answer v1')
    const latest = this.store.getRun(runId)
    this.store.updateRun(runId, { labels: { ...latest.labels, research: `${providerLabels[answer.provider]} · ${answer.model}` }, checkpoint: { ...latest.checkpoint, answerVersion: answer.version, ...(latest.checkpoint.intentId ? { answeredIntentId: latest.checkpoint.intentId } : {}) } })
    if (this.stopped(runId)) this.trace(runId, 'STOPPED', 'Stopped; last good answer preserved.')
  }
  private readonly started = new Map<string, number>()
  /** Run-level scores: outcome, impact, spend and whether every layer ran live (the fallback rate). */
  private scoreRun(runId: string) {
    const run = this.store.getRun(runId)
    this.started.delete(runId)
    scoreTrace('run-outcome', run.phase)
    if (run.impact) scoreTrace('impact', run.impact.classification, run.impact.explanation)
    scoreTrace('spent-sgd', run.spentMinor / 100)
    const fallbacks = [...run.answers.filter(a => a.provider === 'fixture').map(a => `answer v${a.version}`), ...run.decisions.filter(d => d.provider === 'fixture').map(d => `decision round ${d.round}`)]
    scoreTrace('fully-live', fallbacks.length === 0, fallbacks.length ? `fixture: ${fallbacks.join(', ')}` : undefined)
    // The trace link lands in the run's own activity feed and the API log, ready to click on stage.
    void activeTraceUrl().then(url => {
      if (!url) return
      console.log(`Langfuse trace: ${url}`)
      try { this.store.appendEvent(runId, { type: 'TRACE', label: `Langfuse trace: ${url}`, data: { url } }) } catch { /* run may be gone */ }
    })
  }
  /** What a reviewer needs at a glance in the trace table. */
  private summary(runId: string) {
    const run = this.store.getRun(runId)
    return { phase: run.phase, conclusion: run.answers.at(-1)?.conclusion, answerVersions: run.answers.length, impact: run.impact?.classification, spent: `S$${(run.spentMinor / 100).toFixed(2)}`, bought: run.intents.filter(i => i.status === 'VERIFIED').map(i => ({ resourceId: i.resourceId, txHash: i.txHash })), error: run.error }
  }
  start(runId: string): Promise<void> {
    this.started.set(runId, Date.now())
    return traceRun('research-run', this.store.getRun(runId), () => this.run(runId), () => this.summary(runId), () => this.scoreRun(runId))
  }
  private run(runId: string): Promise<void> {
    return this.exclusive(runId, async () => {
      let run = this.store.getRun(runId)
      if (run.stopped || run.phase === 'DONE') return
      // Restart of an interrupted purchase only reconciles/verifies; it cannot buy again.
      if (run.intents.some(intent => ['SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(intent.status))) {
        await this.purchases.reconcile()
        run = this.store.getRun(runId)
        if (run.intents.some(intent => ['SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(intent.status))) throw new Error('Delivery retry required')
        await this.answer(runId)
        if (!this.stopped(runId)) this.trace(runId, 'DONE', 'Recovered verified delivery; no new purchase.')
        return
      }
      if (!run.answers.length) {
        this.trace(runId, 'SEARCH', 'Searching publisher public metadata.')
        this.trace(runId, 'READ_FREE', 'Reading free sources only.')
        const retrieved = await (this.options.retrieve ?? retrieve)(this.client, run.question)
        const candidates = retrieved.candidates.map(candidate => PublicCandidateSchema.parse(candidate))
        if (retrieved.contents.some(content => !candidates.some(candidate => candidate.tier === 'FREE' && candidate.resourceId === content.resourceId && candidate.version === content.version && candidate.profileId === content.profileId))) throw new Error('Retrieval returned ungranted paid content')
        this.store.updateRun(runId, { candidates })
        for (const content of retrieved.contents) this.store.addContent(runId, structuredClone(content))
        await this.answer(runId)
      } else if (run.checkpoint.intentId && run.checkpoint.answeredIntentId !== run.checkpoint.intentId && run.intents.some(intent => intent.intentId === run.checkpoint.intentId && intent.status === 'VERIFIED')) {
        await this.answer(runId)
      }
      while (!this.stopped(runId)) {
        run = this.store.getRun(runId)
        if (run.round >= 3 || (run.budgetMinor > 0 && run.spentMinor + run.reservedMinor >= run.budgetMinor)) break
        const answer = run.answers.at(-1)!
        const gap = answer.openGaps[0]
        const round = run.round + 1
        this.store.updateRun(runId, { round })
        this.trace(runId, 'DECIDE', 'Scoring public previews and applying spending policy.')
        const contents = this.accessible(run)
        const readSources = publicSources(run.candidates.filter(candidate => contents.some(content => content.resourceId === candidate.resourceId && content.version === candidate.version)))
        const decision = await decide({ question: run.question, conclusion: answer.conclusion, gap: gap?.text ?? '', gapFacet: gap?.facet, candidates: run.candidates, readSources, boughtResourceIds: run.intents.filter(intent => !['SKIPPED', 'FAILED_NOT_SETTLED'].includes(intent.status)).map(intent => intent.resourceId), budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, reservedMinor: run.reservedMinor, perSourceCapMinor: run.perSourceCapMinor, round, provider: this.options.provider, threshold: this.options.threshold })
        this.store.addDecision(runId, decision)
        const latest = this.store.getRun(runId)
        this.store.updateRun(runId, { labels: { ...latest.labels, decision: `${decision.provider === 'cloudflare' ? 'Cloudflare' : 'fixture'} · ${decision.model}` } })
        if (this.stopped(runId)) return
        if (!decision.selectedResourceId) break
        const candidate = decision.rows.find(row => row.candidate.resourceId === decision.selectedResourceId)!.candidate
        const intentId = `${runId}:${round}:${candidate.resourceId}:${candidate.version}`
        this.trace(runId, 'BUY', 'Policy selected one purchase within budget.', { intentId })
        // No await between the Stop gate and handing off to the transactional ledger.
        if (this.stopped(runId)) return
        const intent = await this.purchases.purchase({ runId, candidate, intentId })
        // SKIPPED and FAILED_NOT_SETTLED delivered no payment (a failed ledger tx burns only its fee); the next round may decide again.
        if (intent.status === 'SKIPPED' || intent.status === 'FAILED_NOT_SETTLED') continue
        if (intent.status !== 'VERIFIED') throw new Error('Purchase did not verify delivery')
        if (this.stopped(runId)) return
        this.trace(runId, 'READ_PAID', 'Verified grant permits paid evidence.', { intentId })
        await this.answer(runId)
      }
      if (!this.stopped(runId)) this.trace(runId, 'DONE', 'Stopped: no eligible purchase, exhausted budget, or three-round limit.')
    })
  }
  retryDelivery(runId: string, intentId: string): Promise<void> {
    return traceRun('retry-delivery', this.store.getRun(runId), () => this.retry(runId, intentId), () => this.summary(runId))
  }
  private retry(runId: string, intentId: string): Promise<void> {
    return this.exclusive(runId, async () => {
      const intent = this.store.getIntent(intentId)
      if (!intent || intent.runId !== runId || !['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED'].includes(intent.status)) throw new Error('Invalid delivery retry')
      if (intent.status !== 'VERIFIED') {
        const verified = await this.purchases.retryDelivery(intentId)
        if (verified.status !== 'VERIFIED') throw new Error('Delivery still unverified')
      }
      this.store.updateRun(runId, { error: undefined })
      this.trace(runId, 'READ_PAID', 'Resuming delivery verification only; no new purchase.', { intentId })
      await this.answer(runId)
      this.trace(runId, this.stopped(runId) ? 'STOPPED' : 'DONE', 'Delivery retry complete; no new spending.')
    })
  }
}
