// Writes the README scorecard table from eval/scorecard/latest.json (#272), so numbers are never hand-typed.
// Run: node scripts/readme-scorecard.mjs [--check]   (--check exits 1 if the README table is stale)
// Replaces the text between <!-- scorecard:start --> and <!-- scorecard:end --> in README.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const s = JSON.parse(readFileSync(join(root, 'eval/scorecard/latest.json'), 'utf8'))
const date = s.at.slice(0, 10)
const mode = s.mode.toLowerCase() === 'live' ? 'LIVE decision + coverage; fixture research; simulated payments' : 'fixture'
const tag = `${mode} · ${date}`
const pct = (n) => `${n.toFixed(1)}%`
const ms = (n) => `${Math.round(n)} ms`
const rows = [
  ['Hard-gate violations (six-rule audit)', `${s.audit.total} across ${s.audit.runs} runs, ${s.audit.observations} observations`],
  ['Supported-fact uplift from paying', `+${s.quality.supportedFactUpliftPts.toFixed(1)} pts`],
  ['Purchase-selection F1 (flow / sweep)', `${s.quality.selectionF1Flow.toFixed(2)} / ${s.quality.selectionF1Sweep.toFixed(2)}`],
  ['Wasted spend', pct(s.quality.wastedSpendPct)],
  ['p50 / p95 time to first answer', `${ms(s.timing.p50FirstAnswerMs)} / ${ms(s.timing.p95FirstAnswerMs)}`],
  ['Cold start (demo API + publisher)', ms(s.timing.coldStartMs)],
  ['Model cost per query', s.cost.modelUsd === 0 ? 'US$0 (no provider calls)' : `US$${s.cost.latencyModelUsdPerQuery}`],
]
const table = [
  '| Metric | Latest | Mode · date |',
  '|---|---|---|',
  ...rows.map(([m, v]) => `| ${m} | ${v} | ${tag} |`),
].join('\n')
const block = `<!-- scorecard:start -->\n${table}\n<!-- scorecard:end -->`

const path = join(root, 'README.md')
const md = readFileSync(path, 'utf8')
const a = md.indexOf('<!-- scorecard:start -->')
const b = md.indexOf('<!-- scorecard:end -->')
if (a < 0 || b < 0) throw new Error('README.md has no scorecard markers')
const next = md.slice(0, a) + block + md.slice(b + '<!-- scorecard:end -->'.length)
if (process.argv.includes('--check')) {
  if (next !== md) { console.error('readme-scorecard: README table is stale; run node scripts/readme-scorecard.mjs'); process.exit(1) }
  console.log('readme-scorecard: ok')
} else {
  if (next !== md) writeFileSync(path, next)
  console.log(`readme-scorecard: ${next === md ? 'already current' : 'updated'} (${tag})`)
}
