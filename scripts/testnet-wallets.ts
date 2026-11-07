import { mkdir, readFile, writeFile, chmod, lstat, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { Client, AccountSetAsfFlags, Wallet, type SubmittableTransaction } from 'xrpl'
import { TESTNET_WSS, testnetLedger, signPayment, lookupTx } from '../shared/xrpl.js'
class ProvisionError extends Error {}
const resultCode = (e: unknown) => { const value = e as { data?: { error?: string }; message?: string }; return value.data?.error ?? (['actNotFound', 'tefPAST_SEQ'].find(code => value.message?.includes(code))) }
export const FAUCET = 'https://faucet.altnet.rippletest.net/accounts'
export const walletFile = resolve(process.env.TESTNET_WALLET_FILE || 'scratch/testnet-first-touch/wallets.private.json')
export async function provision(file = walletFile, faucet = fetch, ledger = testnetLedger(TESTNET_WSS), allowedRoot = resolve('scratch'), asset = process.env.ESCROW_ASSET) {
  file = resolve(file)
  if (!file.startsWith(resolve(allowedRoot) + sep)) throw Error('Wallet file must be under scratch or the configured private state directory')
  await mkdir(resolve(file, '..'), { recursive: true, mode: 0o700 })
  const parent = await realpath(resolve(file, '..')), root = await realpath(resolve(allowedRoot))
  if (parent !== root && !parent.startsWith(root + sep)) throw Error('Wallet directory escapes private state root')
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
      if (!response.ok) throw new ProvisionError(`faucet HTTP ${response.status} · faucet unavailable`)
      await response.body?.cancel()
      const deadline = Date.now() + 20000
      while (await balanceOf(buyer.classicAddress) < 45_000_000) {
        if (Date.now() >= deadline) throw new ProvisionError('validation timeout')
        await new Promise(r => setTimeout(r, 250))
      }
    }
    // Submit every writer funding payment back to back (the open-ledger Sequence advances), then wait once: ~4 s per writer becomes ~4 s total.
    const submitted: string[] = []
    for (const slug of slugs.filter(s => !['buyer','open-records','grid-operators-report'].includes(s))) {
      const address = Wallet.fromSeed(seeds[slug]).classicAddress
      if (await balanceOf(address) >= 5_000_000) continue
      for (let attempt = 0; ; attempt++) {
        try {
          const payment = await signPayment(buyer, {Destination:address, Amount:'6000000', InvoiceID:'0'.repeat(64)}, ledger)
          const result = await ledger.request({command:'submit',tx_blob:payment.txBlob})
          const code = result.result.engine_result
          if (code && code !== 'tesSUCCESS' && code !== 'terQUEUED') {
            if (code === 'tefPAST_SEQ' && attempt === 0) continue
            throw new ProvisionError(`funding tx result ${/^[a-zA-Z0-9_]+$/.test(code) ? code : 'unknown'}`)
          }
          submitted.push(payment.txHash)
          break
        } catch (error) {
          if (attempt === 0 && ['actNotFound','tefPAST_SEQ'].includes(resultCode(error) ?? '')) continue
          throw error
        }
      }
    }
    const deadline = Date.now()+30000
    for (const hash of submitted) for (;;) {
      const found = await lookupTx(ledger,hash)
      if (found.state === 'validated') {
        if(found.meta.TransactionResult !== 'tesSUCCESS') throw new ProvisionError('funding tx result failed')
        break
      }
      if(Date.now()>deadline) throw new ProvisionError('funding validation timeout')
      await new Promise(r=>setTimeout(r,250))
    }
    if (asset === 'test-iou') await provisionIou(seeds, file)
    return seeds
  } finally { await ledger.close() }
}
export function isolatedEnv(seeds?: Record<string, string>, asset = process.env.ESCROW_ASSET): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { RA_API_TOKEN:process.env.RA_API_TOKEN, MCP_MAX_BUDGET_MINOR:process.env.MCP_MAX_BUDGET_MINOR, MCP_DAILY_CAP_MINOR:process.env.MCP_DAILY_CAP_MINOR, DEMO_WEB_PORT:process.env.DEMO_WEB_PORT, DEMO_API_PORT:process.env.DEMO_API_PORT, DEMO_PUBLISHER_PORT:process.env.DEMO_PUBLISHER_PORT, CODESPACE_NAME:process.env.CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN, PATH:process.env.PATH, HOME:process.env.HOME, TMPDIR:process.env.TMPDIR, DOTENV_CONFIG_PATH:'.testnet-no-env', LLM_PROVIDER:'fixture', DECISION_PROVIDER:'fixture', SEARCH_EMBEDDINGS:'off', LANGFUSE_ENABLED:'0', SETTLEMENT_RAIL:seeds?'xrpl-testnet':'simulated', XRPL_RPC_URL:TESTNET_WSS, APP_DB:':memory:', PUBLISHER_DB:':memory:', PUBLISHER_SECRET:'isolated-testnet-demo', ESCROW_WRITERS:'' }
  if (seeds?.issuer && asset === 'test-iou') { env.ESCROW_ASSET='test-iou'; env.TESTNET_IOU_ISSUER=Wallet.fromSeed(seeds.issuer).classicAddress }
  if (seeds) { env.ESCROW_MODE = process.env.ESCROW_MODE === 'payment' ? 'payment' : 'key-reveal'; env.ESCROW_WRITERS = env.ESCROW_MODE === 'key-reveal' ? Object.keys(seeds).filter(s => !['buyer','issuer'].includes(s)).join(',') : ''; env.XRPL_PAYER_SEED=seeds.buyer; for(const [slug,seed] of Object.entries(seeds)) if(!['buyer','issuer'].includes(slug)) env[`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-','_')}_SEED`]=seed }
  return env
}

export async function prepare(load = provision) { try { return { env: isolatedEnv(await load()), fallback: false } } catch (error) { return { env: isolatedEnv(), fallback: true, reason: error instanceof ProvisionError ? error.message : 'network or provisioning error' } } }

/** Only faucet-funded Testnet XRP; persist issuer seed before any transaction. */
async function provisionIou(seeds: Record<string,string>, file: string) {
  seeds.issuer ||= Wallet.generate().seed!
  await writeFile(file, JSON.stringify(seeds), {mode:0o600}); await chmod(file,0o600)
  const client = new Client(TESTNET_WSS)
  await client.connect()
  try {
    const buyer=Wallet.fromSeed(seeds.buyer), issuer=Wallet.fromSeed(seeds.issuer)
    const submit = async (wallet: Wallet, tx: Record<string,unknown>) => {
      const prepared = await client.autofill({...tx,Account:wallet.classicAddress} as SubmittableTransaction)
      if (Number(prepared.Fee)>2000) throw Error('Provision fee cap')
      const r=await client.submitAndWait(wallet.sign(prepared).tx_blob)
      if (typeof r.result.meta !== 'object' || r.result.meta?.TransactionResult !== 'tesSUCCESS') throw Error('IOU provisioning transaction failed')
    }
    try { await client.request({command:'account_info',account:issuer.classicAddress}) }
    catch { await submit(buyer,{TransactionType:'Payment',Destination:issuer.classicAddress,Amount:'6000000'}) }
    const info = await client.request({command:'account_info',account:issuer.classicAddress,ledger_index:'validated'})
    if (!(info.result.account_data.Flags & 0x40000000)) await submit(issuer,{TransactionType:'AccountSet',SetFlag:AccountSetAsfFlags.asfAllowTrustLineLocking})
    for (const [slug,seed] of Object.entries(seeds)) {
      if (['issuer','open-records','grid-operators-report'].includes(slug)) continue
      const wallet = Wallet.fromSeed(seed)
      const existing = await client.request({command:'account_lines',account:wallet.classicAddress,peer:issuer.classicAddress,ledger_index:'validated'})
      if (!existing.result.lines.some(l => l.currency === 'SGT' && Number(l.limit) >= 1000000)) await submit(wallet,{TransactionType:'TrustSet',LimitAmount:{currency:'SGT',issuer:issuer.classicAddress,value:'1000000'}})
    }
    const lines=await client.request({command:'account_lines',account:buyer.classicAddress,peer:issuer.classicAddress,ledger_index:'validated'})
    if (!lines.result.lines.some(l=>l.currency==='SGT' && Number(l.balance)>=1000)) await submit(issuer,{TransactionType:'Payment',Destination:buyer.classicAddress,Amount:{currency:'SGT',issuer:issuer.classicAddress,value:'10000'}})
  } finally { await client.disconnect() }
}
