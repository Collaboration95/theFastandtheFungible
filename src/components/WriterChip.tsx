/* eslint-disable react-refresh/only-export-components -- The publisher-card hook lives next to the chip that uses it. */
import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { PublicCandidate, ReputationSummary } from '../../shared/contracts/index.js'
import { money } from '../format'

/** Public publisher card (`/.well-known/agent-publisher.json`): display domain and writer names. Never premium bytes. */
const CardSchema = z.object({ name: z.string(), domain: z.string(), writers: z.array(z.object({ slug: z.string(), name: z.string() })) })
export type PublisherCard = z.infer<typeof CardSchema>
const cards = new Map<string, Promise<PublisherCard | undefined>>()
export function usePublisherCard(slug?: string): PublisherCard | undefined {
  const [card, setCard] = useState<PublisherCard>()
  useEffect(() => {
    if (!slug || typeof fetch !== 'function') return
    let cancelled = false
    if (!cards.has(slug)) cards.set(slug, fetch(`/w/${encodeURIComponent(slug)}/.well-known/agent-publisher.json`).then(r => r.ok ? r.json() : undefined).then(data => CardSchema.safeParse(data).data).catch(() => undefined))
    void cards.get(slug)!.then(value => { if (!cancelled) setCard(value) })
    return () => { cancelled = true }
  }, [slug])
  return card
}

const titleCase = (slug: string) => slug.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')
export const writerName = (slug: string, card?: PublisherCard) => card?.writers.find(writer => writer.slug === slug)?.name ?? titleCase(slug)

/** Reputation chip: trust T and status (D6). */
export function TrustChip({ reputation }: { reputation?: ReputationSummary }) {
  if (!reputation) return <span className="ra-trust is-new" title="No history yet: a newcomer starts at H 0.80">T new</span>
  return <span className={`ra-trust is-${reputation.status}`} title={`Honesty H ${reputation.H.toFixed(2)} · calibration C ${reputation.C.toFixed(2)}`}>T {reputation.T.toFixed(2)} · {reputation.status}</span>
}

/** Who wrote a source and who sells it (D21): writer, publisher, display domain, SYNTHETIC, tier and price, trust. */
export default function WriterChip({ candidate, reputation }: { candidate: PublicCandidate; reputation?: ReputationSummary }) {
  const slug = candidate.publisherSlug
  const card = usePublisherCard(slug)
  const writer = candidate.writerSlug ? writerName(candidate.writerSlug, card) : candidate.publisher
  return <span className="ra-writer">
    {slug ? <a href={`/w/${slug}`} target="_blank" rel="noreferrer" className="ra-writer-n" title="Open the writer's site in a new tab">{writer} ↗</a> : <span className="ra-writer-n">{writer}</span>}
    {writer !== candidate.publisher && <span className="ra-writer-p">{candidate.publisher}</span>}
    {card?.domain && <span className="ra-writer-d">{card.domain}</span>}
    {candidate.license.kind === 'SYNTHETIC' && <span className="ra-chip is-sim">SYNTHETIC</span>}
    <span className={`ra-tier is-${candidate.tier.toLowerCase()}`}>{candidate.tier === 'FREE' ? 'FREE' : `PAID ${money(candidate.price.amountMinor)}`}</span>
    <TrustChip reputation={reputation ?? candidate.reputation} />
  </span>
}
