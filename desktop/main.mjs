import { Store } from '../server/store.js'
import { startMcpHttp } from '../mcp/http.js'
import { app, BrowserWindow, Menu, protocol, session, ipcMain, utilityProcess, dialog, shell, clipboard } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORIGIN, CSP, defaults, settings, trustedSender, engineEnv, SECRET_ACCOUNTS, remoteOrigin } from './policy.mjs'
import { readSecret, writeSecret } from './keychain.mjs'
import { backendRequest } from './backend.mjs'
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
let coldStartMs
let engineStatus = 'starting', restartAttempts = 0, restartTimer
let localEnv
function status(value) {
  engineStatus = value
  mainWindow?.setTitle(`ResearchAgent · ${value}`)
}
async function startLocalEngine() {
  status(restartAttempts ? 'reconnecting' : 'starting')
  const target = utilityProcess.fork(join(root, 'desktop', 'engine-host.mjs'), [], { env: localEnv, cwd: root, stdio: 'ignore', serviceName: 'ResearchAgent Engine' })
  child = target
  engine = await new Promise((done, fail) => {
    const timer = setTimeout(() => { target.kill(); fail(new Error('Engine boot timed out')) }, process.arch === 'x64' ? 120_000 : 30_000)
    target.once('message', value => { clearTimeout(timer); done(value) })
    target.once('exit', () => { clearTimeout(timer); fail(new Error('Engine exited')) })
  })
  if (quitting) { target.kill(); return }
  await backendRequest(engine, '/api/wallet/pause', { method: 'POST', body: JSON.stringify({ paused: preferences.paused }) })
  agentStore = new Store(join(userData, preferences.live ? 'testnet' : 'fixture', 'app.db'))
  mcpHttp = await startMcpHttp({ apiUrl: engine.apiUrl, store: agentStore, port: process.env.RA_DESKTOP_KEYCHAIN_SERVICE ? 0 : 9689 })
  await writeFile(join(userData, 'engine.json'), JSON.stringify({ apiUrl: engine.apiUrl, remote: false, pid: target.pid }), { mode: 0o600 })
  status('ready')
  target.once('exit', () => { if (!quitting && child === target) { child = undefined; void restartEngine() } })
}
async function restartEngine() {
  status('reconnecting')
  await mcpHttp?.close(); mcpHttp = undefined
  agentStore?.close(); agentStore = undefined
  if (quitting) return
  const delay = Math.min(30_000, 500 * 2 ** Math.min(restartAttempts++, 6))
  restartTimer = setTimeout(() => { void startLocalEngine().catch(async () => {
    const target = child; child = undefined; target?.kill()
    await restartEngine()
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
  try { preferences = settings(JSON.parse(await readFile(join(userData, 'desktop.json'), 'utf8'))) } catch { /* First launch uses offline fixtures. */ }
  const secrets = {}
  if (preferences.backend === 'local' && preferences.live) {
    for (const name of [...SECRET_ACCOUNTS, 'xrpl-payer']) secrets[name] = await readSecret(name)
    const roster = JSON.parse(await readFile(join(root, 'desktop', 'wallets.json'), 'utf8'))
    for (const name of roster) secrets[name] = await readSecret(name)
    if (!secrets['xrpl-payer'] || !secrets.deepseek || (!secrets.openai && !secrets.cloudflare)) throw new Error('Live credentials incomplete')
  }
  if (preferences.backend === 'remote') {
    const apiToken = await readSecret('api-token')
    if (!apiToken) throw new Error('Backend token missing')
    engine = { apiUrl: remoteOrigin(preferences.remoteUrl), publisherUrl: preferences.remoteUrl, apiToken }
    try {
      await createClient({ baseUrl: engine.apiUrl, token: apiToken }).wallet()
      const health = await (await backendRequest(engine, '/health')).json()
      engine.publisherUrl = remoteOrigin(health.publisherUrl)
    } catch { /* The UI shows backend unavailable; native Settings stays usable for recovery. */ }
  } else {
    if (preferences.mcpEnabled) secrets['local-api-token'] = await readSecret('local-api-token')
    localEnv = loadConfig({ ...engineEnv({ userData, preferences, secrets }), RA_LIVE: preferences.live ? '1' : '0' })
    if (process.env.RA_DESKTOP_ACCEPT_TESTNET === '1' && process.env.RA_DESKTOP_KEYCHAIN_SERVICE?.startsWith('ResearchAgent-Accept-')) {
      localEnv.RA_ACCEPT_TESTNET = '1'
    }
    if (!preferences.live && process.env.RA_DESKTOP_KEYCHAIN_SERVICE?.startsWith('ResearchAgent-Accept-')) localEnv.RA_DESKTOP_CRASH_TEST = process.env.RA_DESKTOP_CRASH_TEST || '0'
    await startLocalEngine()
  }
  // Connection metadata is public. The MCP adapter reads credentials from Keychain only.
  if (preferences.backend === 'remote') await writeFile(join(userData, 'engine.json'), JSON.stringify({ apiUrl: engine.apiUrl, remote: true }), { mode: 0o600 })
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(`${ORIGIN}/`) }))
  await protocol.handle('app', async request => {
    const url = new URL(request.url)
    if (url.host !== 'researchagent') return new Response(null, { status: 403 })
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }
    if (/^\/(?:health|runs(?:\/|$)|api(?:\/|$)|w(?:\/|$))/.test(url.pathname)) {
      try {
        const response = await backendRequest(engine, url.pathname + url.search, { method: request.method,
          ...(!['GET', 'HEAD'].includes(request.method) ? { body: await request.text() } : {}), signal: request.signal })
        return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers } })
      } catch { return new Response('Local engine unavailable', { status: 503, headers }) }
    }
    const pathname = url.pathname === '/preferences' ? '/desktop/preferences.html' : url.pathname === '/desktop/preferences.js' || url.pathname === '/desktop/preferences.css' ? url.pathname : url.pathname === '/' ? '/ui/index.html' : `/ui${url.pathname}`
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
    if (!trustedSender(event) || event.sender !== preferencesWindow?.webContents) throw new Error('Forbidden')
    try { return await handler(...args) } catch { throw new Error('Desktop action failed; check settings and Keychain access') }
  })
  secureHandler('desktop:state', async () => ({ ...preferences, engineStatus, remoteEnabled: true, coldStartMs,
    wallet: await createClient({ baseUrl: engine.apiUrl, token: engine.apiToken }).wallet().catch(() => undefined), versions: engine.versions }))
  secureHandler('desktop:save', async input => {
    const next = settings({ ...preferences, ...input })
    if (next.backend === 'remote') {
      const token = await readSecret('api-token')
      if (!token) throw new Error('Backend token required')
      await createClient({ baseUrl: next.remoteUrl, token }).wallet()
      const response = await backendRequest({ apiUrl: next.remoteUrl, apiToken: token }, '/api/wallet/pause', { method: 'POST', body: JSON.stringify({ paused: next.paused }) })
      if (!response.ok) throw new Error('Remote pause rejected')
    } else if (next.live) {
      if (!await readSecret('xrpl-payer') || !await readSecret('deepseek') || (!await readSecret('openai') && !await readSecret('cloudflare'))) throw new Error('Live credentials incomplete')
    }
    preferences = next
    await writeFile(join(userData, 'desktop.json'), JSON.stringify(preferences), { mode: 0o600 })
    app.relaunch(); app.quit()
  })
  secureHandler('desktop:secret', async (account, value) => {
    if (!SECRET_ACCOUNTS.includes(account) || typeof value !== 'string' || value.length > 4096 || !value.trim()) throw new Error('Invalid credential')
    await writeSecret(account, value.trim()); return { saved: true }
  })
  secureHandler('desktop:wallets', async () => {
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
  const shortcut = (label, accelerator, key, code) => ({ label, accelerator, click: () => mainWindow?.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers: ['meta'], ...(code ? { code } : {}) }) })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ResearchAgent', submenu: [{ role: 'about' }, { label: 'Check for Updates…', click: () => void checkUpdates() }, { label: 'Desktop Settings…', accelerator: 'Cmd+,', click: openPreferences }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] },
    { label: 'File', submenu: [shortcut('New Question', 'Cmd+N', 'N'), { label: 'Print…', accelerator: 'Cmd+P', click: () => BrowserWindow.getFocusedWindow()?.webContents.print() }, { role: 'close' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [shortcut('Run', 'Cmd+1', '1'), shortcut('Writers', 'Cmd+2', '2'), shortcut('Command Menu', 'Cmd+K', 'K'),
      { label: 'Record Mode · 1280 × 800', click: () => { mainWindow.setContentSize(1280, 800); void mainWindow.loadURL(`${ORIGIN}/?record=1`) } },
      { label: 'Leave Record Mode', click: () => { void mainWindow.loadURL(`${ORIGIN}/`) } }] },
    { label: 'Run', submenu: [shortcut('Submit / Go Now', 'Cmd+Return', 'Return'), shortcut('Stop Buying', 'Cmd+.', '.')] }, { role: 'windowMenu' },
  ]))
  mainWindow = makeWindow({ width: 1280, height: 828 })
  await mainWindow.loadURL(`${ORIGIN}/?pace=real${preferences.backend === 'remote' ? `&desktopBackend=${encodeURIComponent(new URL(engine.apiUrl).host)}` : ''}`)
  mainWindow.show()
  if (!process.env.RA_DESKTOP_KEYCHAIN_SERVICE) { const timer = setTimeout(() => void checkUpdates({ quiet: true }), 10000); timer.unref() }
  coldStartMs = Math.round(performance.now() - started)
  console.log(`ResearchAgent ready in ${coldStartMs} ms · ${preferences.backend === 'remote' ? 'REMOTE' : preferences.live ? 'XRPL TESTNET' : 'SIMULATED'} · Electron ${process.versions.electron} · Node ${process.versions.node}`)
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus() })
  app.on('activate', () => mainWindow?.show())
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', event => {
    if (quitting) return
    event.preventDefault(); quitting = true
    void stopEngine().finally(() => app.quit())
  })
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
    // Explicit explorer links only; never load remote content inside Electron.
    if (/^https:\/\/testnet.xrpl.org\/(?:transactions|accounts)\/[a-zA-Z0-9]+$/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  return window
}
function openPreferences() {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) { preferencesWindow.focus(); return }
  preferencesWindow = makeWindow({ width: 660, height: 800, parent: mainWindow })
  preferencesWindow.on('closed', () => { preferencesWindow = undefined })
  void preferencesWindow.loadURL(`${ORIGIN}/preferences`).then(() => preferencesWindow.show())
}
if (!app.requestSingleInstanceLock()) app.quit()
else void boot().catch(async () => {
  dialog.showErrorBox('ResearchAgent could not start', 'The local engine could not start. Quit and reopen; desktop data stays in Application Support/ResearchAgent. No credentials are logged.')
  await stopEngine(); app.exit(1)
})
