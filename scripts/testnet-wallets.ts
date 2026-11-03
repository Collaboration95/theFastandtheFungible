import { mkdir, readFile, writeFile, chmod, lstat, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { Wallet } from 'xrpl'
import { TESTNET_WSS, testnetLedger, signPayment, lookupTx } from '../shared/xrpl.js'
export const FAUCET = 'https://faucet.altnet.rippletest.net/accounts'
export const walletFile = resolve('scratch/testnet-first-touch/wallets.private.json')
export async function provision(file = walletFile, faucet = fetch, ledger = testnetLedger(TESTNET_WSS)) {
  file = resolve(file)
  if (!file.startsWith(resolve('scratch') + sep)) throw Error('Wallet file must be under scratch')
  await mkdir(resolve(file, '..'), { recursive: true, mode: 0o700 })
  if (!(await realpath(resolve(file, '..'))).startsWith(await realpath(resolve('scratch')) + sep)) throw Error('Wallet directory escapes scratch')
  let seeds: Record<string, string> = {}
  try { if (!(await lstat(file)).isFile()) throw Error('Invalid wallet file'); await chmod(file, 0o600); seeds = JSON.parse(await readFile(file, 'utf8')) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('Private wallet cache unavailable') }
  try {
    if ((await ledger.request({ command: 'server_info' })).result.info.network_id !== 1) throw Error('Testnet network ID required')
    // One faucet request funds the buyer; it provisions fixture writers to avoid per-IP faucet limits.
    const slugs = ['buyer', 'alphaleak', 'the-fab-floor', 'notfinancialtimes', 'basis-points', 'load-factor', 'kopi-contrarian', 'marketpulse-digest', 'open-records', 'grid-operators-report']
    for (const slug of slugs) seeds[slug] ||= Wallet.generate().seed!
    await writeFile(file, JSON.stringify(seeds), { mode: 0o600 }); await chmod(file, 0o600)
    const buyer = Wallet.fromSeed(seeds.buyer)
    const balanceOf = async (address: string) => { try { return Number((await ledger.request({command:'account_info', account:address, ledger_index:'validated'})).result.account_data.Balance) } catch { return 0 } }
    if (await balanceOf(buyer.classicAddress) < 45_000_000) {
      const response = await faucet(FAUCET, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({destination:buyer.classicAddress}), signal:AbortSignal.timeout(20000)})
      if (!response.ok) throw Error('Public Testnet faucet unavailable')
      await response.body?.cancel()
    }
    for (const slug of slugs.filter(s => !['buyer','open-records','grid-operators-report'].includes(s))) {
      const address = Wallet.fromSeed(seeds[slug]).classicAddress
      if (await balanceOf(address) >= 5_000_000) continue
      const payment = await signPayment(buyer, {Destination:address, Amount:'6000000', InvoiceID:'0'.repeat(64)}, ledger)
      await ledger.request({command:'submit',tx_blob:payment.txBlob})
      const deadline = Date.now()+15000
      for (;;) {
        const found = await lookupTx(ledger,payment.txHash)
        if (found.state === 'validated') { if(found.meta.TransactionResult !== 'tesSUCCESS') throw Error('Wallet funding failed'); break }
        if(Date.now()>deadline) throw Error('Wallet funding timeout')
        await new Promise(r=>setTimeout(r,250))
      }
    }
    return seeds
  } finally { await ledger.close() }
}
export function isolatedEnv(seeds?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH:process.env.PATH, HOME:process.env.HOME, TMPDIR:process.env.TMPDIR, DOTENV_CONFIG_PATH:'.testnet-no-env', LLM_PROVIDER:'fixture', DECISION_PROVIDER:'fixture', SEARCH_EMBEDDINGS:'off', LANGFUSE_ENABLED:'0', SETTLEMENT_RAIL:seeds?'xrpl-testnet':'simulated', XRPL_RPC_URL:TESTNET_WSS, APP_DB:':memory:', PUBLISHER_DB:':memory:', PUBLISHER_SECRET:'isolated-testnet-demo', ESCROW_WRITERS:'' }
  if (seeds) { env.XRPL_PAYER_SEED=seeds.buyer; for(const [slug,seed] of Object.entries(seeds)) if(slug!=='buyer') env[`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-','_')}_SEED`]=seed }
  return env
}

export async function prepare(load = provision) { try { return { env: isolatedEnv(await load()), fallback: false } } catch { return { env: isolatedEnv(), fallback: true } } }
