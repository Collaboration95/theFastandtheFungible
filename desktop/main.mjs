import { receiptBundle } from '../server/receipt-bundle.js'
import { Store } from '../server/store.js'
import { startMcpHttp } from '../mcp/http.js'
import { app, BrowserWindow, Menu, protocol, session, ipcMain, utilityProcess, shell, clipboard } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORIGIN, CSP, defaults, settings, trustedSender, engineEnv, SECRET_ACCOUNTS, remoteOrigin } from './policy.mjs'
import { bootSecrets } from './recovery.mjs'
import { readSecret, writeSecret, secretPresence, deleteSecret } from './keychain.mjs'
import { backendRequest, testProvider } from './backend.mjs'
import { loadConfig } from '../server/config.js'
import { createClient } from '../sdk/index.js'
import { Client, Wallet } from 'xrpl'
import { TESTNET_WSS, testnetUrl } from '../shared/xrpl.js'

import { checkUpdates } from './updates.mjs'

const started = performance.now()
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }])
if (process.env.RA_DESKTOP_DATA) app.setPath('userData', resolve(process.env.RA_DESKTOP_DATA))
app.setName('ResearchAgent')
let mcpHttp, agentStore
let engine, child, mainWindow, preferencesWindow, quitting = false
let preferences = { ...defaults }
let coldStartMs, configError = false
let windowBounds = { width: 1280, height: 828 }
let engineStatus = 'starting', restartAttempts = 0, restartTimer
let localEnv, recovering = false, connectRequested = false, bootSequence = 0
const emergencyPaused = process.env.SPENDING_PAUSED === '1'
function status(value) {
  engineStatus = value
  mainWindow?.setTitle(`ResearchAgent · ${value}`)
}
async function startLocalEngine(sequence = bootSequence) {
  if (quitting || sequence !== bootSequence) return
  status(restartAttempts ? 'reconnecting' : 'starting')
  const target = utilityProcess.fork(join(root, 'desktop', 'engine-host.mjs'), [], { env: localEnv, cwd: root, stdio: 'ignore', serviceName: 'ResearchAgent Engine' })
  child = target
  const startedEngine = await new Promise((done, fail) => {
    const timer = setTimeout(() => { target.kill(); fail(new Error('Engine boot timed out')) }, process.arch === 'x64' ? 120_000 : 30_000)
    target.once('message', value => { clearTimeout(timer); done(value) })
    target.once('exit', () => { clearTimeout(timer); fail(new Error('Engine exited')) })
  })
  if (quitting || sequence !== bootSequence) { target.kill(); return }
  engine = startedEngine
  // Keep the operator bearer stable for already enabled stdio clients across utility restarts.
  localEnv.RA_API_TOKEN = engine.apiToken
  if (quitting || sequence !== bootSequence) { target.kill(); return }
  const store = new Store(join(userData, preferences.live ? 'testnet' : 'fixture', 'app.db'))
  let listener
  try { listener = await startMcpHttp({ apiUrl: engine.apiUrl, store, port: process.env.RA_DESKTOP_KEYCHAIN_SERVICE ? Number(process.env.RA_DESKTOP_TEST_MCP_PORT || 0) : 9689 }) }
  catch (error) { store.close(); throw error }
  if (quitting || sequence !== bootSequence) { await listener.close(); store.close(); target.kill(); return }
  agentStore = store; mcpHttp = listener
  target.once('exit', () => { if (!quitting && child === target) { child = undefined; void restartEngine(sequence) } })
  await writeFile(join(userData, 'engine.json'), JSON.stringify({ apiUrl: engine.apiUrl, remote: false, pid: target.pid }), { mode: 0o600 })
  status('ready')
  if (mainWindow && !quitting) await mainWindow.loadURL(`${ORIGIN}/?pace=real`)
}
async function restartEngine(sequence = bootSequence) {
  if (quitting || sequence !== bootSequence) return
  status('reconnecting')
  await mcpHttp?.close(); mcpHttp = undefined
  agentStore?.close(); agentStore = undefined
  if (quitting || recovering || sequence !== bootSequence) return
  if (restartAttempts >= 5) { await showRecovery(); return }
  const delay = Math.min(30_000, 500 * 2 ** Math.min(restartAttempts++, 6))
  restartTimer = setTimeout(() => { void startLocalEngine(sequence).catch(async () => {
    if (quitting || sequence !== bootSequence) return
    const target = child; child = undefined; target?.kill()
    await showRecovery()
    await restartEngine(sequence)
  }) }, delay)
}
const userData = app.getPath('userData')
async function stopEngine() {
  clearTimeout(restartTimer)
  await mcpHttp?.close(); mcpHttp = undefined
  agentStore?.close(); agentStore = undefined
  if (!child) return
  const target = child; child = undefined
  await new Promise(done => {
    const timer = setTimeout(() => { target.kill(); done() }, 5000)
    target.once('exit', () => { clearTimeout(timer); done() })
    target.postMessage('close')
  })
}
async function boot() {
  await app.whenReady()
  await mkdir(userData, { recursive: true })
  try { const b = JSON.parse(await readFile(join(userData, 'window.json'), 'utf8')); if (Number.isFinite(b.width) && Number.isFinite(b.height)) windowBounds = { width: Math.max(800, Math.min(2560, b.width)), height: Math.max(600, Math.min(1600, b.height)), ...(Number.isFinite(b.x) && Number.isFinite(b.y) ? { x: b.x, y: b.y } : {}) } } catch { /* first run */ }
  app.setAboutPanelOptions({ applicationName: 'ResearchAgent', applicationVersion: app.getVersion(), copyright: 'MIT licence · ResearchAgent' })
  try { preferences = settings(JSON.parse(await readFile(join(userData, 'desktop.json'), 'utf8'))) } catch (error) { configError = error.code !== 'ENOENT' }
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(`${ORIGIN}/`) }))
  await protocol.handle('app', async request => {
    const url = new URL(request.url)
    if (url.host !== 'researchagent') return new Response(null, { status: 403 })
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }
    if (/^\/(?:health|runs(?:\/|$)|api(?:\/|$)|proof(?:\/|$)|w(?:\/|$))/.test(url.pathname)) {
      try {
        const response = await backendRequest(engine, url.pathname + url.search, { method: request.method,
          ...(!['GET', 'HEAD'].includes(request.method) ? { body: await request.text() } : {}), signal: request.signal })
        return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers } })
      } catch { return new Response('Local engine unavailable', { status: 503, headers }) }
    }
    const pathname = url.pathname === '/recovery' ? '/desktop/recovery.html' : url.pathname === '/preferences' ? '/ui/index.html' : url.pathname === '/desktop/preferences.js' || url.pathname === '/desktop/preferences.css' || url.pathname === '/desktop/recovery.js' || url.pathname === '/desktop/tokens.css' || url.pathname === '/desktop/geist.woff2' ? url.pathname : url.pathname === '/' ? '/ui/index.html' : `/ui${url.pathname}`
    const file = resolve(root, `.${decodeURIComponent(pathname)}`)
    if (!file.startsWith(root + sep) || !['.html', '.js', '.css', '.svg', '.png', '.ico', '.woff2', '.webmanifest'].includes(extname(file))) return new Response(null, { status: 403 })
    try {
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
      let body = await readFile(file)
      if (file === join(root, 'ui/index.html') && preferences.backend === 'remote') body = body.toString().replace('<head>', `<head><meta name="researchagent-backend" content="${new URL(engine.apiUrl).host}">`)
      return new Response(body, { headers: { ...headers, 'Content-Type': mime[extname(file)] } })
    } catch { return new Response(null, { status: 404 }) }
  })
  const secureHandler = (name, handler) => ipcMain.handle(name, async (event, ...args) => {
    if (!trustedSender(event) || !(event.sender === preferencesWindow?.webContents || event.sender === mainWindow?.webContents) || !(new URL(event.senderFrame.url).pathname === '/preferences' || new URL(event.senderFrame.url).searchParams.has('settings') || new URL(event.senderFrame.url).searchParams.has('onboarding'))) throw new Error('Forbidden')
    try { return await handler(...args) } catch { throw new Error('Desktop action failed; check settings and Keychain access') }
  })
  secureHandler('desktop:prompt-budget', input => { if (!agentStore || !Number.isInteger(input?.budgetMinor) || input.budgetMinor < 0 || input.budgetMinor > 500 || typeof input.universal !== 'boolean') throw new Error('Invalid prompt budget'); agentStore.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'prompt-budget-change', budgetMinor: input.budgetMinor, universal: input.universal } }); return { saved: true } })
  secureHandler('desktop:receipts', id => { if (!agentStore || typeof id !== 'string') throw Error('Run unavailable'); return receiptBundle(agentStore, id) })
  secureHandler('desktop:export', async () => { if (!agentStore) throw new Error('Engine unavailable'); return { label: preferences.live ? 'XRPL TESTNET' : 'SIMULATED', runs: agentStore.listRuns().map(r => receiptBundle(agentStore, r.runId)), audit: agentStore.auditEntries() } })
  secureHandler('desktop:reset', async confirmation => { if (confirmation !== 'RESET SETTINGS') throw new Error('Confirmation required'); if (!agentStore) throw new Error('Engine unavailable'); agentStore.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'settings-reset' } }); preferences = settings({ ...defaults, onboarded: false }); await writeFile(join(userData, 'desktop.json'), JSON.stringify(preferences), { mode: 0o600 }); await connectEngine() })
  secureHandler('desktop:updates', () => checkUpdates())
  secureHandler('desktop:state', async () => ({ ...preferences, engineStatus, restartAttempts, remoteEnabled: true, coldStartMs,
    runs: agentStore?.listRuns().map(r => ({runId:r.runId, question:r.question})) || [], version: app.getVersion(), storage: userData, emergencyPaused, wallet: engine ? await createClient({ baseUrl: engine.apiUrl, token: engine.apiToken }).wallet().catch(() => undefined) : undefined, versions: engine?.versions }))
  secureHandler('desktop:save', async input => {
    const next = settings({ ...preferences, ...input })
    if (agentStore) agentStore.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'desktop-settings-save', before: preferences, after: next } })
    else { const auditStore = new Store(join(userData, preferences.live ? 'testnet' : 'fixture', 'app.db')); try { auditStore.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'desktop-settings-save', before: preferences, after: next } }) } finally { auditStore.close() } }
    await writeFile(join(userData, 'desktop.json'), JSON.stringify(next), { mode: 0o600 })
    preferences = next; configError = false
    await connectEngine()
  })
  secureHandler('desktop:pause', async paused => {
    if (typeof paused !== 'boolean' || (!paused && emergencyPaused) || !engine) throw new Error('Pause unavailable')
    const response = await backendRequest(engine, '/api/wallet/pause', { method: 'POST', body: JSON.stringify({ paused }) })
    if (!response.ok) throw new Error('Pause rejected')
    return { paused }
  })
  secureHandler('desktop:presence', account => secretPresence(account))
  secureHandler('desktop:delete', async account => {
    if (!SECRET_ACCOUNTS.includes(account)) throw new Error('Invalid account')
    try { const presence = await deleteSecret(account); void connectEngine(); return { ...presence, deleted: true } }
    catch { return { ...await secretPresence(account), deleted: false } }
  })
  secureHandler('desktop:secret', async (account, value) => {
    if (!SECRET_ACCOUNTS.includes(account) || typeof value !== 'string' || value.length > 4096 || !value.trim()) throw new Error('Invalid credential')
    try { await writeSecret(account, value.trim()) }
    catch { return { ...await secretPresence(account), saved: false } }
    void connectEngine()
    return { saved: true, present: true, available: true }
  })
  secureHandler('desktop:test', () => testProvider(engineStatus === 'ready' ? engine : undefined, preferences))
  secureHandler('desktop:wallets', async () => {
    if (process.env.RA_DESKTOP_RECOVERY_TEST === '1') throw new Error('Fixture-only acceptance')
    const client = new Client(testnetUrl(TESTNET_WSS))
    await client.connect()
    try {
      const accounts = ['xrpl-payer', ...JSON.parse(await readFile(join(root, 'desktop', 'wallets.json'), 'utf8'))]
      const addresses = []
      for (const account of accounts) {
        const stored = await readSecret(account)
        const wallet = stored ? Wallet.fromSeed(stored) : Wallet.generate()
        // Persist before funding so a faucet outage never loses an account.
        if (!stored) await writeSecret(account, wallet.seed)
        await client.fundWallet(wallet)
        addresses.push({ role: account, address: wallet.classicAddress })
      }
      return addresses
    } finally { await client.disconnect() }
  })
  const clients = ['Claude Desktop', 'Claude Code', 'Cursor', 'Codex']
  secureHandler('desktop:agents', async () => ({ url: mcpHttp?.url, agents: agentStore ? agentStore.agentKeys.list().map(key => ({ ...agentStore.agentStatus(key.id), lastCall: agentStore.lastMcpCall(key.id) })) : [] }))
  secureHandler('desktop:agent-create', async (name, maxMinor, dailyMinor) => {
    if (!agentStore || !clients.includes(name) || !Number.isSafeInteger(dailyMinor) || dailyMinor > preferences.walletDailyMinor) throw new Error('Invalid agent')
    const key = agentStore.addAgent({ name, maxMinor, dailyMinor })
    try { await writeSecret(`agent-${key.id}`, key.token) }
    catch { agentStore.setAgentPaused(key.id, true, true); throw new Error('Keychain failed') }
    return { id: key.id }
  })
  secureHandler('desktop:agent-control', async (id, operation) => {
    if (!agentStore || typeof id !== 'string' || !['pause', 'resume', 'revoke'].includes(operation)) throw new Error('Invalid control')
    agentStore.setAgentPaused(id, operation !== 'resume', operation === 'revoke')
  })
  secureHandler('desktop:agent-copy', async id => {
    const agent = agentStore?.agentKeys.get(id)
    if (!agent || agent.revoked || !mcpHttp) throw new Error('Agent unavailable')
    const token = await readSecret(`agent-${id}`)
    if (!token) throw new Error('Credential missing')
    const url = mcpHttp.url
    let snippet
    if (agent.name === 'Claude Code') snippet = `claude mcp add --transport http researchagent ${url} --header "Authorization: Bearer ${token}"`
    else if (agent.name === 'Codex') snippet = `[mcp_servers.researchagent]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${token}" }`
    else if (agent.name === 'Claude Desktop') snippet = JSON.stringify({ mcpServers: { researchagent: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${token}`] } } }, null, 2)
    else snippet = JSON.stringify({ mcpServers: { researchagent: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
    clipboard.writeText(snippet)
    return { copied: true }
  })
  secureHandler('desktop:mcp', async () => {
    // Persist only when the operator explicitly enables the external MCP adapter.
    if (preferences.backend === 'local') {
      await writeSecret('local-api-token', engine.apiToken)
      preferences.mcpEnabled = true
      await writeFile(join(userData, 'desktop.json'), JSON.stringify(preferences), { mode: 0o600 })
    }
    // Uses the system Node, not ELECTRON_RUN_AS_NODE (which would expose the signing runtime).
    const command = `claude mcp add researchagent -- node '${join(root, 'desktop', 'mcp.mjs').replaceAll("'", "'\\''")}' '${userData.replaceAll("'", "'\\''")}'`
    clipboard.writeText(command); return command
  })
  for (const operation of ['settings', 'offline', 'retry']) ipcMain.handle(`recovery:${operation}`, async event => {
    if (!trustedSender(event) || event.sender !== mainWindow?.webContents || new URL(event.senderFrame.url).pathname !== '/recovery') throw new Error('Forbidden')
    if (operation === 'settings') return openPreferences()
    if (operation === 'offline') {
      if (process.env.RA_DESKTOP_RECOVERY_TEST === '1' && process.env.RA_DESKTOP_KEYCHAIN_SERVICE?.startsWith('ResearchAgent-Accept-')) delete process.env.RA_DESKTOP_RECOVERY_FAULT
      configError = false
      preferences = settings({ ...preferences, live: false, backend: 'local', mcpEnabled: false })
      await writeFile(join(userData, 'desktop.json'), JSON.stringify(preferences), { mode: 0o600 })
    }
    if (operation !== 'settings') void connectEngine()
  })
  const shortcut = (label, accelerator, key, code) => ({ label, accelerator, click: () => mainWindow?.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers: ['meta'], ...(code ? { code } : {}) }) })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ResearchAgent', submenu: [{ role: 'about' }, { label: 'Check for Updates…', click: () => void checkUpdates() }, { label: 'Settings…', accelerator: 'Cmd+,', click: () => openPreferences() }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] },
    { label: 'File', submenu: [shortcut('New Question', 'Cmd+N', 'N'), { label: 'Print…', accelerator: 'Cmd+P', click: () => BrowserWindow.getFocusedWindow()?.webContents.print() }, { role: 'close' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [shortcut('Run', 'Cmd+1', '1'), shortcut('Writers', 'Cmd+2', '2'), shortcut('Command Menu', 'Cmd+K', 'K'),
      { label: 'Record Mode · 1280 × 800', click: () => { mainWindow.setContentSize(1280, 800); void mainWindow.loadURL(`${ORIGIN}/?record=1`) } },
      { label: 'Leave Record Mode', click: () => { void mainWindow.loadURL(`${ORIGIN}/`) } }] },
    { label: 'Run', submenu: [shortcut('Submit / Go Now', 'Cmd+Return', 'Return'), shortcut('Stop Buying', 'Cmd+.', '.')] }, { role: 'windowMenu' },
  ]))
  mainWindow = makeWindow(windowBounds)
  mainWindow.on('close', () => { void writeFile(join(userData, 'window.json'), JSON.stringify(mainWindow.getBounds()), { mode: 0o600 }).catch(() => {}) })
  await mainWindow.loadURL(`${ORIGIN}/recovery`)
  mainWindow.show()
  if (!preferences.onboarded && !process.env.RA_DESKTOP_KEYCHAIN_SERVICE) openPreferences(true)
  if (!process.env.RA_DESKTOP_KEYCHAIN_SERVICE) { const timer = setTimeout(() => void checkUpdates({ quiet: true }), 10000); timer.unref() }
  coldStartMs = Math.round(performance.now() - started)
  console.log(`ResearchAgent shell ready in ${coldStartMs} ms · ${preferences.backend === 'remote' ? 'REMOTE' : preferences.live ? 'XRPL TESTNET' : 'SIMULATED'} · Electron ${process.versions.electron} · Node ${process.versions.node}`)
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus() })
  app.on('activate', () => mainWindow?.show())
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', event => {
    if (quitting) return
    event.preventDefault(); quitting = true; bootSequence++
    void stopEngine().finally(() => app.quit())
  })
  void connectEngine()
}
async function showRecovery() {
  status('recovery')
  engine = undefined
  if (mainWindow && !quitting) await mainWindow.loadURL(`${ORIGIN}/recovery`).catch(() => {})
}
async function connectEngine() {
  if (quitting) return
  if (recovering) { connectRequested = true; return }
  recovering = true; bootSequence++
  try {
    await stopEngine()
    engine = undefined; restartAttempts = 0
    status('starting')
    if (configError) throw new Error('Invalid desktop configuration')
    const roster = preferences.live ? JSON.parse(await readFile(join(root, 'desktop', 'wallets.json'), 'utf8')) : []
    const acceptance = process.env.RA_DESKTOP_KEYCHAIN_SERVICE?.startsWith('ResearchAgent-Accept-') && process.env.RA_DESKTOP_RECOVERY_TEST === '1'
    if (acceptance && process.env.RA_DESKTOP_RECOVERY_FAULT) {
      if (process.env.RA_DESKTOP_RECOVERY_FAULT === 'boot-timeout') await new Promise(done => setTimeout(done, 5000))
      throw new Error('Injected fixture-only boot failure')
    }
    // Acceptance fault launches must never enter live rails or read production credentials.
    if (acceptance && (preferences.live || preferences.backend === 'remote')) throw new Error('Fixture-only acceptance')
    const secrets = await bootSecrets(preferences, readSecret, roster)
    if (quitting) return
    if (preferences.backend === 'remote') {
      engine = { apiUrl: remoteOrigin(preferences.remoteUrl), publisherUrl: preferences.remoteUrl, apiToken: secrets['api-token'] }
      const response = await backendRequest(engine, '/health')
      if (!response.ok) throw new Error('Remote unavailable')
      engine.publisherUrl = remoteOrigin((await response.json()).publisherUrl)
      await writeFile(join(userData, 'engine.json'), JSON.stringify({ apiUrl: engine.apiUrl, remote: true }), { mode: 0o600 })
      status('ready')
      await mainWindow.loadURL(`${ORIGIN}/?pace=real`)
    } else {
      localEnv = loadConfig({ ...engineEnv({ userData, preferences, secrets }), RA_LIVE: preferences.live ? '1' : '0' })
      if (!acceptance && process.env.RA_DESKTOP_ACCEPT_TESTNET === '1' && process.env.RA_DESKTOP_KEYCHAIN_SERVICE?.startsWith('ResearchAgent-Accept-')) localEnv.RA_ACCEPT_TESTNET = '1'
      if (!preferences.live && process.env.RA_DESKTOP_KEYCHAIN_SERVICE?.startsWith('ResearchAgent-Accept-')) {
        localEnv.RA_DESKTOP_CRASH_TEST = process.env.RA_DESKTOP_CRASH_TEST || '0'
      }
      recovering = false
      await restartEngine()
    }
  } catch {
    await stopEngine()
    await showRecovery()
  } finally { recovering = false; if (connectRequested && !quitting) { connectRequested = false; void connectEngine() } }
}
function makeWindow(options) {
  const window = new BrowserWindow({ ...options, show: false, title: 'ResearchAgent', backgroundColor: '#FBF8F2',
    webPreferences: { preload: join(root, 'desktop', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } })
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${ORIGIN}/`) || (!url.startsWith(`${ORIGIN}/?`) && url !== `${ORIGIN}/`)) event.preventDefault() })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${ORIGIN}/`) && /^\/runs\/[a-f0-9-]+\/report\.html$/.test(new URL(url).pathname)) {
      const report = makeWindow({ width: 900, height: 900 })
      void report.loadURL(url).then(() => report.show())
    }
    if (/^https:\/\/github.com\/Collaboration95\/theFastandtheFungible\/releases(?:\/tag\/v[0-9A-Za-z.-]+)?$/.test(url)) void shell.openExternal(url)
    // Explicit explorer links only; never load remote content inside Electron.
    if (/^https:\/\/testnet.xrpl.org\/(?:transactions|accounts)\/[a-zA-Z0-9]+$/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  return window
}
function openPreferences(onboarding = false) {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) { preferencesWindow.focus(); return }
  preferencesWindow = makeWindow({ width: 1280, height: 800, parent: mainWindow })
  preferencesWindow.on('closed', () => { preferencesWindow = undefined })
  void preferencesWindow.loadURL(`${ORIGIN}/?settings=1${onboarding ? '&onboarding=1' : ''}`).then(() => preferencesWindow.show())
}
if (!app.requestSingleInstanceLock()) app.quit()
else void boot().catch(() => { void showRecovery() })
