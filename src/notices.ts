// What a fallback label says to the visitor, in the server's own reason where it gives one (gate 5: say what was substituted,
// and why, truthfully). The planner's label is `fixture · scope-fixture` plus, since R8-A, ` · <reason>`; the reason is read from
// the API, never guessed here.
import type { RunSnapshot } from '../shared/contracts/index.js'

/** The notice for a run whose search plan came from the built-in rules although a live planner is configured, or undefined. */
export function planNotice(plan?: string): string | undefined {
  if (!plan?.startsWith('fixture')) return undefined
  switch (plan.split(' · ')[2]) {
    case 'spending guard': return 'Planned with built-in rules: the live plan was rejected by the spending guard, which only the budget rules may override.'
    case 'subject guard': return 'Planned with built-in rules: the live plan was rejected because it dropped the subject of your question.'
    // "planner unavailable", and a bare label recorded before reasons existed.
    default: return 'Planned with built-in rules: the live planner didn’t respond.'
  }
}

/** The answer was written by the offline writer although a live model is configured, and something was written. A decline writes
 * nothing, so it carries no such notice (R8 A3). */
export const writtenOffline = (run: Pick<RunSnapshot, 'labels' | 'answers'>) => run.labels.research.startsWith('fixture') && run.answers.some(answer => answer.claims.length > 0)
