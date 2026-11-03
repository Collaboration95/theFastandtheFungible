import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { validateManifest } from './release-contract.mjs'
const index = process.argv.indexOf('--manifest')
const manifest = resolve(index < 0 ? 'dist/release/manifest.json' : process.argv[index + 1])
validateManifest(JSON.parse(readFileSync(manifest)), dirname(manifest))
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH','HOME','TMPDIR','SYSTEMROOT'].includes(k)))
Object.assign(env, { DOTENV_CONFIG_PATH: '.no-release-env', LANGFUSE_ENABLED: '0', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '1000' })
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/release-consumers.ts', manifest], { env, stdio: 'inherit', timeout: 180000 })
