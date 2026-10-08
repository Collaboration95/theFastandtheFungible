// Live smoke (#158): UC1 → UC2 → UC3 (+ a UC3 re-ask) → UC4 (the focused free search, #211) through the HTTP API on DeepSeek, the configured decision
// provider (DECISION_PROVIDER: cloudflare = Clef, openai = OpenAI Decisions) and XRPL Testnet.
// SPENDS live calls and Testnet XRP: the orchestrator runs it, never CI. `make smoke ARGS="--only UC2"`.
//   --only UC1|UC2|UC3|UC4   run one use case (UC3 includes the SKIP_LOW_TRUST re-ask)
//   --probe              one paid purchase + one forced challenge/refund: UC3 round 1 on its own, no re-ask
// Env: DEMO_PORT_OFFSET (default 300 → 5400/9088/9090; 0 is refused: never the main demo's 5100/8788/8790).
// Writes data/smoke/last.json. Exit 1 when any check fails (fixture fallbacks included).
import { spawn } from 'node:child_process'
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import { liveDecisionProvider } from './stage-checks.mjs'

export const BUDGET = { deepseek: 60, decision: 200 }
const BUDGET_MINOR = 500
const RUN_TIMEOUT_MS = 6 * 60_000
const IDS = ['UC1', 'UC2', 'UC3', 'UC4']
/** UC4's free source that only the focused follow-up search finds, and the paid deep-dive that must not be bought (#211). */
export const UC4_FREE = 'lf-corporate-green-power-round-2026'

export function parseArgs(argv, env = {}) {
  const out = { only: null, probe: false, offset: env.DEMO_PORT_OFFSET === undefined || env.DEMO_PORT_OFFSET === '' ? 300 : Number(env.DEMO_PORT_OFFSET) }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--probe') out.probe = true
    else if (argv[i] === '--only') { out.only = argv[++i]; if (!IDS.includes(out.only)) throw new Error(`--only takes ${IDS.join('|')}`) }
    else throw new Error(`unknown argument ${argv[i]}`)
  }
  if (out.probe && out.only && out.only !== 'UC3') throw new Error('--probe runs UC3 round 1; drop --only or use --only UC3')
  if (!Number.isInteger(out.offset) || out.offset <= 0) throw new Error('DEMO_PORT_OFFSET must be a positive integer: the smoke never uses the main demo ports 5100/8788/8790')
  return out
}

/** The decision label each live provider shows (shared/contracts decisionLabel: `<provider label> · <model>`). */
export const DECISION_LABELS = { cloudflare: 'Cloudflare · ', openai: 'OpenAI Decisions · ' }

/**
 * Every reason a run is not fully live (gate 5: fixtures are labelled, and the smoke fails on any of them). `provider` is
 * the run's configured DECISION_PROVIDER: its label is required, a fixture or the other provider's label fails.
 */
export function detectFallbacks(run, scopeLabel, provider = 'cloudflare') {
  const out = []
  const l = run.labels ?? {}
  if (/fixture/i.test(scopeLabel ?? 'fixture')) out.push(`scope: ${scopeLabel ?? 'no label'}`)
  if (!/deepseek/i.test(l.research ?? '')) out.push(`research label: ${l.research}`)
  if (!(l.decision ?? '').startsWith(DECISION_LABELS[provider])) out.push(`decision label: ${l.decision} (DECISION_PROVIDER=${provider} expects "${DECISION_LABELS[provider]}…")`)
  if (/fixture/i.test(l.plan ?? 'fixture')) out.push(`plan label: ${l.plan ?? 'none'}`)
  if (!/testnet/i.test(l.settlement ?? '')) out.push(`settlement label: ${l.settlement}`)
  if (l.search !== 'hybrid') out.push(`search label: ${l.search ?? 'none'}`)
  for (const a of run.answers ?? []) if (a.provider === 'fixture') out.push(`answer v${a.version} from fixture`)
  for (const d of run.decisions ?? []) {
    if (d.provider === 'fixture' || d.fallbackReason) out.push(`decision round ${d.round} fixture`)
    else if (d.provider !== provider) out.push(`decision round ${d.round} by ${d.provider}, configured ${provider}`)
  }
  // #197/#216: a failed live decision no longer falls back; the run ends FAILED with a DECISION_UNAVAILABLE event.
  for (const e of run.events ?? []) if (e.type === 'DECISION_UNAVAILABLE') out.push(`decision unavailable: ${e.label ?? e.data?.status ?? 'no reason'}`)
  return out
}

const purchased = run => (run.intents ?? []).filter(i => i.txHash)
const skipRow = (run, slug) => (run.decisions ?? []).flatMap(d => d.rows).find(r => r.candidate.publisherSlug === slug && r.verdict === 'SKIP_LOW_TRUST')
const alphaSlug = bible => bible.alphaLeakPlant.articleId.split('-')[0]

/**
 * The UC3 re-ask expects AlphaLeak SKIP_LOW_TRUST, which only holds when the UC3 run before it refunded (with a hash) or
 * quarantined AlphaLeak. `reputation` is the publisher list after that run ({slug, status}).
 */
export function alphaLeakQuarantined(run, bible, reputation = []) {
  const bad = (run.intents ?? []).find(i => i.resourceId === bible.useCases.find(u => u.id === 'UC3').expectedPicks.round1)
  if (bad?.status === 'REFUNDED' && bad.refund?.txHash) return true
  return reputation.some(p => p.slug === alphaSlug(bible) && p.status !== 'active')
}
/** Requested-facts coverage per answer version (#208): [{ version, answered, total }], oldest first; [] for runs without it. */
export const coverageCounts = run => [...(run.checkpoint?.coverage ?? [])].sort((a, b) => a.answerVersion - b.answerVersion)
  .map(c => ({ version: c.answerVersion, answered: c.entries.filter(e => e.status === 'supported').length, total: c.entries.length, ...(c.error ? { error: c.error } : {}) }))
const latestCoverage = run => coverageCounts(run).at(-1)
export const REPEAT_SKIPPED = 'skipped: precondition not met (AlphaLeak not quarantined)'

/** Pass/fail from a finished run snapshot. kind is 'UC1'|'UC2'|'UC3'|'UC3-repeat'|'UC3-probe'|'UC4'. Returns failure strings. */
export function checkRun(kind, run, bible, scopeLabel, provider = 'cloudflare') {
  const fails = detectFallbacks(run, scopeLabel, provider)
  if (run.phase !== 'DONE') fails.push(`run ended ${run.phase}${run.error ? `: ${run.error}` : ''}`)
  const base = kind.replace(/-.*/, '')
  const uc = bible.useCases.find(u => u.id === base)
  const bought = purchased(run).map(i => i.resourceId)
  if (kind === 'UC1' && (run.spentMinor !== 0 || bought.length)) fails.push(`UC1 must spend S$0, spent ${run.spentMinor} minor`)
  if (kind === 'UC2') {
    if (!bought.includes(uc.expectedPicks.round1)) fails.push(`UC2 must buy ${uc.expectedPicks.round1}, bought [${bought}]`)
    if (!run.answers?.length) fails.push('UC2 produced no answer')
    // #208: the free answer leaves the analyst fact open; the bought one answers every requested fact.
    const counts = coverageCounts(run)
    const free = counts.find(c => c.version === 1), last = counts.at(-1)
    if (!free || !last) fails.push('UC2 recorded no requested-facts coverage')
    else {
      if (free.answered >= free.total) fails.push(`UC2 v1 must leave a requested fact open, has ${free.answered} of ${free.total}`)
      if (last.version === free.version || last.answered !== last.total) fails.push(`UC2 must answer every requested fact after the purchase, has ${last.answered} of ${last.total} (v${last.version})`)
    }
  }
  if (kind === 'UC3' || kind === 'UC3-probe') {
    if (bought[0] !== uc.expectedPicks.round1) fails.push(`UC3 must buy ${uc.expectedPicks.round1} first, bought [${bought}]`)
    const bad = (run.intents ?? []).find(i => i.resourceId === uc.expectedPicks.round1)
    if (bad?.status !== 'REFUNDED' || !bad.refund?.txHash) fails.push(`AlphaLeak must end REFUNDED with a refund hash, is ${bad?.status}`)
    if (!(run.events ?? []).some(e => e.type === 'REFUND')) fails.push('no REFUND event')
  }
  if (kind === 'UC3') {
    if (bought[1] !== uc.expectedPicks.round2) fails.push(`UC3 must buy ${uc.expectedPicks.round2} second, bought [${bought}]`)
  }
  if (kind === 'UC4') {
    if (run.spentMinor !== 0 || bought.length) fails.push(`UC4 must spend S$0, spent ${run.spentMinor} minor, bought [${bought}]`)
    if (bought.includes(uc.expectedPicks.wouldHaveBought)) fails.push(`UC4 bought the paid deep-dive ${uc.expectedPicks.wouldHaveBought}`)
    const last = latestCoverage(run)
    if (!last || last.answered !== last.total) fails.push(`UC4 must answer every requested fact, has ${last ? `${last.answered} of ${last.total}` : 'no coverage'}`)
    const followUp = run.checkpoint?.followUp
    const read = (followUp?.added ?? []).some(id => id.startsWith(`${UC4_FREE}@`)) && (run.contents ?? []).some(c => c.resourceId === UC4_FREE)
    if (!(run.events ?? []).some(e => e.type === 'FOLLOW_UP')) fails.push('UC4 has no FOLLOW_UP event')
    if (!read) fails.push(`UC4's follow-up search must read ${UC4_FREE}, read [${(followUp?.added ?? []).join(', ')}]`)
  }
  if (kind === 'UC3-repeat') {
    if (!skipRow(run, alphaSlug(bible))) fails.push('re-ask must show AlphaLeak as SKIP_LOW_TRUST')
    if (bought.includes(uc.expectedPicks.round1)) fails.push('re-ask bought AlphaLeak again')
  }
  return fails
}

/**
 * Estimated live calls of a finished run: DeepSeek = scope + plan + one per answer. Decision: Clef = one gap call plus one
 * per scored row per round; OpenAI Decisions = one batched request per round (a further one per 6 candidates past the
 * first 6, as chunkCandidates splits at 19 questions).
 */
export const countCalls = (run, provider = 'cloudflare') => ({
  deepseek: 2 + (run.answers?.length ?? 0),
  // Decision rounds (a frozen requested fact skips the gap call; an empty gap makes none), plus one coverage request per
  // graded answer version and one for the follow-up's new free passages (#208, #210).
  decision: (run.decisions ?? []).reduce((n, d) => {
    if (typeof d.gap === 'string' && !d.gap.trim()) return n
    if (provider === 'openai') return n + Math.max(1, Math.ceil(d.rows.length / 6))
    return n + (d.gapMaterialSource === 'requirement' ? 0 : 1) + d.rows.length
  }, 0)
    + (run.checkpoint?.coverage?.length ?? 0) + (run.checkpoint?.followUp?.freeRead ? 1 : 0),
})

const explorer = hash => `https://testnet.xrpl.org/transactions/${hash}`
const seconds = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 100) / 10
export function summarise(kind, run, extra, provider = 'cloudflare') {
  const ev = type => (run.events ?? []).filter(e => e.type === type)
  const proof = ev('PROOF')[0], refund = ev('REFUND')[0]
  const trace = ev('TRACE')[0]?.data?.url
  return {
    kind, runId: run.runId, phase: run.phase, labels: run.labels, spentMinor: run.spentMinor, refundedMinor: run.refundedMinor ?? 0,
    purchases: purchased(run).map(i => ({ resourceId: i.resourceId, status: i.status, amountMinor: i.amountMinor, txHash: i.txHash, explorer: explorer(i.txHash) })),
    refundTxHash: refund?.data?.txHash, refundExplorer: refund?.data?.txHash ? explorer(refund.data.txHash) : undefined,
    refundLatencySeconds: proof && refund ? seconds(proof.at, refund.at) : undefined,
    stopReason: run.checkpoint?.stopReason, coverage: coverageCounts(run), followUp: run.checkpoint?.followUp,
    calls: countCalls(run, provider), langfuseTrace: trace, ...extra,
  }
}

// --- everything below talks to a live stack and is only run as a script ---

async function json(base, path, init) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → HTTP ${res.status}`)
  return res.json()
}

async function ask(base, uc, bible) {
  const spec = bible.useCases.find(u => u.id === uc)
  const wantClarify = Boolean(spec.clarify)
  const scope = await json(base, '/api/scope', { method: 'POST', body: JSON.stringify({ question: spec.question, ...(wantClarify ? {} : { clarify: 'never' }) }) })
  const answers = {}, problems = []
  if (wantClarify) {
    const q = scope.questions[0]
    const pick = q?.options.find(o => o.toLowerCase().includes(spec.clarify.expectedUserPick.toLowerCase()))
    if (!q) problems.push('scope returned no clarify question')
    else if (!pick) problems.push(`clarify options [${q.options}] lack the bible pick "${spec.clarify.expectedUserPick}"`)
    else answers[q.id] = pick
  }
  const started = Date.now()
  const created = await json(base, '/runs', { method: 'POST', body: JSON.stringify({ question: spec.question, budgetMinor: BUDGET_MINOR, ...(Object.keys(answers).length ? { answers } : {}) }) })
  let run
  while (Date.now() - started < RUN_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, 2000))
    run = await json(base, `/runs/${created.runId}`)
    if (['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) break
  }
  // The TRACE event lands asynchronously after DONE.
  await new Promise(r => setTimeout(r, 1500))
  run = await json(base, `/runs/${created.runId}`)
  return { run, scopeLabel: scope.label, problems, answers, seconds: Math.round((Date.now() - started) / 100) / 10 }
}

async function main() {
  dotenv.config({ quiet: true })
  const args = parseArgs(process.argv.slice(2), process.env)
  const provider = liveDecisionProvider(process.env.DECISION_PROVIDER)
  const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8'))
  const ports = { api: 8788 + args.offset, pub: 8790 + args.offset }
  const base = `http://127.0.0.1:${ports.api}`
  if (await fetch(`${base}/health`, { signal: AbortSignal.timeout(800) }).then(r => r.ok, () => false)) throw new Error(`something already answers on ${base}; stop it or pick another DEMO_PORT_OFFSET`)

  const dir = 'data/smoke'
  mkdirSync(dir, { recursive: true })
  for (const f of ['app.db', 'app.db-wal', 'app.db-shm']) rmSync(`${dir}/${f}`, { force: true })
  // demo.mjs --live forces LLM_PROVIDER=deepseek (the user's .env may say groq), DECISION_PROVIDER=openai|cloudflare (default
  // cloudflare, the same rule as `provider` above) and SEARCH_EMBEDDINGS=live.
  const env = { ...process.env, DEMO_PORT_OFFSET: String(args.offset), LANGFUSE_ENABLED: '1', LANGFUSE_TRACING_ENVIRONMENT: 'smoke', APP_DB: `${dir}/app.db`, REPORT_DIR: `${dir}/reports`, SEARCH_EMBEDDINGS: 'live', LLM_SYNTHESIS_TIMEOUT_MS: process.env.LLM_SYNTHESIS_TIMEOUT_MS || '120000' }
  const log = openSync(`${dir}/stack.log`, 'w')
  const stack = spawn(process.execPath, ['scripts/demo.mjs', '--live'], { env, stdio: ['ignore', log, log] })
  const stop = () => stack.kill('SIGTERM')
  process.on('SIGINT', () => { stop(); process.exit(130) })
  const summary = { startedAt: new Date().toISOString(), offset: args.offset, args, decisionProvider: provider, runs: [], failures: [], calls: { deepseek: 0, decision: 0 }, budget: BUDGET }
  try {
    for (let i = 0; i < 150; i++) {
      if (stack.exitCode !== null) throw new Error(`stack exited early (see ${dir}/stack.log)`)
      if (await fetch(`${base}/health`, { signal: AbortSignal.timeout(800) }).then(r => r.ok, () => false) && await fetch(`http://127.0.0.1:${ports.pub}/health`, { signal: AbortSignal.timeout(800) }).then(r => r.ok, () => false)) break
      if (i === 149) throw new Error('stack did not become healthy')
      await new Promise(r => setTimeout(r, 400))
    }
    const health = await json(base, '/health')
    summary.stackLabels = health.labels
    await json(base, '/api/reputation/reset', { method: 'POST', body: '{}' })

    const plan = args.probe ? ['UC3-probe'] : [...(args.only ? [args.only] : IDS)].flatMap(u => u === 'UC3' ? ['UC3', 'UC3-repeat'] : [u])
    let uc3Quarantined = true
    for (const kind of plan) {
      const uc = kind.replace(/-.*/, '')
      // UC3's own failure still fails the smoke; the re-ask is not counted as a second failure when its precondition is missing.
      if (kind === 'UC3-repeat' && !uc3Quarantined) {
        summary.runs.push({ kind, skipped: REPEAT_SKIPPED })
        console.log(`${kind}: ${REPEAT_SKIPPED}`)
        continue
      }
      let result, fails, reputation
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (summary.calls.deepseek >= BUDGET.deepseek || summary.calls.decision >= BUDGET.decision) { summary.failures.push(`${kind}: call budget reached (${JSON.stringify(summary.calls)}); stopped`); break }
        // UC4 starts from fresh trust (UC3 quarantined AlphaLeak); a UC3 retry does too.
        if ((attempt === 2 && kind === 'UC3') || (attempt === 1 && kind === 'UC4')) await json(base, '/api/reputation/reset', { method: 'POST', body: '{}' })
        result = await ask(base, uc, bible)
        const calls = countCalls(result.run, provider)
        summary.calls.deepseek += calls.deepseek; summary.calls.decision += calls.decision
        fails = [...result.problems, ...checkRun(kind, result.run, bible, result.scopeLabel, provider)]
        reputation = (await json(base, '/api/reputation')).publishers.map(p => ({ slug: p.publisherSlug, H: +p.H.toFixed(2), C: +p.C.toFixed(2), T: +p.T.toFixed(2), status: p.status }))
        summary.runs.push({ ...summarise(kind, result.run, { attempt, endToEndSeconds: result.seconds, answers: result.answers, reputation }, provider), failures: fails })
        console.log(JSON.stringify(summary.runs.at(-1), null, 2))
        const counts = coverageCounts(result.run).map(c => `v${c.version} ${c.answered}/${c.total}`).join(' → ')
        console.log(`${kind}: stopReason ${result.run.checkpoint?.stopReason ?? 'none'} · requested facts ${counts || 'none'}`)
        if (!fails.length) break
        console.log(`${kind} attempt ${attempt} failed: ${fails.join(' | ')}${attempt === 1 ? '; retrying once' : ''}`)
      }
      if (!result) break
      if (kind === 'UC3') uc3Quarantined = alphaLeakQuarantined(result.run, bible, reputation)
      if (fails.length) summary.failures.push(...fails.map(f => `${kind}: ${f}`))
      if (summary.failures.some(f => f.includes('call budget'))) break
    }
  } catch (error) {
    summary.failures.push(error.message)
  } finally {
    stop()
    summary.finishedAt = new Date().toISOString()
    summary.passed = summary.failures.length === 0
    writeFileSync(`${dir}/last.json`, `${JSON.stringify(summary, null, 2)}\n`)
  }
  console.log(`\nLive calls (estimated): DeepSeek ${summary.calls.deepseek}/${BUDGET.deepseek}, ${provider === 'openai' ? 'OpenAI Decisions' : 'Clef'} ${summary.calls.decision}/${BUDGET.decision}`)
  for (const r of summary.runs) if (!r.skipped) console.log(`${r.kind}: ${r.phase} · stop ${r.stopReason ?? 'none'} · requested facts ${r.coverage?.map(c => `v${c.version} ${c.answered}/${c.total}`).join(' → ') || 'none'} · spent ${r.spentMinor}`)
  console.log(summary.passed ? 'SMOKE PASSED · data/smoke/last.json' : `SMOKE FAILED:\n  ${summary.failures.join('\n  ')}`)
  process.exit(summary.passed ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
