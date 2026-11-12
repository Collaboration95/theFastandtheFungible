// Shared hosted-demo population: admitted holds since 11 Nov UTC, exact XRPL Testnet rail.
import type { DatabaseSync } from 'node:sqlite'
import { XRPL_LABEL } from '../../shared/contracts/index.js'
export const SCOREBOARD_DAY = '2026-11-11'
export function sandboxPopulation(db: DatabaseSync, includeSimulated = false) {
  return db.prepare(`SELECT r.id, sum(max(h.model_used,coalesce(a.micro,0))) AS model, max(h.state) AS state,
      json_extract(r.json,'$.phase') AS phase, json_extract(r.json,'$.budgetMinor') AS budget,
      json_extract(r.json,'$.spentMinor') AS spent, json_extract(r.json,'$.ledgerAnchor') AS anchor,
      json_extract(r.json,'$.labels.settlement') AS rail
      FROM hosted_holds h JOIN runs r ON r.id=h.run_id
      LEFT JOIN (SELECT hold_id,sum(reserved) AS micro FROM hosted_attempts GROUP BY hold_id) a ON a.hold_id=h.id WHERE coalesce(h.started_day,h.day)>=? GROUP BY r.id`).all(SCOREBOARD_DAY).filter(row => includeSimulated || row.rail === XRPL_LABEL)
}
/** A stored receipt for an existing, non-cancelled intent is the scoreboard's settled purchase. */
export function settledReceipts<T extends { intentId: string }>(receipts: T[], intents: { intentId: string; escrow?: { state: string } }[]): T[] {
  const eligible = new Set(intents.filter(i => i.escrow?.state !== 'CANCELLED').map(i => i.intentId))
  return receipts.filter(r => eligible.has(r.intentId))
}
