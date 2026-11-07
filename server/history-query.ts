import type { DatabaseSync } from 'node:sqlite'
import { RunSnapshotSchema } from '../shared/contracts/run.js'
import { IntentStatusSchema } from '../shared/contracts/ledger.js'
import { z } from 'zod'

const summary = RunSnapshotSchema.pick({ question: true, phase: true, stopped: true, budgetMinor: true, spentMinor: true }).extend({ runId: z.string(), at: z.string(), pinned: z.boolean() })
const statuses = IntentStatusSchema.options.map(s => `'${s}'`).join(',')
const charged = "'SETTLED','DELIVERY_PENDING','DELIVERY_FAILED','VERIFIED','CLAIM_FAILED','CHALLENGED','REFUNDED','CHALLENGE_REJECTED','CHALLENGE_REFUSED'"

/** Read-only sidebar projection. Legacy rows use durable intents (never stale snapshot spend)
 * and the first event by id (never chronological MIN); no event means ''. Missing/wrong
 * summary scalars fail closed, just as getRun does. Unselected snapshot bodies are not validated.
 */
export function pastRunSummaries(db: DatabaseSync, { recent }: { recent: number }) {
  // JS's old counter comparison selects ceil(recent) for positive fractions, all unpinned rows for NaN.
  const limit = Number.isNaN(recent) ? -1 : Math.max(0, Math.ceil(recent))
  return db.prepare(`WITH selected AS (
    SELECT r.rowid AS ord, r.id, r.json, COALESCE(m.pinned,0) AS pinned
    FROM runs r LEFT JOIN run_meta m ON m.run_id=r.id
    WHERE COALESCE(m.hidden,0)=0 AND COALESCE(m.pinned,0)!=0
    UNION ALL
    SELECT * FROM (SELECT r.rowid, r.id, r.json, COALESCE(m.pinned,0)
      FROM runs r LEFT JOIN run_meta m ON m.run_id=r.id
      WHERE COALESCE(m.hidden,0)=0 AND COALESCE(m.pinned,0)=0
      ORDER BY r.rowid DESC LIMIT ?)
  ) SELECT id, pinned, json -> '$.question' AS question, json -> '$.phase' AS phase,
    json -> '$.stopped' AS stopped, json -> '$.budgetMinor' AS budget, json -> '$.spentMinor' AS storedSpent,
    (SELECT count(*) FROM (SELECT 1 FROM events e WHERE e.run_id=selected.id LIMIT 1)) AS hasEvent,
    (SELECT e.json -> '$.at' FROM events e WHERE e.run_id=selected.id ORDER BY e.id LIMIT 1) AS at,
    (SELECT COALESCE(SUM(CASE WHEN json_extract(i.json,'$.status') IN (${charged}) THEN json_extract(i.json,'$.amountMinor') ELSE 0 END),0)
      FROM intents i WHERE i.run_id=selected.id) AS spent,
    (SELECT count(*) FROM intents i WHERE i.run_id=selected.id AND
      (COALESCE(json_type(i.json,'$.amountMinor'),'null') NOT IN ('integer','real') OR CAST(json_extract(i.json,'$.amountMinor') AS INTEGER) != json_extract(i.json,'$.amountMinor') OR json_extract(i.json,'$.amountMinor') < 0 OR json_extract(i.json,'$.amountMinor') > 9007199254740991
       OR COALESCE(json_extract(i.json,'$.status'),'') NOT IN (${statuses}))) AS invalid
    FROM selected ORDER BY ord DESC`).all(Number.isFinite(limit) ? limit : -1).map(row => {
      if (row.invalid || (row.hasEvent && row.at === null)) throw new Error('Invalid history intent summary')
      const parse = (value: unknown) => value === null ? undefined : JSON.parse(String(value))
      RunSnapshotSchema.shape.spentMinor.parse(parse(row.storedSpent))
      return summary.parse({ runId: row.id, pinned: !!row.pinned, question: parse(row.question), phase: parse(row.phase),
        stopped: parse(row.stopped), budgetMinor: parse(row.budget), spentMinor: row.spent, at: row.at === null ? '' : parse(row.at) })
    })
}
