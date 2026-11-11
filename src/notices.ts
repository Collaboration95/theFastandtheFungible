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

/** Why the offline writer stood in, from the run's latest MODEL_FALLBACK reason (server/agents/research.ts `fallbackReason`). */
const WHY: Record<string, string> = {
  timeout: 'the model didn’t respond in time',
  cap: 'this question used up its model allowance',
  invalid: 'the model’s draft failed the exact-quote check',
  guard: 'no passage matched the question closely enough to send to the model',
}
/**
 * The offline-writer notice, or undefined (gate 5: what was substituted, and why). Shown when the answer came from the
 * offline writer although a live model is configured, and either something was written or articles were bought (H9-03:
 * a paid run with no answer must say why). A decline writes nothing and buys nothing, so it carries no notice (R8 A3).
 */
export function offlineNotice(run: Pick<RunSnapshot, 'labels' | 'answers' | 'receipts' | 'events'>): string | undefined {
  if (!run.labels.research.startsWith('fixture')) return undefined
  const written = run.answers.some(answer => answer.claims.length > 0)
  if (!written && !run.receipts.length) return undefined
  const reason = [...run.events].reverse().find(event => event.type === 'MODEL_FALLBACK')?.data?.reason
  if (reason === 'guard' && !written) return 'The model wasn’t asked: no bought passage matched the question closely enough to quote.'
  const why = (typeof reason === 'string' && WHY[reason]) || 'the model was unavailable'
  return written ? `Written from offline extracts: ${why}.` : `Offline extracts used: ${why}. They held no citable passage.`
}
