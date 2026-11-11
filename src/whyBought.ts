import { sameSource, sourceKey } from '../shared/source-identity.js'
import type { DecisionRound, DecisionRow, PurchaseIntent, RunSnapshot } from '../shared/contracts'
import { money } from './format'

/** One line a payment row can show, at most this many characters. */
export const WHY_MAX = 90
const REFUND_TAG = 'Refunded: writer-signed'

/** The row policy judged for this purchase: the round that selected the source, else the last round that would buy it. */
export function decisionFor(run: Pick<RunSnapshot, 'decisions'>, intent: PurchaseIntent): { round: DecisionRound; row: DecisionRow } | undefined {
  const rows = (round: DecisionRound) => round.rows.filter(row => row.verdict === 'BUY' && sameSource(row.candidate, intent))
  for (const round of run.decisions) {
    const picked = round.selectedSourceKey ? round.selectedSourceKey === sourceKey(intent) : round.selectedResourceId === intent.resourceId
    const row = picked ? rows(round)[0] : undefined
    if (row) return { round, row }
  }
  // Older snapshots carry no selection: the last round that would have bought it.
  for (const round of [...run.decisions].reverse()) {
    if (round.selectedSourceKey || round.selectedResourceId) continue
    const row = rows(round)[0]; if (row) return { round, row } }
  return undefined
}

/** A requested fact or a legacy gap sentence, as the purchase target: "No accessible evidence on X." → "evidence on X". */
export function coveredThing(gap: string): string {
  return gap.trim().replace(/^no (?:accessible|material|dated)\s+/i, '').replace(/[\s.?!]+$/, '').replace(/\s+/g, ' ')
}
function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, Math.max(0, max - 1)), space = cut.lastIndexOf(' ')
  // Cut at a word, and never leave a dangling "in", "of", "and"… before the ellipsis.
  const words = (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:·-]+$/, '')
  return `${words.replace(/(?:\s+(?:in|of|for|on|at|to|by|as|a|an|the|and|or|with|from|than|that|is|are))+$/i, '')}…`
}

/** Read recorded coverage, never infer it from the BUY score or a successful integrity check. */
function verifiedGap(run: RunSnapshot, intent: PurchaseIntent, gap: string): boolean {
  const answer = [...run.answers].sort((a, b) => b.version - a.version)[0]
  const coverage = run.checkpoint.coverage?.find(record => record.answerVersion === answer?.version)
  const requirement = run.checkpoint.requirements?.find(fact => coveredThing(fact.gap ?? fact.text) === gap)
  const entry = coverage?.entries.find(record => record.requirementId === requirement?.id)
  return !!(intent.status === 'VERIFIED' && answer && entry?.status === 'supported' && !coverage!.error
    && run.grants.some(grant => grant.intentId === intent.intentId && sameSource(grant, intent))
    && answer.claims.some(claim => entry.claimIds?.includes(claim.id) && claim.citations.some(citation => sameSource(citation, intent))))
}

/**
 * Why policy bought this article, in one plain line built from the existing decision record (the round's open gap or
 * requested fact, the probe flag, the run budget). A refunded purchase keeps its reason and adds who signed the refund.
 * Returns undefined when nothing was actually bought or the record does not say (no line, never a guess).
 */
export function whyBought(run: RunSnapshot, intent: PurchaseIntent): string | undefined {
  const bought = run.receipts.some(receipt => receipt.intentId === intent.intentId) && intent.status !== 'FAILED_NOT_SETTLED' && intent.escrow?.state !== 'CANCELLED'
  const found = bought ? decisionFor(run, intent) : undefined
  if (!found) return undefined
  const refunded = intent.status === 'REFUNDED', budget = run.budgetMinor > 0 ? ` · within your ${money(run.budgetMinor)}` : ''
  const tail = refunded ? ` · ${REFUND_TAG}` : ''
  // The reason and the refund are kept whole; the budget is added when it fits.
  const line = (reason: string) => `${reason}${budget}${tail}`.length <= WHY_MAX ? `${reason}${budget}${tail}` : `${reason}${tail}`
  if (found.row.probe || intent.purchaseKind) return line('A small test purchase from a new writer')
  const gap = coveredThing(found.round.gap)
  if (!gap) return line('Bought because the free sources left a gap')
  const open = verifiedGap(run, intent, gap) ? 'Covers “' : 'Bought to fill: “'
  return line(`${open}${clip(gap, WHY_MAX - open.length - 1 - tail.length)}”`)
}
