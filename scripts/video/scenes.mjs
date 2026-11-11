// The scenes of the demo video, one clip each. Every wait is a condition on what is on screen, never a fixed guess;
// every interaction is a gentle glide or an eased scroll. `marks` name the moments the cut (shots.json) refers to.
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { HOSTED_URL, QUESTIONS, REPO, RECEIPTS, RELEASE, ROOT, SITE, TGZ, WHEEL, scratchDir, sleep } from './config.mjs'
import { closeCardHtml, titleCardHtml } from './lib/cards.mjs'
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
  await rec.click(box)
  await rec.type(box, question)
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

function hostedContext(target) { return { ignoreHTTPSErrors: target.kind === 'local' } }
async function openHome(rec, target) {
  const { page } = rec
  await page.goto(`${target.base}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { level: 1, name: 'Research with a wallet.' }).waitFor({ timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
  rec.mark('orientation')
  const pill = page.getByRole('button', { name: /Testnet demo|Shared demo/ }).first()
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
      const verify = page.getByRole('heading', { name: /Verify (on XRPL )?in your browser/ })
      await rec.scrollIntoView(verify, 1500, 140)
      rec.mark('verify_in_view')
      await rec.hold(900)
      await rec.click(page.getByRole('button', { name: 'Run the checks' }))
      rec.mark('verify_started')
      // "All N checks passed", or "N passed · K not checked" when a group (writer identity) is skipped. Never "checks failed".
      await page.getByRole('status').filter({ hasText: /^(?:All \d+ checks passed|\d+ passed · \d+ not checked)/ }).first().waitFor({ timeout: 90_000 })
      rec.mark('verify_done')
      await rec.hold(3500)
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
      rec.labels.models = (await page.getByRole('button', { name: /Testnet demo|Shared demo/ }).first().innerText().catch(() => '')).trim()
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
    id: 'replay-key-reveal', kind: 'browser', source: 'replay',
    labels: () => ({ env: 'Replay of a recorded Testnet run · no backend', backend: 'replay' }),
    async run(rec) {
      const { page } = rec
      await page.goto(`${SITE}/demo/`, { waitUntil: 'domcontentloaded' })
      await page.getByText(/^Replay · recorded/).first().waitFor({ timeout: 45_000 })
      await page.evaluate(() => document.fonts.ready)
      rec.mark('replay_start')
      await page.getByText(/Done in [\d.]+ s/).first().waitFor({ timeout: 60_000 })
      rec.mark('replay_done')
      await rec.hold(1200)
      const card = page.getByText(/Payment unlocked by the writer/).filter({ visible: true }).first()
      await rec.glideTo(card, 1000)
      rec.mark('card_in_view')
      await rec.hold(2600)
      // Step 2 of the payment card is the EscrowFinish: the key published on the ledger.
      const keyRow = page.getByText('Writer released the key').filter({ visible: true }).first()
      const link = keyRow.locator('a[href*="testnet.xrpl.org"]').first()
      await rec.glideTo(link, 900)
      await rec.hold(900)
      rec.mark('tx_hover')
      const href = await link.getAttribute('href')
      await rec.click(link, 300)
      await page.goto(href, { waitUntil: 'domcontentloaded' })
      // The explorer asks about cookies first; the cut starts after the banner is gone.
      const reject = page.getByRole('button', { name: /Reject Non-Essential/i })
      await reject.waitFor({ timeout: 25_000 }).then(() => reject.click(), () => undefined)
      await page.getByText('Escrow Fulfillment').first().waitFor({ timeout: 45_000 })
      await rec.hold(500)
      rec.mark('explorer_ready')
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('*')) {
          if (el.children.length === 0 && /^(EscrowFinish|Escrow Fulfillment|Success)$/.test(el.textContent?.trim() ?? '')) {
            const target = el.closest('div') ?? el
            target.style.cssText += ';outline:3px solid rgba(47,122,58,.55);outline-offset:6px;border-radius:6px'
          }
        }
      })
      await rec.hold(3600)
      rec.mark('explorer_done')
      // Back to the replay for the refund: the writer-signed refund line and the promise it failed.
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await page.getByText(/Done in [\d.]+ s/).first().waitFor({ timeout: 60_000 })
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
    id: 'builder-feedback', kind: 'browser', source: 'github',
    labels: () => ({ env: 'XRPL Testnet · no real value', backend: 'github' }),
    async run(rec) {
      const { page } = rec
      await page.goto(`${REPO}/blob/main/docs/BUILDER-FEEDBACK.md`, { waitUntil: 'domcontentloaded' })
      const doc = page.locator('article.markdown-body, .markdown-body').first()
      await doc.waitFor({ timeout: 45_000 })
      await page.evaluate(() => document.fonts.ready)
      // The file tree beside the page is noise in a video: fold it away, as a reader would.
      const collapse = page.getByRole('button', { name: /collapse file tree/i })
      if (await collapse.count()) await rec.click(collapse.first(), 700)
      rec.mark('feedback_loaded')
      await rec.hold(1800)
      const table = page.locator('.markdown-body table').first()
      if (await table.count()) { await rec.scrollIntoView(table, 1400, 180); rec.mark('table_in_view'); await rec.hold(7200) }
      const mainnet = page.locator('.markdown-body h2, .markdown-body h3').filter({ hasText: /mainnet/i }).first()
      if (await mainnet.count()) { await rec.scrollIntoView(mainnet, 1800, 160); rec.mark('mainnet_in_view'); await rec.hold(3200) }
    },
  },
  {
    id: 'claude-mcp', kind: 'terminal', theme: 'dark', cwd: 'claude',
    labels: () => ({ env: 'Claude Code over MCP · XRPL Testnet · no real value', backend: 'terminal' }),
    redact: () => ({ home: homedir(), user: process.env.USER, blankRows: [/\b5h:\s*\d+%/, /\b7d:\s*\d+%/] }),
    async prepare(cwd) { await prepareClaude(cwd) },
    async run(t) {
      await t.waitFor(atPrompt, { timeout: 20_000, label: 'the shell prompt' })
      await t.sleep(900)
      await t.type('claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y $TGZ --testnet')
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
      await t.waitFor(/testnet\.xrpl\.org\/transactions\//, { timeout: 300_000, label: 'explorer links', approve: [/Do you want to proceed\?/, /❯ 1\. Yes/] })
      t.mark('links_visible')
      await t.waitFor(screen => /for (?:\d+m )?\d+s\s*·\s*done/.test(screen), { timeout: 240_000, stableMs: 2500, label: 'Claude to finish' })
      t.mark('done')
      await t.sleep(4000)
    },
    async cleanup(cwd) { await runCommand('claude', ['mcp', 'remove', 'researchagent'], { cwd, env: cleanEnv() }) },
  },
  {
    id: 'python-verify', kind: 'terminal', theme: 'dark', cwd: 'temp',
    labels: () => ({ env: 'Python verifier · no Node · read-only XRPL Testnet lookups', backend: 'terminal' }),
    async run(t) {
      await t.waitFor(atPrompt, { timeout: 20_000, label: 'the shell prompt' })
      await t.sleep(900)
      const prompt = /\(ra\) \$ $/
      await t.type('python3 -m venv ra && . ra/bin/activate'); await t.sleep(400); await t.enter()
      await t.waitFor(screen => prompt.test(lastLine(screen) + ' '), { timeout: 90_000, label: 'the venv prompt' })
      await t.sleep(700)
      await t.type('pip install -q $REL/researchagent-1.1.0-py3-none-any.whl'); await t.sleep(400); await t.enter()
      t.mark('pip_started')
      await t.waitFor(screen => prompt.test(lastLine(screen) + ' '), { timeout: 240_000, label: 'pip to finish' })
      await t.sleep(700)
      await t.type('curl -sLO https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/v1.1.0/docs/evidence/lane-b3/UC3.receipts.json'); await t.sleep(400); await t.enter()
      await t.waitFor(screen => prompt.test(lastLine(screen) + ' '), { timeout: 60_000, label: 'curl to finish' })
      await t.sleep(700)
      await t.type('researchagent verify UC3.receipts.json --ledger'); await t.sleep(400); await t.enter()
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
      await t.type('npx -y $TGZ try --testnet'); await t.sleep(500); await t.enter()
      t.mark('try_started')
      await t.waitFor(/RESULT PASS/, { timeout: 420_000, label: 'RESULT PASS' })
      t.mark('try_done')
      await t.sleep(3500)
    },
  },
]

// The typed prompt asks for a short report so the final screen fits; everything it prints is Claude's own output.
export const CLAUDE_PROMPT = 'Use researchagent: ask_expert \'What does an x402 402 Payment Required response contain?\' with budget_sgd=2. Reply briefly: the answer in two sentences, the explorer links, and the labels on one line.'

/** What each terminal scene needs in its shell (variables only; nothing secret). */
export function terminalEnv(fresh) {
  return { REL: RELEASE, TGZ, WHEEL, RECEIPTS, npm_config_cache: join(fresh, 'npm-cache'), XDG_STATE_HOME: join(fresh, 'state'), PIP_DISABLE_PIP_VERSION_CHECK: '1', npm_config_update_notifier: 'false' }
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
