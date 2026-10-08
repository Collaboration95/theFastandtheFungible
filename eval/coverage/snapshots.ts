// Requirement-level coverage labels over fixed evidence snapshots (#213). Every snapshot is a question,
// its frozen requested facts (the bank's `need` text, never the answer), and a fixed set of passages.
// Gold labels follow from construction, recomputed against the live corpus each time:
// - supported: a passage of a listed source article holds every needle of the fact;
// - conflicting: supported, and a listed conflict passage (a different value for the same fact) is present;
// - partial: a source passage holds some needles but not all (a sentence cut from the source);
// - missing: neither. A trap passage (topic only, forecast, wrong date or entity) from another article never
//   changes this; one inside a source article counts only for what its text actually holds.
import { factHolds, factPassages, holds, normalize, passagesWith, type Bank, type Fact, type Question } from '../questions/bank.js'
import type { World } from '../decisions/world.js'
import { retrieveOffline } from '../decisions/world.js'

export const STATUSES = ['supported', 'partial', 'missing', 'conflicting'] as const
export type Status = (typeof STATUSES)[number]
export type EvidencePassage = { articleId: string; passageId: string; tier: 'FREE' | 'PAID'; text: string; role: 'source' | 'trap' | 'conflict' | 'context' | 'partial' }
export type SnapshotState = 'free' | 'free+paid' | 'traps' | 'partial' | 'conflict'
export type Snapshot = {
  id: string; questionId: string; state: SnapshotState; question: string; kind: Question['kind']; hardCase?: string
  requirements: { id: string; need: string }[]; evidence: EvidencePassage[]; gold: Record<string, Status>
  /** The trap kinds present in this snapshot: the hard cases #213 names. */
  trapKinds: string[]
}

const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
const someNeedles = (fact: Fact, text: string) => [...fact.needles, ...(fact.alt ?? []).flat()].some(n => normalize(text).includes(normalize(n)))

export function goldStatus(q: Question, fact: Fact, evidence: EvidencePassage[]): Status {
  if (!fact.needles.length) return 'missing'
  const sourced = evidence.filter(e => fact.sources.includes(e.articleId))
  const supported = sourced.some(e => factHolds(fact, e.text))
  const conflict = (q.conflicts ?? []).some(c => c.factId === fact.id && evidence.some(e => e.articleId === c.articleId && holds(c.needles, e.text)))
  if (supported) return conflict ? 'conflicting' : 'supported'
  return sourced.some(e => someNeedles(fact, e.text)) ? 'partial' : 'missing'
}

function passages(world: World, articleId: string, ids: string[], role: EvidencePassage['role']): EvidencePassage[] {
  const article = world.articles.get(articleId)
  return article ? ids.map(id => ({ articleId, passageId: id, tier: article.tier, text: article.passages.find(p => p.id === id)!.text, role })) : []
}
const dedupe = (list: EvidencePassage[]) => list.filter((e, i) => list.findIndex(o => o.articleId === e.articleId && o.passageId === e.passageId && o.text === e.text) === i)

/** Snapshots for one question: free evidence, free plus paid, traps only (hard cases), and a partial cut when one exists. */
export async function questionSnapshots(world: World, q: Question): Promise<Snapshot[]> {
  const sources = q.requested.flatMap(f => f.sources.flatMap(a => passages(world, a, factPassages(f, world.articles.get(a)).slice(0, 1), 'source')))
  const traps = (q.traps ?? []).flatMap(t => passages(world, t.articleId, passagesWith(t.needles, world.articles.get(t.articleId)).slice(0, 1), 'trap'))
  const conflicts = (q.conflicts ?? []).flatMap(c => passages(world, c.articleId, passagesWith(c.needles, world.articles.get(c.articleId)).slice(0, 1), 'conflict'))
  // Context: the first passage of the top two free search hits, so no snapshot is empty and topic noise is realistic.
  const { contents } = await retrieveOffline(world, [q.question])
  const context = contents.slice(0, 2).flatMap(c => passages(world, c.resourceId, [c.spans[0].id], 'context'))
  const make = (state: SnapshotState, evidence: EvidencePassage[], suffix = ''): Snapshot => {
    const ev = dedupe(evidence)
    return { id: `${q.id}:${state}${suffix}`, questionId: q.id, state, question: q.question, kind: q.kind, ...(q.hardCase ? { hardCase: q.hardCase } : {}),
      requirements: q.requested.map(f => ({ id: f.id, need: f.need })), evidence: ev,
      gold: Object.fromEntries(q.requested.map(f => [f.id, goldStatus(q, f, ev)])), trapKinds: [...new Set((q.traps ?? []).filter(t => ev.some(e => e.articleId === t.articleId && holds(t.needles, e.text))).map(t => t.kind))] }
  }
  const free = (list: EvidencePassage[]) => list.filter(e => e.tier === 'FREE')
  const out = [make('free', [...context, ...free(sources), ...free(traps), ...free(conflicts)]), make('free+paid', [...context, ...sources, ...traps, ...conflicts])]
  if (traps.length) out.push(make('traps', [...context, ...traps]))
  // One snapshot per conflicting source: the fact's source passage against that one rival value.
  ;(q.conflicts ?? []).forEach((c, i) => {
    const fact = q.requested.find(f => f.id === c.factId)
    const rival = conflicts.find(e => e.articleId === c.articleId && holds(c.needles, e.text))
    const src = sources.find(e => fact?.sources.includes(e.articleId) && factHolds(fact, e.text))
    if (rival && src && (q.conflicts ?? []).length > 1) out.push(make('conflict', [...context, src, rival], `-${i + 1}`))
  })
  // A partial cut: one sentence of a source passage holding some needles of a multi-needle fact, but not all.
  for (const fact of q.requested.filter(f => f.needles.length > 1)) {
    const src = sources.find(e => fact.sources.includes(e.articleId) && factHolds(fact, e.text))
    const cut = src && sentences(src.text).find(s => someNeedles(fact, s) && !factHolds(fact, s))
    if (src && cut) { out.push(make('partial', [...context, { ...src, text: cut, role: 'partial' }])); break }
  }
  return out
}

export async function buildSnapshots(world: World, bank: Bank): Promise<Snapshot[]> {
  const out: Snapshot[] = []
  for (const q of bank.questions) out.push(...await questionSnapshots(world, q))
  return out
}
