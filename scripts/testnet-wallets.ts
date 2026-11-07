import { resolve } from 'node:path'
import { Wallet } from 'xrpl'
import { TESTNET_WSS, testnetLedger } from '../shared/xrpl.js'
import { TestnetProvisioner, ProvisionError } from '../publisher/publishing/testnet-funding.js'
export { FAUCET } from '../publisher/publishing/testnet-funding.js'
export const walletFile = resolve(process.env.TESTNET_WALLET_FILE || 'scratch/testnet-first-touch/wallets.private.json')
export async function provision(file = walletFile, faucet = fetch, ledger = testnetLedger(TESTNET_WSS), allowedRoot = resolve('scratch'), asset = process.env.ESCROW_ASSET, signal?: AbortSignal) {
  return new TestnetProvisioner({ ledger, faucet, walletStore: { file, allowedRoot } }).prepare({ asset, signal })
}
export function isolatedEnv(seeds?: Record<string, string>, asset = process.env.ESCROW_ASSET): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { RA_API_TOKEN:process.env.RA_API_TOKEN, MCP_MAX_BUDGET_MINOR:process.env.MCP_MAX_BUDGET_MINOR, MCP_DAILY_CAP_MINOR:process.env.MCP_DAILY_CAP_MINOR, DEMO_WEB_PORT:process.env.DEMO_WEB_PORT, DEMO_API_PORT:process.env.DEMO_API_PORT, DEMO_PUBLISHER_PORT:process.env.DEMO_PUBLISHER_PORT, CODESPACE_NAME:process.env.CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN, PATH:process.env.PATH, HOME:process.env.HOME, TMPDIR:process.env.TMPDIR, DOTENV_CONFIG_PATH:'.testnet-no-env', LLM_PROVIDER:'fixture', DECISION_PROVIDER:'fixture', SEARCH_EMBEDDINGS:'off', LANGFUSE_ENABLED:'0', SETTLEMENT_RAIL:seeds?'xrpl-testnet':'simulated', XRPL_RPC_URL:TESTNET_WSS, APP_DB:':memory:', PUBLISHER_DB:':memory:', PUBLISHER_SECRET:'isolated-testnet-demo', ESCROW_WRITERS:'' }
  if (seeds?.issuer && asset === 'test-iou') { env.ESCROW_ASSET='test-iou'; env.TESTNET_IOU_ISSUER=Wallet.fromSeed(seeds.issuer).classicAddress }
  if (seeds) { env.ESCROW_MODE = process.env.ESCROW_MODE === 'payment' ? 'payment' : 'key-reveal'; env.ESCROW_WRITERS = env.ESCROW_MODE === 'key-reveal' ? Object.keys(seeds).filter(s => !['buyer','issuer'].includes(s)).join(',') : ''; env.XRPL_PAYER_SEED=seeds.buyer; for(const [slug,seed] of Object.entries(seeds)) if(!['buyer','issuer'].includes(slug)) env[`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-','_')}_SEED`]=seed }
  return env
}

export async function prepare(load = provision) { try { return { env: isolatedEnv(await load()), fallback: false } } catch (error) { return { env: isolatedEnv(), fallback: true, reason: error instanceof ProvisionError ? error.message : 'network or provisioning error' } } }
