import { z } from 'zod'
import { CandidateJudgmentSchema } from '../../shared/contracts/index.js'
import type { CandidateJudgment } from '../../shared/contracts/index.js'
import { decisionModel, publicCandidate, publicSources } from './decision.js'
import type { DecisionProvider } from './decision.js'

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
export const clefQuestions = {
  round: { gap_material: { type: 'noul', instructions: 'Resolving the open gap could change the conclusion of the answer.' } },
  candidate: {
    addresses_gap: { type: 'noul', instructions: "The candidate's preview indicates it contains new evidence that directly addresses the open gap." },
    originality: { type: 'choice', instructions: 'Classify the candidate evidence relative to the listed already-read sources.', choices: { original: 'Original reporting or primary data.', rewrite: 'A rewrite, syndication or summary of another listed source.', overlap: 'Mostly repeats what the already-read sources say.' } },
    credibility: { type: 'score', instructions: 'Assess the credibility of the candidate evidence.', legend: { '0': 'Opinion or marketing', '1': 'Secondary reporting', '2': 'Named primary sources or data' } },
  },
}
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
            if (!response.ok) throw new Error('Clef HTTP failure')
            const payload: unknown = await response.json()
            z.object({ success: z.literal(true) }).parse(payload)
            validate?.(payload)
            return payload
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Clef timeout')) }, this.options.timeoutMs ?? 3000) }),
        ])
      } catch {
        if (attempt === 1) throw new Error('Clef unavailable after one retry')
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
  private async judge(state: unknown, questions: unknown, validate: (payload: unknown) => unknown): Promise<unknown> {
    const account = await this.resolveAccount()
    return this.request(`/accounts/${encodeURIComponent(account)}/ai/run/${this.model.split('/').map(encodeURIComponent).join('/')}`, { state, questions }, validate)
  }
  async judgeRound(input: Parameters<DecisionProvider['judgeRound']>[0]) {
    return parseClefRound(await this.judge({ question: input.question, conclusion: input.conclusion, gap: input.gap }, clefQuestions.round, parseClefRound))
  }
  async judgeCandidate(input: Parameters<DecisionProvider['judgeCandidate']>[0]) {
    return parseClefCandidate(await this.judge({ question: input.question, gap: input.gap, readSources: publicSources(input.readSources), candidate: publicCandidate(input.candidate) }, clefQuestions.candidate, parseClefCandidate))
  }
}
