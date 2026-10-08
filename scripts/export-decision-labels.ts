// Label flywheel (#203): one row per purchase intent, built only from what the app store already holds
// (run snapshots, decision rows, intents, answers, REPUTATION events). The database is opened read-only
// and the queries never touch the tables that hold delivered bytes or tokens (grants, grant_salts,
// receipts, submissions), so no premium text can leave the grant path through this export.
//
//   npm run eval:labels -- [--db data/app.db] [--out labels.jsonl]
import { writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import type { Answer, DecisionRound, PurchaseIntent, RunSnapshot, TraceEvent } from '../shared/contracts/index.js'
import { loadBank, type Question } from '../eval/questions/bank.js'
import { matchQuestion, supportedByClaimText } from '../eval/decisions/facts.js'

/** The only tables read. Anything that stores delivered content or delivery tokens is deliberately absent. */
export const READ_TABLES = ['runs', 'answers', 'decisions', 'intents', 'events'] as const
const PROOF: Partial<Record<PurchaseIntent['status'], string>> = { VERIFIED: 'PASS', REFUNDED: 'REFUNDED', CHALLENGE_REJECTED: 'REJECTED', CHALLENGE_REFUSED: 'REFUSED', CLAIM_FAILED: 'FAILED', CHALLENGED: 'FAILED' }
const UNCHARGED = new Set(['DECIDED', 'QUOTED', 'RESERVED', 'SUBMITTING', 'SKIPPED', 'FAILED_NOT_SETTLED'])

export type LabelRow = {
  runId: string; intentId: string; round: number | null; resourceId: string; version: string; publisherSlug: string | null
  priceMinor: number; status: PurchaseIntent['status']; charged: boolean; refundedMinor: number
  question: string; clarifyAnswers: Record<string, unknown> | null; bankQuestionId: string | null
  modes: { research: string; decision: string; settlement: string; search: string | null }
  pre: null | { provider: string; model: string; threshold: number; gap: string; gapMaterial: number; fallbackReason: string | null; addressesGap: number; original: number; rewrite: number; overlap: number; credibility: number; trust: number | null; value: number; valuePerDollar: number; verdict: string; claimedRelevance: number | null }
  post: { claimedRelevance: number | null; observedRelevance: number | null; calibrationSkipped: string | null }
  proofOutcome: string | null
  reanswer: { beforeVersion: number | null; afterVersion: number | null; citesPurchased: boolean | null; gainedRequestedFacts: string[] | null; gainedSupportedFact: boolean | null; determinable: boolean; method: 'claim-text needles, citing a source article' }
}

const CALIBRATION = /relevance claimed ([\d.]+), observed ([\d.]+)/
export function exportLabels(dbPath: string, questions: Question[] = loadBank().questions): LabelRow[] {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const rows = <T>(sql: string, ...args: string[]) => db.prepare(sql).all(...args).map(r => JSON.parse(r.json as string) as T)
    const out: LabelRow[] = []
    for (const run of rows<RunSnapshot>('SELECT json FROM runs ORDER BY rowid')) {
      const intents = rows<PurchaseIntent>('SELECT json FROM intents WHERE run_id=? ORDER BY rowid', run.runId)
      if (!intents.length) continue
      const answers = rows<Answer>('SELECT json FROM answers WHERE run_id=? ORDER BY version', run.runId)
      const decisions = rows<DecisionRound>('SELECT json FROM decisions WHERE run_id=? ORDER BY round', run.runId)
      const events = rows<TraceEvent>('SELECT json FROM events WHERE run_id=? ORDER BY id', run.runId).filter(e => e.type === 'REPUTATION')
      const clarify = run.checkpoint?.answers && typeof run.checkpoint.answers === 'object' ? run.checkpoint.answers as Record<string, unknown> : null
      const bank = matchQuestion(questions, run.question, clarify ?? undefined)
      const verified = intents.filter(i => i.status === 'VERIFIED')
      const used = new Map<string, number>()
      for (const intent of intents) {
        const round = Number(intent.intentId.split(':').at(-3))
        const decision = decisions.find(d => d.round === round)
        const row = decision?.rows.find(r => r.candidate.resourceId === intent.resourceId && r.candidate.version === intent.version)
        const candidate = row?.candidate ?? run.candidates.find(c => c.resourceId === intent.resourceId && c.version === intent.version)
        const slug = candidate?.publisherSlug ?? candidate?.profileId ?? null
        const claimed = candidate?.manifest?.relevance ?? candidate?.relevance ?? null
        // Calibration runs once per verified purchase, in order: the k-th calibration event for a publisher is its k-th verified purchase.
        let observed: number | null = null, claimedPost: number | null = null, skipped: string | null = null
        if (intent.status === 'VERIFIED' && slug) {
          const mine = events.filter(e => (e.data as { publisherSlug?: string } | undefined)?.publisherSlug === slug && (CALIBRATION.test(e.label) || Boolean((e.data as { skipped?: boolean }).skipped)))
          const event = mine[used.get(slug) ?? 0]
          used.set(slug, (used.get(slug) ?? 0) + 1)
          const m = event?.label.match(CALIBRATION)
          if (m) { claimedPost = Number(m[1]); observed = Number(m[2]) } else if (event) skipped = event.label
        }
        // Answers: v1 is the free answer; the j-th verified purchase (in round order) produced version j + 2.
        const j = verified.indexOf(intent)
        const before = j >= 0 ? answers.find(a => a.version === j + 1) : undefined
        const after = j >= 0 ? answers.find(a => a.version === j + 2) : undefined
        const determinable = Boolean(bank && before && after)
        const gained = determinable ? supportedByClaimText(after, bank!).filter(id => !supportedByClaimText(before, bank!).includes(id)) : null
        out.push({
          runId: run.runId, intentId: intent.intentId, round: Number.isFinite(round) ? round : null, resourceId: intent.resourceId, version: intent.version, publisherSlug: slug,
          priceMinor: intent.amountMinor, status: intent.status, charged: !UNCHARGED.has(intent.status), refundedMinor: intent.refund?.amountMinor ?? 0,
          question: run.question, clarifyAnswers: clarify, bankQuestionId: bank?.id ?? null,
          modes: { research: run.labels.research, decision: run.labels.decision, settlement: run.labels.settlement, search: run.labels.search ?? null },
          pre: decision && row ? { provider: decision.provider, model: decision.model, threshold: decision.threshold, gap: decision.gap, gapMaterial: decision.gapMaterial, fallbackReason: decision.fallbackReason ?? null,
            addressesGap: row.judgment.addressesGap, original: row.judgment.originality.original, rewrite: row.judgment.originality.rewrite, overlap: row.judgment.originality.overlap, credibility: row.judgment.credibility,
            trust: row.reputation?.T ?? null, value: row.value, valuePerDollar: row.valuePerDollar, verdict: row.verdict, claimedRelevance: claimed } : null,
          post: { claimedRelevance: claimedPost, observedRelevance: observed, calibrationSkipped: skipped },
          proofOutcome: PROOF[intent.status] ?? null,
          reanswer: { beforeVersion: before?.version ?? null, afterVersion: after?.version ?? null, citesPurchased: after ? after.claims.some(c => c.citations.some(r => r.resourceId === intent.resourceId && r.version === intent.version)) : null,
            gainedRequestedFacts: gained, gainedSupportedFact: gained ? gained.length > 0 : null, determinable, method: 'claim-text needles, citing a source article' },
        })
      }
    }
    return out
  } finally { db.close() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
  const rows = exportLabels(arg('--db') ?? process.env.APP_DB ?? 'data/app.db')
  const text = rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
  const out = arg('--out')
  if (out) writeFileSync(out, text); else process.stdout.write(text)
  console.error(JSON.stringify({ rows: rows.length, charged: rows.filter(r => r.charged).length, withObserved: rows.filter(r => r.post.observedRelevance !== null).length, determinable: rows.filter(r => r.reanswer.determinable).length, gained: rows.filter(r => r.reanswer.gainedSupportedFact).length }))
}
