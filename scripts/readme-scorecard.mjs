// Writes the scorecard table in docs/numbers.md from eval/scorecard/latest.json (#272), so numbers are never hand-typed.
// Run: node scripts/readme-scorecard.mjs [--check]   (--check exits 1 if the table is stale)
// Replaces the text between <!-- scorecard:start --> and <!-- scorecard:end --> in docs/numbers.md
// (moved out of README.md when the README became the product page, 11 Nov).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const s = JSON.parse(readFileSync(join(root, 'eval/scorecard/latest.json'), 'utf8'))
const date = s.at.slice(0, 10)
const mode = s.mode.toLowerCase() === 'live' ? 'LIVE decisions + coverage eval; fixture research/flow scoring; simulated payments' : 'fixture'
const fresh = s.evaluationSet === 'fresh-v1'
const tag = `${mode}${fresh ? ` · fresh (${s.counts.questions} questions / 24 new documents)` : ''}${s.split && s.split !== 'all' ? ` · ${s.split === 'heldout' ? 'held-out' : s.split} (${s.counts.questions} questions)` : ''} · ${date}`
const pct = (n) => n == null ? 'unmeasured' : `${n.toFixed(2)}%`
const ci = (key, digits = 1, suffix = '') => { const c = s.confidenceIntervals?.intervals?.[key]; return c && c.low != null ? ` [95% CI ${c.low.toFixed(digits)}–${c.high.toFixed(digits)}${suffix}]` : '' }
const ms = (n) => n == null ? 'unmeasured' : `${Math.round(n)} ms`
const rows = [
  ['**Pitch: gross spend buying a fact used in final answer**', pct(s.quality.usedSpendPct) + ci('usedSpendPct', 2, '%')],

  ['Hard-gate audit violations', `${s.audit.total} across ${s.audit.runs} runs, ${s.audit.observations} observations`],
  ['Supported-fact uplift from paying', `+${s.quality.supportedFactUpliftPts.toFixed(1)} pts${ci('supportedFactUpliftPts', 1, ' pts')}`],
  ['Purchase-selection F1 (flow / sweep)', `${s.quality.selectionF1Flow.toFixed(2)}${ci('selectionF1Flow', 2)} / ${s.quality.selectionF1Sweep.toFixed(2)}${ci('selectionF1Sweep', 2)}`],
  ['Wasted gross spend', pct(s.quality.wastedSpendPct) + ci('wastedSpendPct', 2, '%')],
  ['Wasted net spend (after confirmed refunds)', pct(s.quality.netWastedSpendPct) + ci('netWastedSpendPct', 2, '%')],
  ['p50 / p95 time to first answer', `${ms(s.timing.p50FirstAnswerMs)} / ${ms(s.timing.p95FirstAnswerMs)}`],
  ['Cold start (demo API + publisher)', ms(s.timing.coldStartMs)],
  ['Model cost per query', s.cost.modelUsd === 0 ? 'US$0 (no provider calls)' : `US$${s.cost.latencyModelUsdPerQuery.toFixed(4)}`],
]
const table = [
  '| Metric | Latest | Mode · date |',
  '|---|---|---|',
  ...rows.map(([m, v]) => `| ${m} | ${v} | ${tag} |`),
].join('\n')
const block = `<!-- scorecard:start -->\n${table}\n\nPitch definition: gross cost of verified purchases adding a requested, bank-supported fact retained in the final cited answer, divided by all gross purchase cost. 95% CIs resample source clusters; fixed synthetic corpus and observed model draws. ${fresh ? 'Fresh questions and new documents, frozen before one run per policy; no tuning. Same-vendor synthetic labels, human review pending; source templates are correlated.' : 'Reused question holdout; historical failures were inspected.'} Two separate [live Testnet sanity runs](evidence/numbers-v7-testnet.md) verify the settlement path, not this percentage.\n<!-- scorecard:end -->`

const path = join(root, 'docs/numbers.md')
const md = readFileSync(path, 'utf8')
const a = md.indexOf('<!-- scorecard:start -->')
const b = md.indexOf('<!-- scorecard:end -->')
if (a < 0 || b < 0) throw new Error('docs/numbers.md has no scorecard markers')
const next = md.slice(0, a) + block + md.slice(b + '<!-- scorecard:end -->'.length)
if (process.argv.includes('--check')) {
  if (next !== md) { console.error('readme-scorecard: docs/numbers.md table is stale; run node scripts/readme-scorecard.mjs'); process.exit(1) }
  console.log('readme-scorecard: ok')
} else {
  if (next !== md) writeFileSync(path, next)
  console.log(`readme-scorecard: ${next === md ? 'already current' : 'updated'} (${tag})`)
}

if (fresh) {
  const results = JSON.parse(readFileSync(join(root, 'eval/scorecard/fresh-results.json'), 'utf8'))
  const historical = JSON.parse(readFileSync(join(root, 'eval/scorecard/numbers-v7-results.json'), 'utf8')).after.scorecard
  const cols = [historical, results.before.scorecard, results.after.scorecard]
  const cell = (r, key) => { const c = r.confidenceIntervals.intervals[key]; const n = r.quality[key]; return n == null ? 'unmeasured' : `${n.toFixed(2)} [${c.low.toFixed(2)}, ${c.high.toFixed(2)}]` }
  const comparison = ['| Metric (%, uplift in pts); 95% CI | #324 reused heldout (92) | Fresh main (48) | Fresh generalised (48) |', '|---|---:|---:|---:|', ...[['Final-used gross spend', 'usedSpendPct'], ['Wasted gross spend', 'wastedSpendPct'], ['Wasted net spend', 'netWastedSpendPct'], ['Supported-fact uplift', 'supportedFactUpliftPts']].map(([label, key]) => `| ${label} | ${cols.map(c => cell(c, key)).join(' | ')} |`)].join('\n')
  const u = s.quality.usedSpendPct, c = s.confidenceIntervals.intervals.usedSpendPct
  const claim = `On 48 fresh synthetic questions, ${u.toFixed(2)}% of gross article spend bought a requested fact retained in the final cited answer (95% CI ${c.low.toFixed(2)}–${c.high.toFixed(2)}%).`
  const caveat = 'LIVE decisions/coverage; fixture research, keyword search and SIMULATED payments. Same-vendor labels await human review; structured templates and fixed model draws limit generalisation.'
  const content = `<!-- fresh-scorecard:start -->\nFresh-set recommendation (3 Nov): **${claim}**\n\n${caveat}\n\n${comparison}\n\nNo pooling with the reused holdout. Different-set comparison is descriptive; fresh main/generalised runs use the same frozen set, one run per policy. Evidence: [rule audit](../eval/FRESH-AUDIT.md), [full report](../eval/REPORT-decisions.md).\n<!-- fresh-scorecard:end -->`
  const target = join(root, 'docs/SFF-PUSH.md'), old = readFileSync(target, 'utf8')
  const start = old.indexOf('<!-- fresh-scorecard:start -->'), end = old.indexOf('<!-- fresh-scorecard:end -->')
  const updated = start < 0 ? old.replace('## Hill-climb scorecard', content + '\n\n## Hill-climb scorecard') : old.slice(0, start) + content + old.slice(end + '<!-- fresh-scorecard:end -->'.length)
  if (process.argv.includes('--check')) { if (updated !== old) throw new Error('SFF fresh comparison is stale') } else if (updated !== old) writeFileSync(target, updated)
}
