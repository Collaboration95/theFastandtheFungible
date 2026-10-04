import type { CandidateJudgment, DecisionRound, PublicCandidate, PublicSourceRef } from '../../shared/contracts/index.js'
export interface DecisionProvider {
  name: 'cloudflare' | 'fixture'; model: string
  judgeRound(input: { question: string; conclusion: string; gap: string }): Promise<{ gapMaterial: number }>
  judgeCandidate(input: { question: string; gap: string; readSources: PublicSourceRef[]; candidate: PublicCandidate }): Promise<CandidateJudgment>
}
export async function decide(_input: { question: string; conclusion: string; gap: string; gapFacet?: string; candidates: PublicCandidate[]; readSources: PublicSourceRef[]; budgetMinor: number; spentMinor: number; reservedMinor: number; perSourceCapMinor: number; round: number; provider?: DecisionProvider }): Promise<DecisionRound> { throw new Error('TODO(W1-DECIDE)') }
