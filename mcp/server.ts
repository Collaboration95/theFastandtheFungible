import { parseCommand, resolveStartup } from '../shared/startup-plan.js'
import { loadConfig } from '../server/config.js'
import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { startEngine } from '../server/engine.js'
import { startMcpHttp } from './http.js'
import { Store } from '../server/store.js'
import { createMcpServer } from './tools.js'

// A client can launch this entry from any directory; corpus paths stay repository-relative.
const root = fileURLToPath(new URL('..', import.meta.url))
process.chdir(root)
// `app` subcommand: zero-clone web app on the same engine (mcp/app.ts). Hermetic: never reads .env.
if (process.argv[2] === 'app') { await (await import('./app.js')).runApp(process.argv.slice(3)); process.exit() }
// Testnet mode never reads a local .env; the fixture engine gets only provisioned wallet material.
const testnet = process.argv.includes('--testnet')
if (process.argv.includes('--iou') && !testnet) throw new Error('--iou requires --testnet')
if (!testnet) dotenv.config({ path: resolve(root, '.env'), quiet: true })
let engine: Awaited<ReturnType<typeof startEngine>> | undefined
try {
  if (testnet && process.env.RA_BACKEND_URL) throw new Error('Testnet mode requires a local engine')
  const testnetModule = testnet ? await import('./testnet.js') : undefined
  const config = loadConfig()
  const plan = resolveStartup(config, parseCommand(process.argv.slice(2)))
  const dataDir = testnet ? plan.stateDir : resolve(config.RA_DATA_DIR ?? resolve(root, 'data/mcp'))
  // Testnet answers stdio `initialize` immediately and provisions wallets in the background; tools wait for it.
  const abort = new AbortController()
  const boot = async () => {
    const setup = await testnetModule?.prepareMcpTestnet(undefined, process.argv.includes('--iou') ? 'test-iou' : process.env.ESCROW_ASSET, abort.signal)
    engine = config.RA_BACKEND_URL ? undefined : await startEngine({ dataDir, live: !testnet && config.RA_LIVE === '1', env: setup?.env, signal: abort.signal })
    return { apiUrl: config.RA_BACKEND_URL || engine!.apiUrl, token: config.RA_API_TOKEN || engine?.apiToken, labels: setup?.labels }
  }
  const endpoint = testnet ? boot() : await boot()
  const server = createMcpServer(endpoint)
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    abort.abort()
    await server.close()
    await Promise.resolve(endpoint).catch(() => undefined)
    await engine?.close()
  }
  server.server.onclose = () => { void close().catch(() => { process.exitCode = 1 }) }
  process.once('SIGINT', () => { void close().catch(() => { process.exitCode = 1 }) })
  process.once('SIGTERM', () => { void close().catch(() => { process.exitCode = 1 }) })
  if (process.argv.includes('--http')) {
    if (config.RA_BACKEND_URL) throw new Error('HTTP host requires its local principal database')
    const store = new Store(resolve(dataDir, 'app.db'))
    const http = await startMcpHttp({ apiUrl: (await endpoint).apiUrl, store, port: plan.ports.http })
    const originalClose = server.close.bind(server)
    server.close = async () => { await http.close(); store.close(); await originalClose() }
    console.error(`ResearchAgent MCP listening at ${http.url}; agent bearer required`)
  } else await server.connect(new StdioServerTransport())
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Invalid configuration:') ? error.message : 'ResearchAgent MCP startup failed; check operator configuration. No credentials are logged.')
  await engine?.close().catch(() => undefined)
  process.exitCode = 1
}
