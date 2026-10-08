/**
 * Neutral, deterministic tie-break (#204). Equal scores must not favour a seller's slug (alphabetical order put
 * `alphaleak-*` first) or a seller's claimed relevance (that rewards inflation). Instead, ties order by a hash of
 * (query, article id, version): stable for a given question, unrelated to names, and different across questions.
 * FNV-1a (32-bit) needs no Node APIs, so the same order holds wherever it runs.
 */
export function tieBreakKey(query: string, articleId: string, version: string): number {
  let hash = 0x811c9dc5
  for (const char of `${query}\u0000${articleId}\u0000${version}`) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}
/** Compares two items on their tie-break keys; the joined key string settles a (vanishingly rare) hash collision. */
export const compareTieBreak = (query: string, a: { id: string; version: string }, b: { id: string; version: string }) =>
  tieBreakKey(query, a.id, a.version) - tieBreakKey(query, b.id, b.version) || (a.id === b.id ? a.version.localeCompare(b.version) : a.id.localeCompare(b.id))
