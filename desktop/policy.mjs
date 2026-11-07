export const ORIGIN = 'app://researchagent'
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
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
