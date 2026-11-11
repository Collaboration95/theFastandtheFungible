// Proof of refusal (lane W1): a shareable, sanitized, immutable record that an agent looked at paid sources,
// bought none, and spent nothing, anchored on XRPL Testnet. Pure rules here; storage in server/refusal-proof.ts,
// page in server/proof-page.ts. Shared by the server (authority) and the web app (wording only).
import { z } from 'zod'
import { LedgerAnchorSchema } from './contracts/anchor.js'
import { ReceiptBundleSchema } from './contracts/receipts.js'
import { XRPL_LABEL } from './contracts/publisher.js'
import { LlmProviderSchema } from './contracts/answer.js'
import type { DecisionRow, RunSnapshot } from './contracts/index.js'
import { anchorProgress } from './anchor-status.js'
import { declineSummary } from './decline.js'

export const PROOF_VERSION = 'refusal-proof-v1'
export const PROOF_ID = /^[a-f0-9]{32}$/
/** A snapshot is at most this large, receipts included. A refusal is 4-125 KiB with the offline planner and grows with every
 * article a live plan finds (signed manifests) and every free source it reads, so the cap leaves room for a broad question
 * (R8-B; was 256 KiB). 400 proofs at the cap are still under 300 MB. */
export const PROOF_MAX_BYTES = 768 * 1024
/** Hosted retention: the shared demo's providers end 20 Nov 00:00 SGT and its VM stops at 20 Nov 00:30 SGT, so a proof page is promised
 * only "through 19 November 2026" (the end of 19 Nov SGT). Nothing says it stays up after that. */
export const HOSTED_PROOF_RETAIN_UNTIL = '2026-11-19T16:00:00Z'
/** The words the confirm dialog uses for that promise; a test pins them to HOSTED_PROOF_RETAIN_UNTIL so the two cannot drift apart. */
export const HOSTED_PROOF_PROMISE = 'through 19 November 2026'
export const HOSTED_PROOFS_PER_SESSION = 5
export const HOSTED_PROOFS_TOTAL = 400
/** An anchor not recorded this long after the run ended is reported as missing (it is still picked up if it lands later). */
const ANCHOR_WAIT_MS = 120_000
/** The same refusal the hosted gateway applies to questions: keys and email addresses are never published. */
export const PRIVATE_QUESTION = /-----BEGIN .*PRIVATE KEY|\b(?:sk-|ra_agent_)[A-Za-z0-9_-]{16,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export type ProofBlockCode = 'not_finished' | 'purchased' | 'no_budget' | 'answered' | 'near_match' | 'simulated' | 'anchor_pending' | 'anchor_missing' | 'private_question' | 'too_large' | 'verification_failed'
export type Eligibility = { ok: true } | { ok: false; code: ProofBlockCode; message: string }

const NEAR_STOP = new Set('what which how does did can could should would will are was were the and for with from our your its this that these those when where why who whom not has have had been being into than then over about after before'.split(' '))
/** Content words of a question or title, folded so "injected" and "injection" meet. */
const nearTerms = (text: string) => new Set((text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]+/g) ?? [])
  .filter(word => word.length >= 3 && !NEAR_STOP.has(word)).map(word => word.replace(/(?:ations?|ions?|ings?|ed|es|s)$/, '').slice(0, 6)))
/** A paid article whose title is nearly the question itself and that the decision model still declined as "wouldn't add enough".
 * Publishing that as a refusal would show a reader a decline they can see was wrong, so it is not offered (H8-08). */
export function nearMatchDecline(run: Pick<RunSnapshot, 'question' | 'decisions'>): string | undefined {
  const asked = nearTerms(run.question)
  for (const round of run.decisions) for (const row of round.rows) {
    if (row.verdict !== 'SKIP_LOW_VALUE' || row.candidate.tier !== 'PAID') continue
    const title = nearTerms(row.candidate.title), shared = [...title].filter(term => asked.has(term)).length
    if (shared >= 4 && shared / title.size >= 0.6) return row.candidate.title
  }
}

/** Why a run can or cannot be shared as a proof of refusal. Words are for the visitor; codes are for tests and the API. */
export function refusalEligibility(run: RunSnapshot, now = Date.now()): Eligibility {
  const no = (code: ProofBlockCode, message: string): Eligibility => ({ ok: false, code, message })
  if (run.phase !== 'DONE') return no('not_finished', 'Sharing opens when the run has finished.')
  if (run.spentMinor > 0 || run.reservedMinor > 0 || run.receipts.length || run.grants.length || run.intents.some(intent => intent.status !== 'SKIPPED')) {
    return no('purchased', 'This run paid a writer, so it is not a refusal.')
  }
  // A Free question had no spending authority, so there was no purchase to refuse. The public page says the agent
  // "judged none worth buying", which a S$0 budget can't show (H5: offered live on a Free question).
  if (run.budgetMinor === 0) return no('no_budget', 'This question had no budget, so there was nothing to refuse. Ask with a budget to share a proof of refusal.')
  if (run.answers.some(answer => answer.claims.length > 0)) return no('answered', 'This run answered from free sources, so there is no refusal to prove.')
  if (nearMatchDecline(run)) return no('near_match', 'Not offered: the closest article looked relevant but scored below the bar, so this refusal wouldn’t be a fair example. Try asking it another way.')
  if (run.labels.settlement !== XRPL_LABEL) return no('simulated', 'Simulated payments leave nothing on the ledger, so there is nothing to prove. Use XRPL Testnet to share a refusal.')
  if (PRIVATE_QUESTION.test(run.question)) return no('private_question', 'The question looks like it contains a key or an email address, so it can’t be published.')
  if (!run.ledgerAnchor) {
    const ended = Date.parse(run.events.at(-1)?.at ?? '')
    if (anchorProgress(run.events)?.kind === 'failed' || (Number.isFinite(ended) && now - ended > ANCHOR_WAIT_MS)) return no('anchor_missing', 'No ledger anchor is recorded for this run, so it can’t be shared.')
    return no('anchor_pending', 'Sharing opens once the answer is anchored on XRPL, usually within a minute.')
  }
  return { ok: true }
}

/** Plain words for a decision verdict. The enum codes and scores stay in the app’s Show work. */
export const VERDICT_WORDS: Record<string, string> = {
  SKIP_LOW_VALUE: 'Wouldn’t add enough', SKIP_LOW_TRUST: 'Writer didn’t meet the trust checks', SKIP_OVER_CAP: 'Over the per-article cap',
  SKIP_OVER_BUDGET: 'Over the budget left', SKIP_REWRITE: 'Repeats what is already known', SKIP_NO_GAP: 'Nothing left to fill', NOT_JUDGED: 'Not needed',
}
/** An article the topic guard turned away, or one that says nothing about the question at all, is "not about this question". It is
 * never described as repeating what is known: that sentence is only true of a real rewrite of evidence the run already holds. */
export const TOPIC_MISS_WORDS = 'Not about this question'
export function verdictWords(row: Pick<DecisionRow, 'verdict' | 'reason' | 'judgment'> & { candidate: Pick<DecisionRow['candidate'], 'derivedFrom'> }): string {
  const topicGuard = /do not cover the requested subject/i.test(row.reason)
  const unrelated = (row.verdict === 'SKIP_REWRITE' || row.verdict === 'SKIP_LOW_VALUE') && row.judgment.addressesGap === 0 && !row.candidate.derivedFrom
  return topicGuard || unrelated ? TOPIC_MISS_WORDS : VERDICT_WORDS[row.verdict] ?? VERDICT_WORDS.NOT_JUDGED
}

/** The team's two writers are one author: "ResearchAgent builders", labelled the same way wherever a proof names them. Other writers keep their own name. */
export const TEAM_WRITER_NAME = 'ResearchAgent builders (team-authored)'
export const proofWriter = (publisher: string) => /^ResearchAgent builders\b/.test(publisher) ? TEAM_WRITER_NAME : clip(publisher.split(' · ')[0], 120)

export const ProofItemSchema = z.object({ title: z.string().max(200), writer: z.string().max(120), priceMinor: z.number().int().nonnegative(), verdict: z.string().max(80) })
// Only the server parses stored snapshots; browser imports use the wording helpers below.
export const ProofSnapshotSchema = /* @__PURE__ */ (() => z.object({
  version: z.literal(PROOF_VERSION),
  id: z.string().regex(PROOF_ID),
  createdAt: z.string(),
  question: z.string().min(1).max(2000),
  askedAt: z.string(),
  environment: z.object({ surface: z.enum(['hosted', 'local']), network: z.literal('XRPL Testnet'), models: z.enum(['live', 'fixture']), label: z.string().max(160),
    research: z.object({ provider: LlmProviderSchema, fallback: z.boolean() }).optional(),
  }),
  outcome: z.object({ summary: z.string().max(240) }),
  found: z.object({ paid: z.number().int().nonnegative(), free: z.number().int().nonnegative(), writers: z.number().int().nonnegative(), items: z.array(ProofItemSchema).max(12), more: z.number().int().nonnegative() }),
  bought: z.object({ count: z.literal(0), spentMinor: z.literal(0), currency: z.literal('SGD') }),
  anchor: LedgerAnchorSchema,
  verification: z.object({ ok: z.literal(true), passed: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), total: z.number().int().positive(), at: z.string() }),
  bundle: ReceiptBundleSchema,
}))()
export type ProofSnapshot = z.infer<typeof ProofSnapshotSchema>
export type ProofItem = z.infer<typeof ProofItemSchema>

export const explorerTx = (hash: string) => `https://testnet.xrpl.org/transactions/${hash}`
export const sgd = (minor: number) => `S$${(minor / 100).toFixed(2)}`
/** One line for page titles, descriptions and cards. */
export const clip = (text: string, max: number) => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…` }

/** The public facts of a finished refusal, from the run the server just read. Free text from models never enters. */
export function describeRefusal(run: Pick<RunSnapshot, 'candidates' | 'decisions'>): { summary: string; found: ProofSnapshot['found'] } {
  const paid = run.candidates.filter(candidate => candidate.tier === 'PAID')
  const verdicts = new Map<string, string>()
  for (const round of run.decisions) for (const row of round.rows) {
    const key = `${row.candidate.profileId}/${row.candidate.resourceId}@${row.candidate.version}`
    if (!verdicts.has(key) || row.verdict !== 'BUY') verdicts.set(key, verdictWords(row))
  }
  const items = paid.map(candidate => ({
    title: clip(candidate.title, 200), writer: proofWriter(candidate.publisher), priceMinor: candidate.price.amountMinor,
    verdict: verdicts.get(`${candidate.profileId}/${candidate.resourceId}@${candidate.version}`) ?? VERDICT_WORDS.NOT_JUDGED,
  }))
  const writers = new Set(paid.map(candidate => candidate.publisherSlug ?? candidate.publisher)).size
  return {
    summary: declineSummary(run),
    found: { paid: paid.length, free: run.candidates.length - paid.length, writers, items: items.slice(0, 12), more: Math.max(0, items.length - 12) },
  }
}
