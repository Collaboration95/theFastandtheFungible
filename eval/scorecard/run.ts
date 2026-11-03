import { readReliability } from './chaos.js'
import dotenv from 'dotenv'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateBank, sweepBank, forceFixtureResearch, planProduction } from '../decisions/offline.js'
import { productionProvider } from '../decisions/providers/production.js'
import { assertNoSecrets, enableLive, secret, type CallRecord } from '../decisions/transport.js'
import { runCoverage } from '../coverage/run.js'
import { loadBank } from '../questions/bank.js'
import { buildSnapshots } from '../coverage/snapshots.js'
import { loadWorld } from '../decisions/world.js'
import { auditRuns, readRuns } from '../../scripts/gate-audit.js'
import { qualityMetrics, timings, deltas, reportDeltas, type Quality } from './metrics.js'
import { frozenInputs, sha256, SAMPLE } from './frozen.js'
import { bootstrapQuality } from './uncertainty.js'
import { measureLatency } from './latency.js'

type Scorecard = { schema: string; at: string; commit: string; inputHash: string; mode: 'fixture' | 'LIVE'; quality: Quality; [key: string]: unknown }
const historyFile = 'eval/scorecard/history.jsonl'
export function history(): Scorecard[] { return existsSync(historyFile) ? readFileSync(historyFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [] }
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

export async function run() {
  const chaosAt = process.argv.indexOf('--chaos-evidence'), soakAt = process.argv.indexOf('--soak-evidence')
  if (soakAt >= 0 && chaosAt < 0) throw new Error('--soak-evidence requires --chaos-evidence')
  const reliability = chaosAt < 0 ? null : readReliability(process.argv[chaosAt+1], soakAt < 0 ? undefined : process.argv[soakAt+1])
  if (process.argv.includes('--reliability-only')) {
    if (!reliability || ['--check','--live','--compare','--plan'].some(flag => process.argv.includes(flag))) throw new Error('--reliability-only requires evidence and cannot run or bypass quality checks')
    console.log(JSON.stringify({ reliability, quality: 'not evaluated' },null,2))
    console.log('| Historical fixture reliability | Observation |\n|---|---:|')
    for (const key of ['chaosPassRatePct','doubleCharges','soakP95DriftMs'] as const) console.log(`| ${key} | ${reliability[key] ?? 'null'} |`)
    return
  }
  const realFetch = globalThis.fetch
  const live = process.argv.includes('--live'), planOnly = process.argv.includes('--plan')
  if (!live) globalThis.fetch = (async (url, init) => {
    if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(String(url))) throw new Error('Fixture scorecard forbids external network')
    return realFetch(url, init)
  }) as typeof fetch
  forceFixtureResearch()
  Object.assign(process.env, { DECISION_PROVIDER: 'openai', DECISION_MODEL: 'gpt-6-luna', DECISIONS_WORDING: 'evidence', DECISIONS_GAP_WORDING: 'plain', DECISIONS_MAX_QUESTIONS: '25', EVAL_DECISION_TIMEOUT_MS: '5000', SEARCH_EMBEDDINGS: 'off', SETTLEMENT_RAIL: 'simulated', BUY_THRESHOLD: '' })
  delete process.env.DECISION_CALIBRATION
  const splitArg = process.argv.indexOf('--split')
  const split = splitArg < 0 ? 'all' : process.argv[splitArg + 1]
  if (!['all', 'dev', 'heldout'].includes(split)) throw new Error('--split is all, dev or heldout')
  const protocol = read('eval/scorecard/receipt-split.json')
  const families: string[] | undefined = split === 'all' ? undefined : protocol[split + 'Families']
  const selectedIds: string[] | undefined = split === 'all' ? undefined : protocol[split + 'Ids']
  const ids = loadBank().questions.filter(q => selectedIds ? selectedIds.includes(q.id) : !families || families.includes(q.lane)).map(q => q.id)
  const policy = process.env.DECISION_NUMBERS_POLICY !== 'off' ? 'receipt-value/v1+scope/v3+extraction/v3' : process.env.DECISION_SCOPE_POLICY === 'off' ? 'receipt-value/v1' : 'receipt-value/v1+scope/v1'
  const inputs = await frozenInputs(), frozen = read('eval/scorecard/frozen.json')
  if (JSON.stringify(inputs) !== JSON.stringify(frozen)) throw new Error('Frozen eval inputs/prompts changed. Version and review a new eval set before comparing scores.')
  const inputHash = sha256(JSON.stringify(inputs))
  const previous = history()
  const compareAt = process.argv.indexOf('--compare'), reference = compareAt < 0 ? undefined : process.argv[compareAt + 1]
  const baseline = reference ? previous.filter(r => (r.split ?? 'all') === split && (r.policy ?? 'baseline') === policy && r.mode === (live ? 'LIVE' : 'fixture') && (r.commit.startsWith(reference) || r.at.startsWith(reference))).at(-1) : previous.filter(r => (r.split ?? 'all') === split && (r.policy ?? 'baseline') === policy && r.mode === (live ? 'LIVE' : 'fixture') && r.inputHash === inputHash).at(-1)
  if (reference && (!baseline || baseline.inputHash !== inputHash)) throw new Error('No comparable history row for --compare (same mode and frozen inputs required)')
  const cap = Number(process.env.EVAL_SPEND_CAP_USD ?? 1)
  if (!Number.isFinite(cap) || cap <= 0 || cap > 1) throw new Error('Scorecard EVAL_SPEND_CAP_USD must be > 0 and <= 1')
  process.env.EVAL_SPEND_CAP_USD = String(cap)
  if (live || planOnly) {
    const flow = await planProduction({ sweep: false, ids }), sweep = await planProduction({ sweep: true, ids })
    const coverageCalls = (await buildSnapshots(await loadWorld(), { ...loadBank(), questions: loadBank().questions.filter(q => ids.includes(q.id)) })).length
    const forecast = { flow, sweep, coverageCalls, latencyQueries: SAMPLE.length, latencyCallsUpperBound: SAMPLE.length * 20, maxCalls: Number(flow.maxCalls) + Number(sweep.exactCalls) + coverageCalls + SAMPLE.length * 20, estimatedUsd: Number(flow.estimatedUsd && typeof flow.estimatedUsd === 'object' ? flow.estimatedUsd.max : 0) + Number(sweep.estimatedUsd) + 0.02 + 0.1, capUsd: cap,
      substitutions: 'fixture writer/planner, keyword search, simulated payments; LIVE decision + coverage only', settlement: 'SIMULATED, zero Testnet drops or real funds' }
    console.log('Pre-run call/cost forecast: ' + JSON.stringify(forecast))
    if (planOnly) return
    // LIVE=1 explicitly authorizes local evaluation calls. Prefer isolated EVAL credentials,
    // otherwise use the owner's local key without loading wallet seeds or the whole .env.
    if (process.env.EVAL_LIVE === '1' && !secret('EVAL_OPENAI_API_KEY')) {
      const local = existsSync('.env') ? dotenv.parse(readFileSync('.env')) : {}
      process.env.EVAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY || local.OPENAI_API_KEY || ''
    }
    if (!secret('EVAL_OPENAI_API_KEY')) throw new Error('LIVE not run: missing EVAL_OPENAI_API_KEY or local OPENAI_API_KEY')
    enableLive()
  } else console.log('Forecast: fixture, 0 provider calls, US$0; simulated payments only.')
  const at = new Date().toISOString(), dir = resolve('eval/scorecard/out', at.replaceAll(':', '-') + (live ? '-live' : '-fixture'))
  mkdirSync(dir, { recursive: true })
  process.env.EVAL_OUT = dir // Fresh cache/meter: a repeated nightly run must measure new calls.
  const provider = live ? productionProvider({ phase: 'scorecard-flow' }) : undefined
  console.log('Running requested-fact flow, sweep, then coverage…')
  const flowDataset: import('../decisions/dataset.js').DatasetRow[] = []
  const flow = await evaluateBank({ provider, ids, flow: 'requested', paidRelevance: false, dataset: flowDataset })
  const sweep = await sweepBank({ ids, provider: live ? productionProvider({ phase: 'scorecard-sweep' }) : undefined })
  const arm = live ? 'luna' : 'fixture'
  const coverage = await runCoverage([arm], { ids })
  if (flow.results.some(r => r.error || r.stop === 'decision-unavailable' || r.rounds.some(x => x.fallback)) || sweep.questions.some(q => q.facts.some(f => f.error)) || coverage.results[arm].metrics.errors || coverage.results[arm].metrics.unparsed) {
    const failureFile = join(dir, 'failed-evaluation.json')
    writeFileSync(failureFile, JSON.stringify({ inputHash, flow, sweep, coverage }, null, 2) + '\n')
    assertNoSecrets([failureFile])
    throw new Error(`Evaluation has failed rounds or unparsed judgments; no baseline published. Details: ${failureFile}`)
  }
  const world = await loadWorld(), bank = loadBank()
  const timingIds = SAMPLE.some(id => ids.includes(id)) ? SAMPLE.filter(id => ids.includes(id)) : ids.slice(0, SAMPLE.length)
  const sample = timingIds.map(id => { const q = bank.questions.find(q => q.id === id); if (!q) throw new Error(`Missing frozen sample ${id}`); return q })
  console.log('Measuring 10 API queries and cold start on ephemeral ports…')
  const latency = await measureLatency(dir, sample, world, live)
  writeFileSync(join(dir, 'operations.json'), JSON.stringify(latency.operations, null, 2) + '\n')
  const measuredRuns = readRuns(latency.dbPath)
  if (live && measuredRuns.some(r => r.events.some(e => e.type === 'DECISION_UNAVAILABLE') || r.checkpoint.coverage?.some(c => c.error))) throw new Error('Live timing run has failed model judgments; no baseline published')
  const audit = auditRuns(measuredRuns, world.corpus, latency.observations)
  const cache = join(dir, 'cache')
  const calls: CallRecord[] = existsSync(cache) ? readdirSync(cache).filter(f => f.endsWith('.json')).map(f => read(join(cache, f))) : []
  if (!live && calls.length) throw new Error('Fixture run made provider calls')
  const latencyCalls = calls.filter(c => c.phase === 'latency')
  const usd = (records: CallRecord[]) => records.reduce((s, c) => s + c.usd, 0)
  const quality = qualityMetrics(flow.results, sweep.dataset, coverage.results[arm].metrics.falseComplete)
  const scorecard = { schema: 'tftf.scorecard/v1', at, split, policy, worktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim()), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), inputHash, mode: live ? 'LIVE' as const : 'fixture' as const,
    labels: { ...flow.labels, timing: live ? 'LIVE decision; fixture writer/planner; SIMULATED settlement' : 'fixture; measured wall clock', corpus: 'synthetic demo articles', boot: latency.boot },
    quality, confidenceIntervals: bootstrapQuality(flow.results, sweep.dataset, bank.questions), timing: { ...timings(latency.samples), coldStartMs: latency.coldStartMs, node: process.version, platform: process.platform, observations: latency.samples },
    cost: { providerCalls: calls.length, estimatedUsageCalls: calls.filter(c => c.estimatedUsage).length, inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0), outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0), modelUsd: usd(calls), latencyModelUsdPerQuery: sample.length ? usd(latencyCalls) / sample.length : null, flowDecisionUsdPerQuery: usd(calls.filter(c => c.phase === 'scorecard-flow')) / ids.length, xrpDropsSpent: measuredRuns.flatMap(r => r.receipts).reduce((s, r) => s + Number(r.xrpl?.amountDrops ?? 0), 0), simulatedMinorSpent: flow.summary.overall.spentMinor, rates: 'eval/decisions/transport.ts (8 Oct 2026 rates; usage-derived estimate, not an invoice)' },
    audit, external: { reliability, mcpE2e: null, dmgColdStartMs: null }, counts: { questions: flow.results.length, coverageSnapshots: coverage.snapshots, requestedFacts: flow.summary.overall.requestedFacts },
  }
  const comparison = baseline ? deltas(quality, baseline.quality) : []
  const local = join(dir, 'report.json')
  const observationsFile = join(dir, 'observations.jsonl')
  writeFileSync(observationsFile, latency.observations.map(o => JSON.stringify(o)).join('\n') + '\n')
  writeFileSync(local, JSON.stringify({ scorecard, flow, sweep, coverage, comparison, flowDataset }, null, 2) + '\n')
  assertNoSecrets([local, observationsFile])
  // Failures never enter the committed baseline/history.
  if (audit.total) { console.log(JSON.stringify(audit)); throw new Error('Hard-gate audit failed; see local report') }
  if (process.argv.includes('--check') && !baseline) throw new Error('No matching fixture baseline for regression check')
  if (process.argv.includes('--check') && comparison.some(d => d.regression)) throw new Error('Fixture quality regression >10%: ' + JSON.stringify(comparison.filter(d => d.regression)))
  const text = JSON.stringify(scorecard)
  writeFileSync('eval/scorecard/latest.json', JSON.stringify(scorecard, null, 2) + '\n')
  appendFileSync(historyFile, text + '\n')
  console.log(`\n| Metric | ${scorecard.mode} · ${scorecard.commit.slice(0, 8)} |\n|---|---:|`)
  for (const [key, value] of Object.entries({ ...quality, ...timings(latency.samples), coldStartMs: latency.coldStartMs, providerCalls: calls.length, modelUsd: usd(calls), modelUsdPerQuery: sample.length ? usd(latencyCalls) / sample.length : null, xrpDropsSpent: 0, hardGateViolations: audit.total })) console.log(`| ${{ wastedSpendPct: 'Wasted gross spend (%)', netWastedSpendPct: 'Wasted net spend after confirmed refunds (%)', usedSpendPct: 'Gross spend buying a final-used fact (%)' }[key] ?? key} | ${value === null ? 'null' : value} |`)
  if (reference && baseline) console.log('Deltas: ' + JSON.stringify(reportDeltas(scorecard, baseline)))
  console.log(`History appended; raw evidence: ${local}`)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await run()
