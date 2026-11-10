// Development comparison of two scripts/k5-dev-measure.ts output directories.
// Policy fields (decisions, purchases, refunds, verdicts, spend) must be identical;
// only lead and conclusion text may differ. Usage:
//   tsx scripts/k5-compare-runs.ts <before-dir> <after-dir> <out.json>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const [beforeDir, afterDir, out] = process.argv.slice(2).map(p => resolve(p))
const read = (dir: string, file: string): Json => JSON.parse(readFileSync(join(dir, file), 'utf8'))
/** Everything that decides what is bought, paid and refunded; never wording, ids or timestamps. */
const policy = ({ result, run }: Json) => ({
  phase: run.phase, round: run.round, spentMinor: run.spentMinor, refundedMinor: run.refundedMinor, reservedMinor: run.reservedMinor,
  buyAndCite: result.buyAndCite, purchases: result.purchases, verificationOk: result.verificationOk, violations: result.violations,
  decisions: run.decisions.map((round: Json) => ({
    round: round.round, gapMaterial: round.gapMaterial, threshold: round.threshold, selected: round.selectedResourceId,
    rows: round.rows.map((row: Json) => ({ resource: `${row.candidate.profileId}/${row.candidate.resourceId}@${row.candidate.version}`, verdict: row.verdict, value: row.value, valuePerDollar: row.valuePerDollar, judgment: row.judgment, wouldBuy: row.wouldBuy, reputation: row.reputation })),
  })),
  intents: run.intents.map((intent: Json) => ({ resource: `${intent.profileId}/${intent.resourceId}@${intent.version}`, amountMinor: intent.amountMinor, status: intent.status })),
  receipts: run.receipts.map((receipt: Json) => ({ resource: `${receipt.resourceId}@${receipt.version}`, status: receipt.status, amountMinor: receipt.amountMinor })),
  grants: run.grants.map((grant: Json) => `${grant.resourceId}@${grant.version}`),
})
const files = readdirSync(beforeDir).filter(f => /^(?:v|uc|presets)[\w-]*-[A-Za-z]*\d+\.json$/.test(f)).sort()
const rows = files.map(file => {
  const before = read(beforeDir, file), after = read(afterDir, file)
  const same = JSON.stringify(policy(before)) === JSON.stringify(policy(after))
  const lead = (r: Json) => (r.result.lead ?? []).map((l: Json) => l.text)
  return { file: file.replace(/\.json$/, ''), policyEqual: same, leadChanged: JSON.stringify(lead(before)) !== JSON.stringify(lead(after)), answersItBefore: before.result.answersIt, answersItAfter: after.result.answersIt, leadBefore: lead(before), leadAfter: lead(after) }
})
const summary = { runs: rows.length, policyIdentical: rows.filter(r => r.policyEqual).length, leadChanged: rows.filter(r => r.leadChanged).length, policyDiffs: rows.filter(r => !r.policyEqual).map(r => r.file) }
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1))
console.log(JSON.stringify(summary))
