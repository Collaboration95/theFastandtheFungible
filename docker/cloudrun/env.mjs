// Writes the Cloud Run env file for scripts/cloudrun-deploy.sh: node docker/cloudrun/env.mjs <.env> <out.yaml>.
// Every name .env.example documents that .env sets, minus host-only names, plus the live-mode values scripts/demo.mjs
// sets for `make live`. Prints names only, never values.
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'
import { liveDecisionProvider } from '../../scripts/stage-checks.mjs'

const [envFile = '.env', outFile] = process.argv.slice(2)
if (!outFile) throw new Error('usage: node docker/cloudrun/env.mjs <.env> <out.yaml>')
const env = dotenv.parse(readFileSync(envFile))
// Commented names (# DEEPSEEK_API_KEY=) count as documented, as in make doctor.
const documented = new Set(readFileSync('.env.example', 'utf8').split('\n').map(line => line.match(/^#?\s*([A-Z0-9_]+)=/)?.[1]).filter(Boolean))
// Set by docker/cloudrun/start.mjs for the container, or by the live-mode block below.
const hostOnly = new Set(['HOST', 'PORT', 'PUBLISHER_PORT', 'PUBLISHER_URL', 'PUBLISHER_SECRET', 'APP_DB', 'PUBLISHER_DB', 'REPORT_DIR', 'DEMO_PORT_OFFSET',
  'LLM_PROVIDER', 'SETTLEMENT_RAIL', 'LANGFUSE_ENABLED', 'LANGFUSE_TRACING_ENVIRONMENT', 'PUBLISHER_FAULTS', 'SEARCH_EMBEDDINGS'])
const out = Object.fromEntries(Object.entries(env).filter(([name, value]) => documented.has(name) && !hostOnly.has(name) && value !== ''))
Object.assign(out, {
  LLM_PROVIDER: 'deepseek', SEARCH_EMBEDDINGS: env.SEARCH_EMBEDDINGS === 'off' ? 'off' : 'live', DECISION_PROVIDER: liveDecisionProvider(env.DECISION_PROVIDER),
  SETTLEMENT_RAIL: env.SETTLEMENT_RAIL || (env.XRPL_PAYER_SEED ? 'xrpl-testnet' : 'simulated'), LANGFUSE_ENABLED: env.LANGFUSE_ENABLED || '1',
  LANGFUSE_TRACING_ENVIRONMENT: env.LANGFUSE_TRACING_ENVIRONMENT || 'live', PUBLISHER_FAULTS: '0',
  // The publisher is only reachable on the container's loopback; a fresh secret per deploy.
  PUBLISHER_SECRET: randomBytes(24).toString('hex'),
})
writeFileSync(outFile, Object.entries(out).map(([name, value]) => `${name}: ${JSON.stringify(String(value))}`).join('\n') + '\n', { mode: 0o600 })
console.log(`${Object.keys(out).length} env vars: ${Object.keys(out).join(' ')}`)
console.log(`mode: ${out.LLM_PROVIDER} · decisions ${out.DECISION_PROVIDER} · ${out.SETTLEMENT_RAIL} · embeddings ${out.SEARCH_EMBEDDINGS} · langfuse ${out.LANGFUSE_ENABLED}`)
