import { mkdir, readFile, writeFile, chmod, lstat, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { Client, AccountSetAsfFlags, Wallet, type TrustSet, type SubmittableTransaction } from 'xrpl'
import { TESTNET_WSS, testnetLedger, signPayment, lookupTx } from '../../shared/xrpl.js'
export class ProvisionError extends Error {}
const resultCode = (e: unknown) => { const value = e as { data?: { error?: string }; message?: string }; return value.data?.error ?? (['actNotFound', 'tefPAST_SEQ'].find(code => value.message?.includes(code))) }
export const FAUCET = 'https://faucet.altnet.rippletest.net/accounts'
import { testnetUrl } from '../../shared/xrpl.js'
import { RLUSD_CURRENCY } from '../../shared/contracts/asset.js'

export const DEFAULT_WRITERS = ['buyer', 'team-builder-notes', 'team-xrpl-explainers', 'alphaleak', 'the-fab-floor', 'notfinancialtimes', 'basis-points', 'load-factor', 'kopi-contrarian', 'marketpulse-digest', 'open-records', 'grid-operators-report'].filter(s => s !== 'buyer')
async function prepareWallets(file: string, faucet: typeof fetch, ledger: ReturnType<typeof testnetLedger>, allowedRoot: string, asset?: string, writers = DEFAULT_WRITERS, signal?: AbortSignal, fundFreeWriters = false) {
  signal?.throwIfAborted()
  file = resolve(file)
  if (!file.startsWith(resolve(allowedRoot) + sep)) throw Error('Wallet file must be under scratch or the configured private state directory')
  await mkdir(resolve(file, '..'), { recursive: true, mode: 0o700 })
  const parent = await realpath(resolve(file, '..')), root = await realpath(resolve(allowedRoot))
  if (parent !== root && !parent.startsWith(root + sep)) throw Error('Wallet directory escapes private state root')
  let seeds: Record<string, string> = {}
  try { if (!(await lstat(file)).isFile()) throw Error('Invalid wallet file'); await chmod(file, 0o600); seeds = JSON.parse(await readFile(file, 'utf8')) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('Private wallet cache unavailable') }
  const underlying = ledger
  ledger = { ...ledger, request: async (...args: Parameters<typeof ledger.request>) => { signal?.throwIfAborted(); return underlying.request(...args) } }
  try {
    if ((await ledger.request({ command: 'server_info' })).result.info.network_id !== 1) throw Error('Testnet network ID required')
    // One faucet request funds the buyer; it provisions fixture writers to avoid per-IP faucet limits.
    const slugs = ['buyer', ...writers]
    for (const slug of slugs) seeds[slug] ||= Wallet.generate().seed!
    await writeFile(file, JSON.stringify(seeds), { mode: 0o600 }); await chmod(file, 0o600)
    const buyer = Wallet.fromSeed(seeds.buyer)
    const balanceOf = async (address: string) => { try { return Number((await ledger.request({command:'account_info', account:address, ledger_index:'validated'})).result.account_data.Balance) } catch { return 0 } }
    if (await balanceOf(buyer.classicAddress) < 45_000_000) {
      const response = await faucet(FAUCET, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({destination:buyer.classicAddress}), signal:signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)})
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
    const funded = slugs.filter(s => s !== 'buyer' && (fundFreeWriters || !['open-records','grid-operators-report'].includes(s)))
    const balances = new Map<string, number>()
    for (let i = 0; i < funded.length; i += 4) await Promise.all(funded.slice(i, i + 4).map(async slug => { balances.set(slug, await balanceOf(Wallet.fromSeed(seeds[slug]).classicAddress)) }))
    for (const slug of funded) {
      const address = Wallet.fromSeed(seeds[slug]).classicAddress
      if (balances.get(slug)! >= 5_000_000) continue
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
/** Only faucet-funded Testnet XRP; persist issuer seed before any transaction. */
async function provisionIou(seeds: Record<string,string>, file: string) {
  const started = performance.now()
  const progress = (step: string) => console.error(`Testnet IOU · ${step} · elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`)
  progress('issuer')
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
    progress('trust lines')
    const holders = Object.entries(seeds).filter(([slug]) => !['issuer','open-records','grid-operators-report'].includes(slug))
    const balances = new Map(await Promise.all(holders.map(async ([slug, seed]) => {
      const existing = await client.request({command:'account_lines',account:Wallet.fromSeed(seed).classicAddress,peer:issuer.classicAddress,ledger_index:'validated'})
      return [slug, existing.result.lines] as const
    })))
    // Only the balance reads above overlap; signing and validation retain their order.
    for (const [slug,seed] of holders) {
      const wallet = Wallet.fromSeed(seed)
      if (!balances.get(slug)!.some(l => l.currency === 'SGT' && Number(l.limit) >= 1000000)) await submit(wallet,{TransactionType:'TrustSet',LimitAmount:{currency:'SGT',issuer:issuer.classicAddress,value:'1000000'}})
    }
    progress('issuance')
    const lines=await client.request({command:'account_lines',account:buyer.classicAddress,peer:issuer.classicAddress,ledger_index:'validated'})
    if (!lines.result.lines.some(l=>l.currency==='SGT' && Number(l.balance)>=1000)) await submit(issuer,{TransactionType:'Payment',Destination:buyer.classicAddress,Amount:{currency:'SGT',issuer:issuer.classicAddress,value:'10000'}})
  } finally { await client.disconnect() }
}

export async function ensureTrustLine(client: Client, wallet: Wallet, issuer: string) {
  const currency = RLUSD_CURRENCY
  const lines = (await client.request({ command: 'account_lines', account: wallet.classicAddress, peer: issuer, ledger_index: 'validated' })).result.lines
  if (lines.some(l => l.currency === currency && Number(l.limit) >= 10)) return undefined
  const [account, info] = await Promise.all([client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' }), client.request({ command: 'server_info' })])
  const a = account.result.account_data, v = info.result.info.validated_ledger!
  const reserve = Math.ceil((v.reserve_base_xrp + (a.OwnerCount + (lines.some(l => l.currency === currency) ? 0 : 1)) * v.reserve_inc_xrp) * 1e6)
  if (Number(a.Balance) < reserve + 2000) throw new Error('Insufficient reserve for a new trust line')
  const tx = await client.autofill<TrustSet>({ TransactionType: 'TrustSet' as const, Account: wallet.classicAddress, LimitAmount: { currency, issuer, value: '10' }, Flags: 131072 })
  if (Number(tx.Fee) > 2000) throw new Error('TrustSet fee exceeds ceiling')
  const result = await client.submitAndWait(wallet.sign(tx).tx_blob)
  if (!result.result.validated || typeof result.result.meta !== 'object' || result.result.meta.TransactionResult !== 'tesSUCCESS') throw new Error('TrustSet not validated')
  return result.result.hash
}

/** Private provisioning output belongs only in the engine environment or wallet store. */
export class TestnetProvisioner {
  constructor(private readonly deps: { ledger: ReturnType<typeof testnetLedger>; faucet: typeof fetch; walletStore: { file: string; allowedRoot: string; client?: Client; wallets?: Wallet[]; issuer?: string } }) {}
  async prepare({ asset, writers = DEFAULT_WRITERS, signal, fundFreeWriters = false }: { asset?: string; writers?: string[]; signal?: AbortSignal; fundFreeWriters?: boolean }): Promise<Record<string, string>> {
    if (asset === 'rlusd') {
      const { client, wallets, issuer } = this.deps.walletStore
      if (!client || !wallets || !issuer) throw Error('RLUSD requires explicit Testnet wallets and issuer')
      const results: (string | undefined)[] = []
      for (const wallet of wallets) { signal?.throwIfAborted(); results.push(await ensureTrustLine(client, wallet, issuer)) }
      return Object.fromEntries(wallets.map((wallet, i) => [wallet.classicAddress, results[i] ?? 'already configured']))
    }
    return prepareWallets(this.deps.walletStore.file, this.deps.faucet, this.deps.ledger, this.deps.walletStore.allowedRoot, asset, writers, signal, fundFreeWriters)
  }
}

/** Faucet provisioning never signs a payment. The fixed Testnet allowlist is checked before connecting. */
export async function fundTestnetWallet(wallet: Wallet): Promise<void> {
  const client = new Client(testnetUrl(), { connectionTimeout: 8000, timeout: 12000 })
  try {
    await client.connect()
    try {
      await client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' })
      return // Receiving requires no balance top-up for an existing account.
    } catch (error) { if ((error as { data?: { error?: string } }).data?.error !== 'actNotFound') throw error }
    await client.fundWallet(wallet)
  } catch { throw new Error('Testnet wallet funding failed. The key is saved; rerun the same command to retry. Check XRPL_RPC_URL and Testnet faucet availability.') }
  finally { await client.disconnect() }
}
