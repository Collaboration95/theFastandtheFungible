// Read-only on both networks; no wallets, signatures or submit calls.
import { Client } from 'xrpl'
import { save, TESTNET } from './lib.mjs'
const source = 'https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl'
const networks = [
  { network: 'Mainnet', url: 'wss://xrplcluster.com', issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' },
  { network: 'Testnet', url: TESTNET, issuer: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV' },
]
const results = []
for (const n of networks) {
  const c = new Client(n.url, { timeout: 20000 })
  try {
    await c.connect()
    const { result } = await c.request({ command: 'account_info', account: n.issuer, ledger_index: 'validated' })
    let feature
    try {
      const r = (await c.request({ command: 'feature' })).result
      feature = Object.fromEntries(Object.entries(r.features ?? {}).filter(([, f]) => /TokenEscrow/.test(f.name)))
    } catch (e) { feature = { error: e.data?.error ?? e.name } }
    results.push({ ...n, ledger: result.ledger_index, flags: result.account_data.Flags, flagsHex: '0x' + result.account_data.Flags.toString(16),
      lsfAllowTrustLineLocking: Boolean(result.account_data.Flags & 0x40000000), feature })
  } finally { await c.disconnect() }
}
save('d', { at: new Date().toISOString(), source, results })
console.log(JSON.stringify(results, null, 2))
