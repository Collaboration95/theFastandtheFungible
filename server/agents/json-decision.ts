import { z } from 'zod'
import { CandidateJudgmentSchema } from '../../shared/contracts/index.js'
import { publicCandidate, publicSources, type DecisionProvider } from './decision.js'
import { compatibleJson, compatibleProfile } from './compatible.js'
/** Advisory only. Policy independently prohibits every compatible purchase. */
export class JsonDecisionProvider implements DecisionProvider {
  readonly name = 'compatible' as const
  readonly promptVersion = 'UNCALIBRATED-json-v1'
  readonly model = compatibleProfile(true).model
  private async call(input: unknown, signal?: AbortSignal) {
    const result = await compatibleJson(compatibleProfile(true), input, signal)
    return JSON.parse(result.choices?.[0]?.message?.content ?? '') as unknown
  }
  async judgeRound(input: Parameters<DecisionProvider['judgeRound']>[0]) {
    return z.object({ gapMaterial: z.number().min(0).max(1) }).parse(await this.call({ question: input.question, gap: input.gap }, input.signal))
  }
  async judgeCandidate(input: Parameters<DecisionProvider['judgeCandidate']>[0]) {
    const { manifest: _manifest, wallet: _wallet, url: _url, ...candidate } = publicCandidate(input.candidate)
    return CandidateJudgmentSchema.parse(await this.call({ question: input.question, gap: input.gap, candidate, readSources: publicSources(input.readSources) }, input.signal))
  }
}
