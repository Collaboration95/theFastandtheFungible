/* eslint-disable react-refresh/only-export-components -- Shared access boundary for W2 drawer wiring. */
import { useEffect, useRef, useState } from 'react'
import type { ContentEnvelope, PublicCandidate, RunSnapshot } from '../../shared/contracts/index.js'
import { money, plainVerdict } from '../format'

const drawerAccess = new WeakMap<ContentEnvelope, string>()
const identity = (candidate: PublicCandidate) => JSON.stringify([candidate.profileId, candidate.resourceId, candidate.version])

/** Call with the CURRENT snapshot when opening a drawer; never pass raw run.contents. */
export function getAccessibleContent(run: RunSnapshot, candidate: PublicCandidate): ContentEnvelope | undefined {
  if (!run.candidates.some(item => identity(item) === identity(candidate) && item.tier === candidate.tier)) return undefined
  // Gate 1 and 4: paid text only after a grant whose proof passed; a quarantined source never opens.
  if (candidate.tier === 'PAID' && !run.intents.some(intent => intent.runId === run.runId && intent.resourceId === candidate.resourceId && intent.version === candidate.version && intent.status === 'VERIFIED')) return undefined
  if (candidate.tier === 'PAID' && !run.grants.some(grant => grant.runId === run.runId && grant.resourceId === candidate.resourceId && grant.version === candidate.version && grant.contentDigest.length > 0)) return undefined
  const content = run.contents.find(item => item.profileId === candidate.profileId && item.resourceId === candidate.resourceId && item.version === candidate.version)
  if (!content || !content.spans.every(span => span.text.length > 0 && content.body.includes(span.text))) return undefined
  // An immutable copy keeps the drawer capability tied to the bytes checked here.
  const accessible = Object.freeze({ ...content, spans: content.spans.map(span => Object.freeze({ ...span })) })
  Object.freeze(accessible.spans)
  drawerAccess.set(accessible, identity(candidate))
  return accessible
}

export function canDisplayPassage(candidate: PublicCandidate, content: ContentEnvelope): boolean {
  return content.profileId === candidate.profileId && content.resourceId === candidate.resourceId && content.version === candidate.version &&
    (candidate.tier === 'FREE' || drawerAccess.get(content) === identity(candidate))
}

const QUARANTINED: Partial<Record<string, string>> = { CLAIM_FAILED: 'not used', CHALLENGED: 'refund requested', REFUNDED: 'refunded', CHALLENGE_REJECTED: 'writer disputes', CHALLENGE_REFUSED: 'refused · delisted' }
type CardState = { label: string; tone: string; bought?: boolean }
function cardState(run: RunSnapshot, candidate: PublicCandidate): CardState {
  const price = money(candidate.price.amountMinor)
  if (candidate.tier === 'FREE') return run.contents.some(item => item.resourceId === candidate.resourceId && item.version === candidate.version) ? { label: 'read', tone: 'read' } : { label: 'found', tone: 'found' }
  const intent = run.intents.find(item => item.runId === run.runId && item.resourceId === candidate.resourceId && item.version === candidate.version)
  if (intent?.status === 'VERIFIED') return { label: `bought ${money(intent.amountMinor)}`, tone: 'bought', bought: true }
  if (intent?.status === 'DELIVERY_FAILED') return { label: 'paid · not delivered', tone: 'fail' }
  if (intent && QUARANTINED[intent.status]) return { label: `Promise broken · ${QUARANTINED[intent.status]}`, tone: 'fail' }
  if (intent && intent.status !== 'SKIPPED' && intent.status !== 'FAILED_NOT_SETTLED') return { label: 'buying…', tone: 'buying' }
  const row = run.decisions[0]?.rows.find(item => item.candidate.resourceId === candidate.resourceId && item.candidate.version === candidate.version)
  if (row) {
    if (row.wouldBuy && run.budgetMinor === 0) return { label: `would buy · ${price}`, tone: 'would' }
    const stamp = plainVerdict(row, run).stamp
    if (row.verdict !== 'BUY') return { label: `${stamp.toLowerCase()} · ${price}`, tone: row.verdict === 'SKIP_OVER_CAP' ? 'cap' : 'skip' }
  }
  return { label: price, tone: 'lock' }
}
const RANK: Record<string, number> = { bought: 0, buying: 0, fail: 0, would: 1, cap: 2, skip: 3, lock: 2, read: 4, found: 4 }

export interface SourcesProps { run: RunSnapshot; onOpen?: (candidate: PublicCandidate) => void }
/** T5: sources in one line (counts, the sources that matter named); View all opens the cards. */
export default function Sources({ run, onOpen }: SourcesProps) {
  const [all, setAll] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (all) dialog.current?.showModal(); else dialog.current?.close() }, [all])
  const cards = run.candidates.map(candidate => ({ candidate, state: cardState(run, candidate) })).sort((a,b) => RANK[a.state.tone] - RANK[b.state.tone])
  return <section className="ra-strip" aria-label="Sources"><div className="ra-source-summary">{cards.length} sources · {run.contents.length} read · {run.intents.filter(i => i.status === 'VERIFIED').length} bought <button type="button" className="ra-link" onClick={() => setAll(true)}>View all</button></div>
    <dialog ref={dialog} className="ra-receipt-sheet ra-sources-sheet" aria-label="All sources" onCancel={event => { event.preventDefault(); setAll(false) }}><header><h2>Sources</h2><button type="button" className="ra-btn" onClick={() => setAll(false)} aria-label="Close sources">×</button></header><table><thead><tr><th>Article</th><th>Writer / access</th></tr></thead><tbody>{cards.map(({ candidate, state }) => <tr key={identity(candidate)}><td><button type="button" className="ra-link" onClick={() => { setAll(false); onOpen?.(candidate) }}>{candidate.title}</button></td><td>{candidate.publisher}<br />{state.label}</td></tr>)}</tbody></table></dialog>
  </section>
}
