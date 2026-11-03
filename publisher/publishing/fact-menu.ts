import { FactCoverSchema, type FactCover } from '../../shared/contracts/manifest.js'
import { type Article } from '../../shared/contracts/writers.js'
import { deriveFactMenu, mentionsMenuPhrase, satisfiesFactCover } from '../../shared/fact-menu.js'

/** Headings and front matter add vocabulary; they can only promise phrases in the bound passage. */
export function authorFactMenu(article: Pick<Article, 'tier' | 'passages'>, topics: string[], authored: { entity?: string; measure?: string } = {}): Record<string, FactCover> {
  const fallback = deriveFactMenu(article)
  if (article.tier !== 'PAID') return {}
  // The v2 schema forbids digits and long prose, so values cannot enter through this path.
  const phrases = topics.filter(t => FactCoverSchema.shape.measure.safeParse(t).success)
  return Object.fromEntries(article.passages.flatMap(p => {
    const old = fallback[p.id]
    const entity = authored.entity ?? old?.entity ?? phrases.find(t => mentionsMenuPhrase(p.text, t))
    const measure = authored.measure ?? phrases.find(t => t !== entity && mentionsMenuPhrase(p.text, t)) ?? old?.measure
    if (!entity || !measure) return []
    const covers = FactCoverSchema.safeParse({ entity, measure, ...(old?.period ? { period: old.period } : {}) })
    return covers.success && satisfiesFactCover(p.text, covers.data) ? [[p.id, covers.data]] : []
  }))
}
