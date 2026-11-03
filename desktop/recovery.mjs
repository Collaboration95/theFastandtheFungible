import { SECRET_ACCOUNTS, providerAccount } from './policy.mjs'
// Only explicit live/remote actions enter Keychain. Offline never reads even an MCP token.
export async function bootSecrets(preferences, read, roster = []) {
  const secrets = {}
  if (preferences.backend === 'remote') {
    secrets['api-token'] = await read('api-token')
    if (!secrets['api-token']) throw new Error('Remote token missing. Open Settings or switch offline.')
  } else if (preferences.live) {
    for (const name of [...SECRET_ACCOUNTS, 'xrpl-payer', ...roster]) secrets[name] = await read(name)
    if (!secrets[providerAccount(preferences)] || !secrets['xrpl-payer'] ||
      (!preferences.sameKeyDecisions && !secrets.openai && !(secrets.cloudflare && secrets['cloudflare-account']))) throw new Error('Live credentials incomplete. Open Settings or switch offline.')
    if (preferences.mcpEnabled) secrets['local-api-token'] = await read('local-api-token')
  }
  return secrets
}
export function recoveryMessage() { return 'Engine unavailable. Check provider settings and Keychain access, retry, or open the offline demo. Stored live work is preserved.' }
