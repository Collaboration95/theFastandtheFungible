export const ORIGIN = 'app://researchagent'
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
export const SECRET_ACCOUNTS = ['deepseek', 'openai', 'cloudflare', 'cloudflare-account', 'api-token']
export const defaults = { live: false, paused: false, maxMinor: 200, dailyMinor: 500, walletDailyMinor: 2000, backend: 'local', remoteUrl: '', mcpEnabled: false }
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
  return { live: input.live, paused: input.paused, maxMinor: input.maxMinor, dailyMinor: input.dailyMinor,
    backend, remoteUrl, walletDailyMinor, mcpEnabled: input.mcpEnabled === true }

}
export function trustedSender(event) {
  const url = new URL(event.senderFrame.url)
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
    HOST: '127.0.0.1', RA_API_TOKEN: secrets['local-api-token'] || '',
    WALLET_DAILY_CAP_MINOR: String(preferences.walletDailyMinor ?? 2000), SPENDING_PAUSED: preferences.paused ? '1' : '0',
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: userData, TMPDIR: process.env.TMPDIR || '/tmp',
    DOTENV_CONFIG_PATH: '/dev/null', RA_DATA_DIR: `${userData}/${live ? 'testnet' : 'fixture'}`,
    LLM_PROVIDER: live ? 'deepseek' : 'fixture', LLM_API_KEY: live ? secrets.deepseek || '' : '',
    OPENAI_API_KEY: live ? secrets.openai || '' : '', DECISION_PROVIDER: live ? (secrets.openai ? 'openai' : 'cloudflare') : 'fixture',
    CLOUDFLARE_API_TOKEN: live ? secrets.cloudflare || '' : '', CLOUDFLARE_ACCOUNT_ID: live ? secrets['cloudflare-account'] || '' : '',
    XRPL_RPC_URL: 'wss://s.altnet.rippletest.net:51233',
    XRPL_PAYER_SEED: live ? secrets['xrpl-payer'] || '' : '',
    ...Object.fromEntries(Object.entries(secrets).filter(([key]) => live && /^XRPL_PUBLISHER_[A-Z0-9_]+_SEED$/.test(key))),
    SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', PUBLISHER_FAULTS: '0',
    MCP_MAX_BUDGET_MINOR: String(preferences.paused ? 0 : preferences.maxMinor), MCP_DAILY_CAP_MINOR: String(preferences.paused ? 0 : preferences.dailyMinor),
  }
}

export function remoteOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use an HTTPS origin')
  return url.origin
}
