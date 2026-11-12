import { topicOverlap } from '../../shared/relevance.js'
import type { PublicCandidate, PublicSourceRef } from '../../shared/contracts/index.js'
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
