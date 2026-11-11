import type { RunSnapshot } from './contracts/index.js'

/** Public policy metadata only; numerical diagnostics belong under Why. */
export function declineSummary(run: Pick<RunSnapshot, 'candidates' | 'decisions'>): string {
  if (!run.candidates.length) return 'No source covers this question yet. Nothing was bought.'
  const rows = run.decisions.flatMap(round => round.rows)
  if (rows.some(row => row.verdict === 'SKIP_OVER_BUDGET')) return 'Nothing was bought: the relevant articles exceed the budget left.'
  if (rows.length && rows.every(row => row.verdict === 'SKIP_LOW_TRUST')) return 'Nothing was bought: these writers could not meet the trust checks.'
  return 'Nothing was bought: the available articles do not add enough relevant evidence.'
}

/** H9-03: the plain outcome when articles were bought but no cited claim survived. Never "nothing bought" after a payment. */
export function paidNoAnswerSummary(bought: number): string {
  if (bought === 1) return 'Bought 1 article; it gave no citable answer to this question.'
  return `Bought ${bought} articles; ${bought === 2 ? 'neither' : 'none'} gave a citable answer to this question.`
}
