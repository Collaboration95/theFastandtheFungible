/* eslint-disable react-refresh/only-export-components -- Shared access boundary for W2 drawer wiring. */
import { useState, type CSSProperties } from 'react'
import type { ContentEnvelope, PublicCandidate, RunSnapshot } from '../../shared/contracts/index.js'
import { money, plainVerdict } from '../format'
import WriterChip from './WriterChip'

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

const QUARANTINED: Partial<Record<string, string>> = { CLAIM_FAILED: 'quarantined', CHALLENGED: 'challenged', REFUNDED: 'refunded', CHALLENGE_REJECTED: 'writer disputes', CHALLENGE_REFUSED: 'refused · delisted' }
type CardState = { label: string; tone: string; bought?: boolean }
function cardState(run: RunSnapshot, candidate: PublicCandidate): CardState {
  const price = money(candidate.price.amountMinor)
  if (candidate.tier === 'FREE') return run.contents.some(item => item.resourceId === candidate.resourceId && item.version === candidate.version) ? { label: 'read', tone: 'read' } : { label: 'found', tone: 'found' }
  const intent = run.intents.find(item => item.runId === run.runId && item.resourceId === candidate.resourceId && item.version === candidate.version)
  if (intent?.status === 'VERIFIED') return { label: `bought ${money(intent.amountMinor)}`, tone: 'bought', bought: true }
  if (intent?.status === 'DELIVERY_FAILED') return { label: 'paid · not delivered', tone: 'fail' }
  if (intent && QUARANTINED[intent.status]) return { label: `proof failed · ${QUARANTINED[intent.status]}`, tone: 'fail' }
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
/** The sources strip: six cards with a state each, the rest one click away. */
export default function Sources({ run, onOpen }: SourcesProps) {
  const [all, setAll] = useState(false)
  const cards = run.candidates.map(candidate => ({ candidate, state: cardState(run, candidate) })).sort((a, b) => RANK[a.state.tone] - RANK[b.state.tone])
  const shown = all ? cards : cards.slice(0, 6)
  const read = cards.filter(card => card.state.tone === 'read').length
  const bought = cards.filter(card => card.state.bought).length
  const skipped = cards.filter(card => ['cap', 'skip', 'would'].includes(card.state.tone)).length
  return <section className="ra-strip" aria-label="Sources">
    <div className="ra-strip-h"><h2>Sources</h2>{run.candidates.length === 0
      ? <span className="ra-count">Searching publisher profiles…</span>
      : <span className="ra-count"><span><em>{cards.length}</em> found</span><span><em>{read}</em> read</span><span className="c-b"><em>{bought}</em> bought</span><span><em>{skipped}</em> skipped</span></span>}
      {run.labels.search && <span className={`ra-chip${run.labels.search === 'hybrid' ? '' : ' is-fallback'}`} title="Search mode for this run">search · {run.labels.search}</span>}
      <span className="ra-note-right">Synthetic corpus · fictional</span></div>
    <ul className={`ra-cards${all ? ' is-all' : ''}`}>
      {run.candidates.length === 0 && Array.from({ length: 6 }, (_, index) => <li key={index} className="ra-card is-ghost" aria-hidden="true"><i /><i /><i /></li>)}
      {shown.map(({ candidate, state }, index) => <li key={identity(candidate)} style={{ '--i': index } as CSSProperties}>
        <button type="button" className={`ra-card${state.bought ? ' is-bought' : ''}`} disabled={!onOpen} onClick={() => onOpen?.(candidate)} aria-label={`${candidate.publisher}: ${candidate.title}, ${state.label}`}>
          <span className="ra-card-top"><span className="ra-mono" aria-hidden="true">{initials(candidate.publisher)}</span><span className="ra-card-p">{candidate.publisher}</span></span>
          <span className="ra-card-t">{candidate.title}</span>
          <span className={`ra-card-s st-${state.tone}`}>{state.tone === 'read' || state.bought ? '✓ ' : ''}{state.label}</span>
        </button>
        <WriterChip candidate={candidate} />
      </li>)}
      {cards.length > 6 && <li><button type="button" className="ra-more" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Fewer' : `All ${cards.length}`}</button></li>}
    </ul>
  </section>
}
const initials = (name: string) => name.split(/\s+/).filter(word => /^[A-Z]/.test(word)).slice(0, 2).map(word => word[0]).join('') || name.slice(0, 2).toUpperCase()
