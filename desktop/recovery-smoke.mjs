import { register } from 'tsx/esm/api'
register()
const { ResourceScope } = await import('../shared/resource-scope.ts')
import { _electron as electron, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createServer } from 'node:net'
const arg = flag => process.argv[process.argv.indexOf(flag) + 1]
const service = process.env.RA_DESKTOP_KEYCHAIN_SERVICE
if (!process.argv.includes('--fixture-only') || !/^ResearchAgent-Accept-[A-Za-z0-9-]+$/.test(service || '')) throw new Error('Requires --fixture-only and disposable ResearchAgent-Accept-<id> service')
for (const [name, value] of Object.entries(process.env)) if (value && (/^(?:LLM_|OPENAI_|DEEPSEEK_|CLOUDFLARE_|XRPL_|RA_API_TOKEN|RA_BACKEND_URL|RA_LIVE|RA_DESKTOP_ACCEPT_TESTNET)/.test(name))) throw new Error('Refusing credentials or network rail environment')
if (!process.argv.includes('--app') || !process.argv.includes('--output')) throw new Error('Exact --app and --output required')
const executablePath = join(resolve(arg('--app')), 'Contents/MacOS/ResearchAgent')
const output = resolve(arg('--output'))
await mkdir(dirname(output), { recursive: true })
const results = [], ipc = []
const ports = new Set()
const launch = data => electron.launch({ executablePath, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, RA_DESKTOP_KEYCHAIN_SERVICE: service, RA_DESKTOP_DATA: data, RA_DESKTOP_RECOVERY_TEST: '1' }, timeout: 30000 })
async function settings(app) {
  const next = app.waitForEvent('window')
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items.find(x => x.label === 'Settings…').click())
  const page = await next
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  return page
}
for (const fault of ['fresh-start', 'missing-key', 'deleted-key', 'locked-key', 'denied-key', 'corrupt-key', 'incomplete-config', 'remote-token-absent', 'remote-outage', 'boot-timeout', 'port-conflict']) {
  const scope = new ResourceScope()
  try {
  const data = scope.tempDir('ra-c2-')
  let listener
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, RA_DESKTOP_KEYCHAIN_SERVICE: service, RA_DESKTOP_DATA: data, RA_DESKTOP_RECOVERY_TEST: '1', ...(fault === 'fresh-start' || fault === 'port-conflict' ? {} : { RA_DESKTOP_RECOVERY_FAULT: fault }) }
  if (fault === 'port-conflict') {
    listener = createServer(); scope.defer(() => new Promise(done => listener.listening ? listener.close(done) : done())); await new Promise(done => listener.listen(0, '127.0.0.1', done))
    env.RA_DESKTOP_TEST_MCP_PORT = String(listener.address().port)
  }
  const app = await electron.launch({ executablePath, env, timeout: 30000 })
  scope.own(app)
  let apiUrl
  try {
    const main = await app.firstWindow()
    const start = performance.now()
    const prefs = await settings(app)
    const state = await prefs.evaluate(() => window.desktop.state())
    if (fault === 'boot-timeout') expect(performance.now() - start).toBeLessThan(5000)
    expect(state).not.toHaveProperty('apiToken')
    ipc.push({ fault, settingsUsable: true, noToken: true, mainRendererDenied: await main.evaluate(async () => { const calls = [() => window.desktop.state(), () => window.desktop.save({}), () => window.desktop.presence('compatible'), () => window.desktop.secret('compatible', 'synthetic'), () => window.desktop.deleteSecret('compatible'), () => window.desktop.pause(false), () => window.desktop.test(), () => window.desktop.wallets(), () => window.desktop.agents(), () => window.desktop.agentCreate('Codex', 1, 1), () => window.desktop.agentControl('invalid', 'resume'), () => window.desktop.agentCopy('invalid'), () => window.desktop.mcp()]; return (await Promise.all(calls.map(async call => { try { await call(); return false } catch { return true } }))).every(Boolean) }) })
    expect(ipc.at(-1).mainRendererDenied).toBe(true)
    if (fault === 'missing-key') {
      await main.screenshot({ path: join(dirname(output), 'missing-key.png') })
      await prefs.getByLabel('Research provider').scrollIntoViewIfNeeded()
      await prefs.screenshot({ path: join(dirname(output), 'settings.png') })
      await prefs.getByRole('button', { name: 'Test connection', exact: true }).click()
      await expect(prefs.locator('.owner-status')).toHaveText('Engine unavailable. Unlock Keychain, check configuration or retry from Recovery.')
      await mkdir(join(data, 'testnet'), { recursive: true })
      await writeFile(join(data, 'testnet', 'uncertain-intent-canary'), 'preserve-live-work')
      await main.getByRole('button', { name: 'Open offline demo', exact: true }).click()
      await expect(main.getByRole('button', { name: /^Bank of Japan decision/ })).toBeVisible({ timeout: 30000 })
      expect(await readFile(join(data, 'testnet', 'uncertain-intent-canary'), 'utf8')).toBe('preserve-live-work')
      results.push({ case: 'explicit-offline-switch', passed: true, liveStorePreserved: true })
    }
    if (fault === 'boot-timeout') {
      await main.getByRole('button', { name: 'Open offline demo', exact: true }).click()
      await expect(main.getByRole('button', { name: /^Bank of Japan decision/ })).toBeVisible({ timeout: 15000 })
    }
    if (fault === 'fresh-start') {
      await expect(main.getByRole('button', { name: /^Bank of Japan decision/ })).toBeVisible({ timeout: 30000 })
      const metadata = JSON.parse(await readFile(join(data, 'engine.json'), 'utf8')); apiUrl = metadata.apiUrl
      await main.getByRole('button', { name: /^Bank of Japan decision/ }).click()
      await main.getByRole('button', { name: /^Ask/ }).click()
      await main.getByRole('button', { name: 'Start now' }).click()
      await expect(main).toHaveTitle(/Answer ready/, { timeout: 60000 })
      await main.screenshot({ path: join(dirname(output), 'offline-answer.png') })
      const health = await main.evaluate(async () => (await fetch('/health')).json())
      if (health.publisherUrl) ports.add(health.publisherUrl)
      ports.add(apiUrl)
      const agentState = await prefs.evaluate(() => window.desktop.agents())
      if (agentState.url) ports.add(new URL(agentState.url).origin)
      // Use the main-process proxy for operator API, same bearer path as SDK.
      await prefs.evaluate(() => window.desktop.pause(true))
      await prefs.evaluate(() => window.desktop.save({ model: 'unrelated-fixture-change' }))
      await expect.poll(async () => (await prefs.evaluate(() => window.desktop.state())).wallet?.wallet?.paused, { timeout: 30000 }).toBe(true)
    }
    if (fault === 'port-conflict') await expect.poll(async () => (await prefs.evaluate(() => window.desktop.state())).restartAttempts, { timeout: 15000 }).toBeGreaterThanOrEqual(2)
    results.push({ case: fault, passed: true, evidence: fault === 'fresh-start' ? 'native fixture engine and answer; pause across restart' : 'injected native shell recovery; no real Keychain or remote call' })
  } finally {
    await app.close()
    try { const metadata = JSON.parse(await readFile(join(data, 'engine.json'), 'utf8')); ports.add(metadata.apiUrl) } catch { /* no engine reached ready */ }
    for (const url of ports) await expect(fetch(url + '/health')).rejects.toThrow()
    if (listener) await new Promise(done => listener.close(done))
  }
  if (fault === 'fresh-start') {
    const again = await launch(data)
    try { const prefs = await settings(again); await expect.poll(async () => (await prefs.evaluate(() => window.desktop.state())).wallet?.wallet?.paused, { timeout: 30000 }).toBe(true); results.push({ case: 'durable-pause-relaunch', passed: true }) }
    finally { await again.close() }
  }
  } finally { await scope.close() }
}
await writeFile(output, JSON.stringify({ fixtureOnly: true, nativeArch: process.arch, listenersAfterQuit: 0, checkedListenerCount: ports.size, cases: results, limits: 'Faults are injected before credential/network rails. Unit tests separately exercise actual bootSecrets decisions. No live provider, Keychain incident or Testnet acceptance claimed.' }, null, 2))
await writeFile(join(dirname(output), 'ipc-canaries.json'), JSON.stringify(ipc, null, 2))
console.log(`Recovery smoke passed: ${results.length} native cases`)
