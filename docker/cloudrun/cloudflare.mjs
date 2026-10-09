// Cloud Run start-up: run on the first Cloudflare pair that answers one Workers AI embedding, in the owner's order
// (primary, _2, _3, _4). Names and Cloudflare's own messages only, never a token.
export const PAIR_SUFFIXES = ['', '_2', '_3', '_4']

/** Probes every configured pair at once; `chosen` is the first in order that answered, else undefined. */
export async function pickCloudflarePair(env, probe) {
  const pairs = PAIR_SUFFIXES.map(suffix => ({ name: `CLOUDFLARE_API_TOKEN${suffix}`, token: env[`CLOUDFLARE_API_TOKEN${suffix}`], account: env[`CLOUDFLARE_ACCOUNT_ID${suffix}`] || undefined }))
    .filter(pair => pair.token)
  // An empty account ID is left out so the probe (and later the app) resolves it from the token.
  const results = await Promise.all(pairs.map(pair => probe({ CLOUDFLARE_API_TOKEN: pair.token, ...(pair.account ? { CLOUDFLARE_ACCOUNT_ID: pair.account } : {}) })))
  const lines = pairs.map((pair, i) => `${pair.name}: ${results[i].ok ? 'ok' : 'FAILED'} · ${results[i].line}`)
  return { chosen: pairs[results.findIndex(result => result.ok)], lines }
}

/** The children's env: the chosen pair (else the primary) as the only Cloudflare variables. */
export function withCloudflarePair(env, chosen) {
  const out = { ...env }
  for (const suffix of PAIR_SUFFIXES) { delete out[`CLOUDFLARE_API_TOKEN${suffix}`]; delete out[`CLOUDFLARE_ACCOUNT_ID${suffix}`] }
  const pair = chosen ?? { token: env.CLOUDFLARE_API_TOKEN, account: env.CLOUDFLARE_ACCOUNT_ID || undefined }
  if (pair.token) out.CLOUDFLARE_API_TOKEN = pair.token
  if (pair.account) out.CLOUDFLARE_ACCOUNT_ID = pair.account
  return out
}
