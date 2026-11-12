import { WriterVerification } from './WriterVerification.js'
import Icon from './Icon'
/* eslint-disable react-refresh/only-export-components -- The publisher-card hook lives next to the chip that uses it. */
import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { PublicCandidate, ReputationSummary } from '../../shared/contracts/index.js'
import { money } from '../format'
import { useHosted } from '../hosted'

/** Public publisher card (`/.well-known/agent-publisher.json`): display domain and writer names. Never premium bytes. */
const CardSchema = z.object({ name: z.string(), domain: z.string(), writers: z.array(z.object({ slug: z.string(), name: z.string() })) })
export type PublisherCard = z.infer<typeof CardSchema>
const cards = new Map<string, Promise<PublisherCard | undefined>>()
export function usePublisherCard(slug?: string): PublisherCard | undefined {
  const [card, setCard] = useState<PublisherCard>()
  const hosted = !!useHosted()
  useEffect(() => {
    if (!slug || typeof fetch !== 'function') return
    let cancelled = false
    if (!cards.has(slug)) cards.set(slug, fetch(`/w/${encodeURIComponent(slug)}/.well-known/agent-publisher.json`).then(r => r.ok ? r.json() : undefined).then(data => CardSchema.safeParse(data).data).catch(() => undefined))
    void cards.get(slug)!.then(value => { if (!cancelled) setCard(value) })
    return () => { cancelled = true }
  }, [slug, hosted])
  return card
}

const titleCase = (slug: string) => slug.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')
export const writerName = (slug: string, card?: PublisherCard) => card?.writers.find(writer => writer.slug === slug)?.name ?? titleCase(slug)

/** Reputation chip: "Trust 0.80" (trust T, D6). The status is spelled out only when it isn't active; `quiet` leaves a newcomer unmarked. */
export function TrustChip({ reputation, quiet = false }: { reputation?: ReputationSummary; quiet?: boolean }) {
  if (!reputation) return quiet ? null : <span className="ra-trust is-new" title="No history yet">No history</span>
  return <span className={`ra-trust is-${reputation.status}`} title={`Honesty ${reputation.H.toFixed(2)} · coverage ${reputation.C.toFixed(2)}`}>Trust {reputation.T.toFixed(2)}{reputation.status === 'active' ? '' : ` · ${reputation.status === 'delisted' ? 'Delisted' : 'Blocked'}`}</span>
}

/** Who wrote a source and who sells it (D21). `card` (source cards) keeps the author link, SYNTHETIC and trust; `row` (decision rows) keeps trust only; the full chip is for Show work. */
export default function WriterChip({ candidate, reputation, variant = 'full' }: { candidate: PublicCandidate; reputation?: ReputationSummary; variant?: 'full' | 'card' | 'row' }) {
  const slug = candidate.publisherSlug
  const card = usePublisherCard(variant === 'row' || candidate.source ? undefined : slug)
  const writer = candidate.writerSlug ? writerName(candidate.writerSlug, card) : candidate.publisher
  const trust = <TrustChip reputation={reputation ?? candidate.reputation} quiet={variant !== 'full'} />
  const hosted = !!useHosted()
  if (variant === 'row') return trust
  // Hosted links stay on the gateway, which permits only public writer reads.
  const link = slug ? <a href={import.meta.env.MODE === 'browser-demo' ? `${import.meta.env.BASE_URL}?writers=1` : candidate.source && !hosted ? new URL(`/w/${slug}`, candidate.source.origin).href : `/w/${slug}`} target="_blank" rel="noreferrer" className="ra-writer-n" title="Open the writer’s site in a new tab">{writer} <Icon name="external" size={16} /></a> : <span className="ra-writer-n">{writer}</span>
  const verification = <WriterVerification value={candidate.verification} />
  const community = candidate.publisherSlug?.startsWith('community-') && <span className="ra-chip">Community writer</span>
  const authorship = ['team-builder-notes', 'team-xrpl-explainers'].includes(candidate.publisherSlug ?? '') && <span className="ra-chip" title={candidate.publisherSlug === 'team-xrpl-explainers' ? 'Team-authored explainer with cited sources. Not an independent writer.' : 'Team-authored notes with real content. Not an independent writer.'}>Team-authored</span>
  const synthetic = candidate.license.kind === 'SYNTHETIC' && <span className="ra-chip is-sim">SYNTHETIC</span>
  if (variant === 'card') return <span className="ra-writer">{writer !== candidate.publisher && link}{community}{authorship}{synthetic}{verification}{trust}</span>
  return <span className="ra-writer">
    {link}
    {writer !== candidate.publisher && <span className="ra-writer-p">{candidate.publisher}</span>}
    {card?.domain && !community && <span className="ra-writer-d">{card.domain}</span>}
    {community}{authorship}{synthetic}{verification}
    <span className={`ra-tier is-${candidate.tier.toLowerCase()}`}>{candidate.tier === 'FREE' ? 'FREE' : `PAID ${money(candidate.price.amountMinor)}`}</span>
    {trust}
  </span>
}
