// Run with node --import tsx; never send dotenv credentials to the Electron parent env.
import 'dotenv/config'
import { _electron as electron, expect } from '@playwright/test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Store } from '../server/store.ts'
import { USE_CASES } from '../tests/scenarios/use-cases.ts'
import { Wallet } from 'xrpl'
import { createHash } from 'node:crypto'
import { lookupTx, testnetLedger } from '../shared/xrpl.ts'
const service = `ResearchAgent-Accept-${Date.now()}`
process.env.RA_DESKTOP_KEYCHAIN_SERVICE = service
const { readSecret, writeSecret } = await import('./keychain.mjs')
const accounts = []
async function put(account, value) { if (!value) throw new Error(`Missing acceptance credential: ${account}`); await writeSecret(account, value); accounts.push(account) }
const results = []
const output = resolve('desktop/evidence/acceptance.json')
await mkdir('desktop/evidence', { recursive: true })
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const dmg = resolve(process.env.DESKTOP_DMG || `desktop/out/ResearchAgent-${process.env.DESKTOP_VERSION || pkg.version}-${process.env.DESKTOP_ARCH || 'arm64'}.dmg`)
const mount = await mkdtemp(join(tmpdir(), 'ra-dmg-'))
execFileSync('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg], { stdio: 'ignore' })
const executablePath = join(mount, 'ResearchAgent.app/Contents/MacOS/ResearchAgent')
async function run(live) {
  const data = await mkdtemp(join(tmpdir(), 'ra-accept-'))
  // Keep isolated journals for inspection; a failed live run must never be blindly replayed.
  await writeFile(join(data, 'desktop.json'), JSON.stringify({ live, paused: false, maxMinor: 100, dailyMinor: 100, walletDailyMinor: 100, backend: 'local' }))
  console.log(live ? 'Launching packaged Testnet acceptance' : 'Launching packaged fixture/crash acceptance')
  const start = performance.now()
  const app = await electron.launch({ executablePath, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, RA_DESKTOP_DATA: data, RA_DESKTOP_KEYCHAIN_SERVICE: service, RA_DESKTOP_ACCEPT_TESTNET: live ? '1' : '0', RA_DESKTOP_CRASH_TEST: live ? '0' : '1' }, timeout: 60000 })
  let store, client
  try {
    const page = await app.firstWindow()
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 60000 })
    console.log('Packaged UI interactive')
    const coldStartMs = Math.round(performance.now() - start)
    if (process.argv.includes('--launch-only')) return { live: false, data, coldStartMs, arch: await app.evaluate(() => process.arch), launchOnly: true }
    const windowReady = app.waitForEvent('window')
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items.find(i => i.label === 'Desktop Settings…').click())
    const prefs = await windowReady
    await expect(prefs.getByRole('heading', { name: 'Desktop settings' })).toBeVisible({ timeout: 60000 })
    const { id } = await prefs.evaluate(() => window.desktop.agentCreate('Codex', 100, 100))
    accounts.push(`agent-${id}`)
    const token = await readSecret(`agent-${id}`)
    const connect = async () => {
      const { url } = await prefs.evaluate(() => window.desktop.agents())
      client = new Client({ name: 'packaged-acceptance', version: '1' })
      await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
    }
    await connect()
    store = new Store(join(data, live ? 'testnet' : 'fixture', 'app.db'))
    const args = { question: USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), budget_sgd: 1, idempotency_key: 'packaged-single-purchase' }
    const pending = client.callTool({ name: 'ask_expert', arguments: args }, undefined, { timeout: 180000 }).catch(() => undefined)
    let before
    if (!live) {
      await expect.poll(() => store.listRuns().flatMap(r => store.getRun(r.runId).intents).filter(i => store.getSubmission(i.intentId)).length, { timeout: 60000, intervals: [5] }).toBe(1)
      const intent = store.listRuns().flatMap(r => store.getRun(r.runId).intents)[0]
      before = store.getSubmission(intent.intentId)
      const { pid, apiUrl } = JSON.parse(await readFile(join(data, 'engine.json'), 'utf8'))
      console.log('Killing engine after durable signing')
      process.kill(pid, 'SIGKILL')
      await expect.poll(async () => {
        const next = JSON.parse(await readFile(join(data, 'engine.json'), 'utf8'))
        return next.pid !== pid && next.apiUrl !== apiUrl
      }, { timeout: 60000 }).toBe(true)
      console.log('Engine restarted; reconnecting MCP')
      await client.close(); await connect()
    }
    const response = live ? await pending : await client.callTool({ name: 'ask_expert', arguments: args }, undefined, { timeout: 180000 })
    if (!response || response.isError) throw new Error('Acceptance ask failed; inspect isolated journal before another live run')
    const runId = JSON.parse(response.content[0].text).run_id
    await expect.poll(() => store.getRun(runId).grants.length, { timeout: 120000 }).toBe(1)
    console.log('Grant recovered; checking receipt and replay')
    const run = store.getRun(runId)
    expect(run.receipts).toHaveLength(1); expect(run.intents).toHaveLength(1)
    const submission = store.getSubmission(run.intents[0].intentId)
    if (before) expect(submission).toEqual(before)
    let ledgerResult
    if (live) {
      const ledger = testnetLedger()
      try { ledgerResult = await lookupTx(ledger, run.receipts[0].xrpl.txHash) } finally { await ledger.close() }
      expect(ledgerResult.tx.Account).toBe(Wallet.fromSeed(process.env.XRPL_PAYER_SEED).classicAddress)
      expect(ledgerResult.state).toBe('validated'); expect(ledgerResult.meta.TransactionResult).toBe('tesSUCCESS')
    }
    const replay = await client.callTool({ name: 'ask_expert', arguments: args })
    expect(JSON.parse(replay.content[0].text).run_id).toBe(runId)
    expect(store.getRun(runId).receipts).toHaveLength(1)
    return { live, data, coldStartMs, arch: await app.evaluate(() => process.arch), runId, spentMinor: run.spentMinor, labels: run.labels, crashRecovered: !live, sameSubmission: !!before, txHash: run.receipts[0].xrpl?.txHash, ledger: ledgerResult }
  } finally { await client?.close(); store?.close(); await app.close() }
}
try {
  results.push(await run(false))
  if (!process.argv.includes('--fixture-only') && !process.argv.includes('--launch-only')) {
    await put('xrpl-payer', process.env.XRPL_PAYER_SEED)
    // Fixtures perform research/decisions. These are explicit placeholders, not model credentials.
    await put('deepseek', 'fixture-acceptance'); await put('openai', 'fixture-acceptance')
    const roster = JSON.parse(await readFile(resolve('desktop/dist/desktop/wallets.json'), 'utf8'))
    for (const account of roster) await put(account, process.env[account])
    results.push(await run(true))
  }
  const evidence = { sha256: createHash('sha256').update(await readFile(dmg)).digest('hex'), at: new Date().toISOString(), executablePath, dmg, bytes: (await stat(dmg)).size, results }
  await writeFile(`desktop/evidence/acceptance-${results[0].arch}.json`, JSON.stringify(evidence, null, 2))
  await writeFile(output, JSON.stringify(evidence, null, 2))
  await writeFile('docs/evidence/app-acceptance.md', `# Packaged app acceptance\n\nFresh process and isolated user data; filesystem cache not flushed. Test Keychain service only. Fictional corpus; fixture research/decisions. Live row is XRPL Testnet value only, paid by the packaged utility engine from the seed read through the app Keychain path. Fixture crash kills the utility process after durable signing, before delayed delivery; recovery must retain the identical submission and one receipt/grant. Agent creation uses Settings IPC and the HTTP MCP SDK client uses its Keychain bearer. No owner Keychain entries touched.\n\nCommand: OFFSET=1100 make app-accept\n\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\`\n`)
  console.log(JSON.stringify({ bytes: evidence.bytes, results: results.map(({ coldStartMs, txHash, crashRecovered }) => ({ coldStartMs, txHash, crashRecovered })) }))
} finally {
  execFileSync('hdiutil', ['detach', mount], { stdio: 'ignore' })
  for (const account of accounts) {
    try { execFileSync('/usr/bin/security', ['delete-generic-password', '-s', service, '-a', account], { stdio: 'ignore' }) } catch { /* Missing item is harmless. */ }
  }
}
