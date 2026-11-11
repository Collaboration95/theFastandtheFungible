// Read-only public ledger checks. No wallets, signing or submission.
import { Client } from 'xrpl'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
const amendment = createHash('sha512').update('TokenEscrow').digest('hex').slice(0, 64).toUpperCase()
const checks = []
for (const [network, url, account] of [
 ['Mainnet', 'wss://s1.ripple.com', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'],
 ['Testnet', 'wss://s.altnet.rippletest.net:51233', 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'],
]) {
 const client = new Client(url, { connectionTimeout: 20000, timeout: 20000 })
 try {
  await client.connect()
  const info = (await client.request({ command: 'server_info' })).result.info
  const issuer = (await client.request({ command: 'account_info', account, ledger_index: 'validated' })).result
  const feature = await client.request({ command: 'feature', feature: amendment })
  checks.push({ network, url, checkedAt: new Date().toISOString(), ledger: info.validated_ledger, issuer: { account, flags: issuer.account_data.Flags, allowTrustLineLocking: Boolean(issuer.account_data.Flags & 0x40000000), ledgerIndex: issuer.ledger_index }, tokenEscrow: feature.result })
  console.log(network, JSON.stringify(checks.at(-1)))
 } finally { await client.disconnect() }
}
writeFileSync(new URL('./ledger-readonly.json', import.meta.url), JSON.stringify(checks, null, 2) + '\n')
