// Gate 5: the writers line on zero-clone MCP results names who actually wrote the sources.
// The bundled corpus mixes fictional demo writers (synthetic: true in data/writers) with the
// team's own labelled writers; an answer citing only team-authored explainers must not say
// "fictional writers", and one citing a fictional writer must never drop the word.

/** Mode-level line before any source is known: the bundled corpus holds both kinds. */
export const FIXTURE_WRITERS_LABEL = 'Fixture models · fictional and team-authored writers'

/** The team's own disclosed writers (not independent). Kept in sync with data/writers by tests/writer-label.test.ts. */
export const TEAM_WRITERS: ReadonlySet<string> = new Set(['team-builder-notes', 'team-xrpl-explainers'])
/** The bundled fictional demo writers (synthetic: true). Kept in sync with data/writers by tests/writer-label.test.ts. */
export const FICTIONAL_WRITERS: ReadonlySet<string> = new Set(['alphaleak', 'basis-points', 'kopi-contrarian', 'load-factor', 'marketpulse-digest', 'notfinancialtimes', 'open-records', 'the-fab-floor'])

type Kind = 'fictional' | 'team-authored' | 'unverified writer-supplied'
const ORDER: Kind[] = ['fictional', 'team-authored', 'unverified writer-supplied']

const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' ? value as Record<string, unknown> : undefined
/** Writer slug of a presented citation or purchase: its source identity, else its `/w/<slug>/blog/…` URL. */
const slugOf = (item: Record<string, unknown>) => {
  const profileId = record(item.source)?.profileId
  if (typeof profileId === 'string') return profileId
  return typeof item.url === 'string' ? /\/w\/([^/?#]+)\/blog\//.exec(item.url)?.[1] : undefined
}
const kindOf = (item: Record<string, unknown>): Kind => {
  const slug = slugOf(item)
  if ((slug && TEAM_WRITERS.has(slug)) || (typeof item.writer === 'string' && /team-authored/i.test(item.writer))) return 'team-authored'
  if (slug && FICTIONAL_WRITERS.has(slug)) return 'fictional'
  // Anything else came from a writer the bundle does not know (for example one published locally):
  // never call it fictional or team-authored.
  return 'unverified writer-supplied'
}

/**
 * The writers line for one tool result: the kinds of writer behind its cited passages and purchases,
 * or the mode-level line when it has neither (search results, a decline, an error).
 */
export function writersLabel(data: Record<string, unknown>): string {
  const items = [data.citations, data.purchases].flatMap(list => Array.isArray(list) ? list.map(record).filter((x): x is Record<string, unknown> => !!x) : [])
  if (!items.length) return FIXTURE_WRITERS_LABEL
  const kinds = new Set(items.map(kindOf))
  const names = ORDER.filter(kind => kinds.has(kind))
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `Fixture models · ${list} writers`
}
