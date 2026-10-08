import { activeTraceUrl, scoreTrace, traceRun } from '../telemetry.js'
import type { Store } from '../store.js'
import type { PublisherClient } from '../publisher-client.js'
import type { PurchaseManager } from '../purchases.js'
import { challenge } from '../challenges.js'
import { createHash } from 'node:crypto'
import { AnswerSchema, COVERAGE_STATUSES, CoverageSchema, PlanSchema, PublicCandidateSchema, RunCheckpointSchema, SEARCH_LABELS, STOP_LABELS, decisionLabel, providerLabels } from '../../shared/contracts/index.js'
import type { Answer, ContentEnvelope, Coverage, CoverageStatus, FollowUp, PublicCandidate, PurchaseIntent, Requirement, RunSnapshot, StopReason, TraceEvent } from '../../shared/contracts/index.js'
import { decide, decisionFailureStatus, DecisionUnavailableError, FixtureDecisionProvider, publicSources } from './decision.js'
import type { ProofOutcome, Reputation } from '../reputation.js'
import type { DecisionProvider } from './decision.js'
import { followUpSearch, hitsByPublisher, retrieve, sanitizeGaps, usableContents, writeAnswer, type Retrieved } from './research.js'
import { resolveCitation, validateClaims } from './citations.js'
import { fixtureSupports, followUpQuery, INSTRUCTION, STATUS_RANK, type CoverageEvidence } from './requirements.js'
import type { Plan } from '../../shared/contracts/index.js'

export type RunLoopOptions = {
  provider?: DecisionProvider; retrieve?: (client: PublisherClient, question: string, plan?: Plan) => Promise<Pick<Retrieved, 'candidates' | 'contents'> & Partial<Retrieved>>; writeAnswer?: typeof writeAnswer; threshold?: number; reputation?: Pick<Reputation, 'summaries' | 'calibrate'> & Partial<Pick<Reputation, 'recordProof'>>
  /** The focused follow-up search (#210); tests inject a double. */
  followUpSearch?: (client: PublisherClient, query: string, known: PublicCandidate[]) => Promise<Pick<Retrieved, 'candidates' | 'contents'> & Partial<Retrieved>>
}
const ANSWERED: CoverageStatus[] = ['supported']
/** Did coverage improve? More facts answered, else a better total rank. */
export function coverageImproves(next: Coverage['entries'], current?: Coverage['entries']): boolean {
  if (!current) return true
  const score = (entries: Coverage['entries']) => [entries.filter(e => ANSWERED.includes(e.status)).length, entries.reduce((sum, e) => sum + STATUS_RANK[e.status], 0)]
  const [a, b] = score(next), [c, d] = score(current)
  return a > c || (a === c && b > d)
}
const identity = (c: { resourceId: string; version: string }) => `${c.resourceId}@${c.version}`
/**
 * A proof's end state as reputation evidence (D5); anything else is not an outcome yet. Read only after a
 * challenge was attempted, so CLAIM_FAILED means it could not be challenged (root mismatch, no re-checkable
 * claim): still a failed proof, weighted like a rejection, since the penalty applies whether or not the writer refunds.
 */
const OUTCOME: Partial<Record<PurchaseIntent['status'], ProofOutcome>> = { VERIFIED: 'PASS', REFUNDED: 'REFUNDED', CHALLENGE_REJECTED: 'REJECTED', CHALLENGE_REFUSED: 'REFUSED', CLAIM_FAILED: 'REJECTED' }
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
  /**
   * Proof outcome → trust (FINAL-PUSH §5), keyed by the seller of record's wallet (D21). Once per intent:
   * the checkpoint lists intents already recorded, so a restart sweep records only what a crash lost.
   * Never blocks the run.
   */
  private recordProof(runId: string, intent: PurchaseIntent) {
    const run = this.store.getRun(runId)
    const recorded = Array.isArray(run.checkpoint.trustRecorded) ? run.checkpoint.trustRecorded as string[] : []
    const outcome = OUTCOME[intent.status]
    const candidate = run.candidates.find(c => c.resourceId === intent.resourceId && c.version === intent.version && c.tier === 'PAID')
    if (!outcome || recorded.includes(intent.intentId) || !candidate?.wallet || !this.options.reputation?.recordProof) return
    try {
      // The signed promise goes along: a failed proof records it as broken (observed 0, #205).
      this.options.reputation.recordProof({ publisherSlug: candidate.publisherSlug ?? candidate.profileId, wallet: candidate.wallet, outcome, runId, claimed: candidate.manifest?.relevance ?? candidate.relevance })
      // Synchronous with the record above: no await between them, so it is recorded at most once.
      this.store.updateRun(runId, { checkpoint: { ...this.store.getRun(runId).checkpoint, trustRecorded: [...recorded, intent.intentId] } })
    } catch { /* reputation never blocks the run */ }
  }
  /** A failed proof: challenge the writer (#132), then the outcome lowers trust whether or not it refunds (D5). */
  private async challengeAndRecord(runId: string, intentId: string) {
    this.recordProof(runId, await challenge(this.purchases, intentId))
  }
  /** The clarify answers (UC2's angle) narrow the gap the answer writer names. */
  private focus(run: RunSnapshot) {
    const answers = run.checkpoint.answers
    const values = answers && typeof answers === 'object' ? Object.values(answers as Record<string, unknown>).filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []
    return values.length ? values.join(', ') : undefined
  }
  private stopped(runId: string) { return this.store.getRun(runId).stopped }
  stop(runId: string): void {
    this.store.updateRun(runId, { stopped: true })
    this.trace(runId, 'STOPPED', 'Stopped; no new purchases will start.', { stopReason: 'stopped' })
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
  /**
   * Writes the next answer version and grades its requested-fact coverage. `keepIfImproves` (the follow-up's re-answer,
   * #210): the candidate answer is kept only when its coverage improves; otherwise nothing is stored. Returns whether
   * an answer was stored.
   */
  private async answer(runId: string, options: { keepIfImproves?: boolean } = {}): Promise<boolean> {
    const run = this.store.getRun(runId)
    const previous = run.answers.at(-1)
    const requirements = this.requirements(run)
    const conditional = Boolean(options.keepIfImproves && requirements)
    // A conditional re-answer announces itself only once it is kept, so the ANSWER events match the stored versions.
    if (!conditional) this.trace(runId, 'ANSWER', previous ? 'Re-answering with verified evidence.' : 'Writing the free answer.')
    let lastProgressAt = -Infinity
    const onToken = (_unvalidatedDelta: string) => {
      const now = Date.now()
      if (now - lastProgressAt < 1000) return
      lastProgressAt = now
      this.progress(runId)
    }
    const result = await (this.options.writeAnswer ?? writeAnswer)({ question: run.question, contents: this.accessible(run), candidates: run.candidates.map(candidate => PublicCandidateSchema.parse(candidate)), version: (previous?.version ?? 0) + 1, onToken, ...(this.focus(run) ? { focus: this.focus(run) } : {}), ...(requirements ? { requirements: requirements.map(r => r.text) } : {}), ...(previous ? { previous: structuredClone(previous) } : {}) })
    const answer = AnswerSchema.parse(result.answer)
    if (answer.version !== (previous?.version ?? 0) + 1) throw new Error('Answer version mismatch')
    let coverage: Coverage | undefined
    if (conditional) {
      coverage = await this.assessCoverage(runId, answer)
      if (!coverageImproves(coverage.entries, this.coverageOf(this.store.getRun(runId), previous?.version)?.entries)) {
        this.store.appendEvent(runId, { type: 'COVERAGE', label: 'The focused search added no answered fact; the earlier answer stands.', data: { answerVersion: answer.version, kept: false } })
        return false
      }
      this.trace(runId, 'ANSWER', 'Re-answering with free evidence from the focused search.')
    }
    this.store.addAnswer(runId, structuredClone(answer), result.impact ? structuredClone(result.impact) : undefined)
    const started = this.started.get(runId)
    if (!previous && started) scoreTrace('time-to-first-answer-s', (Date.now() - started) / 1000, 'ask → validated cited answer v1')
    const latest = this.store.getRun(runId)
    this.store.updateRun(runId, { labels: { ...latest.labels, research: `${providerLabels[answer.provider]} · ${answer.model}` }, checkpoint: { ...latest.checkpoint, answerVersion: answer.version, ...(latest.checkpoint.intentId ? { answeredIntentId: latest.checkpoint.intentId } : {}) } })
    if (requirements) this.saveCoverage(runId, coverage ?? await this.assessCoverage(runId, answer))
    if (this.stopped(runId)) this.trace(runId, 'STOPPED', 'Stopped; last good answer preserved.')
    return true
  }
  /** The run's frozen requested facts (#208); undefined for legacy runs, which keep the free-text gap path. */
  private requirements(run: RunSnapshot): Requirement[] | undefined {
    const parsed = RunCheckpointSchema.shape.requirements.safeParse(run.checkpoint.requirements)
    return parsed.success && parsed.data?.length ? parsed.data : undefined
  }
  private coverageOf(run: RunSnapshot, version?: number): Coverage | undefined {
    const list = RunCheckpointSchema.shape.coverage.safeParse(run.checkpoint.coverage)
    return version === undefined || !list.success ? undefined : list.data?.find(c => c.answerVersion === version)
  }
  /** Requested facts not yet answered by the latest answer: missing, partial, conflicting or unknown (never "complete"). */
  private openRequirements(run: RunSnapshot): Requirement[] {
    const coverage = this.coverageOf(run, run.answers.at(-1)?.version)
    return (this.requirements(run) ?? []).filter(r => coverage?.entries.find(e => e.requirementId === r.id)?.status !== 'supported')
  }
  /** Passages for a coverage judgment: exact accessible spans, never instructions (gate 1: free or verified-granted only). */
  private evidence(contents: ContentEnvelope[], refs: { resourceId: string; version: string; spanId: string }[]): CoverageEvidence[] {
    const seen = new Set<string>()
    return refs.flatMap(ref => {
      const key = `${ref.resourceId}@${ref.version}#${ref.spanId}`
      const span = resolveCitation(ref, contents)
      if (!span || seen.has(key) || INSTRUCTION.test(span.text)) return []
      seen.add(key)
      return [{ ref: key, text: span.text }]
    })
  }
  /** One multi-question request to the decision model per evidence state; any failure is `unknown`, labelled, never complete. */
  private async judgeCoverage(question: string, requirements: Requirement[], evidence: CoverageEvidence[]): Promise<{ statuses: Record<string, CoverageStatus>; judge: string; error?: string }> {
    const provider = this.options.provider ?? new FixtureDecisionProvider()
    const judge = decisionLabel({ provider: provider.name, model: provider.model })
    const all = (status: CoverageStatus) => Object.fromEntries(requirements.map(r => [r.id, status]))
    // No passage, nothing to judge: every fact is missing, with no model call.
    if (!evidence.length) return { statuses: all('missing'), judge }
    if (!provider.judgeCoverage) return { statuses: all('unknown'), judge, error: 'coverage not supported' }
    try {
      const raw = await provider.judgeCoverage({ question, requirements: requirements.map(r => ({ id: r.id, text: r.text })), evidence })
      return { statuses: Object.fromEntries(requirements.map(r => [r.id, (COVERAGE_STATUSES as readonly unknown[]).includes(raw?.[r.id]) ? raw[r.id] : 'unknown'])), judge }
    } catch (error) { return { statuses: all('unknown'), judge, error: decisionFailureStatus(error) } }
  }
  /**
   * Coverage of one answer version (#208), judged after citation validation over the passages its validated claims
   * cite, so "supported" always means a displayed claim cites the supporting evidence; a dropped claim drops its passage.
   */
  private async assessCoverage(runId: string, answer: Answer): Promise<Coverage> {
    const run = this.store.getRun(runId)
    const requirements = this.requirements(run)!
    const contents = this.accessible(run)
    const claims = validateClaims(answer.claims, contents)
    const evidence = this.evidence(contents, claims.flatMap(c => c.citations))
    const { statuses, judge, error } = await this.judgeCoverage(run.question, requirements, evidence)
    const fixture = (this.options.provider ?? { name: 'fixture' }).name === 'fixture'
    return CoverageSchema.parse({ answerVersion: answer.version, judge, entries: requirements.map(r => {
      const status = statuses[r.id] ?? 'unknown'
      // The fixture judge can name the supporting claims; a live judge grades the passages as a whole.
      const claimIds = fixture && status === 'supported' ? claims.filter(c => c.citations.some(ref => fixtureSupports(r, resolveCitation(ref, contents)?.text ?? ''))).map(c => c.id) : undefined
      return { requirementId: r.id, status, ...(claimIds?.length ? { claimIds } : {}) }
    }), ...(error ? { error } : {}) })
  }
  private saveCoverage(runId: string, coverage: Coverage) {
    const run = this.store.getRun(runId)
    const existing = (RunCheckpointSchema.shape.coverage.safeParse(run.checkpoint.coverage).data ?? []).filter(c => c.answerVersion !== coverage.answerVersion)
    this.store.updateRun(runId, { checkpoint: { ...run.checkpoint, coverage: [...existing, coverage] } })
    const answered = coverage.entries.filter(e => e.status === 'supported').length
    this.store.appendEvent(runId, { type: 'COVERAGE', label: coverage.error ? `Couldn't check the requested facts (${coverage.error}); treated as open.` : `${answered} of ${coverage.entries.length} requested facts answered.`, data: { answerVersion: coverage.answerVersion, answered, total: coverage.entries.length, judge: coverage.judge, ...(coverage.error ? { error: coverage.error } : {}) } })
  }
  /** Evidence state for decision attempts (#209): accessible versions plus purchase outcomes, so new evidence or a refund re-opens a fact. */
  private fingerprint(run: RunSnapshot): string {
    const state = [...run.contents.map(identity).sort(), '|', ...run.intents.map(i => `${identity(i)}:${i.status}`).sort()]
    return createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 16)
  }
  private setStopReason(runId: string, stopReason: StopReason) {
    const run = this.store.getRun(runId)
    this.store.updateRun(runId, { checkpoint: { ...run.checkpoint, stopReason } })
  }
  /**
   * One focused FREE follow-up search per run, before round 1 and before the budget guard (#210), so an S$0 run still
   * researches free sources. Persisted before dispatch: a resume never repeats it. New candidates are registered
   * before their contents; existing candidates are never touched. Re-answers only when a new free passage answers an
   * open requirement, and keeps that answer only when coverage improves (gate 1: the query comes from the frozen
   * requirement and the question, never from paid text).
   */
  private async followUp(runId: string) {
    const run = this.store.getRun(runId)
    if (!this.requirements(run) || run.checkpoint.followUp || run.round > 0 || run.stopped || !run.answers.length) return
    const coverage = this.coverageOf(run, run.answers.at(-1)!.version)
    const target = this.openRequirements(run).find(r => ['missing', 'partial'].includes(coverage?.entries.find(e => e.requirementId === r.id)?.status ?? ''))
    if (!target) return
    const query = followUpQuery(target, run.question)
    const save = (patch: Partial<FollowUp>) => {
      const latest = this.store.getRun(runId)
      const followUp: FollowUp = { ...(latest.checkpoint.followUp as FollowUp | undefined ?? { requirementId: target.id, query, status: 'started' }), ...patch }
      this.store.updateRun(runId, { checkpoint: { ...latest.checkpoint, followUp } })
    }
    save({ status: 'started' })
    this.store.appendEvent(runId, { type: 'FOLLOW_UP', label: `Searching again for: ${target.text}`, data: { requirementId: target.id, query } })
    let found: Awaited<ReturnType<NonNullable<RunLoopOptions['followUpSearch']>>>
    try {
      found = await (this.options.followUpSearch ?? followUpSearch)(this.client, query, run.candidates)
    } catch {
      save({ status: 'failed' })
      this.store.appendEvent(runId, { type: 'FOLLOW_UP', label: 'The focused search was unavailable; continuing with what was read.', data: { requirementId: target.id, failed: true } })
      return
    }
    if (this.stopped(runId)) { save({ status: 'done' }); return }
    let latest = this.store.getRun(runId)
    // Register new candidates first (store.addContent needs FREE metadata); never mutate or re-register known ones.
    const added = found.candidates.map(c => PublicCandidateSchema.parse(c)).filter(c => !latest.candidates.some(o => o.profileId === c.profileId && identity(o) === identity(c)))
    const contents = found.contents.filter(content => added.some(c => c.tier === 'FREE' && c.profileId === content.profileId && identity(c) === identity(content)))
    if (found.contents.some(content => !contents.includes(content) && !latest.contents.some(o => identity(o) === identity(content)))) throw new Error('Follow-up search returned ungranted paid content')
    for (const drop of found.dropped ?? []) this.store.appendEvent(runId, { type: 'MANIFEST_DROPPED', label: `Dropped ${drop.resourceId}: ${drop.reason}.`, data: { ...drop } })
    // Gate 5: a keyword fallback anywhere makes the run's search label keyword-only.
    const search = found.search === SEARCH_LABELS[1] || latest.labels.search === SEARCH_LABELS[1] ? SEARCH_LABELS[1] : latest.labels.search ?? found.search
    if (added.length) this.store.updateRun(runId, { candidates: [...latest.candidates, ...added] })
    if (search !== latest.labels.search) this.store.updateRun(runId, { labels: { ...this.store.getRun(runId).labels, search } })
    for (const content of contents) this.store.addContent(runId, structuredClone(content))
    latest = this.store.getRun(runId)
    const paidFound = added.filter(c => c.tier === 'PAID').length
    // Does a new free passage answer an open fact? One coverage request over the new passages only.
    const open = this.openRequirements(latest)
    const fresh = this.evidence(this.accessible(latest), usableContents(contents).flatMap(c => c.spans.map(s => ({ resourceId: c.resourceId, version: c.version, spanId: s.id }))))
    const check = open.length && fresh.length ? await this.judgeCoverage(latest.question, open, fresh) : undefined
    const current = (id: string) => coverage?.entries.find(e => e.requirementId === id)?.status ?? 'unknown'
    const helped = check ? open.filter(r => STATUS_RANK[check.statuses[r.id] ?? 'unknown'] > STATUS_RANK[current(r.id)]).map(r => r.id) : []
    save({ status: 'done', ...(found.search ? { searchMode: found.search } : {}), unavailable: found.unavailable ?? [], added: added.map(identity), freeRead: contents.length, paidFound, helped })
    const freeLabel = `${contents.length} new free source${contents.length === 1 ? '' : 's'}`
    this.store.appendEvent(runId, { type: 'FOLLOW_UP', label: helped.length ? `${freeLabel} · found free: ${target.text}` : `${freeLabel} · nothing new on: ${target.text}`, data: { requirementId: target.id, freeRead: contents.length, paidFound, helped, searchMode: found.search ?? null, unavailable: found.unavailable ?? [] } })
    if (!helped.length || this.stopped(runId)) return
    save({ reanswered: await this.answer(runId, { keepIfImproves: true }) })
  }
  /**
   * Decision 2 (#197): a live decision provider failed, so this round buys nothing and no fixture is substituted.
   * The run ends FAILED with the reason; the last validated answer stands and the next step is a new ask.
   */
  private failDecision(runId: string, error: DecisionUnavailableError) {
    this.store.appendEvent(runId, { type: 'DECISION_UNAVAILABLE', label: `${error.message}; nothing bought.`, data: { status: error.status } })
    if (this.stopped(runId)) return
    const run = this.store.getRun(runId)
    const bought = run.intents.some(intent => intent.status === 'VERIFIED')
    this.store.updateRun(runId, { error: `${error.message}; nothing bought. ${bought ? 'The current answer stands.' : 'The free answer stands.'}`, checkpoint: { ...run.checkpoint, nextAction: 'ask', stopReason: 'decision-unavailable' } })
    this.trace(runId, 'FAILED', 'Decision model unavailable; nothing bought.')
  }
  private readonly started = new Map<string, number>()
  /** Run-level scores: outcome, impact, spend and whether every layer ran live (the fallback rate). */
  private scoreRun(runId: string) {
    const run = this.store.getRun(runId)
    this.started.delete(runId)
    scoreTrace('run-outcome', run.phase)
    if (run.impact) scoreTrace('impact', run.impact.classification, run.impact.explanation)
    scoreTrace('spent-sgd', run.spentMinor / 100)
    if (run.refundedMinor) scoreTrace('refunded-sgd', run.refundedMinor / 100)
    if (this.options.reputation) scoreTrace('quarantined-publishers', Object.values(this.options.reputation.summaries()).filter(r => r.status !== 'active').length)
    const fallbacks = [...run.answers.filter(a => a.provider === 'fixture').map(a => `fixture answer v${a.version}`), ...run.decisions.filter(d => d.provider === 'fixture').map(d => `fixture decision round ${d.round}`), ...run.events.filter(e => e.type === 'DECISION_UNAVAILABLE').map(() => 'decision unavailable')]
    scoreTrace('fully-live', fallbacks.length === 0, fallbacks.length ? fallbacks.join(', ') : undefined)
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
        const pending = run.intents.filter(intent => intent.status !== 'VERIFIED').map(intent => intent.intentId)
        await this.purchases.reconcile()
        run = this.store.getRun(runId)
        for (const intent of run.intents.filter(i => pending.includes(i.intentId))) {
          if (intent.status === 'VERIFIED') this.recordProof(runId, intent)
          else if (intent.status === 'CLAIM_FAILED') await this.challengeAndRecord(runId, intent.intentId)
        }
        run = this.store.getRun(runId)
        if (run.intents.some(intent => ['SUBMITTING', 'SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED'].includes(intent.status))) throw new Error('Delivery retry required')
        await this.answer(runId)
        if (!this.stopped(runId)) this.trace(runId, 'DONE', 'Recovered verified delivery; no new purchase.')
        return
      }
      if (!run.answers.length) {
        this.trace(runId, 'SEARCH', 'Searching publisher public metadata.')
        this.trace(runId, 'READ_FREE', 'Reading free sources only.')
        const plan = PlanSchema.safeParse(run.checkpoint.plan)
        const retrieved = await (this.options.retrieve ?? retrieve)(this.client, run.question, plan.success ? plan.data : undefined)
        // A PAID hit with a bad manifest never reaches Clef; the run records why (#138).
        for (const drop of retrieved.dropped ?? []) this.store.appendEvent(runId, { type: 'MANIFEST_DROPPED', label: `Dropped ${drop.resourceId}: ${drop.reason}.`, data: { ...drop } })
        if (retrieved.search) this.store.updateRun(runId, { labels: { ...this.store.getRun(runId).labels, search: retrieved.search } })
        if (retrieved.hits) {
          const perPublisher = hitsByPublisher(retrieved.hits)
          this.store.appendEvent(runId, { type: 'SEARCH', label: `${retrieved.hits.length} hits from ${Object.keys(perPublisher).length} writers · ${retrieved.search ?? 'no results'}${retrieved.unavailable?.length ? ` · unavailable: ${retrieved.unavailable.join(', ')}` : ''}`, data: { perPublisher, searchMode: retrieved.search ?? null, unavailable: retrieved.unavailable ?? [], dropped: retrieved.dropped?.length ?? 0 } })
        }
        const candidates = retrieved.candidates.map(candidate => PublicCandidateSchema.parse(candidate))
        if (retrieved.contents.some(content => !candidates.some(candidate => candidate.tier === 'FREE' && candidate.resourceId === content.resourceId && candidate.version === content.version && candidate.profileId === content.profileId))) throw new Error('Retrieval returned ungranted paid content')
        this.store.updateRun(runId, { candidates })
        for (const content of retrieved.contents) this.store.addContent(runId, structuredClone(content))
        await this.answer(runId)
      } else if (run.checkpoint.intentId && run.checkpoint.answeredIntentId !== run.checkpoint.intentId && run.intents.some(intent => intent.intentId === run.checkpoint.intentId && intent.status === 'VERIFIED')) {
        await this.answer(runId)
      }
      // A failed proof interrupted before its challenge finished: challenge again (the writer refunds at most once).
      for (const intent of this.store.getRun(runId).intents.filter(i => i.status === 'CLAIM_FAILED' || i.status === 'CHALLENGED')) await this.challengeAndRecord(runId, intent.intentId)
      // A crash between a terminal outcome and its trust update: record what is missing (idempotent per intent).
      for (const intent of this.store.getRun(runId).intents) this.recordProof(runId, intent)
      // A crash between an answer and its coverage: grade it now (one request), before deciding anything.
      run = this.store.getRun(runId)
      const latestAnswer = run.answers.at(-1)
      if (this.requirements(run) && latestAnswer && !this.coverageOf(run, latestAnswer.version)) this.saveCoverage(runId, await this.assessCoverage(runId, latestAnswer))
      // One focused free follow-up search before round 1, before the budget guard (#210).
      await this.followUp(runId)
      // Calibration runs beside the re-answer (#206) and is awaited before the next decision, so trust ordering holds.
      let calibration: Promise<unknown> | undefined
      let stopReason: StopReason | undefined
      try { while (!this.stopped(runId)) {
        await calibration
        calibration = undefined
        run = this.store.getRun(runId)
        const requirements = this.requirements(run)
        const answer = run.answers.at(-1)!
        const open = requirements ? this.openRequirements(run) : undefined
        const fingerprint = this.fingerprint(run)
        // #209: the next unresolved requested fact not yet judged on this evidence; a legacy run judges its first free-text gap.
        const target = open?.find(r => !(run.checkpoint.attempts ?? []).some(a => a.requirementId === r.id && a.fingerprint === fingerprint))
        const legacyGap = requirements ? undefined : answer.openGaps[0]
        const nothingOpen = requirements ? !open!.length : !legacyGap?.text.trim()
        if (run.round >= 1 && nothingOpen) { stopReason = 'complete'; break }
        if (run.round >= 3) { stopReason = 'round-limit'; break }
        if (run.budgetMinor > 0 && run.spentMinor + run.reservedMinor >= run.budgetMinor) { stopReason = 'budget-exhausted'; break }
        // Every open fact was judged on this evidence and none was worth buying. An empty gap after round 1 has nothing to decide (#206); round 1 still records its table (UC1: "no gap").
        if (run.round >= 1 && requirements && !target) { stopReason = run.decisions.some(d => d.rows.some(r => r.verdict === 'SKIP_OVER_BUDGET')) ? 'budget-exhausted' : 'no-eligible-purchase'; break }
        // The decision model judges the frozen requirement text (#208), sanitised like a gap; never the LLM-written gap.
        const gap = target ? sanitizeGaps([target.gap ?? target.text], run.candidates)[0]?.text ?? target.text : legacyGap?.text ?? ''
        const round = run.round + 1
        this.store.updateRun(runId, { round })
        this.trace(runId, 'DECIDE', 'Scoring public previews and applying spending policy.')
        const contents = this.accessible(run)
        const readSources = publicSources(run.candidates.filter(candidate => contents.some(content => content.resourceId === candidate.resourceId && content.version === candidate.version)))
        let decision: Awaited<ReturnType<typeof decide>>
        try {
          decision = await decide({ question: run.question, conclusion: answer.conclusion, gap, requirement: Boolean(target), candidates: run.candidates, readSources, boughtResourceIds: run.intents.filter(intent => !['SKIPPED', 'FAILED_NOT_SETTLED'].includes(intent.status)).map(intent => intent.resourceId), budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, reservedMinor: run.reservedMinor, perSourceCapMinor: run.perSourceCapMinor, round, provider: this.options.provider, threshold: this.options.threshold, ...(this.options.reputation ? { reputation: this.options.reputation.summaries() } : {}) })
        } catch (error) {
          if (!(error instanceof DecisionUnavailableError)) throw error
          this.failDecision(runId, error)
          return
        }
        this.store.addDecision(runId, decision)
        const latest = this.store.getRun(runId)
        this.store.updateRun(runId, { labels: { ...latest.labels, decision: decisionLabel(decision) }, ...(target ? { checkpoint: { ...latest.checkpoint, attempts: [...(latest.checkpoint.attempts ?? []), { requirementId: target.id, fingerprint }] } } : {}) })
        if (this.stopped(runId)) return
        if (!decision.selectedResourceId) {
          // #209: nothing worth buying for this fact; the next round tries the next unresolved one (same cap, same budget).
          if (requirements) continue
          stopReason = !legacyGap?.text.trim() ? 'complete' : decision.rows.some(r => r.verdict === 'SKIP_OVER_BUDGET') ? 'budget-exhausted' : 'no-eligible-purchase'
          break
        }
        const candidate = decision.rows.find(row => row.candidate.resourceId === decision.selectedResourceId)!.candidate
        const intentId = `${runId}:${round}:${candidate.resourceId}:${candidate.version}`
        this.trace(runId, 'BUY', 'Policy selected one purchase within budget.', { intentId })
        // No await between the Stop gate and handing off to the transactional ledger.
        if (this.stopped(runId)) return
        // The policy pick's verified search manifest: purchase() signs nothing without it.
        const intent = await this.purchases.purchase({ runId, candidate, intentId, manifest: candidate.manifest })
        // SKIPPED and FAILED_NOT_SETTLED delivered no payment (a failed ledger tx burns only its fee); the next round may decide again.
        if (intent.status === 'SKIPPED' || intent.status === 'FAILED_NOT_SETTLED') continue
        // A failed proof (#131): the source is quarantined and never cited; challenge the writer (#132), then decide again.
        if (intent.status === 'CLAIM_FAILED') { await this.challengeAndRecord(runId, intent.intentId); continue }
        if (intent.status !== 'VERIFIED') throw new Error('Purchase did not verify delivery')
        this.recordProof(runId, intent)
        if (this.stopped(runId)) return
        this.trace(runId, 'READ_PAID', 'Verified grant permits paid evidence.', { intentId })
        // Calibration (#141, #205): re-measure the granted article; a failure is labelled inside calibrate() and never blocks the run.
        const reputation = this.options.reputation
        if (reputation) calibration = Promise.resolve().then(() => reputation.calibrate({ run: this.store.getRun(runId), intentId })).catch(() => undefined)
        await this.answer(runId)
      } } finally { await calibration }
      if (this.stopped(runId)) return
      if (stopReason) this.setStopReason(runId, stopReason)
      this.trace(runId, 'DONE', stopReason ? `Stopped: ${STOP_LABELS[stopReason]}` : 'Stopped: no eligible purchase, exhausted budget, or three-round limit.')
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
        if (verified.status === 'CLAIM_FAILED') await this.challengeAndRecord(runId, intentId)
        if (verified.status !== 'VERIFIED') throw new Error('Delivery still unverified')
        this.recordProof(runId, verified)
      }
      this.store.updateRun(runId, { error: undefined })
      this.trace(runId, 'READ_PAID', 'Resuming delivery verification only; no new purchase.', { intentId })
      await this.answer(runId)
      this.trace(runId, this.stopped(runId) ? 'STOPPED' : 'DONE', 'Delivery retry complete; no new spending.')
    })
  }
}
