import { loadConfig } from '../server/config.js'
import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { startEngine } from '../server/engine.js'
import { createMcpServer } from './tools.js'

// A client can launch this entry from any directory; corpus paths stay repository-relative.
const root = fileURLToPath(new URL('..', import.meta.url))
process.chdir(root)
dotenv.config({ path: resolve(root, '.env'), quiet: true })
let engine: Awaited<ReturnType<typeof startEngine>> | undefined
try {
  const config = loadConfig()
  const dataDir = resolve(config.RA_DATA_DIR ?? resolve(root, 'data/mcp'))
  const apiUrl = config.RA_BACKEND_URL || (engine = await startEngine({ dataDir, live: config.RA_LIVE === '1' })).apiUrl
  const server = createMcpServer(apiUrl)
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    await server.close()
    await engine?.close()
  }
  server.server.onclose = () => { void close() }
  process.once('SIGINT', () => { void close() })
  process.once('SIGTERM', () => { void close() })
  await server.connect(new StdioServerTransport())
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Invalid configuration:') ? error.message : 'ResearchAgent MCP startup failed; check operator configuration. No credentials are logged.')
  await engine?.close()
  process.exitCode = 1
}
