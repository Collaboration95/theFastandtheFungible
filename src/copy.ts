import type { DecisionRow } from '../shared/contracts'
/** Policy codes stay stable in exports; every working surface shares these words. */
export const VERDICT_LABEL = {
  BUY: 'Buy', SKIP_OVER_CAP: 'Skip', SKIP_OVER_BUDGET: 'Skip', SKIP_REWRITE: 'Rewrite', SKIP_LOW_TRUST: 'Blocked', SKIP_NO_GAP: 'Skip', SKIP_LOW_VALUE: 'Skip',
} satisfies Record<DecisionRow['verdict'], string>
export const REFUND_LABEL = { pending: 'Refund requested', refunded: 'Refunded', refused: 'Refund refused' } as const
export const BUDGET_LABEL = { question: 'Budget', default: 'Default budget', article: 'Per-article limit', daily: 'Daily limit' } as const
