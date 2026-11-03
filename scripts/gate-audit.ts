import { auditEntries } from '../server/audit.js'
import { auditAgentAuthority } from '../server/agent-audit.js'
import { auditHireRecords, type HireAuditRecord } from '../server/hire/audit.js'
// Read-only audit. Never print evidence bytes, tokens, or private grant payloads.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { SIMULATED_LABEL, XRPL_LABEL, type RunSnapshot } from '../shared/contracts/index.js'
import type { WriterCorpus } from '../shared/contracts/writers.js'
import { assertNoLeaks, type Observation } from '../tests/scenarios/harness.js'

export const RULES = ['citation_without_verified_grant', 'duplicate_settlement', 'over_budget', 'purchase_without_policy', 'premium_leak', 'missing_rail_label', 'royalty_policy', 'money_chain_reconciliation', 'escrow_finish_without_verified_proof', 'agent_authority'] as const
export type Rule = typeof RULES[number]
export type Violation = { rule: Rule; runId: string; evidence: string }
const charged = new Set(['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'])

export function auditRuns(runs: RunSnapshot[], corpus: WriterCorpus, observations: Observation[] = [], hires: HireAuditRecord[] = []) {
  const violations: Violation[] = []
  const add = (rule: Rule, runId: string, evidence: string) => violations.push({ rule, runId, evidence })
  for (const run of runs) {
    const verified = run.grants.filter(g => g.runId === run.runId && run.intents.some(i => i.intentId === g.intentId && i.runId === run.runId && i.status === 'VERIFIED' && (!i.escrow || i.escrow.state === 'RELEASED') && i.resourceId === g.resourceId && i.version === g.version))
    const free = (resourceId: string, version: string) => !corpus.articles.some(a => a.articleId === resourceId && a.version === version && a.tier === 'PAID') && run.candidates.some(c => c.resourceId === resourceId && c.version === version && c.tier === 'FREE')
    for (const answer of run.answers) for (const claim of answer.claims) for (const c of claim.citations) {
      const accessible = run.contents.find(x => x.resourceId === c.resourceId && x.version === c.version && x.spans.some(s => s.id === c.spanId && x.body.includes(s.text)))
      if (!accessible || !free(c.resourceId, c.version) && !verified.some(g => g.resourceId === c.resourceId && g.version === c.version)) add('citation_without_verified_grant', run.runId, `answer v${answer.version}, resource ${c.resourceId}@${c.version}`)
    }
    for (const intent of run.intents) {
      const e = intent.escrow
      const finished = e?.finishHash || e?.state === 'RELEASED' || run.events.some(v => v.type === 'ESCROW_FINISH' && v.data?.intentId === intent.intentId)
      if (e && (finished && e.proofOk !== true || intent.status === 'VERIFIED' && e.state !== 'RELEASED')) add('escrow_finish_without_verified_proof', run.runId, intent.intentId)

      const receipts = run.receipts.filter(r => r.intentId === intent.intentId)
      // Repeated observations of the SAME receipt/transaction are retries, not new charges.
      const receiptHashes = receipts.map(r => r.xrpl?.txHash ?? r.receiptId.replace(/^x402-/, ''))
      const eventHashes = run.events.filter(e => e.type === 'XRPL' && e.data?.intentId === intent.intentId && /issued a receipt/.test(e.label)).map(e => String(e.data?.txHash))
      if (new Set([...receiptHashes, ...eventHashes]).size > 1 || receipts.length > 1) add('duplicate_settlement', run.runId, intent.intentId)
      const purchaseEvents = run.events.filter(e => e.type === 'PURCHASE' && e.data?.intentId === intent.intentId)
      const decision = run.decisions.find(d => d.selectedResourceId === intent.resourceId && d.rows.some(r => r.candidate.resourceId === intent.resourceId && r.candidate.version === intent.version && r.verdict === 'BUY') && intent.intentId === `${run.runId}:${d.round}:${intent.resourceId}:${intent.version}`)
      // Legacy BUY/DECIDE traces have no intentId: bind them by the persisted round and event order.
      const decides = run.events.filter(e => e.type === 'DECIDE')
      const decide = decision && decides[decision.round - 1], next = decision && decides[decision.round]
      const buy = decide && run.events.find(e => e.type === 'BUY' && e.id > decide.id && (!next || e.id < next.id))
      if (!decision || !buy || purchaseEvents.some(e => e.id < buy.id)) add('purchase_without_policy', run.runId, intent.intentId)
      if (charged.has(intent.status) && intent.amountMinor > run.perSourceCapMinor) add('over_budget', run.runId, `per-source cap: ${intent.intentId}`)
    }
    for (const event of run.events.filter(e => e.type === 'PURCHASE')) {
      if (!run.intents.some(i => i.intentId === event.data?.intentId)) add('purchase_without_policy', run.runId, `orphan purchase event ${event.id}`)
    }
    // Final state cannot retroactively authorize an earlier SSE snapshot's citations.
    for (const observation of observations.filter(o => o.runId === run.runId && o.kind === 'SSE')) {
      let snapshot: RunSnapshot
      try { snapshot = JSON.parse(observation.raw) } catch { continue }
      if (!Array.isArray(snapshot.answers) || !Array.isArray(snapshot.intents) || !Array.isArray(snapshot.grants)) continue
      for (const answer of snapshot.answers) for (const claim of answer.claims) for (const c of claim.citations) {
        if (!free(c.resourceId, c.version) && !snapshot.grants.some(g => g.runId === run.runId && g.resourceId === c.resourceId && g.version === c.version && snapshot.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))) add('citation_without_verified_grant', run.runId, `SSE answer v${answer.version}, resource ${c.resourceId}@${c.version}`)
      }
    }
    const gross = run.intents.filter(i => charged.has(i.status)).reduce((s, i) => s + i.amountMinor, 0)
    const reserved = run.intents.filter(i => ['RESERVED', 'SUBMITTING'].includes(i.status)).reduce((s, i) => s + i.amountMinor, 0)
    const receiptSpend = run.receipts.reduce((s, r) => s + r.amountMinor, 0)
    if (Math.max(gross + reserved, receiptSpend, run.spentMinor + run.reservedMinor) > run.budgetMinor) add('over_budget', run.runId, 'gross charges plus reservations exceed budget (refunds do not release budget)')
    if (![SIMULATED_LABEL, XRPL_LABEL].includes(run.labels?.settlement) || run.receipts.some(r => r.label !== run.labels.settlement) || run.intents.some(i => i.quote?.payment && (i.quote.payment.network !== 'xrpl:1' || (i.quote.payment.rail === 'simulated' ? SIMULATED_LABEL : XRPL_LABEL) !== run.labels.settlement))) add('missing_rail_label', run.runId, 'missing, unsupported or inconsistent settlement label/network')
    // At-rest metadata and search hits NEVER acquire permission to contain paid text.
    const publicRaw = JSON.stringify({ candidates: run.candidates, decisions: run.decisions, checkpoint: run.checkpoint })
    const checks: Observation[] = [{ kind: 'public metadata', raw: publicRaw, grants: [], runId: run.runId }]
    for (const e of run.events) checks.push({ kind: `event ${e.id}`, raw: JSON.stringify(e), runId: run.runId, grants: verified.filter(g => run.events.some(v => v.type === 'GRANT' && v.id < e.id && v.data?.intentId === g.intentId)) })
    checks.push({ kind: 'stored accessible contents and answers', raw: JSON.stringify({ contents: run.contents, answers: run.answers }), runId: run.runId, grants: verified })
    checks.push(...observations.filter(o => o.runId === run.runId).map(o => ({ ...o, grants: o.grants.filter(g => verified.some(v => v.intentId === g.intentId)) })))
    try { assertNoLeaks(checks, corpus) } catch { add('premium_leak', run.runId, 'raw public metadata, persisted events or wire observation') }
  }
  violations.push(...auditHireRecords(runs, hires).map(v => ({ ...v, rule: v.rule as Rule })))
  return { runs: runs.length, observations: observations.length, violations, total: violations.length, byRule: Object.fromEntries(RULES.map(r => [r, violations.filter(v => v.rule === r).length])) }
}

/** Raw JSON is intentional: Store.getRun/schema parsing would sanitize a corrupt store before auditing. */
export function readRuns(dbPath: string): RunSnapshot[] {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    db.exec('BEGIN')
    const rows = <T>(sql: string, ...args: string[]) => db.prepare(sql).all(...args).map(r => JSON.parse(String(r.json)) as T)
    return rows<RunSnapshot>('SELECT json FROM runs ORDER BY rowid').map(run => ({ ...run,
      answers: rows('SELECT json FROM answers WHERE run_id=? ORDER BY version', run.runId),
      decisions: rows('SELECT json FROM decisions WHERE run_id=? ORDER BY round', run.runId),
      intents: rows('SELECT json FROM intents WHERE run_id=? ORDER BY rowid', run.runId),
      events: rows('SELECT json FROM events WHERE run_id=? ORDER BY id', run.runId),
      receipts: rows('SELECT r.json FROM receipts r JOIN intents i ON i.id=r.intent_id WHERE i.run_id=?', run.runId),
      grants: rows('SELECT g.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?', run.runId),
      contents: [...run.contents, ...db.prepare('SELECT g.content, i.json FROM grants g JOIN intents i ON i.id=g.intent_id WHERE i.run_id=?').all(run.runId).filter(r => JSON.parse(String(r.json)).status === 'VERIFIED').map(r => JSON.parse(String(r.content)))],
    }))
  } finally { db.close() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--db')
  if (i < 0 || !process.argv[i + 1]) throw new Error('Usage: npm run gate:audit -- --db <store>')
  const o = process.argv.indexOf('--observations')
  const observations: Observation[] = o < 0 ? [] : readFileSync(process.argv[o + 1], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const db = new DatabaseSync(process.argv[i + 1], { readOnly: true })
  const hasHires = db.prepare("SELECT name FROM sqlite_master WHERE name='hires'").get()
  const hires = hasHires ? db.prepare('SELECT json FROM hires').all().map(r => JSON.parse(String(r.json)) as HireAuditRecord) : []
  const agentViolations = auditAgentAuthority(auditEntries(db))
  db.close()
  const result = auditRuns(readRuns(process.argv[i + 1]), await loadWriterCorpus(undefined, { allowMini: false }), observations, hires)
  result.violations.push(...agentViolations)
  result.total += agentViolations.length
  result.byRule.agent_authority = agentViolations.length
  console.log(JSON.stringify(result, null, 2))
  if (result.total) process.exitCode = 1
}
