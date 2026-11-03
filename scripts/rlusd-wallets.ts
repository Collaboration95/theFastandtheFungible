// Explicit operator setup, Testnet only. No secrets in output. Idempotent TrustSet.
import 'dotenv/config'
import { Client, Wallet } from 'xrpl'
import { testnetUrl } from '../shared/xrpl.js'
import { RLUSD_CURRENCY, RLUSD_TESTNET_ISSUER } from '../shared/contracts/asset.js'
export async function ensureTrustLine(client: Client, wallet: Wallet, issuer: string) {
  const currency = RLUSD_CURRENCY
  const lines = (await client.request({ command: 'account_lines', account: wallet.classicAddress, peer: issuer, ledger_index: 'validated' })).result.lines
  if (lines.some(l => l.currency === currency && Number(l.limit) >= 10)) return undefined
  const [account, info] = await Promise.all([client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' }), client.request({ command: 'server_info' })])
  const a = account.result.account_data, v = info.result.info.validated_ledger!
  const reserve = Math.ceil((v.reserve_base_xrp + (a.OwnerCount + (lines.some(l => l.currency === currency) ? 0 : 1)) * v.reserve_inc_xrp) * 1e6)
  if (Number(a.Balance) < reserve + 2000) throw new Error('Insufficient reserve for a new trust line')
  const tx = await client.autofill({ TransactionType: 'TrustSet' as const, Account: wallet.classicAddress, LimitAmount: { currency, issuer, value: '10' }, Flags: 131072 })
  if (Number(tx.Fee) > 2000) throw new Error('TrustSet fee exceeds ceiling')
  const result = await client.submitAndWait(wallet.sign(tx).tx_blob)
  if (!result.result.validated || typeof result.result.meta !== 'object' || result.result.meta.TransactionResult !== 'tesSUCCESS') throw new Error('TrustSet not validated')
  return result.result.hash
}
export async function setupRlusdWallets() {
  const client = new Client(testnetUrl())
  await client.connect()
  try {
    const issuer = process.env.XRPL_RLUSD_ISSUER || RLUSD_TESTNET_ISSUER
    for (const [key, seed] of Object.entries(process.env).filter(([k,v]) => v && (k === 'XRPL_PAYER_SEED' || /^XRPL_PUBLISHER_[A-Z0-9_]+_SEED$/.test(k)))) {
      const wallet = Wallet.fromSeed(seed!), hash = await ensureTrustLine(client, wallet, issuer)
      console.log(JSON.stringify({ key: key.replace('_SEED', '_ADDRESS'), address: wallet.classicAddress, trustLineTxHash: hash ?? 'already configured', issuer }))
    }
  } finally { await client.disconnect() }
}
