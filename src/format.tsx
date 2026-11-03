import { sourceKey, sameSource, type SourceRef } from '../shared/source-identity.js'
/* eslint-disable react-refresh/only-export-components -- Small shared helpers next to the logo mark. */
import { brandPath, brandFavicons } from './assets/brand/identity'
import { RLUSD_TESTNET_ISSUER, type Asset } from '../shared/contracts/asset.js'
import type { Citation, DecisionRow, RunSnapshot } from '../shared/contracts/index.js'

export const settlementAssetLabel = (asset?: Asset) => !asset || asset === 'XRP' ? 'XRPL Testnet' : asset.issuer === RLUSD_TESTNET_ISSUER ? 'RLUSD (Testnet)' : asset.label

export const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`
export const shortHash = (hash: string) => hash.length > 14 ? `${hash.slice(0, 6)}…${hash.slice(-5)}` : hash
export const candidateOf = (run: RunSnapshot, ref: SourceRef) => run.candidates.find(item => sameSource(item, ref))
export const citationKey = (citation: Citation) => JSON.stringify([sourceKey(citation), citation.spanId])
/** First sentence of a conclusion: the short answer. */
export const leadSentence = (text: string) => text.match(/^.*?[.!?](?=\s+[A-Z]|$)/s)?.[0] ?? text

/** Policy verdicts in words people use: Buy, Skip, Blocked (plus Would buy at S$0 and Rewrite). `why` is the tooltip; the engine's own codes stay in Show work. */
export function plainVerdict(row: DecisionRow, run: RunSnapshot): { stamp: string; tone: string; why: string } {
  const price = money(row.candidate.price.amountMinor)
  if (row.verdict === 'BUY') return run.budgetMinor === 0 ? { stamp: 'WOULD BUY', tone: 'would', why: `Would buy with a budget of ${price} or more` } : { stamp: 'BUY', tone: 'buy', why: 'Covers the gap, clears the bar, fits the cap' }
  if (row.verdict === 'SKIP_OVER_CAP') return { stamp: 'SKIP', tone: 'cap', why: `${price} is over the ${money(run.perSourceCapMinor)} per-source cap` }
  if (row.verdict === 'SKIP_OVER_BUDGET') return row.wouldBuy ? { stamp: 'WOULD BUY', tone: 'would', why: run.budgetMinor === 0 ? `Would buy with a budget of ${price} or more` : 'Would buy, but too little budget is left' } : { stamp: 'SKIP', tone: 'skip', why: 'Costs more than the budget left' }
  if (row.verdict === 'SKIP_REWRITE') {
    const matches = row.candidate.derivedFrom ? run.candidates.filter(item => item.resourceId === row.candidate.derivedFrom) : []
    const source = new Set(matches.map(sourceKey)).size === 1 ? matches[0] : undefined
    return { stamp: 'REWRITE', tone: 'skip', why: source ? `A rewrite of ${source.publisher}` : 'A rewrite of evidence it already has' }
  }
  if (row.verdict === 'SKIP_LOW_TRUST') {
    const H = row.reputation?.H ?? row.candidate.reputation?.H
    return { stamp: 'BLOCKED', tone: 'trust', why: `${row.candidate.publisher} failed a proof check${H === undefined ? '' : ` (honesty ${H.toFixed(2)}, under 0.50)`}: quarantined, never bought or cited` }
  }
  if (row.verdict === 'SKIP_NO_GAP') return { stamp: 'SKIP', tone: 'skip', why: 'No material gap left to close' }
  return { stamp: 'SKIP', tone: 'skip', why: `Value ${row.value.toFixed(2)} is under the ${(run.decisions[0]?.threshold ?? 0.2).toFixed(2)} bar` }
}

export function Mark({ className = '' }: { className?: string }) {
  return <svg className={`ra-mark ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d={brandPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" /></svg>
}

/** Named run states use the same generated mark as the static favicon. */
export function favicon(state: 'idle' | 'work' | 'done' | 'alert'): string {
  return `data:image/svg+xml,${encodeURIComponent(brandFavicons[state])}`
}
