// XRPL Testnet wallets (#133). Testnet only; Testnet XRP has no value. Never prints a seed.
//   make wallets            top up every wallet whose seed is in .env (same addresses after a Testnet reset)
//   make wallets CREATE=1   first create a wallet for each paid roster publisher without
//                           XRPL_PUBLISHER_<SLUG>_SEED, write its seed and address into .env, then fund it
import 'dotenv/config'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client, Wallet } from 'xrpl'
import { TESTNET_WSS } from '../shared/xrpl.ts'
import { seedEnvName } from '../publisher/registry.ts'

const LOW_DROPS = 20_000_000 // top up anything under 20 XRP

/** Roster publishers that sell anything (a price above zero) are paid at their own wallet. Rosters carry no wallet (#112). */
export function paidSlugs(dir = new URL('../data/writers/', import.meta.url)) {
  return readdirSync(dir).filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(readFileSync(new URL(file, dir), 'utf8')).publisher)
    .filter(publisher => Object.values(publisher.prices ?? {}).some(price => price > 0))
    .map(publisher => publisher.slug).sort()
}
export const addressEnvName = slug => seedEnvName(slug).replace(/_SEED$/, '_ADDRESS')

/** Sets NAME=value in .env text: fills an existing empty or stale line, else appends one. */
export function upsertEnv(text, name, value) {
  const line = new RegExp(`^${name}=.*$`, 'm')
  return line.test(text) ? text.replace(line, `${name}=${value}`) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${name}=${value}\n`
}

/** Pure: a new wallet for each paid slug without a seed. Logs addresses and variable names only. */
export function createMissing({ slugs, env, envText, log = console.log, generate = () => Wallet.generate() }) {
  const created = []
  for (const slug of slugs) {
    if (env[seedEnvName(slug)]) continue
    const wallet = generate()
    envText = upsertEnv(upsertEnv(envText, seedEnvName(slug), wallet.seed), addressEnvName(slug), wallet.classicAddress)
    created.push({ name: `PUBLISHER_${slug}`, wallet })
    log(`  + ${slug.padEnd(24)} ${wallet.classicAddress} · seed written to .env as ${seedEnvName(slug)}`)
  }
  return { envText, created }
}

async function main() {
  const slugs = paidSlugs()
  const fresh = []
  if (process.argv.includes('--create')) {
    // .env is written before the faucet call, so a failed funding run never loses a seed.
    const { envText, created } = createMissing({ slugs, env: process.env, envText: existsSync('.env') ? readFileSync('.env', 'utf8') : '' })
    if (created.length) writeFileSync('.env', envText, { mode: 0o600 })
    fresh.push(...created)
  }
  const seeds = [...Object.entries(process.env)
    .filter(([key, value]) => value && (key === 'XRPL_PAYER_SEED' || /^XRPL_PUBLISHER_[A-Z0-9_]+_SEED$/.test(key)))
    .map(([key, value]) => ({ name: key.replace(/^XRPL_/, '').replace(/_SEED$/, ''), wallet: Wallet.fromSeed(value) })), ...fresh]
  if (!seeds.length) { console.log('No XRPL seeds in .env; nothing to fund. Run make wallets CREATE=1 to create them.'); return }
  const client = new Client(TESTNET_WSS)
  await client.connect()
  try {
    for (const { name, wallet } of seeds) {
      let drops = 0
      try { drops = Number((await client.request({ command: 'account_info', account: wallet.classicAddress, ledger_index: 'validated' })).result.account_data.Balance) }
      catch (error) { if (error?.data?.error !== 'actNotFound') throw error }
      if (drops >= LOW_DROPS) { console.log(`  ✓ ${name.padEnd(32)} ${wallet.classicAddress} ${drops / 1e6} XRP`); continue }
      const { balance } = await client.fundWallet(wallet)
      console.log(`  + ${name.padEnd(32)} ${wallet.classicAddress} ${drops ? 'topped up' : 'funded'} → ${balance} XRP`)
    }
  } finally { await client.disconnect() }
  const missing = slugs.filter(slug => !process.env[seedEnvName(slug)] && !fresh.some(f => f.name === `PUBLISHER_${slug}`))
  if (missing.length) console.log(`  ⚠ paid publishers without a wallet: ${missing.join(', ')}; run make wallets CREATE=1`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
