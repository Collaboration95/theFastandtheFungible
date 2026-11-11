/** Display only. Persisted events, reason codes and receipts must never be rewritten. */
import type { TraceEvent } from './contracts/run.js'

export const EVENT_LABELS: Record<string, string> = {
  CLARIFY: 'Clarify', PLAN: 'Plan', SEARCH: 'Search', READ_FREE: 'Read free', ANSWER: 'Write answer',
  ANSWER_PROGRESS: 'Writing', ANSWER_READY: 'Answer ready', FREE_DRAFT: 'Free draft', DECIDE: 'Choose article',
  BUY: 'Pay writer', READ_PAID: 'Read purchased', DONE: 'Done', FAILED: 'Failed', STOPPED: 'Stopped',
  PROOF: 'Check promises', CHALLENGE: 'Request refund', REFUND: 'Refund', REPUTATION: 'Writer trust',
  COVERAGE: 'Check facts', FOLLOW_UP: 'Search again', GRANT: 'Access granted', PURCHASE: 'Payment',
  MODEL_FALLBACK: 'Model substitute', MODEL_USAGE: 'Model usage', DECISION_UNAVAILABLE: 'Buying unavailable',
  MANIFEST_DROPPED: 'Source excluded', RECOVERY: 'Recovery', REPORT: 'Report', SNAPSHOT: 'Saved',
  TRACE: 'Trace link', WIRE: 'Request', XRPL: 'Ledger', PROGRESS: 'Progress',
  LEDGER_DRY_RUN: 'Ledger preview', LEDGER_PRE_CHECK: 'Ledger check', ROYALTY_UNRESOLVED: 'Royalty unresolved',
}

/** ModelFallbackReason in telemetry; guard and cap are deliberate policy paths, not provider outages. */
export const FALLBACK_LABELS: Record<string, string> = {
  guard: 'No supplied passage matched closely enough; used offline extracts without calling the model.',
  timeout: 'The model took too long; used offline extracts instead.',
  http: 'The model provider returned an error; used offline extracts instead.',
  cap: 'A model allowance limit was reached; used offline extracts instead.',
  invalid: 'The model output did not pass validation; used offline extracts instead.',
  unavailable: 'The model was unavailable; used offline extracts instead.',
}

export const REASON_LABELS: Record<string, string> = {
  ...EVENT_LABELS,
  DECIDED: 'Purchase chosen', QUOTED: 'Price received', RESERVED: 'Budget reserved', SUBMITTING: 'Payment being confirmed',
  NOT_FOUND: 'Not found', SETTLED: 'Payment settled', DELIVERY_PENDING: 'Waiting for the article', VERIFIED: 'Article verified', SKIPPED: 'Skipped',
  FAILED_NOT_SETTLED: 'Payment failed before settlement', DELIVERY_FAILED: 'Article delivery failed', CLAIM_FAILED: 'A promised detail failed its check',
  CHALLENGED: 'Refund requested', REFUNDED: 'Refunded', CHALLENGE_REJECTED: 'Refund request rejected', CHALLENGE_REFUSED: 'Refund refused or timed out',
  complete: 'All requested facts answered', 'no-eligible-purchase': 'No source worth buying for the remaining facts',
  'budget-exhausted': 'Budget used up', 'round-limit': 'Three-round limit reached',
  'decision-unavailable': 'Could not judge sources; nothing bought', stopped: 'Stopped by you',
  faucet_unavailable: 'Testnet faucet unavailable', validation_timeout: 'Ledger confirmation took too long',
  wallet_cache_unavailable: 'Saved Testnet wallet unavailable', network_unavailable: 'Testnet network unavailable',
  SKIP_REWRITE: 'Already acquired or repeats existing evidence', SKIP_OVER_CAP: 'Over the article price limit',
  SKIP_OVER_BUDGET: 'Over the remaining budget', SKIP_LOW_VALUE: 'Not enough useful new evidence',
  SKIP_NO_GAP: 'No missing fact to fill', SKIP_LOW_TRUST: 'Writer trust too low',
}

const lookup = (labels: Record<string, string>, code: string): string | undefined => Object.hasOwn(labels, code) ? labels[code] : undefined

export function searchLabel(label: string): string {
  return label.replace(/\bhybrid\b/g, 'Keyword and semantic search').replace(/(?:keyword only \()?embeddings unavailable\)?|keyword only/gi, 'Keyword search (semantic search not used)')
}

/** Older events carry their reason only inside the label. Do not guess an unrecorded reason. */
function fallbackReason(event: TraceEvent): string | undefined {
  return typeof event.data?.reason === 'string' ? event.data.reason : /(?:LLM fallback|MODEL_FALLBACK)\s*\(([^)]+)\)/i.exec(event.label)?.[1]
}

/** Preserve useful recorded details and simulation labels, but expand internal tokens. */
export function traceLabel(label: string): string {
  const cleaned = searchLabel(label)
    .replace(/ · H (\d+(?:\.\d+)?)→(\d+(?:\.\d+)?) · C (\d+(?:\.\d+)?)→(\d+(?:\.\d+)?)/, (_all, h0: string, h1: string, c0: string, c1: string) => ` · Trust ${(Number(h0) * Number(c0)).toFixed(2)} → ${(Number(h1) * Number(c1)).toFixed(2)}`)
    .replace(/ · InvoiceID = (?:sha256\(invoiceId\)|original tx)/, '')
  const known = lookup(REASON_LABELS, cleaned)
  if (known) return known
  return cleaned.replace(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g, token => lookup(REASON_LABELS, token) ?? token.replaceAll('_', ' ').toLowerCase())
}

export function eventPresentation(event: TraceEvent): { title: string; detail: string; warning: boolean } {
  const reason = fallbackReason(event)
  const fallback = event.type === 'MODEL_FALLBACK'
  const detail = fallback ? lookup(FALLBACK_LABELS, reason ?? '') ?? 'Used offline extracts instead of the model; the reason was not recorded in a recognised form.' : traceLabel(event.label)
  const warning = fallback ? !['guard', 'cap'].includes(reason ?? '')
    : ['FAILED', 'DECISION_UNAVAILABLE', 'MANIFEST_DROPPED', 'ROYALTY_UNRESOLVED'].includes(event.type)
      || (event.type === 'WIRE' && typeof event.data?.status === 'number' && event.data.status >= 400 && event.data.status !== 402)
      || event.data?.ok === false || event.data?.failed === true
      || (Array.isArray(event.data?.unavailable) && event.data.unavailable.length > 0)
      || /\b(?:FAILED_NOT_SETTLED|DELIVERY_FAILED|CLAIM_FAILED|CHALLENGE_REJECTED|CHALLENGE_REFUSED)\b/.test(String(event.data?.status ?? event.label))
  return { title: lookup(EVENT_LABELS, event.type) ?? 'Additional activity', detail, warning }
}
