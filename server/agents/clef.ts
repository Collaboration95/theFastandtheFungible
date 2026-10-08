import { startActiveObservation } from '@langfuse/tracing'
import { z } from 'zod'
import { CandidateJudgmentSchema } from '../../shared/contracts/index.js'
import type { CandidateJudgment, ContentEnvelope, CoverageStatus, PublicCandidate, Requirement } from '../../shared/contracts/index.js'
import { COVERAGE_RUBRIC, coverageInstructions, coverageQuestionName, coverageState, isJudged } from './requirements.js'
import { decisionModel, publicCandidate, publicSources } from './decision.js'
import type { CoverageInput, DecisionProvider } from './decision.js'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export class ClefUnavailableError extends Error {
  constructor(readonly status: string) { super(`Clef unavailable (${status})`) }
}
class ClefHttpError extends Error {
  constructor(readonly status: number, readonly retryMs: number) { super(`Clef HTTP ${status}`) }
}
/** Default live per-attempt timeout (#195): 2 attempts × 5 s, so a dead call fails the round within ~12 s, never a minute. */
export const CLEF_DEFAULT_TIMEOUT_MS = 5000
/** The live per-attempt timeout: `CLEF_TIMEOUT_MS` when set to a positive number, otherwise 5 s. Shared with `make preflight`. */
export function clefTimeoutMs(configured: unknown = process.env.CLEF_TIMEOUT_MS): number {
  const value = Number(configured)
  return configured !== undefined && configured !== '' && Number.isFinite(value) && value > 0 ? value : CLEF_DEFAULT_TIMEOUT_MS
}
/** A 429 that waits for longer than this is not worth stalling the stage for; the next attempt runs after at most ~2 s. */
export const CLEF_MAX_RETRY_PAUSE_MS = 2000
/** Cloudflare's daily free-allocation error ("Daily free allocation of 10000 neurons exhausted"); it resets 00:00 UTC. */
export const CLOUDFLARE_DAILY_QUOTA_CODE = 4006
/** The `errors[].code` values of a Cloudflare API error body (a JSON string or parsed object); [] when it has none. */
export function cloudflareErrorCodes(body: unknown): number[] {
  let payload = body
  if (typeof body === 'string') { try { payload = JSON.parse(body) } catch { return [] } }
  const parsed = z.object({ errors: z.array(z.object({ code: z.coerce.number() }).passthrough()) }).safeParse(payload)
  return parsed.success ? parsed.data.errors.map(error => error.code) : []
}
export const isDailyQuotaExhausted = (status: number, body: unknown) => status === 429 && cloudflareErrorCodes(body).includes(CLOUDFLARE_DAILY_QUOTA_CODE)
const probability = z.number().min(0).max(1)
const NoulSchema = z.object({ type: z.literal('noul'), noul: probability })
const EnvelopeSchema = z.object({ success: z.literal(true), result: z.object({ answers: z.record(z.string(), z.unknown()) }) })
export function parseClefRound(payload: unknown): { gapMaterial: number } {
  const { answers } = EnvelopeSchema.parse(payload).result
  return { gapMaterial: NoulSchema.parse(answers.gap_material).noul }
}
export function parseClefCandidate(payload: unknown): CandidateJudgment {
  const { answers } = EnvelopeSchema.parse(payload).result
  const originality = z.object({ type: z.literal('choice'), choice: z.enum(['original', 'rewrite', 'overlap']), probabilities: CandidateJudgmentSchema.shape.originality }).parse(answers.originality)
  const credibility = z.object({ type: z.literal('score'), score: z.number().min(0).max(2) }).parse(answers.credibility)
  return CandidateJudgmentSchema.parse({ addressesGap: NoulSchema.parse(answers.addresses_gap).noul, originality: originality.probabilities, credibility: credibility.score })
}
export function parseClefPaidRelevance(payload: unknown): { observed: number } {
  return { observed: NoulSchema.parse(EnvelopeSchema.parse(payload).result.answers.addresses_gap).noul }
}
/** Coverage answers by question name; a missing or malformed entry is `unknown` (never complete). */
export function parseClefCoverage(payload: unknown, requirements: Pick<Requirement, 'id'>[]): Record<string, CoverageStatus> {
  const { answers } = EnvelopeSchema.parse(payload).result
  return Object.fromEntries(requirements.map(r => {
    const answer = z.object({ type: z.literal('choice'), choice: z.string().optional(), probabilities: z.record(z.string(), probability).optional() }).safeParse(answers[coverageQuestionName(r)])
    const top = answer.success ? answer.data.choice ?? Object.entries(answer.data.probabilities ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined
    return [r.id, isJudged(top) ? top : 'unknown']
  }))
}
/** One choice question per requirement, the #213 rubric as criteria in the pinned order supported, partial, missing, conflicting. */
export const clefCoverageQuestions = (requirements: Pick<Requirement, 'id' | 'text'>[]) => Object.fromEntries(requirements.map(r => [coverageQuestionName(r), { type: 'choice', instructions: coverageInstructions(r), criteria: { ...COVERAGE_RUBRIC } }]))
export const clefQuestions = {
  paid: { addresses_gap: { type: 'noul', instructions: 'The purchased passages contain evidence that directly addresses the open gap.' } },
  // Question-centred (8 Oct live tuning). The displayed conclusion is the verified claim list (citations.ts), so asking whether
  // the gap "could change the conclusion" scored on-question gaps 0.07 (UC3) and 0.11 (UC2); this wording scores them 0.53 and 0.78.
  // A gap's value still needs a candidate that addresses it, is original and credible, times trust (decision.ts).
  round: { gap_material: { type: 'noul', instructions: 'The open gap is part of what the question asks.' } },
  candidate: {
    addresses_gap: { type: 'noul', instructions: "The candidate's public abstract and tags indicate it contains new evidence that directly addresses the open gap." },
    originality: { type: 'choice', instructions: 'Classify the candidate evidence relative to the listed already-read sources.', criteria: { original: 'Original reporting or primary data.', rewrite: 'A rewrite, syndication or summary of another listed source.', overlap: 'Mostly repeats what the already-read sources say.' } },
    credibility: { type: 'score', instructions: 'Assess the credibility of the candidate evidence.', criteria: ['Opinion or marketing', 'Secondary reporting', 'Named primary sources or data'] },
  },
}
/**
 * The candidate as Clef sees it: public hit fields only. No wallet or price (judging is
 * price-blind), no url; the claimed relevance stays in so calibration has a promise to check.
 */
export const clefCandidate = (c: PublicCandidate) => ({
  resourceId: c.resourceId, title: c.title, publisher: c.publisher, abstract: c.preview, tags: c.facets, tier: c.tier, family: c.family,
  ...(c.derivedFrom ? { derivedFrom: c.derivedFrom } : {}), ...(c.relevance === undefined ? {} : { relevance: c.relevance }), authority: c.authority,
})
export type ClefOptions = { accountId?: string; token?: string; model?: string; fetch?: typeof fetch; allowLive?: boolean; timeoutMs?: number }
export class ClefDecisionProvider implements DecisionProvider {
  readonly name = 'cloudflare' as const
  readonly model: string
  private readonly transport: typeof fetch
  private account?: Promise<string>
  constructor(private readonly options: ClefOptions = {}) {
    this.model = options.model ?? decisionModel()
    // Production transport requires explicit opt-in; fixtures and recorded mocks do not.
    this.transport = options.fetch ?? (options.allowLive ? fetch : async () => { throw new Error('Live Clef disabled') })
  }
  /**
   * Two attempts per call (#195): a timeout, HTTP 5xx/429, transport failure or invalid answer is retried once before the
   * call fails the round (#206); a 4xx or the daily quota fails at once. `signal` is the round's: when a sibling call
   * fails the round, this call aborts and is not retried.
   */
  private async request(path: string, body?: unknown, validate?: (payload: unknown) => unknown, signal?: AbortSignal): Promise<unknown> {
    const token = this.options.token ?? process.env.CLOUDFLARE_API_TOKEN
    if (!token) throw new ClefUnavailableError('no credentials')
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw new ClefUnavailableError('abandoned')
      const controller = new AbortController()
      const abandon = () => controller.abort()
      signal?.addEventListener('abort', abandon, { once: true })
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          (async () => {
            const response = await this.transport(`https://api.cloudflare.com/client/v4${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
            if (!response.ok) {
              // The daily quota will not clear in seconds: fail at once, without a retry or a pause (#195).
              if (response.status === 429 && isDailyQuotaExhausted(429, await response.text().catch(() => ''))) throw new ClefUnavailableError('daily quota')
              const retryAfter = response.headers.get('retry-after')
              const seconds = Number(retryAfter)
              const delay = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000
              throw new ClefHttpError(response.status, Math.min(CLEF_MAX_RETRY_PAUSE_MS, Math.max(1000, delay || 1000)))
            }
            const payload: unknown = await response.json()
            z.object({ success: z.literal(true) }).parse(payload)
            validate?.(payload)
            return payload
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Clef timeout')) }, this.options.timeoutMs ?? clefTimeoutMs())
            controller.signal.addEventListener('abort', () => reject(new Error('Clef aborted')), { once: true })
          }),
        ])
      } catch (error) {
        clearTimeout(timer)
        if (error instanceof ClefUnavailableError) throw error
        if (signal?.aborted) throw new ClefUnavailableError('abandoned')
        const status = error instanceof ClefHttpError ? `HTTP ${error.status}` : controller.signal.aborted ? 'timeout' : error instanceof z.ZodError ? 'invalid response' : 'transport failure'
        if (attempt === 1 || (error instanceof ClefHttpError && error.status >= 400 && error.status < 500 && error.status !== 429)) throw new ClefUnavailableError(status)
        if (error instanceof ClefHttpError && error.status === 429) await pause(error.retryMs)
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abandon) }
    }
    throw new Error('Clef unavailable')
  }
  /**
   * Cached once, shared by parallel candidate and round requests. A failed lookup is not cached (#195): the
   * next call retries discovery, so one network blip at boot cannot fail every decision in the session.
   */
  async resolveAccount(): Promise<string> {
    const configured = this.options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID
    if (configured) return configured
    if (!this.account) {
      const lookup = this.request('/accounts').then(payload => {
        const accounts = z.object({ success: z.literal(true), result: z.array(z.object({ id: z.string().min(1) })).length(1) }).parse(payload)
        return accounts.result[0].id
      })
      this.account = lookup
      lookup.catch(() => { if (this.account === lookup) this.account = undefined })
    }
    return this.account
  }
  /** Each Clef call is a Langfuse generation: public state in, calibrated answers out. */
  private judge(name: string, state: unknown, questions: unknown, validate: (payload: unknown) => unknown, metadata?: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    return startActiveObservation(name, async generation => {
      generation.update({ model: this.model, input: { state, questions }, metadata })
      try {
        const payload = await this.callModel(state, questions, validate, signal) as { result?: { answers?: unknown; usage?: { input_tokens?: number; output_tokens?: number } } }
        generation.update({ output: payload.result?.answers, usageDetails: { input: payload.result?.usage?.input_tokens ?? 0, output: payload.result?.usage?.output_tokens ?? 0 } })
        return payload
      } catch (error) { generation.update({ level: 'ERROR', statusMessage: error instanceof Error ? error.message : 'Clef failed' }); throw error }
    }, { asType: 'generation' })
  }
  private async callModel(state: unknown, questions: unknown, validate: (payload: unknown) => unknown, signal?: AbortSignal): Promise<unknown> {
    const account = await this.resolveAccount()
    return this.request(`/accounts/${encodeURIComponent(account)}/ai/run/${this.model.split('/').map(encodeURIComponent).join('/')}`, { model: this.model.endsWith('/clef') ? 'clef' : 'clef-flash', state, questions }, validate, signal)
  }
  async judgeRound(input: Parameters<DecisionProvider['judgeRound']>[0]) {
    return parseClefRound(await this.judge('judge-gap', { question: input.question, conclusion: input.conclusion, gap: input.gap }, clefQuestions.round, parseClefRound, undefined, input.signal))
  }
  /** Calibration (#141): one call per VERIFIED purchase, with the granted passages only (gate 1). */
  async judgePaidRelevance(input: { question: string; gap: string; content: ContentEnvelope; signal?: AbortSignal }) {
    return parseClefPaidRelevance(await this.judge('judge-paid-relevance', { question: input.question, gap: input.gap, passages: input.content.spans.map(s => s.text) }, clefQuestions.paid, parseClefPaidRelevance, { resourceId: input.content.resourceId }, input.signal))
  }
  /** Coverage (#208): one multi-question request per evidence state, over free or granted passages only (gate 1). */
  async judgeCoverage(input: CoverageInput & { signal?: AbortSignal }) {
    const validate = (payload: unknown) => parseClefCoverage(payload, input.requirements)
    return validate(await this.judge('judge-coverage', coverageState(input.question, input.evidence), clefCoverageQuestions(input.requirements), validate, { requirements: input.requirements.length, passages: input.evidence.length }, input.signal))
  }
  async judgeCandidate(input: Parameters<DecisionProvider['judgeCandidate']>[0]) {
    return parseClefCandidate(await this.judge('judge-candidate', { question: input.question, gap: input.gap, readSources: publicSources(input.readSources), candidate: clefCandidate(publicCandidate(input.candidate)) }, clefQuestions.candidate, parseClefCandidate, { resourceId: input.candidate.resourceId, priceMinor: input.candidate.price.amountMinor }, input.signal))
  }
}
