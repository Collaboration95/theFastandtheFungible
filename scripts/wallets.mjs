// Re-fund XRPL Testnet wallets from the public faucet after a Testnet reset (or when low).
// Uses the seeds already in .env, so addresses never change. Never prints a seed.
// Run: make wallets   (Testnet only; Testnet XRP has no value)
import 'dotenv/config'
import { Client, Wallet } from 'xrpl'
import { TESTNET_WSS } from '../shared/xrpl.ts'
import { loadCorpus } from '../publisher/corpus.ts'

const LOW_DROPS = 20_000_000 // top up anything under 20 XRP
const seeds = Object.entries(process.env)
  .filter(([key, value]) => value && (key === 'XRPL_PAYER_SEED' || /^XRPL_PUBLISHER_[A-Z0-9_]+_SEED$/.test(key)))
  .map(([key, value]) => ({ name: key.replace(/^XRPL_(PUBLISHER_)?/, '').replace(/_SEED$/, ''), wallet: Wallet.fromSeed(value) }))
if (!seeds.length) { console.log('No XRPL seeds in .env; nothing to fund.'); process.exit(0) }
const client = new Client(TESTNET_WSS)
await client.connect()
try {
  for (const { name, wallet } of seeds) {
    let drops = 0
    try { drops = Number((await client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' })).result.account_data.Balance) }
    catch (error) { if (error?.data?.error !== 'actNotFound') throw error }
    if (drops >= LOW_DROPS) { console.log(`  ✓ ${name.padEnd(24)} ${wallet.classicAddress} ${drops / 1e6} XRP`); continue }
    const { balance } = await client.fundWallet(wallet)
    console.log(`  + ${name.padEnd(24)} ${wallet.classicAddress} ${drops ? 'topped up' : 're-created'} → ${balance} XRP`)
  }
  // Every paid publisher in the corpus should have a wallet whose seed you hold.
  const held = new Set(seeds.map(s => s.wallet.classicAddress))
  for (const resource of (await loadCorpus('')).filter(r => r.wallet && !held.has(r.wallet))) {
    console.log(`  ⚠ ${resource.publisher}: wallet ${resource.wallet} has no seed in .env; it can receive but not be re-funded here`)
  }
} finally { await client.disconnect() }
