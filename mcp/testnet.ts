import { TEST_SGD_LABEL } from '../shared/contracts/asset.js'
import { homedir } from 'node:os'
import { resolve, isAbsolute } from 'node:path'
import { provision, isolatedEnv } from '../scripts/testnet-wallets.js'

/** Wallets and durable cap accounting live here: `$XDG_STATE_HOME/researchagent/testnet`. */
export function testnetStateDir() {
  const xdg = process.env.XDG_STATE_HOME
  return resolve(xdg && isAbsolute(xdg) ? xdg : resolve(homedir(), '.local/state'), 'researchagent/testnet')
}

/** Gate 5: a faucet or network failure becomes a visible reason class, never raw error text. */
export const reasonClass = (error: unknown) => {
  const message = error instanceof Error ? error.message : ''
  if (/faucet/i.test(message)) return 'faucet_unavailable'
  if (/timeout/i.test(message)) return 'validation_timeout'
  if (/wallet (cache|file|directory)|private state/i.test(message)) return 'wallet_cache_unavailable'
  return 'network_unavailable'
}

const FIXTURE = 'Fixture models and fictional writers'
/**
 * Provisions (or reuses) faucet wallets and returns engine-only environment overrides. The parent
 * process environment is never mutated and operator caps are never touched (hard gate 2).
 */
export async function prepareMcpTestnet(load: typeof provision = provision, asset = process.env.ESCROW_ASSET, signal?: AbortSignal) {
  const started = performance.now()
  try {
    const root = testnetStateDir()
    if (asset === 'test-iou') console.error('Testnet IOU · wallets · elapsed 0.0 s')
    const seeds = await load(resolve(root, 'wallets.private.json'), fetch, undefined, root, asset, ...(signal ? [signal] : []))
    const full = isolatedEnv(seeds, asset)
    const env: NodeJS.ProcessEnv = { ESCROW_MODE: 'key-reveal', ANCHOR_RAIL: 'xrpl-testnet', DOTENV_CONFIG_PATH: '.testnet-no-env' }
    for (const [key, value] of Object.entries(full)) if (value !== undefined && /^(XRPL_|ESCROW_|SETTLEMENT_RAIL$|TESTNET_IOU_ISSUER$)/.test(key)) env[key] = value
    env.ESCROW_MODE = 'key-reveal'
    env.ESCROW_WRITERS = Object.keys(seeds).filter(slug => !['buyer', 'issuer'].includes(slug)).join(',')
    const seconds = ((performance.now() - started) / 1000).toFixed(2)
    console.error(`Testnet · no real value · wallets ready in ${seconds} s`)
    return { testnet: true as const, env, labels: ['Testnet · no real value', FIXTURE, ...(asset === 'test-iou' ? [TEST_SGD_LABEL] : [])] }
  } catch (error) {
    const label = `SIMULATED fallback · ${reasonClass(error)} · no ledger transactions`
    console.error(label)
    return { testnet: false as const, env: { RA_TESTNET_FALLBACK: reasonClass(error) } as NodeJS.ProcessEnv, labels: [label, FIXTURE, ...(asset === 'test-iou' ? [TEST_SGD_LABEL] : [])] }
  }
}
