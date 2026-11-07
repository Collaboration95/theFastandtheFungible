import { parseArgs } from 'node:util'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import { BUDGET } from './contracts/run.js'

export type CommandKind = 'stdio' | 'http' | 'app' | 'try' | 'init' | 'publish'
export function parseCommand(argv: string[]) {
  const explicit = ['stdio', 'http', 'app', 'try', 'init', 'publish'].includes(argv[0])
  let kind = (explicit ? argv[0] : argv.includes('--http') ? 'http' : 'stdio') as CommandKind
  const args = explicit ? argv.slice(1) : argv
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    testnet: { type: 'boolean' }, iou: { type: 'boolean' }, http: { type: 'boolean' }, open: { type: 'boolean' },
    port: { type: 'string' }, slug: { type: 'string' }, name: { type: 'string' }, rail: { type: 'string' }, relax: { type: 'boolean' }, help: { type: 'boolean' },
  } })
  if (values.http) kind = 'http'
  if (values.iou && !values.testnet) throw Error('--iou requires --testnet')
  const port = values.port === undefined ? undefined : Number(values.port)
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) throw Error('--port needs 0-65535')
  return { kind, options: { ...values, port, positionals } }
}

/** Operator env only. Explicit CLI port > mode default; RA_DATA_DIR > XDG > home.
 * No credentials, backend bearer, seeds or arbitrary environment values escape this plan.
 * Caps have no CLI/tool override. MCP defaults remain zero; try retains its demo caps.
 */
export function resolveStartup(env: NodeJS.ProcessEnv, command: ReturnType<typeof parseCommand>) {
  const config = env
  for (const name of ['MCP_MAX_BUDGET_MINOR', 'MCP_DAILY_CAP_MINOR', 'WALLET_DAILY_CAP_MINOR']) {
    const value = env[name]
    if (value !== undefined && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw Error(`Invalid configuration: ${name}`)
  }
  const { kind: mode, options } = command
  const base = env.XDG_STATE_HOME && isAbsolute(env.XDG_STATE_HOME) ? env.XDG_STATE_HOME : resolve(env.HOME || homedir(), '.local/state')
  const testnet = options.testnet === true
  const stateDir = resolve(config.RA_DATA_DIR ?? resolve(base, 'researchagent', testnet ? (mode === 'app' ? 'testnet/app' : 'testnet') : mode === 'app' ? 'app' : 'mcp'))
  return { mode, ports: { web: options.port ?? 0, api: 0, publisher: 0, http: options.port ?? (env.NODE_ENV === 'test' ? 0 : 9689) }, stateDir,
    caps: { maxMinor: Math.min(Number(config.MCP_MAX_BUDGET_MINOR ?? (mode === 'try' ? '200' : '0')), BUDGET.maxMinor), dailyMinor: Number(config.MCP_DAILY_CAP_MINOR ?? (mode === 'try' ? '500' : '0')), walletDailyMinor: Number(config.WALLET_DAILY_CAP_MINOR ?? (testnet || mode === 'try' ? '500' : '2000')) },
    labels: [testnet ? 'Testnet · no real value' : 'SIMULATED rail', ...(mode === 'app' || mode === 'try' || testnet ? ['Fixture models and fictional writers'] : [])] }
}
