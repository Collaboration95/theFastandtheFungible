/* eslint-disable react-refresh/only-export-components -- Small shared helpers next to the logo mark. */
import type { Citation, DecisionRow, RunSnapshot } from '../shared/contracts/index.js'

export const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`
export const shortHash = (hash: string) => hash.length > 14 ? `${hash.slice(0, 6)}…${hash.slice(-5)}` : hash
export const candidateOf = (run: RunSnapshot, ref: { resourceId: string; version: string }) => run.candidates.find(item => item.resourceId === ref.resourceId && item.version === ref.version)
export const citationKey = (citation: Citation) => `${citation.resourceId}|${citation.version}|${citation.spanId}`
/** First sentence of a conclusion: the short answer. */
export const leadSentence = (text: string) => text.match(/^.*?[.!?](?=\s+[A-Z]|$)/s)?.[0] ?? text

/** Policy verdicts in words people use. The engine's own codes stay in Show work. */
export function plainVerdict(row: DecisionRow, run: RunSnapshot): { stamp: string; tone: string; why: string } {
  const price = money(row.candidate.price.amountMinor)
  if (row.verdict === 'BUY') return run.budgetMinor === 0 ? { stamp: 'WOULD BUY', tone: 'would', why: 'Would buy with a budget of S$1 or more' } : { stamp: 'BUY', tone: 'buy', why: 'Covers the gap, clears the bar, fits the cap' }
  if (row.verdict === 'SKIP_OVER_CAP') return { stamp: 'OVER CAP', tone: 'cap', why: `${price} is over the ${money(run.perSourceCapMinor)} per-source cap` }
  if (row.verdict === 'SKIP_OVER_BUDGET') return row.wouldBuy ? { stamp: 'WOULD BUY', tone: 'would', why: run.budgetMinor === 0 ? `Would buy with a budget of ${money(Math.max(100, row.candidate.price.amountMinor))} or more` : 'Would buy, but too little budget is left' } : { stamp: 'OVER BUDGET', tone: 'skip', why: 'Costs more than the budget left' }
  if (row.verdict === 'SKIP_REWRITE') {
    const source = row.candidate.derivedFrom ? run.candidates.find(item => item.resourceId === row.candidate.derivedFrom) : undefined
    return { stamp: 'REWRITE', tone: 'skip', why: source ? `A rewrite of ${source.publisher}` : 'A rewrite of evidence it already has' }
  }
  if (row.verdict === 'SKIP_NO_GAP') return { stamp: 'NO GAP', tone: 'skip', why: 'No material gap left to close' }
  return { stamp: 'LOW VALUE', tone: 'skip', why: `Value ${row.value.toFixed(2)} is under the ${(run.decisions[0]?.threshold ?? 0.2).toFixed(2)} bar` }
}

export function Mark({ className = '' }: { className?: string }) {
  return <svg className={`ra-mark ${className}`} viewBox="0 0 32 32" aria-hidden="true"><path className="br l" d="M11.5 6.5H7.5v19h4" /><path className="br r" d="M20.5 6.5h4v19h-4" /><circle className="coin" cx="16" cy="19" r="4.4" /></svg>
}

/** Favicon: the mark on blue, with a coin colour and an optional dot for the run state. */
export function favicon(state: 'idle' | 'work' | 'done' | 'alert'): string {
  const coin = state === 'done' ? '#12B76A' : state === 'alert' ? '#FF5A1F' : '#FFE45C'
  const dot = state === 'done' || state === 'alert' ? `<circle cx="54" cy="10" r="9" fill="${coin}" stroke="#fff" stroke-width="3"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#2F45FF"/><path d="M24 15h-7v34h7M40 15h7v34h-7" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="38" r="8" fill="${coin}"/>${dot}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
