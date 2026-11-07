if (process.argv.includes('--recovery')) {
  await import('./recovery-smoke.mjs')
  process.exit(0)
}
import { _electron as electron, expect } from '@playwright/test'
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:http'
import { execFileSync } from 'node:child_process'

const executablePath = process.env.DESKTOP_EXECUTABLE || '/Applications/ResearchAgent.app/Contents/MacOS/ResearchAgent'
const data = await mkdtemp(join(tmpdir(), 'researchagent-desktop-smoke-'))
await mkdir('desktop/evidence', { recursive: true })
const canary = 'desktop-secret-canary-not-a-wallet'
const start = performance.now()
const app = await electron.launch({ executablePath, args: process.env.DESKTOP_APP_PATH ? [process.env.DESKTOP_APP_PATH] : [], env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, RA_DESKTOP_DATA: data, XRPL_PAYER_SEED: canary, OPENAI_API_KEY: canary, RA_API_TOKEN: canary }, timeout: 30_000 })
let apiUrl, publisherUrl
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  const logs = []
  app.process().stdout?.on('data', chunk => logs.push(chunk.toString()))
  app.process().stderr?.on('data', chunk => logs.push(chunk.toString()))
  page.on('pageerror', error => errors.push(error.message))
  await expect(page.getByRole('textbox').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Bank of Japan decision/ })).toBeEnabled()
  const onboarding = app.windows().find(window => window.url().includes('onboarding=1'))
  if (onboarding) {
    await expect(onboarding.getByRole('heading', { name: 'Make this workspace yours' })).toBeVisible()
    await onboarding.close()
  }
  const coldStartMs = Math.round(performance.now() - start)
  const state = await app.evaluate(async ({ app, BrowserWindow }) => ({ versions: process.versions,
    preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(), path: app.getPath('userData') }))
  expect(state.preferences.contextIsolation).toBe(true)
  expect(state.preferences.nodeIntegration).toBe(false)
  expect(state.preferences.sandbox).toBe(true)
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined')
  await expect(page.evaluate(() => window.desktop.state())).rejects.toThrow()
  await expect(page.evaluate(() => fetch('https://example.com'))).rejects.toThrow()
  expect(await page.evaluate(async () => (await fetch('/data/corpus/v2/story-bible.json')).status)).toBe(403)
  ;({ apiUrl } = JSON.parse(await readFile(join(data, 'engine.json'), 'utf8')))
  const health = await (await fetch(`${apiUrl}/health`)).json()
  publisherUrl = health.publisherUrl
  expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  expect([5100, 8788, 8790]).not.toContain(Number(new URL(apiUrl).port))
  const rebindingStatus = await new Promise((done, fail) => {
    const req = request(`${apiUrl}/health`, { headers: { Host: 'rebind.example' } }, res => { res.resume(); done(res.statusCode) })
    req.on('error', fail); req.end()
  })
  expect(rebindingStatus).toBe(403)
  expect((await fetch(`${apiUrl}/api/mcp/status`)).status).toBe(401)
  expect((await fetch(`${apiUrl}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401)
  expect((await fetch(`${apiUrl}/runs`, { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: '{}' })).status).toBe(403)
  // No provider inputs are passed. This verifies fixture operation; it does not claim an OS network sandbox.
  const cases = [/^Bank of Japan decision/, /^Kestrel–TSMC outlook/, /^Malaysia packaging lead times/]
  const runs = []
  for (const [index, preset] of cases.entries()) {
    await page.goto('app://researchagent/?pace=real')
    await page.getByRole('button', { name: preset }).click()
    await page.getByRole('button', { name: /^Ask/ }).click()
    if (index === 1) await page.getByRole('button', { name: 'pricing & margins' }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 60_000 })
    await expect(page.getByText(/simulated/i).first()).toBeVisible()
    const list = await page.evaluate(async () => (await fetch('/api/runs')).json())
    const run = await page.evaluate(async id => (await fetch(`/runs/${id}`)).json(), list[0].runId)
    expect(run.answers.length).toBeGreaterThan(0)
    if (index === 0) expect(run.spentMinor).toBe(0)
    if (index === 1) { expect(run.spentMinor).toBeGreaterThan(0); expect(run.grants.length).toBeGreaterThan(0) }
    if (index === 2) { expect(run.refundedMinor).toBeGreaterThan(0); expect(run.intents.some(intent => intent.status === 'REFUNDED')).toBe(true) }
    runs.push({ useCase: `UC${index + 1}`, phase: run.phase, spentMinor: run.spentMinor, refundedMinor: run.refundedMinor, grants: run.grants.length })
    await expect(page.getByRole('complementary', { name: 'Budget and purchases' }).getByText(`S$${(run.budgetMinor / 100).toFixed(2)} budget · S$${((run.budgetMinor - run.spentMinor - run.reservedMinor) / 100).toFixed(2)} budget left · refunds don't restore budget`, { exact: true })).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: `desktop/evidence/uc${index + 1}.png` })
  }
  await page.getByText('Export ⋯', { exact: true }).click()
  const reportReady = app.waitForEvent('window')
  await page.getByRole('button', { name: /Download report/ }).click()
  const report = await reportReady
  await report.waitForLoadState()
  await expect(report.getByText('ResearchAgent evidence report').first()).toBeVisible()
  await report.close()
  const preferencesReady = app.waitForEvent('window')
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === 'Settings…').click())
  const preferences = await preferencesReady
  await expect(preferences.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  const safeState = await preferences.evaluate(() => window.desktop.state())
  expect(JSON.stringify(safeState)).not.toContain(canary)
  expect(safeState.wallet.wallet.dailyMinor).toBe(2000)
  expect(safeState.wallet.wallet.paused).toBe(false)
  expect(safeState).not.toHaveProperty('apiToken')
  await preferences.close()
  for (const entry of await readdir(data, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) expect((await readFile(join(entry.parentPath, entry.name))).includes(Buffer.from(canary))).toBe(false)
  }
  expect(logs.join('')).not.toContain(canary)
  expect(errors).toEqual([])
  const listeners = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' }).split('\n').filter(line => line.includes(new URL(apiUrl).port))
  expect(listeners.every(line => !line.includes('*:'))).toBe(true)
  const result = { executablePath, coldStartMs, versions: { electron: state.versions.electron, node: state.versions.node, chrome: state.versions.chrome }, fixture: true, runs, errors, apiUrl, listeners }
  await writeFile('desktop/evidence/metrics.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await app.close()
  if (apiUrl) await expect(fetch(`${apiUrl}/health`)).rejects.toThrow()
  if (publisherUrl) await expect(fetch(`${publisherUrl}/health`)).rejects.toThrow()
  await rm(data, { recursive: true, force: true })
}
