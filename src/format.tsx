import Icon from './components/Icon'
import type { ReactNode } from 'react'
import { sourceKey, sameSource, type SourceRef } from '../shared/source-identity.js'
/* eslint-disable react-refresh/only-export-components -- Small shared helpers next to the logo mark. */
import { VERDICT_LABEL } from './copy'
import { brandPath, brandFavicons } from './assets/brand/identity'
import type { Citation, DecisionRow, RunSnapshot } from '../shared/contracts/index.js'

export { settlementAssetLabel, money, assetMoney } from '../shared/presentation.js'
import { money, assetMoney } from '../shared/presentation.js'
/** Compact amounts; the adjacent Network/asset line retains the Testnet stand-in disclosure. */
export const compactAssetMoney: typeof assetMoney = (minor, asset) => assetMoney(minor, asset).split(' · ')[0]
export { shortTx as shortHash } from '../shared/presentation.js'
export const candidateOf = (run: RunSnapshot, ref: SourceRef) => run.candidates.find(item => sameSource(item, ref))
export const citationKey = (citation: Citation) => JSON.stringify([sourceKey(citation), citation.spanId])
/** One counting rule for every surface (the run summary and the sources strip): "bought" means paid, never "kept".
    An article is paid once its payment settled and a receipt exists, even if the promise check later refunded it.
    A cancelled key-reveal escrow also leaves a receipt (the cancel transaction), but its money went back: not bought (H5). */
export function purchaseCounts(run: Pick<RunSnapshot, 'intents' | 'receipts'>) {
  const returned = (intent: RunSnapshot['intents'][number]) => intent.status === 'FAILED_NOT_SETTLED' || intent.escrow?.state === 'CANCELLED'
  const paid = run.intents.filter(intent => intent.status === 'REFUNDED' || (!returned(intent) && run.receipts.some(receipt => receipt.intentId === intent.intentId))).length
  const refunded = run.intents.filter(intent => intent.status === 'REFUNDED').length
  return { paid, refunded }
}
export const articleCount = (count: number) => `${count} article${count === 1 ? '' : 's'}`
/** First sentence of a conclusion: the short answer. */
export const leadSentence = (text: string) => text.match(/^.*?[.!?](?=\s+[A-Z]|$)/s)?.[0] ?? text

/** Policy verdicts in words people use: Buy, Skip, Blocked (plus Would buy at S$0 and Rewrite). `why` is the tooltip; the engine's own codes stay in Show work. */
export function plainVerdict(row: DecisionRow, run: RunSnapshot): { stamp: string; tone: string; why: string } {
  const price = money(row.candidate.price.amountMinor), stamp = VERDICT_LABEL[row.verdict]
  if (row.verdict === 'BUY') return run.budgetMinor === 0 ? { stamp: 'Would buy', tone: 'would', why: `Would buy with a budget of ${price} or more` } : { stamp, tone: 'buy', why: 'Fills a gap and fits your budget' }
  if (row.verdict === 'SKIP_OVER_CAP') return { stamp, tone: 'cap', why: `${price} is over the ${money(run.perSourceCapMinor)} per-article limit` }
  if (row.verdict === 'SKIP_OVER_BUDGET') return row.wouldBuy ? { stamp: 'Would buy', tone: 'would', why: run.budgetMinor === 0 ? `Would buy with a budget of ${price} or more` : 'Would buy, but too little budget is left' } : { stamp, tone: 'skip', why: 'Costs more than the budget left' }
  if (row.verdict === 'SKIP_REWRITE') {
    const matches = row.candidate.derivedFrom ? run.candidates.filter(item => item.resourceId === row.candidate.derivedFrom) : []
    const source = new Set(matches.map(sourceKey)).size === 1 ? matches[0] : undefined
    return { stamp, tone: 'skip', why: source ? `A rewrite of ${source.publisher}` : 'A rewrite of evidence it already has' }
  }
  if (row.verdict === 'SKIP_LOW_TRUST') {
    const H = row.reputation?.H ?? row.candidate.reputation?.H
    return { stamp, tone: 'trust', why: `${row.candidate.publisher} failed a proof check${H === undefined ? '' : ` (honesty ${H.toFixed(2)}, under 0.50)`}: blocked, never bought or cited` }
  }
  if (row.verdict === 'SKIP_NO_GAP') return { stamp, tone: 'skip', why: 'No material gap left to close' }
  return { stamp, tone: 'skip', why: `Value ${row.value.toFixed(2)} is under the ${(run.decisions[0]?.threshold ?? 0.2).toFixed(2)} bar` }
}

export function Mark({ className = '' }: { className?: string }) {
  return <svg className={`ra-mark ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d={brandPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" /></svg>
}

/** Named run states use the same generated mark as the static favicon. */
export function favicon(state: 'idle' | 'work' | 'done' | 'alert'): string {
  return `data:image/svg+xml,${encodeURIComponent(brandFavicons[state])}`
}

export function keyRevealLabel(e: import('../shared/contracts/escrow').EscrowStatus): ReactNode {
  if (e.state === 'CANCELLED') return 'Cancelled · funds returned'
  if (e.state !== 'RELEASED') return 'Held in escrow · waiting for the writer’s key'
  const hash = e.finishHash ?? ''
  return <>Paid by key reveal {/^[a-f0-9]{64}$/i.test(hash) && <a href={`https://testnet.xrpl.org/transactions/${hash}`} target="_blank" rel="noreferrer" aria-label="View payment on XRPL Testnet"><Icon name="external" size={16} /></a>}</>
}
