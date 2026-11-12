import { createHash } from 'node:crypto'
import { Router } from 'express'
import type { Store } from '../store.js'
import { XRPL_LABEL } from '../../shared/contracts/index.js'

import { LedgerAnchorSchema } from '../../shared/contracts/anchor.js'
import { sameSource, sourceKey, type SourceIdentity } from '../../shared/source-identity.js'

export const SCOREBOARD_LABEL = 'XRPL Testnet · test funds · includes our own test runs since 11 Nov'
export const SCOREBOARD_SINCE = Date.parse('2026-11-11T00:00:00Z')
const charged = new Set(['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])
export type SandboxStats = {
  label: string; updatedAt: string; questions: number; purchaseRuns: number; purchasesSettled: number; refunds: number;
  completed: number; inProgress: number; excludedSimulated: number; anchored: number; anchorPending: number; stoppedBeforeAnswer: number;
  timing: { samples: number; medianMs: number | null; p90Ms: number | null };
  medianSpendMinor: number | null; medianModelUsd: number | null;
  audit: { checked: number; unavailable: number; readBeforeGrant: number; buyWithoutPolicy: number; overBudget: number; duplicateIntent: number; receiptWithoutIntent: number; unanchored: number };
}
const median = (values: number[]) => {
  if (!values.length) return null
  values.sort((a,b) => a-b)
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle-1] + values[middle]) / 2
}
type Intent = { source?: SourceIdentity; intentId: string; runId: string; resourceId: string; version: string; amountMinor: number; status: string; refund?: { amountMinor: number }; escrow?: { state: string } }
type Event = { type: string; at: string; intentId?: string; round?: number }
type Decision = { round: number; selectedResourceId?: string; selectedSourceKey?: string; rows: { verdict: string; candidate: { resourceId: string; version: string; source?: SourceIdentity } }[] }

/** No hydration of questions, answers, content, tokens or sessions. Bulk reads keep refresh linear in the retained store.
 * Raw ledger rows deliberately bypass getRun(), which joins away orphan receipts and recomputes corrupted totals.
 * Each audit counter counts affected runs, not individual events. An absent trace is unavailable, never a pass.
 */
export function aggregateSandbox(store: Store, now = Date.now()): SandboxStats {
  return store.hostedState(db => {
    const result: SandboxStats = { label: SCOREBOARD_LABEL, updatedAt: new Date(now).toISOString(), questions: 0, purchaseRuns: 0, purchasesSettled: 0, refunds: 0, completed: 0, inProgress: 0, excludedSimulated: 0, anchored: 0, anchorPending: 0, stoppedBeforeAnswer: 0,
      timing: { samples: 0, medianMs: null, p90Ms: null }, medianSpendMinor: null, medianModelUsd: null,
      audit: { checked: 0, unavailable: 0, readBeforeGrant: 0, buyWithoutPolicy: 0, overBudget: 0, duplicateIntent: 0, receiptWithoutIntent: 0, unanchored: 0 } }
    const rows = db.prepare(`SELECT r.id, sum(max(h.model_used,coalesce(a.micro,0))) AS model, max(h.state) AS state,
      json_extract(r.json,'$.phase') AS phase, json_extract(r.json,'$.budgetMinor') AS budget,
      json_extract(r.json,'$.spentMinor') AS spent, json_extract(r.json,'$.ledgerAnchor') AS anchor,
      json_extract(r.json,'$.labels.settlement') AS rail
      FROM hosted_holds h JOIN runs r ON r.id=h.run_id
      LEFT JOIN (SELECT hold_id,sum(reserved) AS micro FROM hosted_attempts GROUP BY hold_id) a ON a.hold_id=h.id WHERE coalesce(h.started_day,h.day)>=? GROUP BY r.id`).all('2026-11-11')
    const runs = new Map(rows.filter(row => row.rail === XRPL_LABEL).map(row => [String(row.id), { row, intents: [] as Intent[], events: [] as Event[], decisions: [] as Decision[], receipts: [] as { intentId: string; amountMinor: number }[] }]))
    result.excludedSimulated = rows.length - runs.size
    // These tables are already indexed by run identity. Reading once avoids N+1 snapshots at 5,000 runs.
    for (const row of db.prepare('SELECT run_id,json FROM intents').iterate()) runs.get(String(row.run_id))?.intents.push(JSON.parse(String(row.json)))
    for (const row of db.prepare(`SELECT run_id,json_object('type',json_extract(json,'$.type'),'at',json_extract(json,'$.at'),
      'intentId',json_extract(json,'$.data.intentId'),'round',json_extract(json,'$.data.round')) AS json FROM events ORDER BY id`).iterate()) runs.get(String(row.run_id))?.events.push(JSON.parse(String(row.json)))
    for (const row of db.prepare('SELECT run_id,json FROM decisions').iterate()) runs.get(String(row.run_id))?.decisions.push(JSON.parse(String(row.json)))
    // No inner join to intents: it would hide precisely the corruption this check must detect.
    for (const row of db.prepare("SELECT json_extract(json,'$.runId') AS run_id,json FROM receipts").iterate()) runs.get(String(row.run_id))?.receipts.push(JSON.parse(String(row.json)))
    const times: number[] = [], spends: number[] = [], models: number[] = [], allIntentIds = new Map<string, number>()
    for (const run of runs.values()) for (const i of run.intents) allIntentIds.set(i.intentId, (allIntentIds.get(i.intentId) ?? 0) + 1)
    for (const [id, { row, intents, events, decisions, receipts }] of runs) {
      result.questions++
      const terminal = ['DONE','FAILED','STOPPED'].includes(String(row.phase))
      if (terminal) result.completed++; else result.inProgress++
      const anchor = row.anchor ? LedgerAnchorSchema.safeParse(JSON.parse(String(row.anchor))) : undefined
      const anchored = anchor?.success && anchor.data.runIdHash === createHash('sha256').update(id).digest('hex')
      const settled = receipts.filter(r => intents.some(i => i.intentId === r.intentId && i.escrow?.state !== 'CANCELLED'))
      const done = [...events].reverse().find(e => e.type === 'DONE')
      // A receipt with a missing intent is still evidence of money: never exempt it.
      const orphanReceipt = receipts.some(r => !intents.some(i => i.intentId === r.intentId))
      const chargedIntent = intents.some(i => charged.has(i.status) && i.escrow?.state !== 'CANCELLED')
      const stoppedBeforeAnswer = ['STOPPED','FAILED'].includes(String(row.phase)) && !settled.length && !chargedIntent && !orphanReceipt && !done
      if (anchored) result.anchored++
      else if (stoppedBeforeAnswer) result.stoppedBeforeAnswer++
      else if (terminal && !['active','queued'].includes(String(row.state))) result.audit.unanchored++
      else result.anchorPending++
      result.purchasesSettled += settled.length
      result.refunds += intents.filter(i => i.refund && i.refund.amountMinor > 0).length
      const spent = intents.filter(i => charged.has(i.status)).reduce((n,i) => n+i.amountMinor,0)
      if (settled.length) { result.purchaseRuns++; spends.push(spent) }
      models.push(Number(row.model) / 1_000_000)
      const started = events.length ? Date.parse(events[0].at) : NaN
      if (done && Number.isFinite(started) && Number.isFinite(Date.parse(done.at)) && Date.parse(done.at) >= started) times.push(Date.parse(done.at) - started)
      if (Math.max(spent, Number(row.spent), receipts.reduce((n,r) => n+r.amountMinor,0)) > Number(row.budget)) result.audit.overBudget++
      const duplicateIdentity = intents.some(i => i.runId !== id || (allIntentIds.get(i.intentId) ?? 0) > 1) || new Set(receipts.map(r => r.intentId)).size < receipts.length
      if (orphanReceipt) result.audit.receiptWithoutIntent++
      if (!events.length) { result.audit.unavailable++; if (duplicateIdentity) result.audit.duplicateIntent++; continue }
      result.audit.checked++
      const grants = new Set<string>(), bought = new Set<string>(), authorized = new Set<string>(), explicitBuys = new Set<string>()
      let round = 0, pendingBuy = false, lastIntent: string | undefined, readViolation = false, policyViolation = false, duplicateBuy = false
      for (const event of events) {
        if (event.type === 'DECIDE') round = event.round ?? round+1
        if (event.type === 'BUY') {
          pendingBuy = true
          lastIntent = event.intentId || undefined
          const decision = decisions.find(d => d.round === (event.round ?? round))
          if (!round || (event.round ?? round) !== round || !decision?.rows.some(r => r.verdict === 'BUY' && (decision.selectedSourceKey ? sourceKey(r.candidate) === decision.selectedSourceKey : r.candidate.resourceId === decision.selectedResourceId))) policyViolation = true
          if (lastIntent) {
            if (bought.has(lastIntent) || explicitBuys.has(lastIntent)) duplicateBuy = true
            explicitBuys.add(lastIntent)
          }
        }
        if (event.type === 'PURCHASE' || event.type === 'ESCROW_CREATE') {
          lastIntent = event.intentId || undefined
          if (pendingBuy && lastIntent) { if (bought.has(lastIntent)) duplicateBuy = true; bought.add(lastIntent) }
          const needsDecision = pendingBuy
          pendingBuy = false
          const intent = intents.find(i => i.intentId === lastIntent), decision = decisions.find(d => d.round === round)
          const selected = intent && decision?.rows.some(r => r.verdict === 'BUY' && sameSource(r.candidate,intent) && (decision.selectedSourceKey ? sourceKey(intent) === decision.selectedSourceKey : decision.selectedResourceId === intent.resourceId))
          if (needsDecision && selected && lastIntent) authorized.add(lastIntent)
          if (!intent || !lastIntent || !authorized.has(lastIntent)) policyViolation = true
        }
        if (event.type === 'GRANT' && event.intentId) { grants.add(event.intentId); lastIntent ??= event.intentId }
        // Legacy phase traces omit data.intentId; PURCHASE/ESCROW_CREATE supplies the same trace's identity.
        if (event.type === 'READ_PAID' && !grants.has(event.intentId || lastIntent || '')) readViolation = true
      }
      if (readViolation) result.audit.readBeforeGrant++
      if (policyViolation || intents.some(i => charged.has(i.status) && !authorized.has(i.intentId))) result.audit.buyWithoutPolicy++
      if (duplicateBuy || duplicateIdentity) result.audit.duplicateIntent++
    }
    result.timing = { samples: times.length, medianMs: median(times), p90Ms: times.length ? times[Math.ceil(times.length * .9)-1] : null }
    result.medianSpendMinor = median(spends); result.medianModelUsd = median(models)
    return result
  })
}

/** Mounted before the session/admission middleware. This router owns only one exact, read-only, aggregate URL. */
export function sandboxStatsRouter(store: Store, now: () => number = Date.now) {
  const router = Router({ caseSensitive: true, strict: true })
  let cache: { expires: number; body: SandboxStats } | undefined
  router.get('/api/demo/stats', (req,res) => {
    if (Object.keys(req.query).length) { res.status(404).json({ error: 'Not found.' }); return }
    const at = now()
    try {
      if (!cache || at >= cache.expires) cache = { expires: at+60000, body: aggregateSandbox(store,at) }
    } catch { res.status(503).json({ error: 'Sandbox numbers are unavailable.' }); return }
    res.set({ 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' }).json(cache.body)
  })
  router.all('/api/demo/stats', (_req,res) => res.set('Allow','GET, HEAD').status(405).json({ error: 'Method not allowed.' }))
  return router
}
