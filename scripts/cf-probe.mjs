// Workers AI start-up probe (owner, 9 Oct): `make live` embeds every search query with Workers AI, and a token that
// Cloudflare refuses only showed up mid-demo as "keyword only (embeddings unavailable)". One tiny embedding call says so
// before anything starts. Names and Cloudflare's own messages only; never the token.
import { isDailyQuota, QUOTA_LINE } from './stage-checks.mjs'

const API = 'https://api.cloudflare.com/client/v4'
const MODEL = '@cf/baai/bge-base-en-v1.5'
/** Cloudflare's code for a token whose Client IP Address Filtering blocks this network. */
export const IP_BLOCKED = 9109
export const IP_HINT = "The token's Client IP Address Filtering blocks this network: allow this IP (or remove the filter) under Manage Account → Account API Tokens in the Cloudflare dashboard."

/**
 * One embedding with the configured token. Returns { ok, line, hint? }. A refused call only says "Authentication error",
 * so on failure the token's own record is read once: an IP-filtered token answers with code 9109 and the blocked location.
 */
export async function probeWorkersAi(env = process.env, call = fetch, timeoutMs = 8000) {
  const token = env.CLOUDFLARE_API_TOKEN
  if (!token) return { ok: false, line: 'CLOUDFLARE_API_TOKEN not set' }
  const headers = { Authorization: `Bearer ${token}` }
  const get = async path => (await call(`${API}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) })).json()
  const started = Date.now()
  try {
    let account = env.CLOUDFLARE_ACCOUNT_ID
    if (!account) {
      const accounts = await get('/accounts')
      if (accounts?.result?.length !== 1) { const blocked = await blockedLocation(get); return blocked ? { ok: false, line: blocked, hint: IP_HINT } : { ok: false, line: 'set CLOUDFLARE_ACCOUNT_ID: the token sees zero or several accounts' } }
      account = accounts.result[0].id
    }
    const response = await call(`${API}/accounts/${encodeURIComponent(account)}/ai/run/${MODEL}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: ['preflight'] }), signal: AbortSignal.timeout(timeoutMs) })
    if (response.ok) return { ok: true, line: `Workers AI embedding answered in ${Date.now() - started} ms` }
    const body = await response.json().catch(() => ({}))
    if (isDailyQuota(response.status, body)) return { ok: false, line: `Workers AI: ${QUOTA_LINE}`, hint: 'Start with CF_BACKUP=1 to use the backup Cloudflare pair.' }
    const blocked = await blockedLocation(get, account)
    if (blocked) return { ok: false, line: blocked, hint: IP_HINT }
    const message = body?.errors?.[0]?.message
    return { ok: false, line: `Workers AI embedding failed (HTTP ${response.status}${message ? `: ${message}` : ''})` }
  } catch (error) {
    return { ok: false, line: `Workers AI did not answer (${error?.name === 'TimeoutError' ? `no reply in ${timeoutMs} ms` : error?.message ?? 'network error'})` }
  }
}

/** Cloudflare's "Cannot use the access token from location: <ip>" for an account or user token, else undefined. */
async function blockedLocation(get, account) {
  for (const base of [...(account ? [`/accounts/${encodeURIComponent(account)}/tokens`] : []), '/user/tokens']) {
    try {
      const id = (await get(`${base}/verify`))?.result?.id
      if (!id) continue
      const record = await get(`${base}/${encodeURIComponent(id)}`)
      const error = record?.errors?.find(item => Number(item?.code) === IP_BLOCKED)
      if (error?.message) return String(error.message)
    } catch { /* next token kind */ }
  }
  return undefined
}
