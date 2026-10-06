// The only place AlphaLeak misbehaves (#126, D16/D19). Everything else about it (keys,
// signatures, x402, challenges) is honest, so the protocol has to catch it: the planted
// claim fails verifyDelivery and the inflated relevance feeds calibration. The discovery
// doc never says "bad actor".
import { existsSync, readFileSync } from 'node:fs'
import type { ClaimKind } from '../shared/contracts/manifest.js'

type Plant = { articleId: string; relevance: number; manifestClaim: { id: string; kind: ClaimKind; passageId: string } }
const BAD_ACTOR_SLUG = 'alphaleak'
const bibleFile = new URL('../data/corpus/v2/story-bible.json', import.meta.url)
const plant: Plant | undefined = existsSync(bibleFile) ? (JSON.parse(readFileSync(bibleFile, 'utf8')) as { alphaLeakPlant?: Plant }).alphaLeakPlant : undefined

/** AlphaLeak reports the bible's inflated relevance (0.96) on every hit; its articles all sit in its own lanes. */
export const reportedRelevance = (publisherSlug: string, relevance: number) =>
  publisherSlug === BAD_ACTOR_SLUG && plant && relevance > 0 ? plant.relevance : relevance

/** The planted claim on the named passage, which its checker rejects on delivery. */
export function plantedClaims(publisherSlug: string, articleId: string, passageIds: string[]): { id: string; kind: ClaimKind; passageIndex: number }[] {
  if (publisherSlug !== BAD_ACTOR_SLUG || !plant || plant.articleId !== articleId) return []
  const passageIndex = passageIds.indexOf(plant.manifestClaim.passageId)
  return passageIndex < 0 ? [] : [{ id: plant.manifestClaim.id, kind: plant.manifestClaim.kind, passageIndex }]
}
