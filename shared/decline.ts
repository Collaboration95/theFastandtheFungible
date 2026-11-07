import type { RunSnapshot } from './contracts/index.js'

/** Public decision metadata only: no passage or preview is used to explain a decline. */
export function declineSummary(run: Pick<RunSnapshot, 'candidates' | 'decisions'>): string {
  if (!run.candidates.length) return 'No listed writer covers this yet · nothing bought'
  const paid = run.candidates.filter(c => c.tier === 'PAID')
  const scored = run.decisions.flatMap(round => round.rows.map(row => ({ row, threshold: round.threshold })))
  const best = scored.reduce<typeof scored[number] | undefined>((best, item) => !best || item.row.value > best.row.value ? item : best, undefined)
  const lowValue = scored.length > 0 && scored.every(({ row }) => row.verdict === 'SKIP_LOW_VALUE')
  return `Found ${paid.length} paid article${paid.length === 1 ? '' : 's'}; ${lowValue ? 'none cleared the value threshold' : 'none selected by policy'}${best ? ` (best ${best.row.value.toFixed(2)} vs ${best.threshold.toFixed(2)})` : ''}`
}
