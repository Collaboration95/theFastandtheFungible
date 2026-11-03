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

const started = performance.now()
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }])
if (process.env.RA_DESKTOP_DATA) app.setPath('userData', resolve(process.env.RA_DESKTOP_DATA))
app.setName('ResearchAgent')
let engine, child, mainWindow, preferencesWindow, quitting = false
let preferences = { ...defaults }
let coldStartMs
const userData = app.getPath('userData')
async function stopEngine() {
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
    const env = loadConfig({ ...engineEnv({ userData, preferences, secrets }), RA_LIVE: preferences.live ? '1' : '0' })
    child = utilityProcess.fork(join(root, 'desktop', 'engine-host.mjs'), [], { env, cwd: root, stdio: 'ignore', serviceName: 'ResearchAgent Engine' })
    engine = await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error('Engine boot timed out')), 30_000)
      child.once('message', value => { clearTimeout(timer); done(value) })
      child.once('exit', () => { clearTimeout(timer); fail(new Error('Engine exited')) })
    })
    await backendRequest(engine, '/api/wallet/pause', { method: 'POST', body: JSON.stringify({ paused: preferences.paused }) })
    child.on('exit', () => { if (!quitting) { dialog.showErrorBox('Local engine stopped', 'Quit and reopen ResearchAgent to recover.'); app.quit() } })
  }
  // Connection metadata is public. The MCP adapter reads credentials from Keychain only.
  await writeFile(join(userData, 'engine.json'), JSON.stringify({ apiUrl: engine.apiUrl, remote: preferences.backend === 'remote' }), { mode: 0o600 })
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
  secureHandler('desktop:state', async () => ({ ...preferences, remoteEnabled: true, coldStartMs,
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
    { label: 'ResearchAgent', submenu: [{ role: 'about' }, { label: 'Desktop Settings…', accelerator: 'Cmd+,', click: openPreferences }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] },
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
