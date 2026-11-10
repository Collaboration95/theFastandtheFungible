// Local hosted-mode stack for tests/hosted-ui.spec.ts (never a deployment): the built web app behind a local HTTPS
// front, the HG gateway with HOSTED=1, fixture models and the simulated rail, and the fixture writer server.
// The gateway requires an exact HTTPS origin, so the front terminates TLS with a throwaway self-signed certificate.
// Readiness is the only override: without a funded Testnet payer the real probe is never ready, so a flag file decides.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttps } from 'node:https'
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, relative, resolve } from 'node:path'
import { ResourceScope } from '../../shared/resource-scope.js'

const web = Number(process.env.HOSTED_WEB_PORT), api = Number(process.env.HOSTED_API_PORT), pub = Number(process.env.HOSTED_PUBLISHER_PORT)
const scope = new ResourceScope()
// State lives in the given directory (the Playwright config puts it under .playwright/) or a scoped temp directory.
const given = process.env.HOSTED_STACK_DIR ? resolve(process.env.HOSTED_STACK_DIR) : undefined
const dir = given ?? scope.tempDir('ra-hosted-ui-')
if (given) mkdirSync(given, { recursive: true })
const origin = `https://localhost:${web}`
Object.assign(process.env, {
  HOSTED: '1', HOSTED_ORIGIN: origin, HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'hosted-ui-test-only-'.padEnd(40, 'x'), HOSTED_CONTROL_PATH: join(dir, 'control.json'),
  SETTLEMENT_RAIL: 'simulated', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', DOTENV_CONFIG_PATH: '.playwright/no-env',
  PUBLISHER_URL: `http://127.0.0.1:${pub}`, PUBLISHER_PORT: String(pub), PUBLISHER_DB: join(dir, 'publisher.db'), APP_DB: join(dir, 'app.db'), REPORT_DIR: join(dir, 'reports'),
})
for (const key of Object.keys(process.env)) if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(key)) delete process.env[key]
// Ready control (operator-owned in production); tests pause it through this same file.
if (!existsSync(process.env.HOSTED_CONTROL_PATH!)) writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'hosted_ui_test', expiresAt: '2026-11-19T16:00:00Z' }))

const publisher = scope.spawn(process.execPath, ['--import', 'tsx', 'publisher/server.ts'], { env: process.env })
publisher.stdout.pipe(process.stdout); publisher.stderr.pipe(process.stderr)
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${pub}/health`)).ok) break } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)) }

const { createApiApp } = await import('../../server/routes.js')
const backend = await createApiApp({ publisherUrl: process.env.PUBLISHER_URL, hostedReadiness: async () => !existsSync(join(dir, 'degraded')) })
const apiServer = backend.app.listen(api, '127.0.0.1')

// The front: static production build with SPA fallback; gateway paths stream through with the public Host intact.
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'), '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' })
const root = resolve('dist')
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
const proxy = (req: IncomingMessage, res: ServerResponse) => {
  const upstream = httpRequest({ host: '127.0.0.1', port: api, method: req.method, path: req.url, headers: { ...req.headers, host: `localhost:${web}` } }, reply => { res.writeHead(reply.statusCode ?? 502, reply.headers); reply.pipe(res) })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
  req.pipe(upstream)
}
const front = createHttps({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (req, res) => {
  const path = new URL(req.url ?? '/', origin).pathname
  if (/^\/(?:api|runs|w|livez|startupz|readyz)(?:\/|$)/.test(path)) return proxy(req, res)
  const file = resolve(root, `.${decodeURIComponent(path)}`)
  const target = file.startsWith(root) && existsSync(file) && extname(file) ? file : join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': types[extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
  res.end(readFileSync(target))
}).listen(web, '127.0.0.1')
console.log(`Hosted UI stack: ${origin} (state ${dir})`)

const stop = async () => {
  front.close(); apiServer.close(); await backend.close().catch(() => undefined)
  await scope.close().catch(() => undefined)
  // A given directory is removed only when it is test state under .playwright/.
  if (given && !relative(resolve('.playwright'), given).startsWith('..')) rmSync(given, { recursive: true, force: true })
  process.exit(0)
}
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop())
