import { parseCommand, resolveStartup } from '../shared/startup-plan.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { startEngine } from '../server/engine.js'
import { loadConfig } from '../server/config.js'
import { createClient } from '../sdk/index.js'
import { BUDGET } from '../shared/contracts/run.js'

/** Conservative wallet-wide cap for this mode (SGD minor units): S$5.00. The operator may set WALLET_DAILY_CAP_MINOR. */
export const APP_DAILY_CAP_MINOR = 500
const USAGE = 'Usage: researchagent-mcp app [--testnet] [--iou] [--port N] [--open]'
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
// Same surface as the Vite proxy and desktop shell: engine API (bearer added here) and the public publisher.
const API_PATH = /^\/(?:runs|api)(?:\/|$)/
const PUBLISHER_PATH = /^\/w(?:\/|$)/
const sgd = (minor: number) => `S$${(minor / 100).toFixed(2)}`

export function parseAppArgs(argv: string[]) {
  let command
  try { command = parseCommand(['app', ...argv]) } catch { throw Error(USAGE) }
  if (command.options.positionals.length || argv.some(arg => !['--testnet', '--iou', '--open', '--port'].includes(arg) && argv[argv.indexOf(arg) - 1] !== '--port')) throw Error(`Unknown argument. ${USAGE}`)
  return { testnet: command.options.testnet ?? false, open: command.options.open ?? false, port: command.options.port ?? 0 }
}

/** The tgz ships the built UI at `ui/`; a checkout falls back to `dist/` from `npm run build`. */
function uiDirectory(root: string, override?: string) {
  const dir = [override, resolve(root, 'ui'), resolve(root, 'dist')].filter((candidate): candidate is string => Boolean(candidate)).find(candidate => existsSync(join(candidate, 'index.html')))
  if (!dir) throw new Error('UI bundle not found; run npm run build in a checkout')
  return dir
}

/** The browser origin is the only one the proxy accepts; DNS-rebinding pages cannot reach the engine. */
export const localOrigin = (headers: IncomingMessage['headers'], port: number) => {
  const host = headers.host
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false
  return !headers.origin || headers.origin === `http://${host}`
}

/** Preserve browser owner metadata only for Settings, after the local origin guard. */
export function settingsHeaders(path: string, headers: IncomingMessage['headers']): Record<string, string> {
  if (!path.startsWith('/api/settings')) return {}
  const forwarded: Record<string, string> = {}
  for (const name of ['origin', 'sec-fetch-site', 'x-settings-ui', 'x-settings-csrf']) {
    const value = headers[name]
    if (typeof value === 'string') forwarded[name] = value
  }
  return forwarded
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 1 << 20) throw new Error('Request body too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

function openBrowser(url: string) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  execFile(command, args, { windowsHide: true }, () => {}).unref()
}

/** `stop` ends the app like Ctrl-C (tests); `ui` overrides the bundled UI directory. */
export async function runApp(argv: string[], { ui: uiOverride, stop }: { ui?: string; stop?: AbortSignal } = {}) {
  const started = performance.now()
  let options
  try { options = parseAppArgs(argv) } catch (error) { console.error((error as Error).message); process.exitCode = 2; return }
  const root = fileURLToPath(new URL('..', import.meta.url))
  // Like --testnet MCP, app mode never reads a local .env: hermetic, fixture models, fictional writers.
  if (process.env.RA_BACKEND_URL) { console.error('The app needs a local engine; unset RA_BACKEND_URL'); process.exitCode = 1; return }
  let engine: Awaited<ReturnType<typeof startEngine>> | undefined
  let http: ReturnType<typeof createServer> | undefined
  let tokenFile = ''
  let closing: Promise<void> | undefined
  const close = () => closing ??= (async () => {
    if (http) await new Promise<void>(done => { http!.close(() => done()); http!.closeAllConnections() })
    await engine?.close().catch(() => undefined)
    if (tokenFile) rmSync(tokenFile, { force: true })
  })()
  try {
    const ui = uiDirectory(root, uiOverride)
    const testnetModule = options.testnet ? await import('./testnet.js') : undefined
    const setup = await testnetModule?.prepareMcpTestnet(undefined, argv.includes('--iou') ? 'test-iou' : process.env.ESCROW_ASSET, stop)
    const config = loadConfig()
    const plan = resolveStartup(config, parseCommand(['app', ...argv]))
    const dataDir = plan.stateDir
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    // Engine-only overrides: the parent environment is never mutated and no operator cap is raised (gate 2).
    const dailyMinor = setup?.testnet ? plan.caps.walletDailyMinor : Number(config.WALLET_DAILY_CAP_MINOR ?? '2000')
    const env: NodeJS.ProcessEnv = { ...setup?.env, DOTENV_CONFIG_PATH: '.app-no-env' }
    if (setup?.testnet) env.WALLET_DAILY_CAP_MINOR = String(dailyMinor)
    // Bind once on an ephemeral port, then pin engine admission to that UI origin.
    http = createServer()
    await new Promise<void>((done, fail) => { http!.once('error', fail); http!.listen(options.port, '127.0.0.1', done) })
    const port = (http.address() as { port: number }).port
    env.RA_WEB_ORIGIN = `http://127.0.0.1:${port}`
    engine = await startEngine({ dataDir, live: false, env, signal: stop })
    const engineUrl = engine.apiUrl, token = engine.apiToken, publisherUrl = engine.publisherUrl
    // The SDK talks to the bearer-protected engine; the token lives only in this 0600 file, never on screen.
    tokenFile = join(dataDir, 'api-token')
    writeFileSync(tokenFile, token + '\n', { mode: 0o600 })
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }

    const proxy = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
      const publisher = PUBLISHER_PATH.test(url.pathname)
      const method = req.method ?? 'GET'
      const abort = new AbortController()
      res.once('close', () => abort.abort())
      const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(req)
      const upstream = await fetch(new URL(url.pathname + url.search, publisher ? publisherUrl : engineUrl), {
        method, body, redirect: 'error', signal: abort.signal,
        headers: { ...settingsHeaders(url.pathname, req.headers), ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}), ...(req.headers.accept ? { Accept: req.headers.accept } : {}), ...(typeof req.headers['idempotency-key'] === 'string' ? { 'Idempotency-Key': req.headers['idempotency-key'] } : {}), ...(publisher ? {} : { Authorization: `Bearer ${token}` }) },
      })
      const out: Record<string, string> = { ...headers, 'Cache-Control': 'no-store' }
      for (const name of ['content-type', 'content-disposition', 'etag']) { const value = upstream.headers.get(name); if (value) out[name] = value }
      res.writeHead(upstream.status, out)
      if (!upstream.body || method === 'HEAD') { res.end(); return }
      Readable.fromWeb(upstream.body as never).on('error', () => res.destroy()).pipe(res)
    }

    http.on('request', async (req, res) => {
      try {
        if (!localOrigin(req.headers, port)) { res.writeHead(403, headers); res.end('Forbidden'); return }
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
        if (API_PATH.test(url.pathname) || PUBLISHER_PATH.test(url.pathname)) { await proxy(req, res, url); return }
        if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405, headers); res.end(); return }
        const file = resolve(ui, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`)
        if (!file.startsWith(ui + sep) || !MIME[extname(file)]) { res.writeHead(403, headers); res.end(); return }
        const data = await readFile(file).catch(() => undefined)
        if (!data) { res.writeHead(404, headers); res.end(); return }
        res.writeHead(200, { ...headers, 'Content-Type': MIME[extname(file)], 'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=3600' })
        res.end(req.method === 'HEAD' ? undefined : data)
      } catch { if (!res.headersSent) res.writeHead(502, headers); res.end('Local engine unavailable') }
    })
    const url = `http://127.0.0.1:${port}`

    const money = setup?.env.ESCROW_ASSET === 'test-iou' ? (minor: number) => `TEST-SGD ${(minor / 100).toFixed(2)} · stand-in for RLUSD · no real value` : sgd
    const rail = setup?.testnet ? 'XRPL TESTNET' : options.testnet ? setup!.labels[0] : 'SIMULATED rail'
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    const wallet = await createClient({ baseUrl: engineUrl, token }).wallet().catch(() => undefined)
    const lines = [`ResearchAgent ready: ${url} · fixture models · ${rail} · no real value`]
    if (setup?.testnet) {
      lines.push(`  payer address: ${wallet?.payerAddress ?? 'unavailable'} (public; seeds stay in ${testnetModule!.testnetStateDir()}, mode 0600)`,
        '  key-reveal escrow and answer anchor on; each receipt links its EscrowCreate / EscrowFinish / anchor on testnet.xrpl.org')
    } else lines.push(options.testnet ? '  settlement is SIMULATED: no ledger transactions' : '  settlement is SIMULATED; add --testnet for real XRPL Testnet transactions')
    lines.push(`  caps: per-prompt budget set in the UI (max ${money(BUDGET.maxMinor)}) · wallet daily cap ${money(dailyMinor)}${setup?.testnet && config.WALLET_DAILY_CAP_MINOR === undefined ? ' (app Testnet default; WALLET_DAILY_CAP_MINOR overrides)' : ''}`,
      `  Engine baseUrl: ${engineUrl}`,
      `  Token file: ${tokenFile} (private; read it from your client, never print the token)`,
      `  SDK caps: ${money(Number(config.MCP_MAX_BUDGET_MINOR ?? 0))} per ask · ${money(Number(config.MCP_DAILY_CAP_MINOR ?? 0))} daily (set MCP_MAX_BUDGET_MINOR / MCP_DAILY_CAP_MINOR before app start)`,
      '  Ask + export + verify: https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/sdk.md',
      `  Verification: ${setup?.testnet ? 'use { onlineLedger: true } for read-only settlement and anchor checks' : 'use offline verification (default); SIMULATED receipts are not ledger proof'}`,
      `  ready in ${seconds} s · Ctrl-C to stop`)
    console.log(lines.join('\n'))
    if (options.open) openBrowser(url)
    await new Promise<void>(done => {
      const signals = ['SIGINT', 'SIGTERM'] as const
      const finish = () => { for (const signal of signals) process.off(signal, finish); done() }
      for (const signal of signals) process.on(signal, finish)
      if (stop?.aborted) finish(); else stop?.addEventListener('abort', finish, { once: true })
    })
  } catch (error) {
    console.error(error instanceof Error && /^(UI bundle|Invalid configuration:)/.test(error.message) ? error.message : 'ResearchAgent app startup failed; check operator configuration. No credentials are logged.')
    process.exitCode = 1
  } finally { await close() }
}
