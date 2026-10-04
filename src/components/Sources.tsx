/* eslint-disable react-refresh/only-export-components -- Shared access boundary for W2 drawer wiring. */
import type { ContentEnvelope, PublicCandidate, RunSnapshot } from '../../shared/contracts/index.js'

const drawerAccess = new WeakMap<ContentEnvelope, string>()
const identity = (candidate: PublicCandidate) => JSON.stringify([candidate.profileId, candidate.resourceId, candidate.version])

/** Call with the CURRENT snapshot when opening a drawer; never pass raw run.contents. */
export function getAccessibleContent(run: RunSnapshot, candidate: PublicCandidate): ContentEnvelope | undefined {
  if (!run.candidates.some(item => identity(item) === identity(candidate) && item.tier === candidate.tier)) return undefined
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

export interface SourcesProps { run: RunSnapshot; onOpen?: (candidate: PublicCandidate) => void }
export default function Sources({ run, onOpen }: SourcesProps) {
  return <section className="ra-panel ra-sources" aria-label="Sources">
    <div className="ra-section-heading"><h2>Sources</h2><span>{run.candidates.length} discovered</span></div>
    <p className="ra-muted">Synthetic corpus · fictional companies, publishers and findings.</p>
    {run.candidates.length === 0 && <p>Searching publisher profiles for evidence…</p>}
    <ul className="ra-source-list">{run.candidates.map(candidate => {
      const content = getAccessibleContent(run, candidate)
      const intent = run.intents.find(item => item.runId === run.runId && item.resourceId === candidate.resourceId && item.version === candidate.version && ['SETTLED', 'DELIVERY_PENDING', 'VERIFIED', 'DELIVERY_FAILED'].includes(item.status))
      return <li className="ra-source-card" key={identity(candidate)}>
        <div className="ra-section-heading"><span className="ra-eyebrow">{candidate.publisher}</span><span className={`ra-badge ${intent ? 'ra-badge-teal' : ''}`}>{intent ? `bought S$${(intent.amountMinor / 100).toFixed(2)}` : candidate.tier === 'FREE' ? 'Free' : `S$${(candidate.price.amountMinor / 100).toFixed(2)} · preview`}</span></div>
        <h3>{candidate.title}</h3><p>{candidate.preview}</p>
        <p className="ra-muted">{candidate.family} · {candidate.version}{candidate.derivedFrom ? ` · derived from ${candidate.derivedFrom}` : ''}</p>
        <button className="ra-text-button" type="button" disabled={!onOpen} onClick={() => onOpen?.(candidate)}>{content ? 'Read source →' : 'View public preview →'}</button>
        {intent && !content && <p className="ra-muted">Delivery pending verification. Full text remains locked.</p>}
      </li>
    })}</ul>
  </section>
}
