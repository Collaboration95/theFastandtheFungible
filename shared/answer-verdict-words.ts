// Answer-only wording mirror: importing the proof authority also initializes its snapshot schemas.
// A parity regression pins this small view table to refusal-proof.ts without coupling the initial search bundle to it.
export const ANSWER_VERDICT_WORDS: Record<string, string> = {
  SKIP_LOW_VALUE: 'Wouldn’t add enough', SKIP_LOW_TRUST: 'Writer didn’t meet the trust checks', SKIP_OVER_CAP: 'Over the per-article cap',
  SKIP_OVER_BUDGET: 'Over the budget left', SKIP_REWRITE: 'Repeats what is already known', SKIP_NO_GAP: 'Nothing left to fill', NOT_JUDGED: 'Not needed',
}
