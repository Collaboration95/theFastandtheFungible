import { homedir } from 'node:os'
import { resolve, isAbsolute } from 'node:path'
import { provision, isolatedEnv } from '../scripts/testnet-wallets.js'

export function testnetStateDir() {
  const xdg = process.env.XDG_STATE_HOME
  return resolve(xdg && isAbsolute(xdg) ? xdg : resolve(homedir(), '.local/state'), 'researchagent/testnet')
}
/** Provisioning never changes operator caps or exposes private wallet material. */
export async function prepareMcpTestnet() {
  const started = performance.now()
  try {
    const root = testnetStateDir()
    const seeds = await provision(resolve(root, 'wallets.private.json'), fetch, undefined, root)
    const env = isolatedEnv(seeds)
    Object.assign(process.env, Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)), { ESCROW_MODE: 'key-reveal', ANCHOR_RAIL: 'xrpl-testnet' })
    console.error(`Testnet · no real value · wallets ready in ${((performance.now() - started) / 1000).toFixed(2)} s`)
    return { testnet: true, labels: ['Testnet · no real value', 'Fixture models and fictional writers'] }
  } catch {
    Object.assign(process.env, Object.fromEntries(Object.entries(isolatedEnv()).filter(([, value]) => value !== undefined)), { ANCHOR_RAIL: 'simulated' })
    const reason = 'network_or_provisioning_error'
    console.error(`SIMULATED fallback · ${reason} · no ledger transactions`)
    return { testnet: false, labels: [`SIMULATED fallback · ${reason} · no ledger transactions`, 'Fixture models and fictional writers'] }
  }
}
