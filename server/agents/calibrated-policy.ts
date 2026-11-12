import { createHash } from 'node:crypto'
import weights from '../../data/calibration/policy-v1.json' with { type: 'json' }
import { embedLocal } from '../embeddings/local.js'
import { cosine } from '../../publisher/search.js'
import { topicOverlap } from '../../shared/relevance.js'
import type { CandidateJudgment, PublicCandidate, PublicSourceRef } from '../../shared/contracts/index.js'
import type { DecisionProvider } from './decision.js'
export const POLICY_FEATURES = ['relevance','similarity','priceSgd','trust','honesty','promiseHistory','authority','original','repeatedFamily','gapCoverage','entityCoverage'] as const
export type PolicyFeatures = number[]
export function metadataFeatures(gap: string, candidate: PublicCandidate, sources: PublicSourceRef[], similarity: number): PolicyFeatures {
  const text = `${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`
  return [candidate.relevance ?? 0, Math.max(0,similarity), Math.min(10,candidate.price.amountMinor/100), candidate.reputation?.T??1,
    candidate.reputation?.H??1,candidate.reputation?.C??1,candidate.authority/2,candidate.derivedFrom?0:1,
    sources.some(s=>s.family===candidate.family)?1:0,topicOverlap(gap,text),topicOverlap(gap,candidate.title)]
}
export const sigmoid = (n: number) => 1/(1+Math.exp(-Math.max(-40,Math.min(40,n))))
export const predictPolicy = (features: number[], model: {intercept:number;weights:number[]}) => sigmoid(model.intercept+features.reduce((s,v,i)=>s+v*model.weights[i],0))
const {sha256,...payload}=weights
if (createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==sha256 || JSON.stringify(weights.features)!==JSON.stringify(POLICY_FEATURES)) throw new Error('Invalid calibrated policy weights')
/** Scores only public metadata. It has no payer, store or purchase capability. */
export class CalibratedDecisionProvider implements DecisionProvider {
  readonly name='calibrated' as const
  readonly model=`policy-v${weights.version}-${sha256.slice(0,12)}`
  async judgeRound({gap}:{question:string;conclusion:string;gap:string}) {return {gapMaterial:gap.trim()?1:0}}
  async judgeCandidate({gap,candidate,readSources,signal}:{question:string;gap:string;candidate:PublicCandidate;readSources:PublicSourceRef[];signal?:AbortSignal}):Promise<CandidateJudgment> {
    const vectors=await embedLocal([gap,`${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`],signal)
    const probability=predictPolicy(metadataFeatures(gap,candidate,readSources,cosine(vectors[0],vectors[1])),weights)
    const rewrite=Boolean(candidate.derivedFrom),repeated=readSources.some(s=>s.family===candidate.family)
    return {addressesGap:probability,originality:rewrite?{original:0,rewrite:1,overlap:0}:repeated?{original:0,rewrite:0,overlap:1}:{original:1,rewrite:0,overlap:0},credibility:2}
  }
}
