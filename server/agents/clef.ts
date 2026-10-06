import { startActiveObservation } from '@langfuse/tracing'
import { z } from 'zod'
import { CandidateJudgmentSchema } from '../../shared/contracts/index.js'
import type { CandidateJudgment, ContentEnvelope, PublicCandidate } from '../../shared/contracts/index.js'
import { decisionModel, publicCandidate, publicSources } from './decision.js'
import type { DecisionProvider } from './decision.js'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export class ClefUnavailableError extends Error {
  constructor(readonly status: string) { super(`Clef unavailable (${status})`) }
}
class ClefHttpError extends Error {
  constructor(readonly status: number, readonly retryMs: number) { super(`Clef HTTP ${status}`) }
}
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
export const clefQuestions = {
  paid: { addresses_gap: { type: 'noul', instructions: 'The purchased passages contain evidence that directly addresses the open gap.' } },
  round: { gap_material: { type: 'noul', instructions: 'Resolving the open gap could change the conclusion of the answer.' } },
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
  private async request(path: string, body?: unknown, validate?: (payload: unknown) => unknown): Promise<unknown> {
    const token = this.options.token ?? process.env.CLOUDFLARE_API_TOKEN
    if (!token) throw new Error('Clef credentials unavailable')
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          (async () => {
            const response = await this.transport(`https://api.cloudflare.com/client/v4${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
            if (!response.ok) {
              const retryAfter = response.headers.get('retry-after')
              const seconds = Number(retryAfter)
              const delay = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000
              throw new ClefHttpError(response.status, Math.min(60000, Math.max(1000, delay || 1000)))
            }
            const payload: unknown = await response.json()
            z.object({ success: z.literal(true) }).parse(payload)
            validate?.(payload)
            return payload
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Clef timeout')) }, this.options.timeoutMs ?? 3000) }),
        ])
      } catch (error) {
        clearTimeout(timer)
        const status = error instanceof ClefHttpError ? `HTTP ${error.status}` : controller.signal.aborted ? 'timeout' : error instanceof z.ZodError ? 'invalid response' : 'transport failure'
        if (attempt === 1 || (error instanceof ClefHttpError && error.status >= 400 && error.status < 500 && error.status !== 429)) throw new ClefUnavailableError(status)
        if (error instanceof ClefHttpError && error.status === 429) await pause(error.retryMs)
      } finally { clearTimeout(timer) }
    }
    throw new Error('Clef unavailable')
  }
  /** Cached once, shared by parallel candidate and round requests. */
  async resolveAccount(): Promise<string> {
    const configured = this.options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID
    if (configured) return configured
    this.account ??= this.request('/accounts').then(payload => {
      const accounts = z.object({ success: z.literal(true), result: z.array(z.object({ id: z.string().min(1) })).length(1) }).parse(payload)
      return accounts.result[0].id
    })
    return this.account
  }
  /** Each Clef call is a Langfuse generation: public state in, calibrated answers out. */
  private judge(name: string, state: unknown, questions: unknown, validate: (payload: unknown) => unknown, metadata?: Record<string, unknown>): Promise<unknown> {
    return startActiveObservation(name, async generation => {
      generation.update({ model: this.model, input: { state, questions }, metadata })
      try {
        const payload = await this.callModel(state, questions, validate) as { result?: { answers?: unknown; usage?: { input_tokens?: number; output_tokens?: number } } }
        generation.update({ output: payload.result?.answers, usageDetails: { input: payload.result?.usage?.input_tokens ?? 0, output: payload.result?.usage?.output_tokens ?? 0 } })
        return payload
      } catch (error) { generation.update({ level: 'ERROR', statusMessage: error instanceof Error ? error.message : 'Clef failed' }); throw error }
    }, { asType: 'generation' })
  }
  private async callModel(state: unknown, questions: unknown, validate: (payload: unknown) => unknown): Promise<unknown> {
    const account = await this.resolveAccount()
    return this.request(`/accounts/${encodeURIComponent(account)}/ai/run/${this.model.split('/').map(encodeURIComponent).join('/')}`, { model: this.model.endsWith('/clef') ? 'clef' : 'clef-flash', state, questions }, validate)
  }
  async judgeRound(input: Parameters<DecisionProvider['judgeRound']>[0]) {
    return parseClefRound(await this.judge('judge-gap', { question: input.question, conclusion: input.conclusion, gap: input.gap }, clefQuestions.round, parseClefRound))
  }
  /** Calibration (#141): one call per VERIFIED purchase, with the granted passages only (gate 1). */
  async judgePaidRelevance(input: { question: string; gap: string; content: ContentEnvelope }) {
    return parseClefPaidRelevance(await this.judge('judge-paid-relevance', { question: input.question, gap: input.gap, passages: input.content.spans.map(s => s.text) }, clefQuestions.paid, parseClefPaidRelevance, { resourceId: input.content.resourceId }))
  }
  async judgeCandidate(input: Parameters<DecisionProvider['judgeCandidate']>[0]) {
    return parseClefCandidate(await this.judge('judge-candidate', { question: input.question, gap: input.gap, readSources: publicSources(input.readSources), candidate: clefCandidate(publicCandidate(input.candidate)) }, clefQuestions.candidate, parseClefCandidate, { resourceId: input.candidate.resourceId, priceMinor: input.candidate.price.amountMinor }))
  }
}
