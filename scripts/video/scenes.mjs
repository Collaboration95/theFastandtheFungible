// The scenes of the demo video, one clip each. Every wait is a condition on what is on screen, never a fixed guess;
// every interaction is a gentle glide or an eased scroll. `marks` name the moments the cut (shots.json) refers to.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { HOSTED_URL, QUESTIONS, REPO, RECEIPTS, RELEASE, ROOT, SITE, scratchDir, sleep } from './config.mjs'
import { closeCardHtml, titleCardHtml, dryRunCardHtml } from './lib/cards.mjs'
import { run as runCommand } from './lib/proc.mjs'

const PROMPT_RE = /\$ \s*$/
const lastLine = screen => screen.split('\n').map(l => l.trimEnd()).filter(Boolean).at(-1) ?? ''
const atPrompt = screen => PROMPT_RE.test(lastLine(screen) + ' ')

/** Poll until `done()`; mark each probe the first time it becomes visible. Throws at the deadline. */
async function watch(rec, { probes = {}, done, timeout, label }) {
  const t0 = Date.now(), seen = new Set()
  for (;;) {
    for (const [name, locator] of Object.entries(probes)) {
      if (!seen.has(name) && await locator.first().isVisible().catch(() => false)) { seen.add(name); rec.mark(name) }
    }
    if (await done()) return seen
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${label}`)
    await sleep(250)
  }
}

/** Ask a question the way a visitor does: type it, look at the budget, press Ask, then ride the plan to its start. */
async function askQuestion(rec, question, { keepPlanOnScreenMs = 2600 } = {}) {
  const { page } = rec
  const box = page.getByRole('textbox', { name: 'Your question' })
  const preset = page.getByRole('button', { name: `How writers get paid ${question}`, exact: true })
  if (question === QUESTIONS.buy && await preset.count()) await rec.click(preset)
  else { await rec.click(box); await rec.type(box, question) }
  rec.mark('typed')
  await rec.hold(700)
  await rec.glideTo(page.locator('.ra-budget-chip'), 700)
  await rec.hold(900)
  await rec.click(page.getByRole('button', { name: /^Ask/ }))
  rec.mark('asked')
  const start = page.getByRole('button', { name: 'Start now' })
  const clarify = page.getByRole('region', { name: 'Clarifying questions' })
  await watch(rec, { done: async () => await start.isVisible() || await clarify.isVisible(), timeout: 150_000, label: 'the plan' })
  if (await clarify.isVisible()) {
    rec.mark('clarify_shown'); await rec.hold(2200)
    await rec.click(clarify.locator('.ra-chip-opt').first())
    await start.waitFor({ timeout: 120_000 })
  }
  rec.mark('plan_ready')
  await rec.hold(keepPlanOnScreenMs)
  // The plan starts by itself after five seconds; press Start now only if it has not.
  const started = await start.waitFor({ state: 'hidden', timeout: 9000 }).then(() => true, () => false)
  if (!started) await rec.click(start, 700)
  rec.mark('plan_confirmed')
}

/** The UI renders the checkmark as SVG, so success must use its semantic result state. */
export async function waitForKeyMatch(page, timeout = 60000) {
  const result = page.locator('.ra-key-check-out.is-match').first()
  await result.waitFor({ timeout })
  return result
}

const title = page => page.title()

async function riseToAnswer(rec, { timeout = 260_000 } = {}) {
  const { page } = rec
  await watch(rec, {
    probes: { payment: page.locator('.ra-payment'), locking: page.getByText('Payment held until the writer releases the key'), escrow: page.getByText('Payment locked in escrow'), key: page.getByText('Writer released the key'), unlocked: page.getByText('Article unlocked') },
    done: async () => { const t = await title(page); if (/Couldn.t finish/.test(t)) throw new Error('the run failed'); return /Answer ready|Stopped/.test(t) },
    timeout, label: 'the answer',
  })
  rec.mark('answer_ready')
  // The simulated rail (local fallback) has no key-reveal steps; its first payment row stands in for the escrow mark.
  if (rec.marks.escrow === undefined && rec.marks.payment !== undefined) rec.marks.escrow = rec.marks.payment
  // The local fixture stack finishes in under a second, before any poll sees a row: the receipt line still proves a purchase.
  if (rec.marks.escrow === undefined && await page.getByText(/Paid for \d+ articles?/).first().isVisible().catch(() => false)) rec.marks.escrow = rec.marks.answer_ready
}

function hostedContext(target) { return { ignoreHTTPSErrors: target.kind === 'local', ...(target.kind === 'hosted' ? { viewport: { width: 1280, height: 720 } } : {}) } }
async function openHome(rec, target) {
  const { page } = rec
  await page.goto(`${target.base}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { level: 1, name: 'Research with a wallet.' }).waitFor({ timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
  rec.mark('orientation')
  const pill = page.getByRole('button', { name: /Testnet demo|Shared (?:XRPL Testnet )?demo/ }).first()
  rec.labels.indicator = (await pill.innerText().catch(() => '')).trim()
  rec.labels.freshSession = true
  return pill
}

/** The label bar for hosted footage, built from what the app's own chip said on that run (hard gate 5). */
function caption(target, chip, writers) {
  if (target.kind !== 'hosted') return ['Local HOSTED=1 stack', 'fixture models', 'simulated payments', 'no real value', writers].filter(Boolean).join(' · ')
  const parts = chip.split(' · ').map(s => s.trim()).filter(Boolean)
  const models = parts.length >= 3 ? parts.slice(1, -1).join(' · ') : ''
  return ['Live sandbox', 'XRPL Testnet', models, 'no real value', writers].filter(Boolean).join(' · ')
}
const hostedLabels = target => target.kind === 'hosted'
  ? { env: 'Live sandbox · XRPL Testnet · no real value', backend: 'hosted' }
  : { env: 'Local HOSTED=1 stack · fixture models · simulated payments · no real value', backend: 'local' }

export const SCENES = [
  {
    id: 'judges-corner', kind: 'browser', local: true, liveQuestions: 0,
    labels: () => ({ env: 'Local HOSTED=1 · recorded sandbox run, 11 Nov · public XRPL Testnet reads · no real value', caption: 'Local acceptance · recorded sandbox run, 11 Nov · public XRPL Testnet reads · no question used', backend: 'local' }),
    contextOptions: hostedContext,
    async run(rec, target) {
      await openHome(rec, target)
      const calls = []
      rec.page.on('request', r => { if (/\/api\/(?:runs|scope|admission)/.test(r.url())) calls.push(r.url()) })
      await rec.click(rec.page.locator('.ra-hwork > summary'))
      const corner = rec.page.getByRole('region', { name: 'Check our work without asking a question' })
      await rec.scrollIntoView(corner, 1000, 140)
      rec.mark('corner_check_started')
      await rec.click(corner.getByRole('button', { name: 'Run the checks' }))
      const result = corner.locator('.ra-hv-head')
      await result.waitFor({ timeout: 90000 })
      const text = await result.innerText()
      if (!/^(?:All \d+ checks passed|\d+ passed · \d+ not checked)$/.test(text)) throw new Error(`corner check: ${text}`)
      if (calls.length) throw new Error('corner consumed an admission/run request')
      rec.labels.result = text; rec.labels.questionRequests = calls.length
      rec.mark('corner_check_done'); await rec.hold(7000)
    },
  },
  {
    id: 'key-check', kind: 'browser', localReplay: true, source: 'replay',
    labels: () => ({ env: 'Local replay · recorded XRPL Testnet run · fictional writer · public node reads · no real value', caption: 'Local replay · fictional writer · real recorded Testnet escrow · browser key check', backend: 'replay' }),
    async run(rec, target) {
      await rec.page.goto(target.base, { waitUntil: 'domcontentloaded' })
      await rec.page.waitForFunction(() => document.title.includes('Answer ready'), null, { timeout: 90000 })
      await rec.click(rec.page.locator('.ra-spend:visible .ra-spending-proof > summary'))
      const button = rec.page.getByRole('button', { name: 'Check the key yourself' }).first()
      await button.waitFor({ timeout: 90000 })
      await rec.scrollIntoView(button, 1000, 320)
      rec.mark('key_check_started'); await rec.glideTo(button); await button.click()
      const result = await waitForKeyMatch(rec.page)
      rec.labels.result = await result.innerText()
      rec.mark('key_check_done'); await rec.hold(6500)
    },
  },
  {
    id: 'writer-credentials', kind: 'browser', local: true, liveQuestions: 0,
    labels: () => ({ env: 'Local HOSTED=1 · live Testnet identity · fixture models · simulated buyer rail · no real value', caption: 'Local UI · live Testnet identity · operator-issued, not KYC · simulated buyer rail · no real value', backend: 'local' }),
    contextOptions: hostedContext,
    async run(rec, target) {
      await openHome(rec, target)
      // Identity requires signed search metadata. A local zero-budget question supplies it without any purchase.
      await rec.page.locator('.ra-budget-chip').click()
      await rec.page.getByRole('button', { name: 'Free', exact: true }).click()
      await rec.page.keyboard.press('Escape')
      await rec.page.getByRole('textbox', { name: 'Your question' }).fill('When an agent gets an HTTP 402, what does it send next to pay over x402, and what unlocks the article?')
      await rec.page.getByRole('button', { name: 'Ask free', exact: true }).click()
      const start = rec.page.getByRole('button', { name: 'Start now' })
      await watch(rec, { done: async () => await start.isVisible() || (await rec.page.title()).includes('Answer ready'), timeout: 60000, label: 'local free plan or answer' })
      if (await start.isVisible()) await start.click()
      await rec.page.waitForFunction(() => document.title.includes('Answer ready'), null, { timeout: 60000 })
      await rec.page.keyboard.press('Meta+2')
      await rec.page.getByRole('heading', { name: 'Writers', exact: true }).waitFor()
      const badges = rec.page.getByRole('link', { name: /XRPL Credential · issued by ResearchAgent operator/ })
      await badges.nth(2).waitFor({ timeout: 60000 })
      if (await badges.count() !== 3) throw new Error('expected three live identity badges')
      rec.labels.verifiedWriters = 3
      rec.mark('writer_identity'); await rec.hold(9000)
    },
  },
  {
    id: 'title-card', kind: 'card', seconds: 12,
    html: () => titleCardHtml({ mark: join(ROOT, 'design/brand/mark.svg') }),
  },
  {
    id: 'close-card', kind: 'card', seconds: 14,
    html: () => closeCardHtml({ lockup: join(ROOT, 'design/brand/lockup.svg'), repo: REPO.replace('https://', '') }),
  },
  {
    id: 'hosted-ask', kind: 'browser', hosted: true, liveQuestions: 1,
    labels: hostedLabels, contextOptions: hostedContext,
    async run(rec, target) {
      const { page } = rec
      const pill = await openHome(rec, target)
      const questionCalls = []
      page.on('request', req => { if (req.method() === 'POST' && /\/api\/(?:runs|scope|admission)/.test(req.url())) questionCalls.push(req.url()) })
      await rec.click(page.getByRole('button', { name: 'Verify a recorded run, no question used', exact: true }))
      const corner = page.getByRole('region', { name: 'Check our work without asking a question' })
      rec.mark('corner_check_started')
      await rec.click(corner.getByRole('button', { name: 'Run the checks', exact: true }))
      await corner.locator('.ra-hv-head.is-ok').waitFor({ timeout: 90000 })
      const gates = corner.locator('.ra-gates')
      await gates.locator('strong').filter({ hasText: /^Passed$/ }).nth(4).waitFor({ timeout: 30000 })
      if (await gates.locator('strong').filter({ hasText: /^Passed$/ }).count() !== 5) throw new Error('Expected five passed recorded gates')
      rec.labels.cornerResult = await corner.locator('.ra-hv-head').innerText()
      rec.labels.cornerGates = await gates.innerText()
      if (questionCalls.length) throw new Error('Recorded verification consumed a question')
      rec.labels.cornerQuestionRequests = 0
      await rec.scrollIntoView(gates, 1000, 140)
      rec.mark('corner_check_done'); await rec.hold(7000)
      await rec.click(page.locator('.ra-hwork > summary'))
      await rec.hold(1500)
      await rec.glideTo(pill, 1000)       // the one environment indicator
      await rec.hold(1800)
      await askQuestion(rec, target.kind === 'local' ? QUESTIONS.localBuy : QUESTIONS.buy)
      await riseToAnswer(rec)
      if (rec.marks.escrow === undefined) throw new Error('the run bought nothing, so there is no payment card to show')
      rec.labels.models = (await pill.innerText().catch(() => '')).trim()
      rec.labels.caption = caption(target, rec.labels.models, target.kind === 'local' ? 'fictional writers' : 'team-authored writers')
      await rec.hold(2400)
      // The anchor line reads "Anchoring…" for up to a minute after the answer; the cut shows it turn into "Anchored on XRPL".
      const anchored = page.getByRole('link', { name: /^Anchored on XRPL/ })
      const landed = await anchored.first().waitFor({ timeout: 100_000 }).then(() => true, () => false)
      if (landed) { rec.mark('anchored'); await rec.hold(1800) } else rec.note('the anchor line still said "Anchoring…" after 100 s')
      // The answer, then the receipt checks in the browser.
      await rec.glide(1100, 600, 800)
      const answer = page.getByRole('region', { name: 'Research answer' })
      if (await answer.count()) { await rec.scrollIntoView(answer, 1300, 100); rec.mark('answer_read'); await rec.hold(3200) }
      await rec.click(page.locator('.ra-spend:visible .ra-spending-proof > summary'))
      const key = page.getByRole('button', { name: 'Check the key yourself' }).first()
      await rec.glideTo(key); await key.click()
      await waitForKeyMatch(page)
      rec.labels.keyResult = 'sha256(key) = lock ✓'
      rec.mark('key_check_done'); await rec.hold(6000)
      rec.labels.runUrl = page.url()
      rec.labels.answer = await page.getByRole('region', { name: 'Research answer' }).innerText()
      rec.labels.payment = await page.locator('.ra-spend:visible').innerText()
      rec.labels.transactions = await page.locator('a[href*="testnet.xrpl.org"]').evaluateAll(els => els.map(el => ({ text: el.textContent, href: el.href })))
      rec.mark('why_bought'); await rec.hold(4000)
      await page.getByRole('button', { name: 'Show work', exact: true }).click()
      const work = page.getByRole('dialog', { name: 'Show work' })
      await work.getByRole('tab', { name: 'Trace', exact: true }).click()
      await work.locator('.ra-plan-check').waitFor()
      rec.labels.planComparison = await work.locator('.ra-plan-check').innerText()
      rec.labels.trace = await work.innerText()
      rec.mark('plan_check'); await rec.hold(6500)
      await page.getByRole('button', { name: 'Close show work' }).click()
      await page.keyboard.press('Meta+2')
      await page.getByRole('link', { name: /XRPL Credential · issued by ResearchAgent operator/ }).nth(2).waitFor({ timeout: 60000 })
      rec.labels.verifiedWriters = await page.getByRole('link', { name: /XRPL Credential · issued by ResearchAgent operator/ }).count()
      rec.mark('writer_identity'); await rec.hold(9500)
    },
  },
  {
    id: 'hosted-decline', kind: 'browser', hosted: true, liveQuestions: 1,
    labels: hostedLabels, contextOptions: hostedContext,
    async run(rec, target) {
      const { page } = rec
      await openHome(rec, target)
      await rec.hold(800)
      await askQuestion(rec, QUESTIONS.decline, { keepPlanOnScreenMs: 1500 })
      await riseToAnswer(rec)
      rec.labels.models = (await page.getByRole('button', { name: /Testnet demo|Shared (?:XRPL Testnet )?demo/ }).first().innerText().catch(() => '')).trim()
      rec.labels.caption = caption(target, rec.labels.models, target.kind === 'local' ? 'synthetic test anchor' : undefined)
      await rec.hold(2200)
      const share = page.getByRole('button', { name: 'Share proof of refusal' })
      if (target.kind === 'local') {
        // Simulated payments leave nothing on a ledger; the test stack can promote one decline to a synthetic anchor.
        const runId = new URL(page.url()).searchParams.get('run')
        await page.request.post(`${target.base}/__test/anchor/${runId}`)
        rec.note('local stack: the anchor behind this proof is a synthetic test stand-in')
        await page.reload()
      }
      await share.waitFor({ timeout: 150_000 })
      rec.mark('share_available')
      await rec.scrollIntoView(share, 1000, 420)
      await rec.hold(900)
      await rec.click(share)
      rec.mark('share_confirm')
      await page.getByRole('heading', { name: 'Publish this proof?' }).waitFor({ timeout: 20_000 })
      await rec.hold(3500)
      await rec.click(page.getByRole('button', { name: 'Publish proof page' }))
      await page.getByText('Proof page ready').waitFor({ timeout: 30_000 })
      rec.mark('proof_ready')
      await rec.hold(1500)
      const href = await page.getByRole('link', { name: 'Open proof page' }).getAttribute('href')
      await rec.click(page.getByRole('link', { name: 'Open proof page' }), 700)
      await page.goto(new URL(href, target.base).href, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { level: 1, name: 'Refused to spend.' }).waitFor({ timeout: 30_000 })
      rec.mark('proof_page')
      await rec.hold(3500)
    },
  },
  {
    id: 'replay-key-reveal', kind: 'browser', source: 'replay', localReplay: true,
    labels: () => ({ env: 'Replay of a recorded Testnet run · no backend', backend: 'replay' }),
    async run(rec, target) {
      const { page } = rec
      await page.goto(target.base, { waitUntil: 'domcontentloaded' })
      await page.getByText(/^Replay · recorded/).first().waitFor({ timeout: 45_000 })
      await page.evaluate(() => document.fonts.ready)
      rec.mark('replay_start')
      await page.waitForFunction(() => document.title.includes('Answer ready'), null, { timeout: 60000 })
      rec.mark('replay_done')
      await rec.hold(1200)
      await rec.click(page.locator('.ra-spend:visible .ra-spending-proof > summary'))
      const card = page.getByText(/Payment unlocked by the writer/).filter({ visible: true }).first()
      await rec.glideTo(card, 1000)
      rec.mark('card_in_view')
      await rec.hold(2600)
      rec.mark('replay_back')
      const refund = page.getByText(/Refund signed by the writer/).filter({ visible: true }).first()
      await rec.glideTo(refund, 900)
      rec.mark('refund_in_view')
      await rec.hold(4600)
    },
  },
  {
    id: 'ledger', kind: 'browser', source: 'site',
    labels: () => ({ env: 'XRPL Testnet · no real value', backend: 'site' }),
    async run(rec) {
      const { page } = rec
      await page.goto(`${SITE}/ledger/`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { level: 1, name: 'Testnet ledger' }).waitFor({ timeout: 45_000 })
      await page.getByText(/Read-only check finished: \d+\/\d+ validated/).first().waitFor({ timeout: 90_000 })
      await page.evaluate(() => document.fonts.ready)
      rec.mark('ledger_loaded')
      await rec.hold(1800)
      const button = page.getByRole('button', { name: /Check these hashes/ })
      await rec.click(button)
      rec.mark('check_started')
      // Wait for the second, user-started pass to finish (the progress text changes while it runs).
      await sleep(600)
      await page.getByText(/Read-only check finished: \d+\/\d+ validated/).first().waitFor({ timeout: 90_000 })
      rec.mark('check_done')
      await rec.hold(1500)
      const firstRow = page.locator('table tbody tr').first()
      await rec.scrollIntoView(firstRow, 1500, 260)
      rec.mark('rows_in_view')
      await rec.hold(1800)
      await rec.scrollTo((await page.evaluate(() => document.scrollingElement.scrollTop)) + 520, 3200)
      await rec.hold(1200)
    },
  },
  {
    id: 'builder-feedback', kind: 'card', seconds: 23,
    labels: () => ({ env: 'Recorded unsigned simulate results · Testnet + Mainnet reads · nothing signed/submitted', backend: 'recorded-rpc' }),
    html: () => dryRunCardHtml(JSON.parse(readFileSync(join(ROOT, 'docs/evidence/dry-run-nov12/result.json'), 'utf8'))),
    marks: { feedback_loaded: 0, dry_run_verdict: 0, table_in_view: 0, mainnet_in_view: 18000 },
  },
  {
    id: 'claude-mcp', kind: 'terminal', theme: 'dark', cwd: 'claude',
    labels: () => ({ env: 'Claude Code over MCP · XRPL Testnet · no real value', backend: 'terminal' }),
    redact: () => ({ home: homedir(), user: process.env.USER, blankRows: [/\b5h:\s*\d+%/, /\b7d:\s*\d+%/] }),
    async prepare(cwd) { await prepareClaude(cwd) },
    async run(t) {
      await t.waitFor(atPrompt, { timeout: 20_000, label: 'the shell prompt' })
      await t.sleep(900)
      await t.type('claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y --package $TGZ researchagent-mcp --testnet')
      t.mark('add_typed'); await t.sleep(500); await t.enter()
      await t.waitFor(/Added stdio MCP server researchagent/, { timeout: 90_000, label: 'claude mcp add' })
      t.mark('add_done'); await t.sleep(1300)
      await t.type('claude'); await t.sleep(400); await t.enter()
      t.mark('claude_started')
      await t.waitFor(/Claude Code v[\d.]+[\s\S]*❯/, { timeout: 60_000, label: 'the Claude Code prompt' })
      await t.sleep(1800)
      await t.type(CLAUDE_PROMPT, { pace: 16 })
      t.mark('prompt_typed'); await t.sleep(700); await t.enter()
      t.mark('asked')
      await t.waitFor(screen => { if (/failed to connect|CONNECTION_CLOSED/.test(screen)) throw new Error('MCP did not connect'); return /testnet\.xrpl\.org\/transactions\//.test(screen) }, { timeout: 300_000, label: 'explorer links', approve: [/Do you want to proceed\?/, /❯ 1\. Yes/] })
      t.mark('links_visible')
      await t.waitFor(screen => /for (?:\d+m )?\d+s\s*·\s*done/.test(screen), { timeout: 240_000, stableMs: 2500, label: 'Claude to finish' })
      if (!hasTeamAuthoredResult(t.screen())) throw new Error('MCP result must visibly say team-authored')
      t.mark('done')
      await t.sleep(4000)
    },
    async cleanup(cwd) { await runCommand('claude', ['mcp', 'remove', 'researchagent'], { cwd, env: cleanEnv() }) },
  },
  {
    id: 'python-verify', kind: 'terminal', theme: 'dark', cwd: 'temp',
    async prepare(cwd) { copyFileSync(RECEIPTS, join(cwd, 'recorded.receipts.json')) },
    labels: () => ({ env: 'Python verifier · no Node · read-only XRPL Testnet lookups', backend: 'terminal' }),
    async run(t) {
      await t.waitFor(atPrompt, { timeout: 20_000, label: 'the shell prompt' })
      await t.sleep(900)
      const prompt = /\(ra\) \$ $/
      await t.type('python3 -m venv ra && . ra/bin/activate'); await t.sleep(400); await t.enter()
      await t.waitFor(screen => prompt.test(lastLine(screen) + ' '), { timeout: 90_000, label: 'the venv prompt' })
      await t.sleep(700)
      await t.type('pip install -q $WHEEL'); await t.sleep(400); await t.enter()
      t.mark('pip_started')
      await t.waitFor(screen => prompt.test(lastLine(screen) + ' '), { timeout: 240_000, label: 'pip to finish' })
      await t.sleep(700)
      await t.type('researchagent verify recorded.receipts.json --ledger'); await t.sleep(400); await t.enter()
      t.mark('verify_started')
      await t.waitFor(/RESULT PASS/, { timeout: 180_000, label: 'RESULT PASS' })
      t.mark('verify_done')
      await t.sleep(3500)
    },
  },
  {
    id: 'try-testnet', kind: 'terminal', theme: 'dark', cwd: 'temp',
    labels: () => ({ env: 'XRPL Testnet · no real value · fixture models · fictional writers', backend: 'terminal' }),
    async run(t) {
      await t.waitFor(atPrompt, { timeout: 20_000, label: 'the shell prompt' })
      await t.sleep(900)
      await t.type('npx -y --package $TGZ researchagent-mcp try --testnet'); await t.sleep(500); await t.enter()
      t.mark('try_started')
      await t.waitFor(/RESULT PASS/, { timeout: 420_000, label: 'RESULT PASS' })
      t.mark('try_done')
      await t.sleep(3500)
    },
  },
]

// The typed prompt asks for a short report so the final screen fits; everything it prints is Claude's own output.
export const CLAUDE_PROMPT = 'Use researchagent: ask_expert \'What does an x402 402 Payment Required response contain?\' with budget_sgd=2. Reply briefly: the answer in two sentences, the explorer links, and the labels on one line, including the exact team-authored label returned by the tool.'

/** Match the returned labels, rather than the instruction visible above them. */
export function hasTeamAuthoredResult(screen) {
  return /\b(?:labels?|writers?)\s*:[\s\S]*?\bteam-authored\b/i.test(screen)
}

/** What each terminal scene needs in its shell (variables only; nothing secret). */
export function terminalEnv(fresh) {
  return { REL: RELEASE, TGZ: join(fresh, 'researchagent-mcp-1.1.1.tgz'), WHEEL: join(fresh, 'researchagent-1.1.1-py3-none-any.whl'), RECEIPTS, npm_config_cache: join(fresh, 'npm-cache'), XDG_STATE_HOME: join(fresh, 'state'), PIP_DISABLE_PIP_VERSION_CHECK: '1', npm_config_update_notifier: 'false' }
}
export const cleanEnv = () => ({ PATH: process.env.PATH, HOME: process.env.HOME, TERM: 'xterm-256color' })

/** Claude Code asks once whether it may work in a folder; answer that off camera so the take starts at the prompt. */
async function prepareClaude(cwd) {
  const { captureSession } = await import('./lib/terminal.mjs')
  const scratch = scratchDir('prep-')
  try {
    await runCommand('claude', ['mcp', 'remove', 'researchagent'], { cwd, env: cleanEnv() }) // a stale server from an earlier take
    await captureSession({ id: 'prep', cwd, outDir: scratch, env: {}, script: async t => {
      await t.waitFor(atPrompt, { timeout: 20_000 })
      await t.type('claude'); await t.enter()
      await t.waitFor(/trust this folder|Claude Code v[\d.]+/, { timeout: 60_000, label: 'the trust prompt or Claude Code' })
      if (/trust this folder/.test(t.screen())) {
        // Ink attaches its key handler a moment after the first paint: press Down until "Yes" is selected, then Enter.
        await sleep(1200)
        for (let i = 0; i < 6 && !/❯\s+Yes/.test(t.screen()); i++) { await t.key('Down'); await sleep(700) }
        await t.enter()
      }
      await t.waitFor(/Claude Code v[\d.]+[\s\S]*❯/, { timeout: 60_000, label: 'the Claude Code prompt' })
      await t.sleep(800); await t.type('/exit'); await t.enter(); await t.sleep(1200)
    } })
  } finally { rmSync(scratch, { recursive: true, force: true }) }
}

export function claudeCwd() {
  const dir = process.env.VIDEO_CLAUDE_CWD ?? join(homedir(), 'ra-demo')
  const created = !existsSync(dir)
  mkdirSync(dir, { recursive: true })
  return { dir, created }
}
export { HOSTED_URL }
