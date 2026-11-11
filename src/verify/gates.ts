import { ReceiptBundleSchema, type ReceiptBundle } from '../../shared/contracts/receipts'
import { sameSource, sourceKey } from '../../shared/source-identity'
import type { VerificationCheck } from '../../sdk/verify'

export type GateStatus = 'Held' | 'Not checked' | 'Broken'
export type GateRow = { id: number; title: string; status: GateStatus; seqs: number[]; detail: string; labels?: { name: string; value: string }[] }
type Entry = Extract<ReceiptBundle['audit']['entries'][number], { kind: string }>
const titles = ['No premium bytes before a grant', 'Only policy code spends, within budget', 'One charge per intent', 'Real citations', 'Simulated or substituted work is labelled']
const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** Browser summary only. This does not extend the published TS/Python verifier contracts.
 * Missing historical telemetry is Not checked. In particular final grants cannot prove read order.
 * P4's scoreboard predicates: read/grant order, decision/reservation order and gross budget,
 * unique intents and receipt coverage. Anchoring remains with the existing verifier groups.
 * No network, clock, mutable state, hashing or payment authority lives here.
 */
export function summarizeGates(input: unknown, checks: readonly VerificationCheck[] = []): GateRow[] {
  const parsed = ReceiptBundleSchema.safeParse(input && typeof input === 'object' && 'verification' in input ? input.verification : input)
  const row = (id: number, status: GateStatus, entries: Entry[], detail: string): GateRow => ({ id, title: titles[id - 1], status, seqs: [...new Set(entries.map(e => e.seq))].sort((a, b) => a - b), detail })
  if (!parsed.success) return titles.map((_, index) => row(index + 1, 'Not checked', [], 'No usable receipt bundle.'))
  const b = parsed.data
  const entries = b.audit.entries.filter((e): e is Entry => !('commitment' in e) && e.runId === b.runId).sort((a, c) => a.seq - c.seq)
  const kinds = (...names: string[]) => entries.filter(e => names.includes(e.kind.toLowerCase()))
  const intentOf = (e: Entry) => e.intentId ?? e.data.intentId
  const admissions = kinds('admission'), reserves = kinds('reserve'), decisions = kinds('decision'), settlements = kinds('settle')

  const reads = kinds('read_paid'), grants = kinds('grant')
  const grantEvidence = kinds('grant', 'proof', 'escrow_finish')
  const readBeforeGrant = reads.some(read => {
    const id = intentOf(read)
    const intent = b.intents.find(i => i.intentId === id)
    const finalGrant = b.grants.find(g => g.intentId === id && g.runId === b.runId && intent && sameSource(g, intent))
    const before = grantEvidence.filter(e => intentOf(e) === id && e.seq < read.seq)
    const explicit = before.some(e => e.kind.toLowerCase() === 'grant')
    const proof = before.some(e => e.kind === 'proof' && e.data.verified === true)
    const released = !intent?.escrow || before.some(e => e.kind === 'ESCROW_FINISH' && e.data.proofOk === true)
    return !finalGrant || !(explicit || proof && released)
  })
  const paid = b.intents.length > 0 || b.candidates.some(c => c.tier === 'PAID' && b.sources.some(s => sameSource(c, s)))
  const ordering = row(1, readBeforeGrant ? 'Broken' : reads.length || !paid ? 'Held' : 'Not checked', [...reads, ...grants, ...grantEvidence, ...kinds('deliver')],
    readBeforeGrant ? 'A paid read has no preceding verified grant.' : reads.length ? 'Recorded paid reads follow their grants.' : paid ? 'This export has no paid-read events; final grants do not prove read order.' : 'No paid evidence was read in this bundle.')

  // Deduplicate identical intent records here so a duplicated intent changes gate 3 alone.
  const intents = [...new Map(b.intents.map(i => [i.intentId, i])).values()]
  const budget = admissions.at(0)?.data.admittedMinor ?? reserves.at(0)?.data.runBudgetMinor
  const charged = new Map<string, number>()
  const charge = (tx: string, amount: number) => {
    const key = tx.replace(/^(x402-|escrow-)/, '')
    charged.set(key, Math.max(charged.get(key) ?? 0, amount))
  }
  for (const payment of b.payments.filter(p => p.kind === 'purchase')) if (money(payment.amountMinor)) charge(payment.txHash || payment.intentId, payment.amountMinor)
  for (const receipt of b.receipts) charge(receipt.xrpl?.txHash ?? receipt.receiptId, receipt.amountMinor)
  for (const e of settlements) if (typeof e.data.txHash === 'string' && money(e.data.amountMinor)) charge(e.data.txHash, e.data.amountMinor)
  const chargedStates = ['SETTLED', 'DELIVERY_PENDING', 'DELIVERY_FAILED', 'VERIFIED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED']
  const intentGross = intents.filter(i => chargedStates.includes(i.status)).reduce((sum, i) => sum + i.amountMinor, 0)
  const gross = Math.max(intentGross, [...charged.values()].reduce((sum, amount) => sum + amount, 0))
  const over = money(budget) && (gross > budget || reserves.some(e => money(e.data.amountMinor) && money(e.data.committedMinor) && e.data.committedMinor + e.data.amountMinor > budget))
  const withoutPolicy = reserves.some(reserve => {
    const intent = intents.find(i => i.intentId === intentOf(reserve))
    const decision = decisions.filter(e => e.seq < reserve.seq).at(-1)
    if (!intent || !decision || !money(decision.data.round)) return true
    const expected = intent.source ? JSON.stringify([b.runId, decision.data.round, sourceKey(intent)]) : `${b.runId}:${decision.data.round}:${intent.resourceId}:${intent.version}`
    return intent.intentId !== expected || decision.data.selectedResourceId !== intent.resourceId || !!intent.source && decision.data.selectedSourceKey !== sourceKey(intent) || typeof reserve.data.policyVersion !== 'string'
  })
  const covered = intents.every(i => reserves.some(e => intentOf(e) === i.intentId))
  const policy = row(2, over || withoutPolicy ? 'Broken' : money(budget) && covered ? 'Held' : 'Not checked', [...admissions, ...decisions, ...reserves, ...settlements],
    over ? 'Gross spend or committed funds exceed the admitted budget; refunds do not restore it.' : withoutPolicy ? 'A purchase reservation has no matching preceding policy decision in its round.' : money(budget) && covered ? 'Reservations follow policy decisions; gross spend stays within the admitted budget.' : 'Admission budget or policy reservation evidence is missing.')

  const seen = new Set<string>()
  let duplicateIntent = false
  for (const intent of b.intents) {
    if (seen.has(intent.intentId)) duplicateIntent = true
    seen.add(intent.intentId)
  }
  const receiptIds = b.receipts.map(r => r.intentId), paymentIds = b.payments.filter(p => p.kind === 'purchase').map(p => p.intentId)
  const duplicateCharge = new Set(receiptIds).size !== receiptIds.length || new Set(paymentIds).size !== paymentIds.length || settlements.some(e => settlements.some(other => other !== e && intentOf(other) === intentOf(e) && other.data.txHash !== e.data.txHash))
  const orphan = [...receiptIds, ...paymentIds, ...settlements.map(e => String(intentOf(e)))].some(id => !seen.has(id))
  const once = row(3, duplicateIntent || duplicateCharge || orphan ? 'Broken' : entries.length ? 'Held' : 'Not checked', [...reserves, ...settlements],
    duplicateIntent || duplicateCharge ? 'An intent or charge appears more than once.' : orphan ? 'A receipt has no matching intent.' : 'Intent IDs are unique; each receipt belongs to one intent.')

  // Reuse the citations group, including signature/hash checks, rather than inventing weaker checks.
  const citations = checks.filter(c => c.check.startsWith('citation'))
  const hasCitations = b.answers.some(a => a.claims.some(c => c.citations.length))
  const citationStatus = citations.some(c => c.status === 'FAIL') ? 'Broken' : hasCitations && citations.length && citations.every(c => c.status === 'PASS') ? 'Held' : 'Not checked'
  const real = row(4, citationStatus, kinds('proof', 'answer-anchor'), citationStatus === 'Held' ? 'The existing citations checks passed for delivered, signed passages.' : citationStatus === 'Broken' ? 'The existing citations checks found a mismatch.' : 'No completed citation checks for this bundle.')

  const labels = admissions.flatMap(e => e.data.labels && typeof e.data.labels === 'object' ? Object.entries(e.data.labels).filter((pair): pair is [string, string] => typeof pair[1] === 'string').map(([name, value]) => ({ name, value })) : [])
  const rail = labels.find(l => l.name === 'settlement')?.value
  const missing = ['research', 'decision', 'publisher', 'settlement'].some(name => !labels.some(l => l.name === name && l.value.trim()))
  const mismatched = !!rail && (!b.label.includes(rail) || [...b.receipts, ...b.payments.filter(p => p.kind === 'purchase')].some(r => r.label !== rail))
  const labelled = row(5, mismatched || admissions.length && missing ? 'Broken' : labels.length && b.label.trim() ? 'Held' : 'Not checked', [...admissions, ...kinds('settle', 'decision')],
    mismatched ? 'Settlement labels disagree.' : missing ? 'Run labels are missing from the admission record.' : 'Recorded labels, verbatim; admission labels describe the start of the run.')
  labelled.labels = [...labels, { name: 'Bundle', value: b.label }]
  return [ordering, policy, once, real, labelled]
}
