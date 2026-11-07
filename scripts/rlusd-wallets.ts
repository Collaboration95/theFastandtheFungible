// Explicit operator setup, Testnet only. No secrets in output. Idempotent TrustSet.
import 'dotenv/config'
import { Client, Wallet } from 'xrpl'
import { testnetLedger, testnetUrl } from '../shared/xrpl.js'
import { RLUSD_TESTNET_ISSUER } from '../shared/contracts/asset.js'
export { ensureTrustLine } from '../publisher/publishing/testnet-funding.js'
import { TestnetProvisioner } from '../publisher/publishing/testnet-funding.js'
export async function setupRlusdWallets() {
  const client = new Client(testnetUrl())
  await client.connect()
  try {
    const issuer = process.env.XRPL_RLUSD_ISSUER || RLUSD_TESTNET_ISSUER
    const entries = Object.entries(process.env).filter(([k,v]) => v && (k === 'XRPL_PAYER_SEED' || /^XRPL_PUBLISHER_[A-Z0-9_]+_SEED$/.test(k)))
    const wallets = entries.map(([, seed]) => Wallet.fromSeed(seed!))
    const hashes = await new TestnetProvisioner({ ledger: testnetLedger(testnetUrl()), faucet: fetch, walletStore: { file: '', allowedRoot: '', client, wallets, issuer } }).prepare({ asset: 'rlusd' })
    entries.forEach(([key], i) => console.log(JSON.stringify({ key: key.replace('_SEED', '_ADDRESS'), address: wallets[i].classicAddress, trustLineTxHash: hashes[wallets[i].classicAddress], issuer })))
  } finally { await client.disconnect() }
}
