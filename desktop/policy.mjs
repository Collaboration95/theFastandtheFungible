export const ORIGIN = 'app://researchagent'
/**
 * The only hosts the renderer may reach besides the app itself: the two public XRPL Testnet nodes the in-browser verifier
 * reads (src/verify/browser.ts, server/proof-page.ts). Exact origins, no wildcard, WebSocket only. The verifier sends
 * read-only `tx` lookups and holds no keys.
 */
export const LEDGER_ORIGINS = Object.freeze(['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233'])
/** The app shell's policy: no inline script, no remote content, and the verifier's two Testnet nodes as the only network. */
export const CSP = ["default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
  `connect-src 'self' ${LEDGER_ORIGINS.join(' ')}`, "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"].join('; ')

/** Every request from a renderer is cancelled unless it targets the app itself or one of the two Testnet nodes. */
export function allowedRequest(raw) {
  if (raw.startsWith(`${ORIGIN}/`)) return true
  let url; try { url = new URL(raw) } catch { return false }
  return url.protocol === 'wss:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' && LEDGER_ORIGINS.includes(`${url.protocol}//${url.host}`)
}

// The public proof page (GET /proof/<id>) brings its own nonce-based policy and one inline script that runs the in-browser
// check. The shell keeps that policy untouched, but only while it is at least as strict as the shell's own guarantees.
const PROOF_PAGE = /^\/proof\/[A-Za-z0-9-]+$/
const PROOF_WINDOW = /^\/proof\/[a-f0-9]{32}$/
const NONCE = /^'nonce-[A-Za-z0-9+/=_-]{16,}'$/
const SELF = "'self'", NONE = "'none'"
const PROOF_RULES = {
  'default-src': sources => sources.length === 1 && sources[0] === NONE,
  'script-src': sources => sources.includes(SELF) && sources.every(source => source === SELF || NONCE.test(source)),
  'style-src': sources => sources.length > 0 && sources.every(source => source === SELF || NONCE.test(source)),
  'img-src': sources => sources.every(source => source === SELF || source === 'data:'),
  'font-src': sources => sources.every(source => source === SELF),
  'connect-src': sources => sources.every(source => source === SELF || LEDGER_ORIGINS.includes(source)),
  'base-uri': sources => sources.length === 1 && sources[0] === NONE,
  'form-action': sources => sources.length === 1 && sources[0] === NONE,
  'frame-ancestors': sources => sources.length === 1 && sources[0] === NONE,
}
/** True only for a policy that denies by default and allows just this document, a nonce, data images and the Testnet nodes. */
export function acceptableProofCsp(value) {
  if (typeof value !== 'string' || value.includes(',')) return false
  const directives = new Map()
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (!name) continue
    if (directives.has(name) || !Object.hasOwn(PROOF_RULES, name)) return false
    directives.set(name, sources)
  }
  return directives.has('default-src') && directives.has('script-src') && [...directives].every(([name, sources]) => PROOF_RULES[name](sources))
}
export const isProofPage = pathname => PROOF_PAGE.test(pathname)
/** The URL of a proof page the app may open in its own window: this origin, `/proof/<32 hex>`, nothing else. */
export function proofWindowUrl(raw) {
  let url; try { url = new URL(raw) } catch { return undefined }
  return url.protocol === 'app:' && url.host === 'researchagent' && !url.username && !url.password && !url.search && !url.hash && PROOF_WINDOW.test(url.pathname) ? url : undefined
}

/**
 * Headers for a response the shell serves. Every response gets the shell policy, so a backend's own policy can only narrow it
 * (the browser applies both). The one exception is a proof page whose own policy passes `acceptableProofCsp`: it is served with
 * that policy alone, because the shell's `script-src 'self'` would block the page's nonce'd script.
 */
export function responseHeaders(pathname, backend) {
  const headers = new Headers(backend)
  headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Cache-Control', 'no-store')
  if (isProofPage(pathname) && acceptableProofCsp(headers.get('Content-Security-Policy'))) return headers
  headers.append('Content-Security-Policy', CSP)
  return headers
}
export const SECRET_ACCOUNTS = ['deepseek', 'openai', 'cloudflare', 'cloudflare-account', 'api-token', 'compatible']
export const defaults = { live: false, paused: false, maxMinor: 200, dailyMinor: 500, walletDailyMinor: 2000, backend: 'local', remoteUrl: '', mcpEnabled: false, provider: 'deepseek', baseUrl: '', model: '', sameKeyDecisions: false }
export function settings(input) {
  if (!input || typeof input.live !== 'boolean' || typeof input.paused !== 'boolean' ||
    !Number.isInteger(input.maxMinor) || input.maxMinor < 0 || input.maxMinor > 500 ||
    !Number.isInteger(input.dailyMinor) || input.dailyMinor < 0 || input.dailyMinor > 10000) throw new Error('Invalid desktop settings')
  const backend = input.backend ?? 'local'
  if (!['local', 'remote'].includes(backend)) throw new Error('Invalid backend')
  const remoteUrl = input.remoteUrl ? remoteOrigin(input.remoteUrl) : ''
  if (backend === 'remote' && !remoteUrl) throw new Error('Remote URL required')
  const walletDailyMinor = input.walletDailyMinor ?? 2000
  if (!Number.isSafeInteger(walletDailyMinor) || walletDailyMinor < 0 || walletDailyMinor > 100000) throw new Error('Invalid wallet cap')
  const provider = input.provider ?? 'deepseek'
  if (!['deepseek', 'openai', 'openai-compatible'].includes(provider)) throw new Error('Invalid provider')
  const baseUrl = input.baseUrl ? providerOrigin(input.baseUrl) : ''
  const model = input.model ?? ''
  if (typeof model !== 'string' || model.length > 200 || /[\r\n]/.test(model)) throw new Error('Invalid model')
  if (input.live && provider === 'openai-compatible' && (!baseUrl || !model.trim())) throw new Error('Compatible endpoint and model required')
  const ESCROW_MODE = input.ESCROW_MODE ?? 'key-reveal', ESCROW_ASSET = input.ESCROW_ASSET ?? 'XRP', ANCHOR_RAIL = input.ANCHOR_RAIL ?? 'xrpl-testnet'
  if (!['key-reveal', 'payment'].includes(ESCROW_MODE) || !['XRP', 'TEST-SGD'].includes(ESCROW_ASSET) || !['off', 'xrpl-testnet'].includes(ANCHOR_RAIL)) throw new Error('Invalid payment settings')
  return { ESCROW_MODE, ESCROW_ASSET, ANCHOR_RAIL, onboarded: input.onboarded === true, provider, baseUrl, model, sameKeyDecisions: input.sameKeyDecisions === true, live: input.live, paused: input.paused, maxMinor: input.maxMinor, dailyMinor: input.dailyMinor,
    backend, remoteUrl, walletDailyMinor, mcpEnabled: input.mcpEnabled === true }

}
export function trustedSender(event) {
  if (!event.senderFrame) return false
  let url; try { url = new URL(event.senderFrame.url) } catch { return false }
  return event.senderFrame === event.sender.mainFrame && url.protocol === 'app:' && url.host === 'researchagent'
}
export function localRequest(request, port) {
  if (request.headers.host !== `127.0.0.1:${port}`) return false
  const origin = request.headers.origin
  // Desktop proxy strips Origin. Web pages, including DNS rebinding pages, cannot mutate the engine.
  return !origin || origin === ORIGIN
}
export function engineEnv({ userData, preferences, secrets = {} }) {
  const live = preferences.live
  // Allowlist, never inherit .env, NODE_OPTIONS, provider URLs, proxy settings or wallet seeds.
  return {
    ESCROW_MODE: live ? preferences.ESCROW_MODE || 'key-reveal' : 'payment', ESCROW_ASSET: preferences.ESCROW_ASSET || 'XRP', ANCHOR_RAIL: preferences.ANCHOR_RAIL || 'xrpl-testnet',
    HOST: '127.0.0.1', RA_API_TOKEN: secrets['local-api-token'] || '',
    WALLET_DAILY_CAP_MINOR: String(preferences.walletDailyMinor ?? 2000), SPENDING_PAUSED: process.env.SPENDING_PAUSED === '1' ? '1' : '0',
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: userData, TMPDIR: process.env.TMPDIR || '/tmp',
    DOTENV_CONFIG_PATH: '/dev/null', RA_DATA_DIR: `${userData}/${live ? 'testnet' : 'fixture'}`,
    LLM_PROVIDER: live ? preferences.provider || 'deepseek' : 'fixture',
    LLM_BASE_URL: live ? preferences.baseUrl || '' : '', LLM_MODEL: live ? preferences.model || '' : '',
    LLM_API_KEY: live ? secrets[providerAccount(preferences)] || '' : '',
    OPENAI_API_KEY: live ? secrets.openai || '' : '', DECISION_PROVIDER: live ? (preferences.sameKeyDecisions ? 'compatible' : secrets.openai ? 'openai' : 'cloudflare') : 'fixture',
    CLOUDFLARE_API_TOKEN: live ? secrets.cloudflare || '' : '', CLOUDFLARE_ACCOUNT_ID: live ? secrets['cloudflare-account'] || '' : '',
    XRPL_RPC_URL: 'wss://s.altnet.rippletest.net:51233',
    XRPL_PAYER_SEED: live ? secrets['xrpl-payer'] || '' : '',
    ...Object.fromEntries(Object.entries(secrets).filter(([key]) => live && /^XRPL_PUBLISHER_[A-Z0-9_]+_SEED$/.test(key))),
    SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', PUBLISHER_FAULTS: '0',
    MCP_MAX_BUDGET_MINOR: String(preferences.maxMinor), MCP_DAILY_CAP_MINOR: String(preferences.dailyMinor),
  }
}

export function remoteOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use an HTTPS origin')
  return url.origin
}

// Deliberately narrow compatibility: no arbitrary DNS or redirects carrying credentials.
export function providerOrigin(value) {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || !['/', '/v1', '/v1/'].includes(url.pathname)) throw new Error('Use a provider API origin or /v1')
  const publicHosts = ['api.openai.com', 'api.deepseek.com', 'api.groq.com', 'api.mistral.ai']
  const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname)
  if (!(url.protocol === 'https:' && publicHosts.includes(url.hostname) && !url.port) && !(loopback && url.protocol === 'http:')) throw new Error('Endpoint outside supported providers and numeric loopback')
  return url.href.replace(/\/$/, '')
}
export const providerAccount = preferences => ({ deepseek: 'deepseek', openai: 'openai', 'openai-compatible': 'compatible' })[preferences.provider || 'deepseek']
