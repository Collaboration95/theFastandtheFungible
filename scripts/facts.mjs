// One source for every number a judge reads (README, docs/, docs/submission/, the deck).
//   node scripts/facts.mjs           → writes docs/submission/facts.json and fills every marked fact
//   node scripts/facts.mjs --check   → exits 1 if facts.json or any marked fact is stale (runs in `npm run hygiene`)
//   node scripts/facts.mjs --get prs → prints one value (for scripts and the deck export)
// Inputs are generated or committed evidence only: site/progress/data.json (git and gh counts at a
// pinned SHA, from `npm run site:progress`), the held-out results, the receipt-conformance manifest,
// the writer-onboarding and fee probes, and BUILDER-FEEDBACK.md counts (already in data.json).
// In Markdown and the deck HTML, a fact is written <!--f:key-->value<!--/f-->; GitHub and browsers hide the comments.
// Refresh after any new measurement: `npm run site:progress -- --at origin/main && node scripts/facts.mjs`.
// RA_DEV_BANKS_ONLY=1 uses published held-out aggregates without opening the raw results of a bank
// that has not been measured yet. v1–v5 are used development data (scripts/local-gate-banks.mjs),
// so their results are read as usual; only a later, unmeasured bank is blanked.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { heldOutBankPath } from './local-gate-banks.mjs'

const root = join(import.meta.dirname, '..')
const developmentOnly = () => process.env.RA_DEV_BANKS_ONLY === '1'
const heldOutPath = heldOutBankPath
const read = path => {
  if (developmentOnly() && heldOutPath(path)) throw new Error('facts: held-out content is forbidden in development-only mode')
  return readFileSync(join(root, path), 'utf8')
}
const json = path => JSON.parse(read(path))
const OUT = 'docs/submission/facts.json'
const DECK = 'docs/submission/deck/index.html'
const REPO = 'https://github.com/Collaboration95/theFastandtheFungible'
// Owner: paste the unlisted demo-video URL here once it is uploaded, then run
// `node scripts/facts.mjs && node docs/submission/deck/export.mjs`. Until then the
// deck says the owner video is pending; it never shows a placeholder.
const VIDEO_URL = ''
// Owner decision A3: change this sentence when the packages are published.
const REGISTRY = 'GitHub Releases; not yet on npm, PyPI or the MCP Registry'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
/** Small counts as spoken words (pitch and video scripts); larger ones stay digits. */
export const spoken = n => WORDS[n] ?? n.toLocaleString('en-US')

/** Stop on a missing input, like build-progress-data.mjs: a fact is never guessed. */
function need(value, label) {
  if (value === undefined || value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`facts: missing ${label}`)
  return value
}
/** Development lanes may check presentation from the published aggregates, but
 * cannot derive held-out numbers from raw results that contain question text.
 * All other fact derivation and marker checks remain enabled. */
function heldoutFacts(fact) {
  // Held-out: v5 once its results are committed, otherwise v4 with its date.
  const v5 = 'docs/evidence/v5-heldout/v5/results.json', v5n = 'docs/evidence/v5-heldout/v5-negatives/results.json'
  const measuredV5 = existsSync(join(root, v5))
  const bank = measuredV5 ? 'v5' : 'v4'
  const pos = measuredV5 ? v5 : 'docs/evidence/v4-heldout/v4/results.json'
  const neg = measuredV5 ? v5n : 'docs/evidence/v4-heldout/v4-negatives/results.json'
  // Development-only mode withholds raw results of a bank that is still unmeasured; a used bank is read as usual.
  if (developmentOnly() && (heldOutPath(pos) || heldOutPath(neg))) {
    const retained = json(OUT).facts
    return Object.fromEntries(['heldout_bank', 'heldout', 'heldout_n', 'heldout_N', 'heldout_on', 'answers_it', 'offtopic', 'offtopic_N', 'heldout_source', 'heldout_violations'].map(key => [key, need(retained[key], `published ${key}`)]))
  }
  const s = json(pos).summary, sn = json(neg).summary
  const heldDir = `docs/evidence/${bank}-heldout/README.md`
  const held = { n: need(s.buyAndCite?.n, 'held-out n'), N: need(s.buyAndCite?.N, 'held-out N') }
  const off = { n: need(sn.negativeBuys?.n, 'off-topic buys'), N: need(sn.negativeBuys?.N, 'off-topic N') }
  // The evidence packet's result table states terminal gate violations per bank.
  const violations = [...read(heldDir).matchAll(/\| terminal gate violations \| (\d+) \|/g)].map(m => Number(m[1]))
  if (violations.length !== 2) need(null, `two "terminal gate violations" rows in ${heldDir}`)
  return {
    heldout_bank: fact(bank, pos, 'blind held-out bank the headline number comes from'),
    heldout: fact(`${held.n}/${held.N}`, pos, `${bank} blind held-out questions bought and cited, run once`),
    heldout_n: fact(spoken(held.n), pos, 'held-out bought and cited, spoken'),
    heldout_N: fact(spoken(held.N), pos, 'held-out bank size, spoken'),
    heldout_on: fact(read(heldDir).split('\n')[0].match(/\((\d{1,2} [A-Z][a-z]{2}) \d{4}\)/)?.[1], heldDir, 'day the held-out bank was run (the evidence packet\'s title date)'),
    answers_it: fact(`${need(s.answersIt?.n, 'answersIt n')}/${need(s.answersIt?.N, 'answersIt N')}`, pos, 'held-out answers whose key fact leads'),
    offtopic: fact(`${off.n}/${off.N}`, neg, `${bank} off-topic questions that led to a purchase`),
    offtopic_N: fact(spoken(off.N), neg, 'off-topic bank size, spoken'),
    heldout_source: fact(heldDir, heldDir, 'evidence packet for the held-out numbers'),
    heldout_violations: fact(violations.reduce((a, b) => a + b, 0), heldDir, 'terminal gate violations across the held-out and off-topic banks'),
  }
}

export function build() {
  const progress = json('site/progress/data.json')
  const h = progress.headline
  const fact = (value, source, definition) => ({ value: String(need(value, definition)), source, definition })
  const P = 'site/progress/data.json'

  const STATS = 'docs/submission/evidence/hosted-stats-nov12/stats.json'
  const stats = json(STATS)
  const captured = json('docs/submission/evidence/hosted-stats-nov12/capture.json')
  const heldout = heldoutFacts(fact)
  const bank = heldout.heldout_bank.value
  const dev = id => { const b = need(progress.metrics.banks.find(x => x.id === id), `dev bank ${id}`); return `${b.n}/${b.N}` }

  const cases = json('tests/fixtures/receipt-conformance/manifest.json').cases
  const onboarding = json('docs/evidence/round4-j3/slim-onboarding.json')
  const probe = json('docs/evidence/round3-a/probe.json').timings[0].transactions
  const CHAOS = 'docs/evidence/chaos-279-500.json'
  const chaos = json(CHAOS)
  const fee = type => need(probe.find(t => t.type === type)?.feeDrops, `${type} fee`)
  const first = Object.fromEntries(progress.metrics.firstRun.map(m => [m.label, m]))
  const tries = progress.metrics.tryRuns
  const fb = progress.feedback
  const sha = progress.source_sha.slice(0, 8)
  const counted = `counted at ${sha} on ${day(progress.as_of)}`

  const PAID = 'docs/submission/evidence/hosted-answer-nov12/summary.json'
  const paid = json(PAID)
  const FEATURED = 'docs/evidence/hosted-export-nov12/summary.json'
  const featured = json(FEATURED)
  const IDENTITY = 'docs/evidence/writer-credentials-nov12/ledger.json'
  const identity = json(IDENTITY)
  const facts = {
    featured_grant: fact(featured.grantSeq, FEATURED, 'explicit grant sequence before each paid read'),
    featured_reads: fact(`${featured.paidReadSeqs[0]}–${featured.paidReadSeqs.at(-1)}`, FEATURED, 'featured paid-read audit sequence range'),
    featured_failed: fact(featured.browser.failed, FEATURED, 'featured browser failures; not skipped checks'),
    featured_spend: fact((featured.spentMinor / 100).toFixed(2), FEATURED, 'featured preset-2 nominal SGD display spend, not FX'),
    featured_seconds: fact((featured.startToDoneMs / 1000).toFixed(1), FEATURED, 'one hosted preset-2 run on 12 Nov; Start to Done excludes planning/modal'),
    featured_browser: fact(featured.browser.passed, FEATURED, 'featured browser and published TS checks passed; two identity/origin checks not checked'),
    featured_wheel: fact(featured.wheel.passed, FEATURED, 'featured published v1.1.1 wheel checks passed; zero failed, two skipped'),
    identity_writers: fact(identity.writers.length, IDENTITY, 'operator writer Credentials in the validated Testnet identity snapshot; identity only'),
    identity_domains: fact(identity.domain.validated && identity.domain.index === identity.domainId ? 1 : 0, IDENTITY, 'retained validated Testnet Permissioned Domain, identity display only'),
    identity_ledger: fact(identity.ledgerIndex, IDENTITY, 'validated Testnet identity snapshot ledger; 11 Nov 2026'),
    paid_seconds: fact((paid.startToDoneMs / 1000).toFixed(1), PAID, 'recorded writer-payment run Start to Done seconds; excludes pre-admission planning and five-second modal'),
    paid_spend: fact((paid.spentMinor / 100).toFixed(2), PAID, 'recorded writer-payment run nominal S$ article price; fixed Testnet demo rate, not FX'),
    paid_principal: fact(paid.principalDrops.toLocaleString('en-US'), PAID, 'recorded writer-payment run Testnet XRP principal in drops'),
    paid_articles: fact(paid.bought.length, PAID, 'recorded writer-payment run purchased articles'),
    paid_create: fact(paid.fees.buyerCreateDrops, 'docs/submission/evidence/hosted-answer-nov12/ledger.json', 'recorded writer-payment run buyer create fee, independently re-read on Testnet'),
    paid_finish: fact(paid.fees.writerFinishDrops, 'docs/submission/evidence/hosted-answer-nov12/ledger.json', 'recorded writer-payment run writer finish fee, independently re-read on Testnet'),
    paid_anchor: fact(paid.fees.buyerAnchorDrops, 'docs/submission/evidence/hosted-answer-nov12/ledger.json', 'recorded writer-payment run buyer anchor fee, independently re-read on Testnet'),
    paid_passages: fact(paid.evidence.length, PAID, 'recorded writer-payment run delivered passages'),
    paid_before: fact(paid.freeDraft.openGaps.length, PAID, 'recorded writer-payment run free draft recorded open gaps; no independent quality score'),
    paid_after: fact(paid.finalAnswer.openGaps.length, PAID, 'recorded writer-payment run final recorded open gaps; no independent quality score'),
    paid_model_cost: fact('unmeasured', PAID, paid.modelCostNote),
    simulate_create: fact('10', 'docs/evidence/dry-run-nov12/result.json', 'unsigned rippled create fee autofill, no fee charged'),
    simulate_finish: fact('350', 'docs/evidence/dry-run-nov12/result.json', 'unsigned dummy finish fee autofill, tecNO_TARGET; not a successful delivery'),
    // Dates and provenance
    as_of: fact(`${day(progress.as_of)} ${progress.as_of.slice(0, 4)}`, P, 'day the counts below were taken (SGT)'),
    sha: fact(sha, P, 'main commit the counts were taken at'),
    since: fact(day(progress.since.date), P, 'first day counted as "since SingHacks" (SGT)'),
    event: fact(progress.event.label, P, 'SingHacks event dates'),
    // Progress since SingHacks (git and gh queries in data.json "queries")
    prs: fact(h.prs, P, `main-branch PRs merged on or after ${progress.since.label} (SGT), ${counted}`),
    commits: fact(h.commits, P, `commits after the last pre-21 Sep commit, ${counted}`),
    days: fact(h.days, P, `calendar days from ${progress.since.label} to ${day(progress.as_of)}`),
    releases: fact(h.releases, P, 'published GitHub releases reachable from the counted commit (prereleases included)'),
    release: fact(progress.today.release, P, 'latest published release'),
    release_day: fact(day(progress.today.releaseDay), P, 'day the latest release was published (SGT)'),
    transactions: fact(h.transactions, P, 'Testnet transactions on the /ledger/ page, each re-checked live in the browser'),
    // Judge questions
    ...heldout,
    dev_v1: fact(dev('v1'), P, 'v1 development bank bought and cited (tuned on; not held-out)'),
    dev_v3: fact(dev('v3'), P, 'v3 development bank bought and cited at threshold 0.20 (tuned on; not held-out)'),
    // One-line judge path
    try_s: fact(tries.at(-1).seconds.toFixed(1), P, 'cold `try --testnet` wall time, empty npm cache, one measurement'),
    try_misses: fact(`${tries.filter(r => !r.pass).length} of ${tries.length}`, P, `cold \`try\` runs that overran the ${progress.metrics.tryLimit} s limit`),
    try_limit: fact(progress.metrics.tryLimit, P, 'deadline in seconds the cold `try` runs were measured against'),
    mcp_mb: fact(first['Download size'].after.toFixed(1), P, 'MCP package download, MB'),
    mcp_init_s: fact(first['MCP server starts'].after.toFixed(1), P, 'cold MCP initialize, seconds'),
    app_ready_s: fact(first['Testnet app ready'].after.toFixed(1), P, 'zero-clone Testnet app ready, seconds'),
    // Verification
    vectors: fact(cases.length, 'tests/fixtures/receipt-conformance/manifest.json', 'shared receipt-conformance cases; TypeScript and Python must agree on all'),
    vectors_golden: fact(cases.filter(c => c.expected).length, 'tests/fixtures/receipt-conformance/manifest.json', 'conformance cases that must pass'),
    vectors_tampered: fact(cases.filter(c => !c.expected).length, 'tests/fixtures/receipt-conformance/manifest.json', 'tampered conformance cases that must fail'),
    // Writers and cost
    writer_s: fact(need(onboarding.coldInitPlusPublishSeconds, 'writer onboarding').toFixed(1), 'docs/evidence/round4-j3/slim-onboarding.json', '`init` + `publish` to a validated Testnet writer Credential, one measurement'),
    fee_create: fact(fee('EscrowCreate'), 'docs/evidence/round3-a/probe.json', 'EscrowCreate network fee, drops'),
    fee_finish: fact(fee('EscrowFinish'), 'docs/evidence/round3-a/probe.json', 'EscrowFinish (key reveal) network fee, drops'),
    fee_drops: fact(fee('EscrowCreate') + fee('EscrowFinish'), 'docs/evidence/round3-a/probe.json', 'network fees per key-reveal purchase, drops'),
    fee_xrp: fact(((fee('EscrowCreate') + fee('EscrowFinish')) / 1e6).toFixed(6), 'docs/evidence/round3-a/probe.json', 'network fees per key-reveal purchase, XRP (1 XRP = 1,000,000 drops)'),
    // Recovery under chaos (synthetic fixture ledger, real SIGKILLs, 3 Nov)
    chaos_runs: fact(need(chaos.iterations, 'chaos iterations'), CHAOS, 'seeded chaos runs, each with one injected fault (synthetic fixture ledger, no Testnet)'),
    chaos_kills: fact(need(chaos.processKills, 'chaos kills'), CHAOS, 'real SIGKILLs of the API, MCP or publisher process across those runs'),
    chaos_double: fact(need(chaos.doubleCharges, 'chaos double charges'), CHAOS, 'double charges across those runs'),
    // Builder feedback (counts in data.json follow BUILDER-FEEDBACK.md's own definitions)
    findings: fact(fb.findings, P, 'numbered findings B01–Bnn in docs/BUILDER-FEEDBACK.md'),
    ranked: fact(fb.ranked, P, 'ranked findings with runnable repros'),
    submissions: fact(fb.submissions, P, 'research submissions sent in September'),
    submitted_on: fact(fb.submittedOn, P, 'days those submissions were sent'),
    drafts: fact(fb.drafts, P, 'upstream issue drafts in docs/feedback/upstream/'),
    filed: fact(fb.filed, P, 'upstream issues filed with a public link'),
  }
  Object.assign(facts, {
    live_questions: fact(stats.questions, STATS, 'hosted questions since 11 Nov; includes team test runs'),
    live_purchases: fact(stats.purchasesSettled, STATS, 'settled purchases in the hosted aggregate'),
    live_median_s: fact((stats.timing.medianMs / 1000).toFixed(3), STATS, 'median recorded answer time; timing sample count separate'),
    live_p90_s: fact((stats.timing.p90Ms / 1000).toFixed(3), STATS, 'p90 recorded answer time'),
    live_timing_n: fact(stats.timing.samples, STATS, 'runs with recorded answer timing'),
    live_model_usd: fact(stats.medianModelUsd, STATS, 'median model cost USD per question; separate from article prices'),
    live_audits: fact(stats.audit.checked, STATS, 'runs with available audit traces'),
    live_audit_unavailable: fact(stats.audit.unavailable, STATS, 'runs without available audit traces'),
    live_violations: fact(['readBeforeGrant', 'buyWithoutPolicy', 'overBudget', 'duplicateIntent', 'receiptWithoutIntent'].reduce((n, k) => n + stats.audit[k], 0), STATS, 'sum of recorded gate violation counters across available audits'),
    live_asof: fact(captured.asOfSgt, 'docs/submission/evidence/hosted-stats-nov12/capture.json', 'snapshot fetch time in Singapore'),
  })
  // Round 3 evidence: proof at scale, real content, publishing. Each is read from a committed evidence file, never typed.
  const PROOF = 'docs/evidence/proof'
  const modelRuns = json(`${PROOF}/model-summary.json`)
  const sim = json(`${PROOF}/sim-summary.json`)
  const verified = json(`${PROOF}/testnet-1000-verify.json`)
  const t1000 = json('data/evidence/testnet-1000/summary.json')
  const attacks = read(`${PROOF}/PROOF-REPORT.md`).match(/(\d+) local HTTP-stack attacks: (\d+) passed, (\d+) breaches/)
  if (!attacks || attacks[1] !== attacks[2]) need(null, `a passing attack line in ${PROOF}/PROOF-REPORT.md`)
  const docsManifest = json('data/corpus/public-docs/manifest.json')
  const phone = json('docs/evidence/publish/phone-live.json')
  const grouped = n => Number(n).toLocaleString('en-US')
  Object.assign(facts, {
    proof_purchases: fact(grouped(verified.verified), `${PROOF}/testnet-1000-verify.json`, 'real key-reveal purchases the independent script re-read from a public node and verified'),
    proof_p50_s: fact((t1000.endToEndMs.p50 / 1000).toFixed(1), 'data/evidence/testnet-1000/summary.json', 'median seconds end to end across the 1,000 purchases'),
    proof_states: fact(grouped(modelRuns.models.reduce((n, m) => n + need(m.states, 'model states'), 0)), `${PROOF}/model-summary.json`, 'bounded protocol states explored across four model configurations'),
    proof_mutations: fact(spoken(modelRuns.mutations.length), `${PROOF}/model-summary.json`, 'deliberately seeded model bugs, spoken; each is reported with a counterexample'),
    proof_schedules: fact(grouped(sim.runs), `${PROOF}/sim-summary.json`, 'simulated crash and retry schedules run against the real purchase code'),
    proof_attacks: fact(attacks[1], `${PROOF}/PROOF-REPORT.md`, 'attacks against the local stack that passed; zero breaches'),
    proof_violations: fact(Object.values(sim.violations).reduce((a, b) => a + b, 0) + modelRuns.models.reduce((n, m) => n + (m.violations?.length ?? 0), 0), `${PROOF}/sim-summary.json`, 'violations across the simulated schedules and the model checker'),
    content_passages: fact(grouped(docsManifest.sources.reduce((n, x) => n + x.passageCount, 0)), 'data/corpus/public-docs/manifest.json', 'XRPL and x402 documentation passages in the free tier'),
    publish_live_s: fact(phone.submitToVisibleLiveSeconds.toFixed(1), 'docs/evidence/publish/phone-live.json', 'seconds from phone-width form submission to a live note, measured locally'),
    publish_sale_s: fact(phone.totalToVisibleSaleSeconds.toFixed(1), 'docs/evidence/publish/phone-live.json', 'seconds from submission to a visible verified sale, measured locally'),
  })
  const v = k => facts[k].value
  // Canonical sentences other surfaces reuse word for word (deck, Q&A, form).
  const copy = {
    feedback_line: `${v('ranked')} ranked findings with runnable repros · ${v('findings')} numbered findings (B01–B${v('findings')}) · ${v('submissions')} submissions on ${v('submitted_on')} · ${v('drafts')} upstream drafts, ${v('filed')} filed`,
    progress_line: `${v('prs')} pull requests merged since ${v('since')} (${counted}) · ${v('releases')} releases · ${v('transactions')} Testnet transactions you can re-check`,
    heldout_line: `${bank} blind held-out: ${v('heldout')} bought and cited, ${v('offtopic')} off-topic purchases (run once, ${v('heldout_on')}, fixture research and decision models with answers written offline, team-authored writers)`,
    singhacks_then: 'At SingHacks a language model proposed each purchase and a person approved every quote before payment; payment was a fixture by default, with optional Testnet settlement.',
    hosted: 'Live answers · policy rules decide purchases',
    // Same line as `node scripts/install-snippets.mjs --tag <release> --try` (tests/deck.test.ts checks it).
    try_line: `npx -y ${REPO}/releases/download/${v('release')}/researchagent-mcp-${v('release').slice(1)}.tgz try --testnet`,
    registry: REGISTRY,
    video: VIDEO_URL || 'Owner video pending',
  }
  for (const [key, value] of Object.entries(copy)) facts[key] = { value, source: 'scripts/facts.mjs', definition: 'canonical sentence built from the facts above' }
  return {
    schema: 1,
    note: 'Generated by node scripts/facts.mjs; do not edit. Each value names its source and definition.',
    as_of: progress.as_of,
    source_sha: progress.source_sha,
    links: {
      hosted: 'https://ra-front-651013803640.asia-southeast1.run.app',
      hosted_window: '13–19 Nov 2026',
      repo: REPO,
      release: `${REPO}/releases/tag/${v('release')}`,
      progress: 'https://collaboration95.github.io/theFastandtheFungible/progress/',
      replay: 'https://collaboration95.github.io/theFastandtheFungible/demo/',
      ledger: 'https://collaboration95.github.io/theFastandtheFungible/ledger/',
      site: 'https://collaboration95.github.io/theFastandtheFungible/',
      deck: `${REPO}/blob/main/docs/submission/ResearchAgent-SFF-deck.pdf`,
      video: VIDEO_URL || null,
    },
    facts,
  }
}

const MARK = /<!--f:([A-Za-z0-9_]+)-->([\s\S]*?)<!--\/f-->/g
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Replace every marked value with the current fact; unknown keys are errors. HTML files get escaped values. */
export function fill(text, facts, file = 'text') {
  const html = file.endsWith('.html')
  const filled = text.replace(MARK, (_, key) => {
    if (!facts[key]) throw new Error(`facts: ${file} uses unknown fact "${key}"`)
    return `<!--f:${key}-->${html ? escapeHtml(facts[key].value) : facts[key].value}<!--/f-->`
  })
  // HTML attributes cannot contain fact comments. Mark pinned release links explicitly instead.
  return filled.replace(/data-fact-link="release" href="[^"]*"/g,
    () => `data-fact-link="release" href="${REPO}/releases/tag/${facts.release.value}"`)
}
/** Rendered text: what GitHub shows once the comments are hidden. */
export const strip = text => text.replace(/<!--\/?f(?::[A-Za-z0-9_]+)?-->/g, '')

export function markedFiles() {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
  return [...files, DECK].filter(f => !(developmentOnly() && heldOutPath(f)) && existsSync(join(root, f)) && read(f).includes('<!--f:'))
}

function main() {
  const check = process.argv.includes('--check')
  const data = build()
  if (process.argv.includes('--get')) { const key = process.argv[process.argv.indexOf('--get') + 1]; console.log(need(data.facts[key], `fact ${key}`).value); return }
  const out = JSON.stringify(data, null, 2) + '\n'
  const stale = []
  if (!existsSync(join(root, OUT)) || read(OUT) !== out) { if (check) stale.push(OUT); else writeFileSync(join(root, OUT), out) }
  const files = markedFiles()
  for (const file of files) {
    const before = read(file), after = fill(before, data.facts, file)
    if (before !== after) { if (check) stale.push(file); else writeFileSync(join(root, file), after) }
  }
  if (stale.length) { console.error(`facts: stale, run node scripts/facts.mjs:\n  ${stale.join('\n  ')}`); process.exit(1) }
  console.log(`facts: ${check ? 'ok' : 'written'} (${Object.keys(data.facts).length} facts at ${data.source_sha.slice(0, 8)}, ${files.length} files)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main() } catch (error) { console.error(error.message); process.exit(1) }
}
