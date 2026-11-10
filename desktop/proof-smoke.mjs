// Desktop smoke, proof step (S3, 11 Nov 2026): inside the Mac app, share a refusal, open it in its own window and run the
// in-browser check against a Testnet node, through the shell's real CSP and request filter.
//
// What is real: the packaged app and its engine (fixture mode, simulated payments), a decline asked through the app's own UI,
// the share flow, the proof window, the server's own proof-page policy, the renderer's WebSocket and the verifier chunk.
// What is a stand-in, and is labelled in the output: (1) the simulated rail never anchors, so the finished decline is promoted
// to "anchored" with a synthetic transaction (tests/helpers/stand-in-anchor.ts); (2) the "Testnet node" is a local TLS WebSocket
// server that answers the read-only `tx` lookup for that transaction. Chromium is told to resolve the node's public hostnames to
// it (`--host-resolver-rules`) and to trust only its key, so the renderer opens exactly the URLs it would use against Testnet.
// Nothing here uses a wallet, a key, the Keychain or the public network.
import { _electron as electron, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:https'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'

const QUESTION = 'Which Singapore banks are piloting RLUSD settlement in 2026?'
const SHELL_PROOF_CSP = /^default-src 'none'; script-src 'self' 'nonce-[A-Za-z0-9+/=]+'; style-src 'nonce-[A-Za-z0-9+/=]+'; img-src 'self' data:; font-src 'self'; connect-src 'self' wss:\/\/s\.altnet\.rippletest\.net:51233 wss:\/\/clio\.altnet\.rippletest\.net:51233; base-uri 'none'; form-action 'none'; frame-ancestors 'none'$/

/** A local stand-in for the public Testnet node: TLS + WebSocket, answering only `tx` for the stand-in anchor. */
async function startStandInNode(scope, dir) {
  const key = join(dir, 'node-key.pem'), cert = join(dir, 'node-cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=stand-in-testnet-node'], { stdio: 'ignore' })
  const pin = execFileSync('sh', ['-c', `openssl x509 -in '${cert}' -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`], { encoding: 'utf8' }).trim()
  const transactions = new Map(), hosts = [], commands = []
  const https = createServer({ key: await readFile(key), cert: await readFile(cert) })
  const sockets = new WebSocketServer({ server: https })
  sockets.on('connection', (socket, request) => {
    hosts.push(request.headers.host)
    socket.on('message', raw => {
      const message = JSON.parse(String(raw))
      commands.push(message.command)
      const tx = message.command === 'tx' ? transactions.get(message.transaction) : undefined
      socket.send(JSON.stringify(tx ? { id: message.id, status: 'success', type: 'response', result: tx } : { id: message.id, status: 'error', type: 'response', error: 'txnNotFound' }))
    })
  })
  await new Promise(done => https.listen(0, '127.0.0.1', done))
  scope.defer(() => new Promise(done => { for (const client of sockets.clients) client.terminate(); sockets.close(() => https.close(() => done())) }))
  return { port: https.address().port, pin, transactions, hosts, commands }
}

/** Run from desktop/smoke.mjs (which registers tsx): `node desktop/smoke.mjs --proof`, and as the last step of `make desktop-smoke`. */
export async function proofSmoke({ executablePath, appPath, evidenceDir }) {
  const { ResourceScope } = await import('../shared/resource-scope.ts')
  const scope = new ResourceScope()
  try {
    const data = scope.tempDir('researchagent-desktop-proof-')
    return await run({ executablePath, appPath, evidenceDir, scope, data })
  } finally { await scope.close() }
}

async function run({ executablePath, appPath, evidenceDir, scope, data }) {
  await mkdir(evidenceDir, { recursive: true })
  const node = await startStandInNode(scope, data)
  const rules = ['s.altnet.rippletest.net', 'clio.altnet.rippletest.net', 'evil.example'].map(host => `MAP ${host} 127.0.0.1:${node.port}`).join(', ')
  const app = await electron.launch({ executablePath, timeout: 30_000,
    args: [`--host-resolver-rules=${rules}`, `--ignore-certificate-errors-spki-list=${node.pin}`, ...(appPath ? [appPath] : [])],
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, RA_DESKTOP_DATA: data } })
  scope.own(app)
  const errors = []
  try {
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    page.on('pageerror', error => errors.push(error.message))
    await expect(page.getByRole('textbox').first()).toBeVisible()
    const onboarding = app.windows().find(window => window.url().includes('onboarding=1'))
    if (onboarding) await onboarding.close()

    // 1. A real decline, asked through the app (simulated payments, fixture models).
    await page.goto('app://researchagent/?pace=real')
    await page.getByRole('textbox', { name: 'Your question' }).fill(QUESTION)
    await page.getByRole('button', { name: /^Ask/ }).click()
    const chip = page.getByRole('button', { name: 'pricing & margins' }), start = page.getByRole('button', { name: 'Start now' })
    await expect(chip.or(start).first()).toBeVisible({ timeout: 30_000 })
    if (await chip.isVisible()) await chip.click()
    await start.click()
    const answer = page.getByRole('region', { name: 'Research answer' })
    await expect(answer).toContainText('Nothing was bought', { timeout: 60_000 })
    const runId = new URL(page.url()).searchParams.get('run')
    expect(runId).toBeTruthy()
    // Simulated payments leave nothing on a ledger: it says so and offers no share.
    await expect(answer).toContainText('nothing to prove')
    await expect(page.getByRole('button', { name: 'Share proof of refusal' })).toHaveCount(0)

    // 2. Stand-in anchor (labelled), written to the app's own database through a second connection.
    const { Store } = await import('../server/store.ts')
    const { standInAnchor } = await import('../tests/helpers/stand-in-anchor.ts')
    const store = new Store(join(data, 'fixture', 'app.db'))
    let anchor
    try {
      const stood = standInAnchor(store, runId)
      anchor = stood.anchor; node.transactions.set(anchor.txHash, stood.tx)
    } finally { store.close() }
    await page.reload()

    // 3. Share: in the app there is no public address, so no URL and no "Copy link"; the card is what you send.
    await page.getByRole('button', { name: 'Share proof of refusal' }).click()
    await expect(page.getByRole('heading', { name: 'Create this proof?' })).toBeVisible()
    await page.getByRole('button', { name: 'Create proof page' }).click()
    const done = page.getByRole('region', { name: 'Proof of refusal' })
    await expect(done).toContainText('Proof page ready')
    await expect(done.getByRole('button', { name: 'Copy link' })).toHaveCount(0)
    await expect(done).not.toContainText('app://')
    await expect(done.getByRole('link', { name: 'Download proof card' })).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: join(evidenceDir, 'desktop-share-ready.png') })

    // 4. Open proof page: its own window, the server's policy untouched, the page's script allowed to run.
    const opened = app.waitForEvent('window')
    await done.getByRole('link', { name: 'Open proof page' }).click()
    const proof = await opened
    await proof.waitForLoadState()
    const url = proof.url()
    expect(url).toMatch(/^app:\/\/researchagent\/proof\/[a-f0-9]{32}$/)
    expect(page.url()).toContain(`run=${runId}`) // the app window did not navigate
    await expect(proof.getByRole('heading', { level: 1, name: 'Refused to spend.' })).toBeVisible()
    await expect(proof.locator('.chip .full')).toBeVisible()
    const policies = await proof.evaluate(async address => { const response = await fetch(address); return { csp: response.headers.get('content-security-policy'), nosniff: response.headers.get('x-content-type-options') } }, url)
    expect(policies.csp).toMatch(SHELL_PROOF_CSP) // one policy, the server's, with no second "script-src 'self'" beside it
    expect(policies.nosniff).toBe('nosniff')
    const checks = (await proof.locator('.facts').innerText()).match(/(\d+) of (\d+) checks passed when shared/)
    expect(checks).toBeTruthy()
    // Opening it again focuses the same window.
    await done.getByRole('link', { name: 'Open proof page' }).click({ noWaitAfter: true })
    await page.waitForTimeout(500)
    expect(app.windows().filter(window => window.url() === url)).toHaveLength(1)
    await proof.bringToFront()
    await proof.screenshot({ animations: 'disabled', fullPage: true, path: join(evidenceDir, 'desktop-proof.png') })

    // 5. Verify in the renderer: the verifier chunk, the Testnet WebSocket, the lookup, the result.
    await proof.getByRole('button', { name: 'Verify on XRPL in your browser' }).click()
    await expect(proof.locator('#vout .vhead')).toHaveText(new RegExp(`^(?:All ${checks[2]}|\\d+ of ${checks[2]}) checks passed$`), { timeout: 30_000 })
    await expect(proof.locator('#vout')).toContainText('Answer anchored on XRPL Testnet')
    await expect(proof.locator('#vout')).toContainText('reading s.altnet.rippletest.net (read-only)')
    await expect(proof.locator('#vout .note')).toContainText('Skipped here: writer credentials')
    await proof.locator('#vout').scrollIntoViewIfNeeded()
    await proof.screenshot({ animations: 'disabled', fullPage: true, path: join(evidenceDir, 'desktop-proof-verified.png') })
    expect(node.hosts).toContain(`s.altnet.rippletest.net:51233`)
    expect(node.commands.length).toBeGreaterThan(0)
    expect(new Set(node.commands)).toEqual(new Set(['tx'])) // read-only lookups, nothing else
    const seen = node.hosts.length

    // 6. Everything else stays blocked: other hosts and other ports never reach the node, whether or not the name resolves.
    const attempt = address => proof.evaluate(address => new Promise(resolve => {
      const timer = setTimeout(() => resolve('timeout'), 5000)
      try { const socket = new WebSocket(address); socket.onopen = () => { clearTimeout(timer); socket.close(); resolve('open') }; socket.onerror = () => { clearTimeout(timer); resolve('blocked') } }
      catch { clearTimeout(timer); resolve('blocked') }
    }), address)
    const blocked = {}
    for (const address of ['wss://evil.example:51233/', 'wss://s.altnet.rippletest.net:51234/', 'wss://s.altnet.rippletest.net:51233/other', 'ws://s.altnet.rippletest.net:51233/']) blocked[address] = await attempt(address)
    expect(Object.values(blocked)).toEqual(['blocked', 'blocked', 'blocked', 'blocked'])
    expect(node.hosts.length).toBe(seen) // none of them connected
    await expect(proof.evaluate(() => fetch('https://example.com'))).rejects.toThrow()
    // The app shell itself may also open the two nodes (its own "Verify in your browser" card) and nothing else.
    expect(await page.evaluate(address => new Promise(resolve => { const socket = new WebSocket(address); socket.onopen = () => { socket.close(); resolve('open') }; socket.onerror = () => resolve('blocked') }), 'wss://clio.altnet.rippletest.net:51233')).toBe('open')
    expect(await page.evaluate(address => new Promise(resolve => { const socket = new WebSocket(address); socket.onopen = () => { socket.close(); resolve('open') }; socket.onerror = () => resolve('blocked') }), 'wss://evil.example:51233')).toBe('blocked')

    // At phone width the environment chip stays, in its short form, inside the header (S16).
    await app.evaluate(({ BrowserWindow }, address) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === address).setContentSize(390, 844), url)
    await expect(proof.locator('.chip .short')).toHaveText('Testnet demo · no real value')
    await expect(proof.locator('.chip .full')).toBeHidden()
    const chipBox = await proof.locator('.chip').boundingBox()
    expect(chipBox.x).toBeGreaterThanOrEqual(0); expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(390)
    expect(await proof.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await proof.evaluate(() => scrollTo(0, 0))
    await proof.screenshot({ animations: 'disabled', path: join(evidenceDir, 'desktop-proof-390.png') })
    // The proof window cannot be navigated away, not even into the app. Last use of this window: Playwright keeps waiting
    // on a navigation the shell cancelled, so later actions on it would stall.
    await proof.getByRole('link', { name: 'ResearchAgent' }).click({ noWaitAfter: true })
    await app.evaluate(async () => new Promise(done => setTimeout(done, 500)))
    expect(proof.url()).toBe(url)

    // 7. Settings, for the record.
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === 'Settings…').click())
    let preferences
    await expect.poll(() => Boolean(preferences = app.windows().find(window => new URL(window.url(), 'http://local').searchParams.has('settings'))), { timeout: 30_000 }).toBe(true)
    await expect(preferences.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(preferences.getByText('Loading settings…')).toHaveCount(0, { timeout: 15_000 })
    await preferences.screenshot({ animations: 'disabled', path: join(evidenceDir, 'desktop-settings.png') })
    await preferences.close()
    expect(errors).toEqual([])

    const result = {
      step: 'desktop proof: share, open in its own window, verify in the renderer',
      label: 'Real app, real fixture decline (simulated rail), STAND-IN anchor (synthetic transaction), local STAND-IN Testnet node (read-only tx answers). No wallet, key or public network used.',
      anchor: { txHash: anchor.txHash, synthetic: true }, proofUrl: url, checks: { passedWhenShared: Number(checks[1]), total: Number(checks[2]) },
      verify: await proof.locator('#vout .vhead').innerText(), nodeSaw: { connectionsFrom: [...new Set(node.hosts)], commands: [...new Set(node.commands)] }, blocked,
    }
    await writeFile(join(evidenceDir, 'desktop-proof-smoke.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
    return result
  } finally { await app.close() }
}

/**
 * Optional, `DESKTOP_PROOF_LIVE=1`: the shell's renderer reaches the real public Testnet node, read-only (no host mapping, no
 * stand-in). It asks for the anchor of the recorded real refusal in docs/evidence/w1-proof. Either answer proves the path
 * (validated, or `txnNotFound` if Testnet has been reset since); a CSP or request-filter block would error instead.
 */
export async function liveLedgerSmoke({ executablePath, appPath, evidenceDir }) {
  const { ResourceScope } = await import('../shared/resource-scope.ts')
  const scope = new ResourceScope()
  try {
    const data = scope.tempDir('researchagent-desktop-live-')
    const recorded = JSON.parse(await readFile('docs/evidence/w1-proof/testnet-refusal.receipts.json', 'utf8')).ledgerAnchor
    const app = scope.own(await electron.launch({ executablePath, timeout: 30_000, args: appPath ? [appPath] : [],
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, RA_DESKTOP_DATA: data } }))
    try {
      const page = await app.firstWindow()
      await expect(page.getByRole('textbox').first()).toBeVisible()
      const reply = await page.evaluate(({ transaction }) => new Promise(resolve => {
        const timer = setTimeout(() => resolve({ error: 'timeout' }), 15_000)
        const socket = new WebSocket('wss://s.altnet.rippletest.net:51233')
        socket.onerror = () => { clearTimeout(timer); resolve({ error: 'blocked or unreachable' }) }
        socket.onopen = () => socket.send(JSON.stringify({ id: 1, command: 'tx', transaction }))
        socket.onmessage = event => { clearTimeout(timer); socket.close(); const body = JSON.parse(event.data); resolve({ status: body.status, error: body.error, validated: body.result?.validated, ledger: body.result?.ledger_index }) }
      }), { transaction: recorded.txHash })
      const result = { step: 'desktop live read-only Testnet lookup', node: 'wss://s.altnet.rippletest.net:51233 (public, real)', transaction: recorded.txHash, reply, reachedNode: reply.status === 'success' || reply.error === 'txnNotFound' }
      expect(result.reachedNode, JSON.stringify(reply)).toBe(true)
      await mkdir(evidenceDir, { recursive: true })
      await writeFile(join(evidenceDir, 'desktop-live-testnet.json'), JSON.stringify(result, null, 2))
      console.log(JSON.stringify(result, null, 2))
      return result
    } finally { await app.close() }
  } finally { await scope.close() }
}
